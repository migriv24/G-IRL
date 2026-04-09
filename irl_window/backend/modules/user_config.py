"""
user_config.py — User settings persistence for IRL_Window.

Stored at ~/.girl/config.json. Handles first-run initialization,
username, and recent project tracking.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any

from backend.utils.paths import CONFIG_FILE, ensure_dirs

logger = logging.getLogger(__name__)

APP_VERSION = "0.1.0"

_DEFAULT_USER = {
    "username": "anon",
    "created_at": None,  # filled on first run
}

_DEFAULT_CONFIG: dict[str, Any] = {
    "format": "girl-config",
    "format_version": "1.0",
    "app_version": APP_VERSION,
    "user": _DEFAULT_USER,
    "recent_projects": [],  # list of { id, name, path, opened_at }
}


def load_config() -> dict:
    """Load user config from disk. Creates default config on first run."""
    ensure_dirs()
    if not CONFIG_FILE.exists():
        cfg = _make_default()
        save_config(cfg)
        logger.info(f"Created new user config at {CONFIG_FILE}")
        return cfg
    try:
        with CONFIG_FILE.open(encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning(f"Could not read config ({e}), falling back to default")
        return _make_default()


def save_config(cfg: dict) -> None:
    """Persist user config to disk."""
    ensure_dirs()
    with CONFIG_FILE.open("w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)


def get_username() -> str:
    return load_config()["user"].get("username", "anon")


def set_username(username: str) -> dict:
    cfg = load_config()
    cfg["user"]["username"] = username.strip() or "anon"
    save_config(cfg)
    return cfg


def add_recent_project(project_id: str, name: str, path: str) -> None:
    """Add or move a project to the top of the recent list (max 15)."""
    cfg = load_config()
    recent = cfg.get("recent_projects", [])
    # Remove stale entry for same id
    recent = [r for r in recent if r.get("id") != project_id]
    recent.insert(0, {
        "id": project_id,
        "name": name,
        "path": path,
        "opened_at": _now(),
    })
    cfg["recent_projects"] = recent[:15]
    save_config(cfg)


def remove_recent_project(project_id: str) -> None:
    cfg = load_config()
    cfg["recent_projects"] = [r for r in cfg.get("recent_projects", []) if r.get("id") != project_id]
    save_config(cfg)


# ── Internals ─────────────────────────────────────────────────────────────────

def _make_default() -> dict:
    import copy
    cfg = copy.deepcopy(_DEFAULT_CONFIG)
    cfg["user"]["created_at"] = _now()
    return cfg


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
