"""
paths.py — Platform-abstracted filesystem paths for IRL_Window.

All paths use pathlib.Path so they work identically on Windows, Linux, and macOS.
Never construct paths manually with strings — always use these helpers.

Default layout:
  ~/.girl/
    config.json         ← user settings
    projects/           ← saved journey files (.json)
"""

from pathlib import Path

# Root app data directory — ~/.girl on all platforms
APP_DIR: Path = Path.home() / ".girl"

# Subdirectories
PROJECTS_DIR: Path = APP_DIR / "projects"
CANVAS_DIR:   Path = APP_DIR / "canvas"

# Top-level config file
CONFIG_FILE:    Path = APP_DIR / "config.json"
CURRENT_CANVAS: Path = CANVAS_DIR / "current.journey.json"


def ensure_dirs() -> None:
    """Create all required directories if they don't exist."""
    PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    CANVAS_DIR.mkdir(parents=True, exist_ok=True)


def project_path(project_id: str) -> Path:
    """Return the absolute path for a project file by its ID."""
    return PROJECTS_DIR / f"{project_id}.json"
