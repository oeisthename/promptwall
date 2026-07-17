from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

Severity = Literal["high", "critical"]

_DIRECTIVE_LANGUAGE = re.compile(
    r"\byou\s+(must|should|will|need to|have to|shall|are now)\b"
    r"|(?:^|[.!?,;:]\s*)(please\s+)?(ignore|disregard|forget|override|bypass|"
    r"reveal|print|output|send|email|post|upload|execute|delete|act|pretend|"
    r"become|assume|disable|comply|obey|follow)\b",
    re.MULTILINE,
)

_AI_META_REFERENCE = re.compile(
    r"\b(instructions?|system prompt|prompts?|rules?|guidelines?|directives?|"
    r"restrictions?|programming|training data|your training)\b"
)

_AUTHORITY_OVERRIDE = re.compile(
    r"\b(no matter what|regardless of|without (any )?restrictions?|"
    r"new (instructions?|rules?|directives?)|override(s|d|n|ing)?|supersedes?|"
    r"from now on|original (programming|instructions?))\b"
)


@dataclass(frozen=True)
class SemanticFinding:
    matched_categories: tuple[str, ...]
    severity: Severity | None  # None means "not suspicious enough to flag"


def score_content(normalized_content: str) -> SemanticFinding:
    categories: list[str] = []
    if _DIRECTIVE_LANGUAGE.search(normalized_content):
        categories.append("directive-language")
    if _AI_META_REFERENCE.search(normalized_content):
        categories.append("ai-meta-reference")
    if _AUTHORITY_OVERRIDE.search(normalized_content):
        categories.append("authority-override")

    has_override = "authority-override" in categories
    has_support = "directive-language" in categories or "ai-meta-reference" in categories

    severity: Severity | None
    if has_override and "directive-language" in categories and "ai-meta-reference" in categories:
        severity = "critical"
    elif has_override and has_support:
        severity = "high"
    else:
        severity = None

    return SemanticFinding(matched_categories=tuple(categories), severity=severity)
