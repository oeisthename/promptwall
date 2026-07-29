"""Turns a firewall detection into an actual redacted copy of the content.

Detection (scanner.py) answers "should this be blocked/sanitized?".
This module answers the follow-up question sanitize mode actually needs
answered: "what does the safe-to-forward version of this content look
like?"

Matching happens on normalized text (evasion-resistant — see
text_normalize.py), but replacement happens on the ORIGINAL content via
normalize_with_spans()'s position mapping, so an obfuscated phrase (mixed
case, extra whitespace, embedded zero-width characters) gets fully
redacted in the original text, not left intact because the redaction pass
only re-matched a raw, un-normalized string.
"""

from __future__ import annotations

from promptwall.firewall.patterns import BUILTIN_PATTERNS
from promptwall.firewall.semantic import (
    _AI_META_REFERENCE,
    _AUTHORITY_OVERRIDE,
    _DIRECTIVE_LANGUAGE,
    score_content,
)
from promptwall.firewall.severity import SEVERITY_THRESHOLDS
from promptwall.firewall.text_normalize import normalize_with_spans

_REDACTION_MARKER = "[REDACTED]"
# Deliberately a fixed string with no rule-name interpolation. Rule names
# (e.g. "instruction-override", "semantic-directive-override") are chosen
# to be human-readable descriptions of what they detect, which means they
# necessarily share vocabulary with the trigger words themselves
# ("instruction", "override"). A marker like "[REDACTED:instruction-override]"
# re-triggers the semantic layer's ai-meta-reference/authority-override
# patterns on the very next scan — confirmed by testing this against a
# re-scan of the sanitized output before settling on this fixed marker.
# The rule name that fired is still available on ScanResult.signals for
# anyone who needs that detail; it doesn't need to be duplicated in the
# redacted text itself.


def _find_redaction_spans(normalized: str, sensitivity: str) -> list[tuple[int, int, str]]:
    """Find (start, end, rule_name) spans in `normalized` text that should
    be redacted. Mirrors InputFirewall.scan()'s detection logic exactly —
    same severity threshold, same two layers — so redaction only ever
    touches text that would actually have been flagged.
    """
    active_severities = SEVERITY_THRESHOLDS[sensitivity]
    spans: list[tuple[int, int, str]] = []

    for pattern in BUILTIN_PATTERNS:
        if pattern.severity not in active_severities:
            continue
        for match in pattern.regex.finditer(normalized):
            spans.append((match.start(), match.end(), pattern.name))

    finding = score_content(normalized)
    if finding.severity is not None and finding.severity in active_severities:
        # Only redact spans belonging to categories that were actually part
        # of the flagged finding. authority-override is always present when
        # anything is flagged (score_content's own rule); directive-language
        # and/or ai-meta-reference are included only if they co-occurred.
        # This mirrors score_content()'s flagging rule exactly, so
        # redaction never touches a sentence that, on its own (without
        # override phrasing), would have been ordinary technical writing —
        # the same false-positive boundary test_semantic.py already locks in.
        category_regexes = (
            ("authority-override", _AUTHORITY_OVERRIDE),
            ("directive-language", _DIRECTIVE_LANGUAGE),
            ("ai-meta-reference", _AI_META_REFERENCE),
        )
        for category, regex in category_regexes:
            if category not in finding.matched_categories:
                continue
            for match in regex.finditer(normalized):
                spans.append((match.start(), match.end(), "semantic-directive-override"))

    return spans


def _merge_spans(spans: list[tuple[int, int, str]]) -> list[tuple[int, int, str]]:
    """Merge overlapping or touching spans into one, keeping the first rule
    name seen. Needed because the literal-pattern layer and the semantic
    layer can flag overlapping ranges of the same text; replacing both
    independently without merging would corrupt positions.
    """
    if not spans:
        return []
    spans_sorted = sorted(spans, key=lambda s: s[0])
    merged: list[tuple[int, int, str]] = [spans_sorted[0]]
    for start, end, rule in spans_sorted[1:]:
        last_start, last_end, last_rule = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end), last_rule)
        else:
            merged.append((start, end, rule))
    return merged


def sanitize_content(content: str, sensitivity: str) -> str:
    """Return a redacted copy of `content` with every span that would
    trigger a firewall signal (at the given sensitivity) replaced by a
    `[REDACTED:<rule>]` marker.

    Returns `content` unchanged if nothing would be flagged.
    """
    normalized, origin_spans = normalize_with_spans(content)
    if not origin_spans:
        return content

    spans = _find_redaction_spans(normalized, sensitivity)
    if not spans:
        return content

    original_spans: list[tuple[int, int, str]] = []
    for start, end, rule in spans:
        if start < 0 or end - 1 >= len(origin_spans) or end <= start:
            continue  # defensive: matches should always be in-bounds
        orig_start = origin_spans[start][0]
        orig_end = origin_spans[end - 1][1]
        original_spans.append((orig_start, orig_end, rule))

    if not original_spans:
        return content

    merged = _merge_spans(original_spans)
    merged.sort(key=lambda s: s[0], reverse=True)

    result = content
    for orig_start, orig_end, _rule in merged:
        result = result[:orig_start] + _REDACTION_MARKER + result[orig_end:]

    return result
