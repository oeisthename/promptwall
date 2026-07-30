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
        """Create the audit_logs table if it doesn't exist."""
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
                    latency REAL
                )
                """
            )
            # Create an index on timestamp for fast queries
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs (timestamp)"
            )
            conn.commit()

    def log_event(
        self,
        decision: str,
        original_prompt: str,
        latency: float,
        matched_rule: str | None = None,
        sanitized_prompt: str | None = None,
        score: float | None = None,
    ) -> None:
        """Log a prompt enforcement event to the SQLite database.

        Args:
            decision: 'allow', 'block', 'redact', 'require_approval'
            original_prompt: The prompt text extracted from the request
            latency: Time taken to evaluate the policy in milliseconds
            matched_rule: Name of the rule that triggered the decision (if any)
            sanitized_prompt: The resulting prompt after redaction/sanitization
            score: Confidence score or risk score associated with the decision
        """
        event_id = str(uuid.uuid4())
        # Use UTC timestamp formatted as ISO8601
        timestamp = datetime.now(UTC).isoformat()

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO audit_logs 
                (id, timestamp, decision, matched_rule, original_prompt, sanitized_prompt, score, latency)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
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
                ),
            )
            conn.commit()
