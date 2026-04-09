"""
project_manager.py — Save, load, list, and delete journey projects.

Save format (girl-journey v1.0):
  {
    "format": "girl-journey",
    "format_version": "1.0",
    "meta": {
      "id":           str   — short UUID (8 chars)
      "name":         str
      "description":  str
      "app_version":  str
      "created_by":   str   — username at save time
      "created_at":   ISO8601
      "saved_at":     ISO8601
      "node_count":   int
      "save_type":    "journey" | "journey+samples"
    },
    "journey": { "nodes": [...], "edges": [...] },
    "samples": null | { "run_ids": [...] },
    "model":   null
  }

Files are stored in ~/.girl/projects/<id>.json
"""

import json
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.utils.paths import ensure_dirs, project_path, PROJECTS_DIR
from backend.modules.user_config import get_username, add_recent_project, remove_recent_project

logger = logging.getLogger(__name__)

FORMAT = "girl-journey"
FORMAT_VERSION = "1.0"
APP_VERSION = "0.1.0"


# ── Public API ────────────────────────────────────────────────────────────────

def save_project(
    name: str,
    nodes: list,
    edges: list,
    *,
    description: str = "",
    project_id: str | None = None,
    run_ids: list[str] | None = None,
) -> dict:
    """Save a journey to disk. Returns the project meta dict.

    If project_id is None, creates a new project (new ID + created_at timestamp).
    If project_id is provided, updates an existing project (preserves created_at).
    """
    ensure_dirs()
    now = _now()
    is_new = project_id is None

    if is_new:
        project_id = uuid.uuid4().hex[:8]
        created_at = now
    else:
        # Preserve original created_at if re-saving an existing project
        existing = _try_load_raw(project_id)
        created_at = (existing or {}).get("meta", {}).get("created_at", now)

    save_type = "journey+samples" if run_ids else "journey"

    meta: dict[str, Any] = {
        "id": project_id,
        "name": name.strip() or "Untitled Journey",
        "description": description.strip(),
        "app_version": APP_VERSION,
        "created_by": get_username(),
        "created_at": created_at,
        "saved_at": now,
        "node_count": len(nodes),
        "save_type": save_type,
    }

    data: dict[str, Any] = {
        "format": FORMAT,
        "format_version": FORMAT_VERSION,
        "meta": meta,
        "journey": {"nodes": nodes, "edges": edges},
        "samples": {"run_ids": run_ids} if run_ids else None,
        "model": None,
    }

    path = project_path(project_id)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    add_recent_project(project_id, meta["name"], str(path))
    logger.info(f"[Project] Saved '{meta['name']}' → {path}")
    return meta


def load_project(project_id: str) -> dict | None:
    """Load a project from disk. Returns the full data dict, or None if not found."""
    path = project_path(project_id)
    if not path.exists():
        logger.warning(f"[Project] Not found: {project_id}")
        return None
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        if data.get("format") != FORMAT:
            logger.warning(f"[Project] Unknown format in {path}")
            return None
        # Record as recently opened
        meta = data.get("meta", {})
        add_recent_project(project_id, meta.get("name", "?"), str(path))
        return data
    except Exception as e:
        logger.error(f"[Project] Failed to load {project_id}: {e}")
        return None


def list_projects() -> list[dict]:
    """Return list of project meta dicts, sorted by saved_at descending."""
    ensure_dirs()
    projects: list[dict] = []
    for p in sorted(PROJECTS_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            with p.open(encoding="utf-8") as f:
                data = json.load(f)
            if data.get("format") == FORMAT:
                projects.append(data.get("meta", {}))
        except Exception:
            pass
    return projects


def delete_project(project_id: str) -> bool:
    """Delete a project file. Returns True if deleted, False if not found."""
    path = project_path(project_id)
    if not path.exists():
        return False
    path.unlink()
    remove_recent_project(project_id)
    logger.info(f"[Project] Deleted {project_id}")
    return True


def rename_project(project_id: str, new_name: str) -> dict | None:
    """Rename a project in-place. Returns updated meta or None if not found."""
    path = project_path(project_id)
    if not path.exists():
        return None
    try:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        data["meta"]["name"] = new_name.strip() or "Untitled Journey"
        data["meta"]["saved_at"] = _now()
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        add_recent_project(project_id, data["meta"]["name"], str(path))
        return data["meta"]
    except Exception as e:
        logger.error(f"[Project] Failed to rename {project_id}: {e}")
        return None


# ── Internals ─────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _try_load_raw(project_id: str) -> dict | None:
    path = project_path(project_id)
    if not path.exists():
        return None
    try:
        with path.open(encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None
