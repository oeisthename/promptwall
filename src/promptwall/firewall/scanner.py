from __future__ import annotations

from promptwall.firewall.models import ScanResult, Signal, Verdict
from promptwall.firewall.patterns import BUILTIN_PATTERNS

_ZERO_WIDTH_CHARS = "\u200b\u200c\u200d\ufeff"

_SEVERITY_THRESHOLDS: dict[str, set[str]] = {
    "low": {"critical"},
    "medium": {"critical", "high"},
    "high": {"critical", "high", "medium"},
}

_SNIPPET_MAX_LEN = 60


def normalize(content: str) -> str:
    """Strip common evasion tricks before pattern matching.

    - Zero-width Unicode characters can be inserted between letters to
      break a literal regex match while looking identical when rendered.
    - Collapsing whitespace defeats spacing tricks like
      "IGNORE    PREVIOUS   INSTRUCTIONS".
    - Lowercasing means every pattern only needs to be written once.
    """
    for ch in _ZERO_WIDTH_CHARS:
        content = content.replace(ch, "")
    content = " ".join(content.split())
    return content.lower()


class InputFirewall:
    def __init__(self, mode: str = "block", sensitivity: str = "medium") -> None:
        self.mode = mode
        self.sensitivity = sensitivity

    def scan(self, content: str) -> ScanResult:
        active_severities = _SEVERITY_THRESHOLDS[self.sensitivity]
        normalized = normalize(content)

        signals: list[Signal] = []
        for pattern in BUILTIN_PATTERNS:
            if pattern.severity not in active_severities:
                continue
            match = pattern.regex.search(normalized)
            if match:
                start = max(match.start() - 15, 0)
                end = min(match.end() + 15, len(normalized))
                snippet = normalized[start:end][:_SNIPPET_MAX_LEN]
                signals.append(
                    Signal(
                        rule_name=pattern.name,
                        category=pattern.category,
                        severity=pattern.severity,
                        matched_text=snippet,
                    )
                )

        if not signals:
            return ScanResult(verdict="allow", signals=[])

        verdict: Verdict = "block" if self.mode == "block" else "sanitize"
        return ScanResult(verdict=verdict, signals=signals)
