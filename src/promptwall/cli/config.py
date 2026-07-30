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
    return get_config().get("api_key")


def get_base_url() -> str | None:
    return get_config().get("base_url")


def get_proxy_host() -> str:
    return str(get_config().get("proxy_host", "127.0.0.1"))


def get_proxy_port() -> int:
    return int(get_config().get("proxy_port", 8000))


def get_default_upstream() -> str:
    return str(get_config().get("default_upstream", "https://api.openai.com"))
