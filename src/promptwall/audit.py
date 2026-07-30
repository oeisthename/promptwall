"""Audit Logging for PromptWall Proxy."""

import sqlite3
import uuid
from datetime import UTC, datetime
from pathlib import Path

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
            try:
                cursor.execute("ALTER TABLE audit_logs ADD COLUMN tokens INTEGER DEFAULT 0")
            except sqlite3.OperationalError:
                pass  # column already exists
            try:
                cursor.execute("ALTER TABLE audit_logs ADD COLUMN cost REAL DEFAULT 0.0")
            except sqlite3.OperationalError:
                pass  # column already exists
                
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
        
        if api_key and base_url:
            try:
                # Dashboard audit API endpoint
                url = f"{base_url.rstrip('/')}/api/audit"
                payload = {
                    "action": decision,
                    "ruleName": matched_rule,
                    "fullRequest": original_prompt,
                    "promptPreview": sanitized_prompt,
                    "latencyMs": latency,
                    "severity": "medium",  # Defaulting severity
                }
                async with httpx.AsyncClient() as client:
                    await client.post(
                        url,
                        json=payload,
                        headers={"Authorization": f"Bearer {api_key}"},
                        timeout=5.0
                    )
            except Exception:
                # Silently fail sync if dashboard is unreachable, local SQLite has it
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
