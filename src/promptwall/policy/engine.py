"""Policy loading, validation, and enforcement."""

from __future__ import annotations

from pathlib import Path

import yaml

from promptwall.policy.matcher import Condition, evaluate_condition, parse_match_expression
from promptwall.policy.schema import Policy, Rule


class PolicyEngine:
    """Loads a YAML policy file and evaluates tool calls against it.

    Rules are evaluated in the order they appear in the policy file; the
    first rule whose match expression evaluates to true determines the
    action (first-match-wins). If no rule matches, the default action is
    "allow".

    Match expressions and policy structure are validated once, at load
    time (see promptwall.policy.schema.Policy) — evaluate() assumes the
    loaded policy is already well-formed.
    """

    def __init__(self, policy: Policy) -> None:
        self.policy = policy
        self.agent = policy.agent
        self.rules: list[Rule] = policy.rules
        self._conditions: list[Condition] = [
            parse_match_expression(rule.match) for rule in policy.rules
        ]
        self._definitions: dict[str, object] = policy.definitions.model_dump()

    @classmethod
    def from_file(cls, path: str) -> PolicyEngine:
        policy_path = Path(path)
        with policy_path.open("r", encoding="utf-8") as f:
            raw_policy = yaml.safe_load(f)
        policy = Policy.model_validate(raw_policy)
        return cls(policy)

    def evaluate(
        self, tool_call: dict[str, object], output: str | None = None
    ) -> dict[str, object]:
        """Evaluate a tool call (and optional output content) against the
        loaded rules and return a decision.

        `tool_call` fields are referenced in match expressions as
        `tool_call.<field>` (e.g. `tool_call.url`). `output` is referenced
        directly as `output` and represents content the agent is about to
        emit or write.
        """
        for rule, condition in zip(self.rules, self._conditions, strict=True):
            if evaluate_condition(condition, tool_call, output, self._definitions):
                return {
                    "action": rule.action,
                    "matched_rule": rule.name,
                    "severity": rule.severity,
                    "tool_call": tool_call,
                }

        return {"action": "allow", "matched_rule": None, "severity": None, "tool_call": tool_call}
