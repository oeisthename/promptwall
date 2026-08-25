"""The Enforcer — combines the Input Firewall and Policy Engine into one
enforce() call.

See docs/ARCHITECTURE.md, "Data flow for a single tool call": the firewall
scans content first, the policy engine checks the tool call second, and a
single combined decision comes out. This module is that combinator.

Direction-agnostic by design: `content` may represent inbound content the
agent is about to read (a fetched page, a tool result) or outbound content
the agent is about to emit (a file write). The Enforcer doesn't need to
know which — it runs both checks against whatever content it's given. The
MCP proxy (Phase 3, part 2) decides what `content` means at each call site
by choosing when to call enforce().
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal, cast

if TYPE_CHECKING:
    from promptwall.client import PromptWallClient

import yaml
from pydantic import BaseModel, ConfigDict

from promptwall.firewall.models import ScanResult
from promptwall.firewall.scanner import InputFirewall
from promptwall.policy.engine import PolicyEngine
from promptwall.policy.schema import Policy

Action = Literal["allow", "block", "redact", "sanitize", "require_approval"]

# Worst-wins precedence across the two sub-systems' differing action
# vocabularies. Lower number = more severe = wins.
_ACTION_PRECEDENCE: dict[Action, int] = {
    "block": 0,
    "require_approval": 1,
    "redact": 2,
    "sanitize": 2,
    "allow": 3,
}


class EnforcementDecision(BaseModel):
    """The single combined decision returned by Enforcer.enforce().

    Keeps both sub-results intact (not just the final `action`) so that
    the Phase 4 audit ledger can record the full detail of what fired,
    not just the final verb.

    Contract for callers deciding what to forward:
    - action == "allow": forward the original `content` unchanged.
    - action in ("redact", "sanitize"): forward `sanitized_content`
      instead of the original — it is guaranteed non-None and guaranteed
      different from the original whenever one of these two actions is
      reported (see Enforcer.enforce()'s fail-closed check).
    - action in ("block", "require_approval"): don't forward anything.
    """

    model_config = ConfigDict(frozen=True)

    action: Action
    reason: str
    firewall_result: ScanResult | None
    policy_result: dict[str, object]
    tool_call: dict[str, object]
    sanitized_content: str | None = None


def _firewall_action(scan_result: ScanResult | None) -> Action:
    """Map a firewall verdict onto the shared Action vocabulary.

    A `None` scan_result means no content was scanned (no `content` was
    passed to enforce()) — that's not the same as "allow"; it means the
    firewall had nothing to say, so it must never be able to out-vote the
    policy engine. We give it the least severe rank ("allow") precisely
    because "no opinion" and "explicitly allowed" behave identically in
    a worst-wins comparison: neither should ever win over an actual
    block/redact/require_approval from the other side.
    """
    if scan_result is None:
        return "allow"
    if scan_result.verdict == "block":
        return "block"
    if scan_result.verdict == "sanitize":
        return "sanitize"
    return "allow"


def _combine(firewall_action: Action, policy_action: Action) -> Action:
    """Worst-wins: whichever action ranks more severe in _ACTION_PRECEDENCE
    determines the overall action.

    A rank tie currently only happens between "redact" (policy) and
    "sanitize" (firewall) — both rank 2. When that happens, the firewall's
    action wins deterministically: this function is only ever called as
    _combine(firewall_action, policy_action), in that fixed order, so the
    tie-break just needs to be deterministic, not symmetric. Firewall wins
    the tie because it's reading raw content directly, rather than a
    policy-derived label of that content.
    """
    if _ACTION_PRECEDENCE[firewall_action] <= _ACTION_PRECEDENCE[policy_action]:
        return firewall_action
    return policy_action


def _build_reason(scan_result: ScanResult | None, policy_result: dict[str, object]) -> str:
    """Merge both sub-results into one human-readable reason string.

    Lists every signal/rule that fired, not just the one that determined
    the final action — a call can be blocked by policy while the firewall
    also flagged something lower-severity, and that context matters for
    a human reviewing the decision later.
    """
    parts: list[str] = []

    if scan_result is not None and scan_result.signals:
        signal_names = ", ".join(signal.rule_name for signal in scan_result.signals)
        parts.append(f"firewall[{scan_result.verdict}]: {signal_names}")

    matched_rule = policy_result.get("matched_rule")
    if matched_rule is not None:
        parts.append(f"policy[{policy_result.get('action')}]: {matched_rule}")

    if not parts:
        return "no rules or signals matched; default allow"

    return "; ".join(parts)


def _apply_policy_redaction(text: str, policy_result: dict[str, object]) -> str:
    """Apply the policy's redact_pattern (see PolicyEngine.evaluate()) to
    `text`, replacing every match with a fixed marker. Returns `text`
    unchanged if the decision isn't a redact action, or if it is but
    there's no resolvable pattern to redact with (e.g. a redact rule that
    matched on a tool_call field rather than output — nothing textual to
    redact in that case).
    """
    if policy_result.get("action") != "redact":
        return text
    pattern = policy_result.get("redact_pattern")
    if not isinstance(pattern, str):
        return text
    return re.sub(pattern, "[REDACTED]", text)


def _build_sanitized_content(
    content: str | None, scan_result: ScanResult | None, policy_result: dict[str, object]
) -> str | None:
    """Build the safe-to-forward version of `content`, chaining both
    sub-systems' mutations when both fire.

    Order: firewall sanitization first, then policy redaction applied to
    the already-sanitized result — consistent with the same "firewall
    wins ties" precedent from _combine(), since the firewall is reading
    raw content directly rather than a policy-derived label of it.

    Returns None if content is None (nothing to sanitize) or if neither
    sub-system produced a mutation-type action.
    """
    if content is None:
        return None

    mutated = content
    changed = False

    if (
        scan_result is not None
        and scan_result.verdict == "sanitize"
        and scan_result.sanitized_content is not None
    ):
        mutated = scan_result.sanitized_content
        changed = True

    if policy_result.get("action") == "redact":
        dlp_results = cast(list[Any], policy_result.get("dlp_results"))
        if dlp_results:
            from promptwall.policy.dlp import PresidioWrapper

            redacted = PresidioWrapper.get_instance().anonymize(mutated, dlp_results)
        else:
            redacted = _apply_policy_redaction(mutated, policy_result)

        if redacted != mutated:
            changed = True
        mutated = redacted

    return mutated if changed else None


class Enforcer:
    """Combines InputFirewall.scan() and PolicyEngine.evaluate() into one
    enforce() call, per the "Data flow for a single tool call" section of
    docs/ARCHITECTURE.md: firewall scans content first, policy checks the
    tool call second, and a single combined decision is returned.

    Both checks always run — even if the firewall already blocks — so the
    combined decision (and later, the audit ledger entry) reflects every
    signal that fired, not just the first one found.
    """

    def __init__(self, policy_engine: PolicyEngine, firewall: InputFirewall) -> None:
        self.policy_engine = policy_engine
        self.firewall = firewall

    @classmethod
    def from_file(cls, path: str) -> Enforcer:
        """Build an Enforcer from a single policy YAML file.

        The Input Firewall is configured from the policy's `input_firewall`
        block (mode + sensitivity). If a policy omits that block, we default
        to mode="block", sensitivity="medium" rather than skipping content
        scanning — fail-closed, consistent with the allowlist-bypass fix in
        Phase 1: an unconfigured firewall is a silent gap, not a safe default.
        """
        policy_path = Path(path)
        with policy_path.open("r", encoding="utf-8") as f:
            raw_policy = yaml.safe_load(f)
        policy = Policy.model_validate(raw_policy)

        policy_engine = PolicyEngine(policy)

        if policy.input_firewall is not None:
            firewall = InputFirewall(
                mode=policy.input_firewall.mode,
                sensitivity=policy.input_firewall.sensitivity,
            )
        else:
            firewall = InputFirewall(mode="block", sensitivity="medium")

        return cls(policy_engine, firewall)

    @classmethod
    def from_api(cls, client: PromptWallClient, environment: str = "production") -> Enforcer:
        """Build an Enforcer from a remote API policy."""
        policy_engine = PolicyEngine.from_api(client, environment=environment)
        policy = policy_engine.policy

        if policy.input_firewall is not None:
            firewall = InputFirewall(
                mode=policy.input_firewall.mode,
                sensitivity=policy.input_firewall.sensitivity,
            )
        else:
            firewall = InputFirewall(mode="block", sensitivity="medium")

        return cls(policy_engine, firewall)

    def enforce(
        self, tool_call: dict[str, object], content: str | None = None
    ) -> EnforcementDecision:
        """Evaluate a tool call (and optional content) against both the
        Input Firewall and the Policy Engine, and return one combined
        decision.

        `content` is direction-agnostic: it may be inbound content the
        agent is about to read, or outbound content it's about to emit.
        The caller (the MCP proxy, in Phase 3 part 2) decides what to pass
        and when. If `content` is None, only the policy check runs — the
        firewall has nothing to scan.
        """
        scan_result = self.firewall.scan(content) if content is not None else None
        policy_result = self.policy_engine.evaluate(tool_call, output=content)

        firewall_action = _firewall_action(scan_result)
        # PolicyEngine.evaluate() always returns one of the four Action
        # literals in its "action" key (schema.py's Action type); the cast
        # just narrows the untyped dict[str, object] return shape.
        policy_action = cast(Action, policy_result["action"])

        combined_action = _combine(firewall_action, policy_action)
        reason = _build_reason(scan_result, policy_result)
        sanitized_content = _build_sanitized_content(content, scan_result, policy_result)

        # Fail-closed safety net: if the combined action is "redact" or
        # "sanitize" but nothing was actually changed (sanitized_content is
        # None, or — belt and braces — identical to the original), forwarding
        # it would mean silently passing through content a signal said was
        # unsafe, under a label that implies it was made safe. This
        # shouldn't normally happen given the invariants in scanner.py and
        # redaction.py (a "sanitize" verdict always has at least one
        # locatable span; a "redact" action only fires when its pattern
        # actually matched), but a security tool shouldn't rely on
        # "shouldn't" — escalate to block instead of forwarding unmodified
        # flagged content.
        if combined_action in ("redact", "sanitize") and (
            sanitized_content is None or sanitized_content == content
        ):
            combined_action = "block"
            reason = f"{reason}; sanitization produced no change, escalated to block"
            sanitized_content = None

        return EnforcementDecision(
            action=combined_action,
            reason=reason,
            firewall_result=scan_result,
            policy_result=policy_result,
            tool_call=tool_call,
            sanitized_content=sanitized_content,
        )
