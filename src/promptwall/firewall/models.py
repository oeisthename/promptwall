from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

Verdict = Literal["allow", "block", "sanitize"]
Severity = Literal["low", "medium", "high", "critical"]


class Signal(BaseModel):
    model_config = ConfigDict(frozen=True)

    rule_name: str
    category: str
    severity: Severity
    matched_text: str


class ScanResult(BaseModel):
    model_config = ConfigDict(frozen=True)

    verdict: Verdict
    signals: list[Signal]
