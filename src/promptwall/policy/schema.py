"""Pydantic schema for PromptWall policy YAML files.

Validates a policy at load time so a malformed policy fails loudly at
startup, not silently during enforcement. Deliberately strict:
- extra="forbid" everywhere: a typo'd field (e.g. "sevirity") must raise,
  not be silently dropped.
- regex patterns are compiled at load time, so a broken SECRET_PATTERN
  fails on startup, not on the first tool call that happens to trigger it.
- match expressions are parsed (not just stored as strings) at load time,
  using the same parser the engine evaluates with later, so a malformed
  match expression is caught before it ever reaches evaluate().
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from promptwall.policy.matcher import parse_match_expression

Action = Literal["allow", "block", "redact", "require_approval"]
Severity = Literal["low", "medium", "high", "critical"]
Plane = Literal["output"]


class Definitions(BaseModel):
    model_config = ConfigDict(extra="forbid")

    allowlist: list[str] = Field(default_factory=list)
    patterns: dict[str, str] = Field(default_factory=dict)

    @field_validator("patterns")
    @classmethod
    def patterns_must_compile(cls, patterns: dict[str, str]) -> dict[str, str]:
        for name, pattern in patterns.items():
            try:
                re.compile(pattern)
            except re.error as exc:
                raise ValueError(f"Pattern {name!r} is not a valid regex: {exc}") from exc
        return patterns


class Rule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    plane: Plane
    match: str
    action: Action
    severity: Severity

    @field_validator("match")
    @classmethod
    def match_must_parse(cls, match: str) -> str:
        parse_match_expression(match)  # raises ValueError if malformed
        return match


class InputFirewallConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mode: Literal["block", "sanitize"] = "block"
    sensitivity: Literal["low", "medium", "high"] = "medium"


class LimitsConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requests_per_minute: int = Field(default=0)


class Policy(BaseModel):
    model_config = ConfigDict(extra="forbid")

    agent: str
    definitions: Definitions = Field(default_factory=Definitions)
    input_firewall: InputFirewallConfig | None = None
    limits: LimitsConfig | None = None
    rules: list[Rule] = Field(default_factory=list)

    @field_validator("rules")
    @classmethod
    def rule_names_must_be_unique(cls, rules: list[Rule]) -> list[Rule]:
        seen: set[str] = set()
        for rule in rules:
            if rule.name in seen:
                raise ValueError(f"Duplicate rule name: {rule.name!r}")
            seen.add(rule.name)
        return rules
