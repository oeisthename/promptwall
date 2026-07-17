"""Property-based tests for the semantic heuristic scorer's core invariant.

Per CONTRIBUTING.md: any change to the Input Firewall's detection logic
must include a property-based test demonstrating the invariant it upholds.

The invariant here: directive language or AI/instruction meta-reference,
*on their own, without authority-override phrasing*, must never be
flagged — this is what keeps the semantic layer usable on ordinary
technical writing, manuals, and policy documents.
"""

from hypothesis import given
from hypothesis import strategies as st

from promptwall.firewall.semantic import score_content

_DIRECTIVE_ONLY_SENTENCES = [
    "you must configure the server before starting it",
    "you should read the manual first",
    "you will need to restart the application",
    "please follow the setup guide",
    "act according to the deployment checklist",
]

_META_REFERENCE_ONLY_SENTENCES = [
    "the rules are outlined in the employee handbook",
    "please review the guidelines before submitting",
    "the system prompt for this feature is configurable in settings",
    "our training programs cover the new policy",
]

_OVERRIDE_PHRASES = [
    "no matter what",
    "regardless of",
    "from now on",
    "these new rules supersede everything",
]


@given(sentence=st.sampled_from(_DIRECTIVE_ONLY_SENTENCES))
def test_directive_only_sentences_are_never_flagged(sentence: str) -> None:
    finding = score_content(sentence)
    assert finding.severity is None, f"False positive on benign directive text: {sentence!r}"


@given(sentence=st.sampled_from(_META_REFERENCE_ONLY_SENTENCES))
def test_meta_reference_only_sentences_are_never_flagged(sentence: str) -> None:
    finding = score_content(sentence)
    assert finding.severity is None, f"False positive on benign meta-reference text: {sentence!r}"


@given(
    directive=st.sampled_from(_DIRECTIVE_ONLY_SENTENCES),
    override=st.sampled_from(_OVERRIDE_PHRASES),
)
def test_override_phrasing_combined_with_directive_language_is_always_flagged(
    directive: str, override: str
) -> None:
    """Once override language is added to directive language, in any
    combination, the content must be flagged — proving the layer isn't
    just matching the handful of exact sentences used in unit tests."""
    combined = f"{override}, {directive}"
    finding = score_content(combined)
    assert finding.severity is not None, f"Missed injection: {combined!r}"
