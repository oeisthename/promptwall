"""PromptWall — runtime security middleware for AI agents."""

from promptwall.policy.engine import PolicyEngine

__version__ = "0.1.0"


class PromptWall:
    """Main entrypoint for embedding PromptWall in an existing agent.

    Example:
        guard = PromptWall(policy_file="policies/example-agent.yaml")
        result = guard.enforce(tool_call)
    """

    def __init__(self, policy_file: str) -> None:
        self.policy_engine = PolicyEngine.from_file(policy_file)

    def enforce(self, tool_call: dict) -> dict:
        """Evaluate a tool call against the active policy and return a decision.

        This is a stub — see src/promptwall/policy/engine.py for the real
        implementation as it's built out.
        """
        return self.policy_engine.evaluate(tool_call)


__all__ = ["PromptWall"]
