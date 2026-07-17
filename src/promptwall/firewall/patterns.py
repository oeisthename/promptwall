from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

Severity = Literal["low", "medium", "high", "critical"]


@dataclass(frozen=True)
class InjectionPattern:
    name: str
    category: str
    severity: Severity
    regex: re.Pattern[str]


BUILTIN_PATTERNS: list[InjectionPattern] = [
    InjectionPattern(
        name="instruction-override",
        category="instruction-injection",
        severity="critical",
        regex=re.compile(
            r"(ignore|disregard|forget)\s+(all\s+|any\s+|your\s+)?"
            r"(previous|prior|above|earlier)?\s*(instructions?|prompts?|rules?)"
        ),
    ),
    InjectionPattern(
        name="fake-system-tag",
        category="context-breaking",
        severity="critical",
        regex=re.compile(
            r"(<\|(im_start|im_end|system|endoftext)\|>|\[/?(inst|sys)\]|###\s*system\s*:)"
        ),
    ),
    InjectionPattern(
        name="credential-harvest-request",
        category="exfiltration",
        severity="critical",
        regex=re.compile(
            r"(reveal|print|output|show)\s+(your\s+)?(system prompt|api key|credentials?|secrets?)"
        ),
    ),
    InjectionPattern(
        name="role-hijack",
        category="instruction-injection",
        severity="high",
        regex=re.compile(
            r"(you are now|pretend (that )?you (are|have)|act as (an?|the))\s*"
            r".{0,20}(unrestricted|unfiltered|jailbroken|no rules|"
            r"no restrictions|developer mode|admin mode)"
        ),
    ),
    InjectionPattern(
        name="exfiltration-request",
        category="exfiltration",
        severity="high",
        regex=re.compile(
            r"(send|email|post|upload|exfiltrate)\s+(this|the|all)\s+"
            r"(data|information|content|file|secrets?)s?\s+to\b"
        ),
    ),
    InjectionPattern(
        name="hidden-html-comment-instruction",
        category="hidden-content",
        severity="medium",
        regex=re.compile(r"<!--.*?(ignore|instruction|system|admin).*?-->", re.DOTALL),
    ),
]
