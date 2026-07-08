"""Property-based tests for Policy Engine security invariants.

Per CONTRIBUTING.md: any change to the Policy Engine's enforcement logic
must include a property-based test demonstrating the invariant it upholds.
"""

from hypothesis import given
from hypothesis import strategies as st

from promptwall.policy.engine import PolicyEngine

ALLOWLIST = ["api.internal-service.com", "api.partner.com", "en.wikipedia.org"]

_LABEL = st.text(alphabet="abcdefghijklmnopqrstuvwxyz0123456789", min_size=1, max_size=10)
_SCHEME = st.sampled_from(["http", "https"])
_PATH = st.text(alphabet="abcdefghijklmnop/-_", min_size=0, max_size=20)


def _engine() -> PolicyEngine:
    return PolicyEngine.from_file("policies/example-agent.yaml")


@given(label=_LABEL, scheme=_SCHEME, path=_PATH)
def test_unknown_hostname_is_always_blocked_regardless_of_scheme_or_path(
    label: str, scheme: str, path: str
) -> None:
    """Any hostname not exactly in the allowlist must be blocked, no matter
    how the rest of the URL (scheme, path, query) is formatted."""
    hostname = f"{label}.attacker-controlled.example"
    url = f"{scheme}://{hostname}/{path}"
    decision = _engine().evaluate({"name": "fetch_url", "url": url})
    assert decision["action"] == "block", f"URL should have been blocked: {url}"


@given(allowed_host=st.sampled_from(ALLOWLIST), scheme=_SCHEME, path=_PATH)
def test_allowlisted_hostname_is_never_blocked_by_host_rule(
    allowed_host: str, scheme: str, path: str
) -> None:
    """An exactly-allowlisted hostname must never be blocked by the
    outbound-host rule, no matter what path or query string is appended."""
    url = f"{scheme}://{allowed_host}/{path}"
    decision = _engine().evaluate({"name": "fetch_url", "url": url})
    assert decision["matched_rule"] != "no-outbound-to-unknown-hosts", (
        f"Allowlisted host was incorrectly blocked: {url}"
    )


@given(allowed_host=st.sampled_from(ALLOWLIST), decoration=_LABEL)
def test_lookalike_hostnames_never_bypass_the_allowlist(allowed_host: str, decoration: str) -> None:
    """A hostname that merely *contains* an allowlisted hostname as a
    substring (prefix or suffix trick) must still be blocked. This is the
    exact bug class the hostname-parsing fix in matcher.py exists to close."""
    engine = _engine()

    prefixed = f"{decoration}{allowed_host}"
    decision = engine.evaluate({"name": "fetch_url", "url": f"https://{prefixed}"})
    assert decision["action"] == "block", f"Lookalike bypassed allowlist: {prefixed}"

    suffixed = f"{allowed_host}.{decoration}.example"
    decision = engine.evaluate({"name": "fetch_url", "url": f"https://{suffixed}"})
    assert decision["action"] == "block", f"Lookalike bypassed allowlist: {suffixed}"
