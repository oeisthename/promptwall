"""Match-expression parsing and evaluation for PromptWall policy rules.

See docs/POLICY_REFERENCE.md for the supported grammar.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

_TWO_WORD_OPERATORS = {"not in", "not contains", "not startswith"}
_ONE_WORD_OPERATORS = {"in", "contains", "startswith", "==", "!="}
_ALL_OPERATORS = _TWO_WORD_OPERATORS | _ONE_WORD_OPERATORS


@dataclass(frozen=True)
class Condition:
    field: str
    operator: str
    value: str


def parse_match_expression(expr: str) -> Condition:
    tokens = expr.split()
    if len(tokens) < 3:
        raise ValueError(f"Malformed match expression: {expr!r}")

    field = tokens[0]

    if tokens[1] == "not" and len(tokens) >= 4:
        operator = f"not {tokens[2]}"
        value_tokens = tokens[3:]
    else:
        operator = tokens[1]
        value_tokens = tokens[2:]

    if not value_tokens:
        raise ValueError(f"Malformed match expression, missing value: {expr!r}")

    value = " ".join(value_tokens).strip('"')

    if operator not in _ALL_OPERATORS:
        raise ValueError(f"Unsupported operator {operator!r} in: {expr!r}")

    return Condition(field=field, operator=operator, value=value)


def _resolve_field(field: str, tool_call: dict[str, object], output: str | None) -> object:
    if field == "output":
        return output
    if field.startswith("tool_call."):
        key = field.split(".", 1)[1]
        return tool_call.get(key)
    raise ValueError(f"Unknown field reference: {field!r}")


def _resolve_allowlist(definitions: dict[str, object]) -> list[str]:
    allowlist = definitions.get("allowlist", [])
    if not isinstance(allowlist, list):
        raise TypeError("definitions.allowlist must be a list")
    return [str(item) for item in allowlist]


def _resolve_pattern(definitions: dict[str, object], name: str) -> str:
    patterns = definitions.get("patterns", {})
    if not isinstance(patterns, dict):
        raise TypeError("definitions.patterns must be a dict")
    return str(patterns[name])


def evaluate_condition(
    condition: Condition,
    tool_call: dict[str, object],
    output: str | None,
    definitions: dict[str, object],
) -> bool:
    field_value = _resolve_field(condition.field, tool_call, output)
    if field_value is None:
        return False

    op = condition.operator
    is_pattern = condition.value.startswith("pattern:")
    is_allowlist = condition.value == "allowlist"

    if op in ("in", "not in") and condition.field == "tool_call.url":
        # Allowlists are hostnames; a tool_call.url is a full URL. Compare the
        # actual parsed hostname, never a raw substring match (a raw substring
        # check would let "fakeapi.partner.com" pass an "api.partner.com"
        # allowlist). A URL that fails to parse a hostname resolves to the
        # string "None", which matches nothing -> fails closed (blocked).
        field_value = urlparse(str(field_value)).hostname

    field_str = str(field_value)

    if op in ("in", "not in"):
        candidates = _resolve_allowlist(definitions) if is_allowlist else [condition.value]
        is_member = field_str in candidates
        return is_member if op == "in" else not is_member

    if op in ("contains", "not contains"):
        if condition.value.startswith("dlp:"):
            entities = condition.value.split(":", 1)[1].split(",")
            entities = [e.strip() for e in entities if e.strip()]
            from promptwall.policy.dlp import PresidioWrapper

            dlp_wrapper = PresidioWrapper.get_instance()
            results = dlp_wrapper.analyze(field_str, entities)
            found = len(results) > 0
            if found:
                # We stash the results directly onto the condition object temporarily
                # so the engine can pick them up. This is a bit of a hack but avoids
                # changing the evaluate_condition signature.
                condition._dlp_results = results  # type: ignore[attr-defined]
            return found if op == "contains" else not found
        elif is_pattern:
            pattern = _resolve_pattern(definitions, condition.value.split(":", 1)[1])
            found = re.search(pattern, field_str) is not None
        else:
            found = condition.value in field_str
        return found if op == "contains" else not found

    if op == "startswith":
        return field_str.startswith(condition.value)
    if op == "not startswith":
        return not field_str.startswith(condition.value)
    if op == "==":
        return field_str == condition.value
    if op == "!=":
        return field_str != condition.value

    raise ValueError(f"Unsupported operator: {op!r}")
