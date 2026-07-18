"""PromptWall — runtime security middleware for AI agents."""

from promptwall.enforcer import EnforcementDecision, Enforcer

__version__ = "0.1.0"


class PromptWall:
    """Main entrypoint for embedding PromptWall in an existing agent.

    Combines the Input Firewall and Policy Engine via the Enforcer: every
    enforce() call scans content (if provided) and checks the tool call
    against policy, returning one combined decision. See
    docs/ARCHITECTURE.md, "Data flow for a single tool call".

    Example:
        guard = PromptWall(policy_file="policies/example-agent.yaml")
        decision = guard.enforce(tool_call, content=fetched_page_text)
        if decision.action == "block":
            ...
    """

    def __init__(self, policy_file: str) -> None:
        self.enforcer = Enforcer.from_file(policy_file)

    def enforce(
        self, tool_call: dict[str, object], content: str | None = None
    ) -> EnforcementDecision:
        """Evaluate a tool call (and optional content) and return a combined
        decision. `content` may be inbound content the agent is about to
        read, or outbound content it's about to emit — see Enforcer.enforce
        for details.
        """
        return self.enforcer.enforce(tool_call, content=content)


__all__ = ["PromptWall"]
