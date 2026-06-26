"""Unit tests for the PolicyEngine stub.

These will expand significantly once real rule evaluation is implemented —
see tests/property/ for where security-invariant tests belong once the
match-expression evaluator exists.
"""

from promptwall.policy.engine import PolicyEngine


def test_loads_policy_from_file():
    engine = PolicyEngine.from_file("policies/example-agent.yaml")
    assert engine.agent == "research-agent"
    assert len(engine.rules) > 0


def test_evaluate_returns_a_decision_shape():
    engine = PolicyEngine.from_file("policies/example-agent.yaml")
    decision = engine.evaluate({"name": "fetch_url", "url": "https://example.com"})
    assert "action" in decision
    assert decision["action"] in {"allow", "block", "redact", "require_approval"}
