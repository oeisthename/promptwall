"""Text normalization for evasion-resistant detection AND redaction.

normalize() is the existing evasion-resistant transform: strip zero-width
characters, collapse whitespace runs, lowercase. Detection (scanner.py) has
always run against this normalized form so obfuscated evasion attempts
(mixed case, extra spacing, invisible Unicode) still get caught.

normalize_with_spans() does the same transform but additionally returns,
for every character in the normalized output, the exact span of the
ORIGINAL string that produced it. This is what makes real redaction
possible: a regex match found against normalized text can be mapped back
to a precise span in the original text, so redaction removes the entire
original (possibly obfuscated) phrase rather than only its normalized
form. Without this mapping, redaction would have to choose between
operating on normalized text (destroying the original's casing/formatting
for content that has nothing wrong with it) or re-matching raw text
(which is exactly what the evasion tricks defeat).

normalize() is defined in terms of normalize_with_spans() specifically so
the two can never drift apart — there is only one implementation of what
"normalized" means, detection and redaction both consume it identically.
"""

from __future__ import annotations

_ZERO_WIDTH_CHARS = "\u200b\u200c\u200d\ufeff"


def normalize_with_spans(content: str) -> tuple[str, list[tuple[int, int]]]:
    """Return (normalized_text, origin_spans).

    origin_spans[i] is the half-open (start, end) span in the ORIGINAL
    `content` that produced normalized_text[i]. For an ordinary character
    this is a single-character span; for the single space inserted between
    two tokens (replacing a run of one or more original whitespace
    characters), it's the full span of that original whitespace run, so a
    match ending or starting on that joining space still maps to a
    sensible original-text boundary.
    """
    # Stage 1: drop zero-width characters, remembering each surviving
    # character's original index.
    stage1_chars: list[str] = []
    stage1_to_original: list[int] = []
    for original_index, ch in enumerate(content):
        if ch in _ZERO_WIDTH_CHARS:
            continue
        stage1_chars.append(ch)
        stage1_to_original.append(original_index)
    stage1_text = "".join(stage1_chars)

    # Stage 2: find token spans (runs of non-whitespace) within stage1_text.
    tokens: list[tuple[int, int]] = []
    i = 0
    n = len(stage1_text)
    while i < n:
        if stage1_text[i].isspace():
            i += 1
            continue
        start = i
        while i < n and not stage1_text[i].isspace():
            i += 1
        tokens.append((start, i))

    # Stage 3: join tokens with a single space each, lowercasing, tracking
    # the original-content span behind every output character.
    normalized_chars: list[str] = []
    origin_spans: list[tuple[int, int]] = []
    for token_index, (tok_start, tok_end) in enumerate(tokens):
        if token_index > 0:
            prev_tok_end = tokens[token_index - 1][1]
            gap_start = stage1_to_original[prev_tok_end - 1] + 1
            gap_end = stage1_to_original[tok_start]
            normalized_chars.append(" ")
            origin_spans.append((gap_start, gap_end))
        for stage1_index in range(tok_start, tok_end):
            normalized_chars.append(stage1_text[stage1_index].lower())
            original_index = stage1_to_original[stage1_index]
            origin_spans.append((original_index, original_index + 1))

    return "".join(normalized_chars), origin_spans


def normalize(content: str) -> str:
    """Strip common evasion tricks before pattern matching.

    - Zero-width Unicode characters can be inserted between letters to
      break a literal regex match while looking identical when rendered.
    - Collapsing whitespace defeats spacing tricks like
      "IGNORE    PREVIOUS   INSTRUCTIONS".
    - Lowercasing means every pattern only needs to be written once.
    """
    return normalize_with_spans(content)[0]
