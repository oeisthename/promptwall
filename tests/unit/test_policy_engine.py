"""Unit tests for PolicyEngine — real enforcement behavior."""

import pytest
from pydantic import ValidationError

from promptwall.policy.engine import PolicyEngine
from promptwall.policy.schema import Policy


def test_loads_policy_from_file():
    engine = PolicyEngine.from_file("policies/example-agent.yaml")
    assert engine.agent == "research-agent"
    assert len(engine.rules) == 4


def test_unknown_host_is_blocked():
    engine = PolicyEngine.from_file("policies/example-agent.yaml")
    decision = engine.evaluate({"name": "fetch_url", "url": "https://evil.com"})
    assert decision["action"] == "block"
    assert decision["matched_rule"] == "no-outbound-to-unknown-hosts"


def test_allowlisted_host_is_allowed():
    engine = PolicyEngine.from_file("policies/example-agent.yaml")
    decision = engine.evaluate({"name": "fetch_url", "url": "https://api.partner.com/v1"})
    assert decision["action"] == "allow"
    assert decision["matched_rule"] is None


def test_lookalike_domain_does_not_bypass_allowlist():
    engine = PolicyEngine.from_file("policies/example-agent.yaml")
    decision = engine.evaluate({"name": "fetch_url", "url": "https://fakeapi.partner.com"})
    assert decision["action"] == "block"


def test_secret_shaped_output_is_redacted():
    engine = PolicyEngine.from_file("policies/example-agent.yaml")
    decision = engine.evaluate(
        {"name": "write_file", "path": "/sandbox/notes.txt"},
        output="here is my api_key: sk-abc123",
    )
    assert decision["action"] == "redact"
    assert decision["matched_rule"] == "no-secret-shaped-strings-in-output"


def test_write_outside_sandbox_is_blocked():
    engine = PolicyEngine.from_file("policies/example-agent.yaml")
    decision = engine.evaluate({"name": "write_file", "path": "/etc/passwd"})
    assert decision["action"] == "block"
    assert decision["matched_rule"] == "writes-restricted-to-sandbox"


def test_payment_requires_approval():
    engine = PolicyEngine.from_file("policies/example-agent.yaml")
    decision = engine.evaluate({"name": "submit_payment", "amount": 500})
    assert decision["action"] == "require_approval"


def test_first_match_wins():
    """Two rules that could both match: earlier rule in the file wins."""
    policy = Policy.model_validate(
        {
            "agent": "test-agent",
            "definitions": {"allowlist": []},
            "rules": [
                {
                    "name": "rule-a-blocks-first",
                    "plane": "output",
                    "match": 'tool_call.name == "danger"',
                    "action": "block",
                    "severity": "critical",
                },
                {
                    "name": "rule-b-would-allow",
                    "plane": "output",
                    "match": 'tool_call.name == "danger"',
                    "action": "allow",
                    "severity": "low",
                },
            ],
        }
    )
    engine = PolicyEngine(policy)
    decision = engine.evaluate({"name": "danger"})
    assert decision["matched_rule"] == "rule-a-blocks-first"
    assert decision["action"] == "block"


def test_rule_referencing_missing_field_does_not_match():
    """A rule about tool_call.url shouldn't fire on a call with no url."""
    engine = PolicyEngine.from_file("policies/example-agent.yaml")
    decision = engine.evaluate({"name": "write_file", "path": "/sandbox/x.txt"})
    assert decision["matched_rule"] != "no-outbound-to-unknown-hosts"


def test_malformed_policy_is_rejected_at_load_time():
    with pytest.raises(ValidationError):
        Policy.model_validate(
            {
                "agent": "test-agent",
                "rules": [
                    {
                        "name": "bad-rule",
                        "plane": "output",
                        "match": "this is not a valid expression",
                        "action": "block",
                        "severity": "high",
                    }
                ],
            }
        )
