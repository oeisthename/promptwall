"""CLI Configuration management."""

import json
from pathlib import Path
from typing import Any, cast

CONFIG_DIR = Path.home() / ".promptwall"
CONFIG_FILE = CONFIG_DIR / "config.json"


def get_config() -> dict[str, Any]:
    """Load configuration from ~/.promptwall/config.json."""
    if not CONFIG_FILE.exists():
        return {}
    try:
        with CONFIG_FILE.open("r", encoding="utf-8") as f:
            return cast(dict[str, Any], json.load(f))
    except json.JSONDecodeError:
        return {}


def save_config(config: dict[str, Any]) -> None:
    """Save configuration to ~/.promptwall/config.json."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    with CONFIG_FILE.open("w", encoding="utf-8") as f:
        json.dump(config, f, indent=2)


def get_api_key() -> str | None:
    import os

    return os.environ.get("PROMPTWALL_API_KEY") or get_config().get("api_key")


def get_base_url() -> str | None:
    import os

    return os.environ.get("PROMPTWALL_BASE_URL") or get_config().get("base_url")


def get_proxy_host() -> str:
    return str(get_config().get("proxy_host", "127.0.0.1"))


def get_proxy_port() -> int:
    return int(get_config().get("proxy_port", 8000))


def get_default_upstream() -> str:
    return str(get_config().get("default_upstream", "https://api.openai.com"))


def get_fallback_enabled() -> bool:
    return bool(get_config().get("fallback_enabled", False))


def get_fallback_upstream() -> str | None:
    return get_config().get("fallback_upstream")


def get_fallback_api_key() -> str | None:
    return get_config().get("fallback_api_key")


def get_fallback_model() -> str | None:
    return get_config().get("fallback_model")


def get_daily_budget() -> float | None:
    budget = get_config().get("daily_budget")
    return float(budget) if budget is not None else None
