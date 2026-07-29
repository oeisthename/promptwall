"""PromptWall — runtime security middleware for AI agents."""

import datetime
import uuid

from promptwall.client import PromptWallClient
from promptwall.enforcer import EnforcementDecision, Enforcer

__version__ = "0.1.0"


class PromptWall:
    """Main entrypoint for embedding PromptWall in an existing agent.

    Combines the Input Firewall and Policy Engine via the Enforcer.
    If configured with an API key, it will fetch policies dynamically,
    enforce central rate limits/budgets, and stream audit logs.
    """

    def __init__(
        self,
        policy_file: str | None = None,
        api_key: str | None = None,
        base_url: str | None = None,
        environment: str = "production",
    ) -> None:
        self.client = None
        if api_key and base_url:
            self.client = PromptWallClient(api_key=api_key, base_url=base_url)
            self.enforcer = Enforcer.from_api(self.client, environment=environment)
        elif policy_file:
            self.enforcer = Enforcer.from_file(policy_file)
        else:
            raise ValueError("Must provide either policy_file or (api_key and base_url)")

    def enforce(
        self, tool_call: dict[str, object], content: str | None = None
    ) -> EnforcementDecision:
        """Evaluate a tool call (and optional content) and return a combined decision."""
        # 1. Pre-flight check for rate limits / token budgets (if cloud-connected)
        if self.client:
            try:
                scan_response = self.client.scan_tool_call(tool_call, content)
                if scan_response.get("action") == "block":
                    decision = EnforcementDecision(
                        action="block",
                        reason=scan_response.get("reason", "Blocked by central platform"),
                        firewall_result=None,
                        policy_result={
                            "action": "block",
                            "matched_rule": "PlatformPolicy",
                            "severity": "high",
                            "tool_call": tool_call,
                        },
                        tool_call=tool_call,
                        sanitized_content=None,
                    )
                    self._log_audit(decision)
                    return decision
            except ValueError as e:
                # 429 Rate Limit or Token Budget Exceeded
                decision = EnforcementDecision(
                    action="block",
                    reason=str(e),
                    firewall_result=None,
                    policy_result={
                        "action": "block",
                        "matched_rule": "PlatformLimit",
                        "severity": "critical",
                        "tool_call": tool_call,
                    },
                    tool_call=tool_call,
                    sanitized_content=None,
                )
                self._log_audit(decision)
                return decision
            except Exception:
                # Fail open if the platform is unreachable, just proceed to local policy check
                pass

        # 2. Local Policy & Firewall checks
        decision = self.enforcer.enforce(tool_call, content=content)

        # 3. Stream Audit Event
        self._log_audit(decision)
        return decision

    def _log_audit(self, decision: EnforcementDecision) -> None:
        if not self.client:
            return

        event = {
            "id": str(uuid.uuid4()),
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "action": decision.action,
            "severity": decision.policy_result.get("severity") or "info",
            "ruleName": decision.policy_result.get("matched_rule") or "none",
            "toolName": str(decision.tool_call.get("name", "unknown")),
            "promptPreview": str(decision.tool_call)[:200],  # truncated preview
            "fullRequest": decision.tool_call,
            "latencyMs": 0,  # handled by the platform or calculated later
        }
        self.client.send_audit_event(event)


__all__ = ["PromptWall"]
