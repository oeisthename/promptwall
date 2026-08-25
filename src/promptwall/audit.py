"""Audit Logging for PromptWall Proxy."""

import contextlib
import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

CONFIG_DIR = Path.home() / ".promptwall"
DB_PATH = CONFIG_DIR / "audit.db"


class AuditLogger:
    def __init__(self) -> None:
        """Initialize the AuditLogger and ensure the database and table exist."""
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        self.db_path = DB_PATH
        self._init_db()

    def _init_db(self) -> None:
        """Create the audit_logs table if it doesn't exist, and apply migrations."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id TEXT PRIMARY KEY,
                    timestamp DATETIME NOT NULL,
                    decision TEXT NOT NULL,
                    matched_rule TEXT,
                    original_prompt TEXT NOT NULL,
                    sanitized_prompt TEXT,
                    score REAL,
                    latency REAL,
                    tokens INTEGER DEFAULT 0,
                    cost REAL DEFAULT 0.0
                )
                """
            )
            # Create an index on timestamp for fast queries
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs (timestamp)"
            )

            # Simple migration logic for existing databases
            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("ALTER TABLE audit_logs ADD COLUMN tokens INTEGER DEFAULT 0")

            with contextlib.suppress(sqlite3.OperationalError):
                cursor.execute("ALTER TABLE audit_logs ADD COLUMN cost REAL DEFAULT 0.0")

            conn.commit()

    async def log_event(
        self,
        decision: str,
        original_prompt: str,
        latency: float,
        matched_rule: str | None = None,
        sanitized_prompt: str | None = None,
        score: float | None = None,
        tokens: int = 0,
        cost: float = 0.0,
    ) -> None:
        """Log a prompt enforcement event to the SQLite database and sync to Dashboard.

        Args:
            decision: 'allow', 'block', 'redact', 'require_approval'
            original_prompt: The prompt text extracted from the request
            latency: Time taken to evaluate the policy in milliseconds
            matched_rule: Name of the rule that triggered the decision (if any)
            sanitized_prompt: The resulting prompt after redaction/sanitization
            score: Confidence score or risk score associated with the decision
            tokens: Estimated or exact tokens used
            cost: Estimated cost in USD
        """
        event_id = str(uuid.uuid4())
        # Use UTC timestamp formatted as ISO8601
        timestamp = datetime.now(UTC).isoformat()

        # 1. Save locally to SQLite
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO audit_logs 
                (id, timestamp, decision, matched_rule, original_prompt, sanitized_prompt, score, latency, tokens, cost)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event_id,
                    timestamp,
                    decision,
                    matched_rule,
                    original_prompt,
                    sanitized_prompt,
                    score,
                    latency,
                    tokens,
                    cost,
                ),
            )
            conn.commit()

        # 2. Sync to Dashboard asynchronously
        import httpx

        from promptwall.cli.config import get_api_key, get_base_url

        api_key = get_api_key()
        base_url = get_base_url()

        payload = {
            "action": decision,
            "ruleName": matched_rule,
            "fullRequest": original_prompt,
            "promptPreview": sanitized_prompt,
            "latencyMs": latency,
            "severity": "medium",  # Defaulting severity
        }

        if api_key and base_url:
            try:
                # Dashboard audit API endpoint
                url = f"{base_url.rstrip('/')}/api/audit"
                async with httpx.AsyncClient() as client:
                    await client.post(
                        url,
                        json=payload,
                        headers={"Authorization": f"Bearer {api_key}"},
                        timeout=5.0,
                    )
            except Exception:
                # Silently fail sync if dashboard is unreachable, local SQLite has it
                pass

        # 3. Forward to SIEM integrations
        await self._forward_to_siem(payload)

    async def _forward_to_siem(self, payload: dict[str, Any]) -> None:
        if not hasattr(self, "_siem_integrations"):
            self._siem_integrations = []
            from promptwall.cli.config import get_api_key, get_base_url

            api_key = get_api_key()
            base_url = get_base_url()
            if api_key and base_url:
                try:
                    from promptwall.client import PromptWallClient

                    client = PromptWallClient(api_key=api_key, base_url=base_url)
                    integrations = client.fetch_siem_integrations()
                    self._siem_integrations = [i for i in integrations if i.get("enabled")]
                except Exception:
                    pass

        if not self._siem_integrations:
            return

        import httpx

        async with httpx.AsyncClient() as http_client:
            for siem in self._siem_integrations:
                provider = siem.get("provider")
                endpoint = siem.get("endpoint")
                siem_key = str(siem.get("apiKey") or "")
                if not endpoint:
                    continue

                headers = {"Content-Type": "application/json"}
                try:
                    if provider == "datadog":
                        headers["DD-API-KEY"] = siem_key
                        await http_client.post(endpoint, json=payload, headers=headers, timeout=2.0)
                    elif provider == "splunk":
                        headers["Authorization"] = f"Splunk {siem_key}"
                        await http_client.post(
                            endpoint, json={"event": payload}, headers=headers, timeout=2.0
                        )
                    elif provider in ("elk", "wazuh"):
                        if siem_key:
                            headers["Authorization"] = f"Bearer {siem_key}"
                        await http_client.post(endpoint, json=payload, headers=headers, timeout=2.0)
                except Exception:
                    pass

    def get_today_cost(self) -> float:
        """Get the total cost for the current UTC day."""
        today = datetime.now(UTC).strftime("%Y-%m-%d")
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT SUM(cost) FROM audit_logs WHERE timestamp LIKE ?", (f"{today}%",)
            )
            result = cursor.fetchone()
            return float(result[0]) if result and result[0] is not None else 0.0
