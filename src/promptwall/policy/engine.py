"""Policy loading, validation, and enforcement."""

from __future__ import annotations

from pathlib import Path

import yaml


class PolicyEngine:
    """Loads a YAML policy file and evaluates tool calls against it.

    This is an early stub. The real match-expression evaluator, schema
    validation, and rule actions (allow/block/redact/require_approval) will
    be implemented during Weeks 1-3 of the build (see docs/ARCHITECTURE.md).
    """

    def __init__(self, raw_policy: dict[str, object]) -> None:
        self.raw_policy = raw_policy
        self.agent = raw_policy.get("agent")
        self.rules = raw_policy.get("rules", [])

    @classmethod
    def from_file(cls, path: str) -> PolicyEngine:
        policy_path = Path(path)
        with policy_path.open("r", encoding="utf-8") as f:
            raw_policy = yaml.safe_load(f)
        return cls(raw_policy)

    def evaluate(self, tool_call: dict[str, object]) -> dict[str, object]:
        """Evaluate a tool call against the loaded rules.

        Placeholder implementation: always allows. Real rule evaluation
        (match expressions, severity, actions) lands in a follow-up PR.
        """
        return {"action": "allow", "matched_rule": None, "tool_call": tool_call}
