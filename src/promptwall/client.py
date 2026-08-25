"""HTTP Client for communicating with the PromptWall Dashboard."""

import contextlib
import json
import urllib.error
import urllib.request
from typing import Any, cast


class PromptWallClient:
    def __init__(self, api_key: str, base_url: str):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def _request(
        self, endpoint: str, method: str = "GET", payload: dict[str, Any] | None = None
    ) -> Any:
        url = f"{self.base_url}{endpoint}"
        headers = {"x-api-key": self.api_key, "Content-Type": "application/json"}

        data = None
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")

        req = urllib.request.Request(url, data=data, headers=headers, method=method)

        try:
            with urllib.request.urlopen(req) as response:
                response_data = response.read()
                if response_data:
                    return json.loads(response_data.decode("utf-8"))
                return None
        except urllib.error.HTTPError as e:
            error_msg = e.read().decode("utf-8")
            if e.code == 429:
                raise ValueError(f"RateLimitExceeded: {error_msg}") from e
            raise RuntimeError(f"HTTP {e.code} from {url}: {error_msg}") from e
        except Exception as e:
            raise RuntimeError(f"Failed to connect to {url}: {e}") from e

    def fetch_active_policy(self, environment: str = "production") -> dict[str, Any]:
        return cast(
            dict[str, Any],
            self._request(f"/api/policies/active?environment={environment}"),
        )

    def fetch_siem_integrations(self) -> list[dict[str, Any]]:
        return cast(
            list[dict[str, Any]],
            self._request("/api/settings/siem"),
        )

    def send_audit_event(self, event: dict[str, Any]) -> None:
        with contextlib.suppress(Exception):
            self._request("/api/audit", method="POST", payload=event)

    def scan_tool_call(
        self, tool_call: dict[str, Any], content: str | None = None
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {"tool_call": tool_call}
        if content is not None:
            payload["content"] = content
        return cast(dict[str, Any], self._request("/api/scan", method="POST", payload=payload))
