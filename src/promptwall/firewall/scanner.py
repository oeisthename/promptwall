from __future__ import annotations

from promptwall.firewall.models import ScanResult, Signal, Verdict
from promptwall.firewall.patterns import BUILTIN_PATTERNS
from promptwall.firewall.redaction import sanitize_content
from promptwall.firewall.semantic import score_content
from promptwall.firewall.severity import SEVERITY_THRESHOLDS
from promptwall.firewall.text_normalize import normalize

_SNIPPET_MAX_LEN = 60


class InputFirewall:
    """Two detection layers, combined into one ScanResult per scan():

    1. Pattern-based (patterns.py) — exact known injection signatures.
    2. Semantic heuristic (semantic.py) — structural/directive-language
       scoring that can catch novel phrasing the literal patterns miss.

    Both layers run on every scan; their signals are merged, and the
    final verdict is based on whether any signal survived the configured
    sensitivity threshold. In sanitize mode, a real redacted copy of the
    content is computed (see redaction.py) and attached to the result as
    sanitized_content, ready to forward in place of the original.
    """

    def __init__(self, mode: str = "block", sensitivity: str = "medium") -> None:
        self.mode = mode
        self.sensitivity = sensitivity

    def scan(self, content: str) -> ScanResult:
        active_severities = SEVERITY_THRESHOLDS[self.sensitivity]
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

        finding = score_content(normalized)
        if finding.severity is not None and finding.severity in active_severities:
            signals.append(
                Signal(
                    rule_name="semantic-directive-override",
                    category="semantic-heuristic",
                    severity=finding.severity,
                    matched_text="matched: " + ", ".join(finding.matched_categories),
                )
            )

        if not signals:
            return ScanResult(verdict="allow", signals=[])

        verdict: Verdict = "block" if self.mode == "block" else "sanitize"
        sanitized_content = (
            sanitize_content(content, self.sensitivity) if verdict == "sanitize" else None
        )
        return ScanResult(verdict=verdict, signals=signals, sanitized_content=sanitized_content)
