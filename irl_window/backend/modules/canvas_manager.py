"""
canvas_manager.py — Persistent working canvas for the Journey Designer.

Manages a single `current.journey.json` file that is the source of truth
for the active canvas. This file is written on every auto-save and read
by the generation pipeline — the frontend's React Flow state is never
trusted for generation.

Separate from named project saves (project_manager.py). The workflow is:
  - Any edit          → canvas_manager.save_canvas()   (auto-save)
  - Ctrl+S            → canvas_manager.save_canvas()   (flush)
                        + project_manager.save_project() (named copy)
  - ▶ Run             → canvas_manager.load_canvas()   (read by backend)

File location: ~/.girl/canvas/current.journey.json
"""

import json
import logging
from datetime import datetime, timezone

from backend.utils.paths import ensure_dirs, CURRENT_CANVAS

logger = logging.getLogger(__name__)

CANVAS_FORMAT         = "girl-canvas"
CANVAS_FORMAT_VERSION = "1.0"

_EMPTY: dict = {"nodes": [], "edges": []}


# ── Public API ────────────────────────────────────────────────────────────────

def save_canvas(nodes: list, edges: list) -> None:
    """Write the current canvas to disk.

    Overwrites current.journey.json atomically. Called on every auto-save
    trigger from the frontend (debounced) and on explicit node/project saves.
    """
    ensure_dirs()
    data = {
        "format":         CANVAS_FORMAT,
        "format_version": CANVAS_FORMAT_VERSION,
        "saved_at":       _now(),
        "nodes":          nodes,
        "edges":          edges,
    }
    # Write to a temp file then rename for atomicity
    tmp = CURRENT_CANVAS.with_suffix(".tmp")
    try:
        with tmp.open("w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        tmp.replace(CURRENT_CANVAS)
        logger.debug(f"[Canvas] Auto-saved ({len(nodes)} nodes, {len(edges)} edges)")
    except Exception as e:
        logger.error(f"[Canvas] Save failed: {e}")
        if tmp.exists():
            tmp.unlink()
        raise


def load_canvas() -> dict:
    """Load the current canvas from disk.

    Returns { "nodes": [...], "edges": [...] }.
    Returns empty defaults if the file doesn't exist or is malformed.
    """
    ensure_dirs()
    if not CURRENT_CANVAS.exists():
        logger.info("[Canvas] No current canvas on disk — returning empty defaults")
        return _EMPTY.copy()
    try:
        with CURRENT_CANVAS.open(encoding="utf-8") as f:
            data = json.load(f)
        if data.get("format") != CANVAS_FORMAT:
            logger.warning("[Canvas] Unknown format — returning empty defaults")
            return _EMPTY.copy()
        return {
            "nodes": data.get("nodes", []),
            "edges": data.get("edges", []),
        }
    except Exception as e:
        logger.error(f"[Canvas] Load failed: {e} — returning empty defaults")
        return _EMPTY.copy()


def canvas_exists() -> bool:
    """Return True if a saved canvas exists on disk."""
    return CURRENT_CANVAS.exists()


# ── Internal ──────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
