"""Property-based tests for the Enforcer's precedence invariant.

Per CONTRIBUTING.md: any change to the Policy Engine's or Input Firewall's
enforcement logic must include a property-based test demonstrating the
invariant it upholds. The Enforcer introduces a new invariant of its own —
the worst-wins precedence rule combining two different action vocabularies
— so it gets its own property test rather than piggybacking on either
sub-system's existing suite.

Core invariant: if either sub-system says "block", the combined action is
always "block", and the combined action is "allow" only when *both*
sub-systems say "allow".
"""

from hypothesis import given
from hypothesis import strategies as st

from promptwall.enforcer import _ACTION_PRECEDENCE, Action, _combine

_ACTIONS = st.sampled_from(list(_ACTION_PRECEDENCE.keys()))


@given(firewall_action=_ACTIONS, policy_action=_ACTIONS)
def test_block_always_wins_from_either_side(firewall_action: Action, policy_action: Action) -> None:
    """If either sub-system's action is 'block', the combined result must
    be 'block' — nothing should ever be able to out-vote a block."""
    result = _combine(firewall_action, policy_action)
    if firewall_action == "block" or policy_action == "block":
        assert result == "block"


@given(firewall_action=_ACTIONS, policy_action=_ACTIONS)
def test_combined_action_is_allow_only_if_both_sides_are_allow(
    firewall_action: Action, policy_action: Action
) -> None:
    """The combined action must never be 'allow' unless both sub-systems
    independently agreed on 'allow' — a single non-allow verdict from
    either side must always survive into the combined decision."""
    result = _combine(firewall_action, policy_action)
    if result == "allow":
        assert firewall_action == "allow"
        assert policy_action == "allow"


@given(firewall_action=_ACTIONS, policy_action=_ACTIONS)
def test_combined_action_is_always_one_of_the_two_inputs(
    firewall_action: Action, policy_action: Action
) -> None:
    """The combiner never invents a third action — it always returns
    exactly one of the two actions it was given."""
    result = _combine(firewall_action, policy_action)
    assert result in (firewall_action, policy_action)


def test_redact_sanitize_tie_deterministically_favors_firewall() -> None:
    """'redact' (policy) and 'sanitize' (firewall) rank equally severe.
    _combine() is only ever called as _combine(firewall_action,
    policy_action) in that fixed order in Enforcer.enforce(), so the
    tie-break only needs to be deterministic, not symmetric — but it does
    need to be deterministic, and it needs to consistently prefer the
    firewall's read (it's scanning raw content directly, rather than a
    policy-derived label of that content)."""
    assert _combine("sanitize", "redact") == "sanitize"
    assert _combine("redact", "sanitize") == "redact"


@given(action=_ACTIONS)
def test_combine_is_idempotent_on_matching_actions(action: Action) -> None:
    """Combining an action with itself must return itself."""
    assert _combine(action, action) == action
