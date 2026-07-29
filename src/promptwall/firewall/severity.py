"""Shared severity-threshold configuration for the Input Firewall.

Extracted into its own module (rather than living in scanner.py) so that
both scanner.py and redaction.py can depend on it without creating a
circular import between them — scanner.py needs redaction.py's
sanitize_content(), and redaction.py needs to gate its own span-finding by
the exact same severity threshold scanner.py uses for detection.
"""

from __future__ import annotations

SEVERITY_THRESHOLDS: dict[str, set[str]] = {
    "low": {"critical"},
    "medium": {"critical", "high"},
    "high": {"critical", "high", "medium"},
}
