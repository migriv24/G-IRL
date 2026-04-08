"""
SQLite persistence for generated samples and runs.
Database lives at data/samples.db relative to the project root.
"""

import sqlite3
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).parent.parent.parent / "data" / "samples.db"


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = _connect()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS runs (
            id          TEXT    PRIMARY KEY,
            created_at  TEXT    NOT NULL,
            provider    TEXT,
            model       TEXT,
            n           INTEGER,
            goal        TEXT
        );

        CREATE TABLE IF NOT EXISTS samples (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id      TEXT    NOT NULL REFERENCES runs(id),
            idx         INTEGER NOT NULL,
            phase       TEXT,
            locus       TEXT,
            outcome     REAL,
            goal        TEXT,
            text        TEXT,
            created_at  TEXT    NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_samples_run ON samples(run_id);
        CREATE INDEX IF NOT EXISTS idx_samples_phase ON samples(phase);
    """)
    conn.commit()
    conn.close()
    logger.info(f"[SamplesDB] Initialized at {DB_PATH}")


def new_run(provider: str, model: str, n: int, goal: str) -> str:
    run_id = str(uuid.uuid4())
    conn = _connect()
    conn.execute(
        "INSERT INTO runs (id, created_at, provider, model, n, goal) VALUES (?, ?, ?, ?, ?, ?)",
        (run_id, _now(), provider, model, n, goal),
    )
    conn.commit()
    conn.close()
    return run_id


def save_sample(run_id: str, idx: int, phase: str, locus: str, outcome: float, goal: str, text: str):
    conn = _connect()
    conn.execute(
        """INSERT INTO samples (run_id, idx, phase, locus, outcome, goal, text, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (run_id, idx, phase, locus, outcome, goal, text, _now()),
    )
    conn.commit()
    conn.close()


# ── Query helpers ─────────────────────────────────────────────────────────────

def list_runs(limit: int = 50) -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM runs ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_run(run_id: str) -> Optional[dict]:
    conn = _connect()
    row = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def list_samples(run_id: Optional[str] = None, phase: Optional[str] = None,
                 limit: int = 200, offset: int = 0) -> list[dict]:
    filters, params = [], []
    if run_id:
        filters.append("run_id = ?"); params.append(run_id)
    if phase:
        filters.append("phase = ?"); params.append(phase)
    where = ("WHERE " + " AND ".join(filters)) if filters else ""
    params += [limit, offset]
    conn = _connect()
    rows = conn.execute(
        f"SELECT * FROM samples {where} ORDER BY id DESC LIMIT ? OFFSET ?", params
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_sample(sample_id: int) -> Optional[dict]:
    conn = _connect()
    row = conn.execute("SELECT * FROM samples WHERE id = ?", (sample_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def run_stats(run_id: str) -> dict:
    conn = _connect()
    rows = conn.execute(
        """SELECT phase,
                  COUNT(*)        as count,
                  AVG(outcome)    as avg_outcome,
                  MIN(outcome)    as min_outcome,
                  MAX(outcome)    as max_outcome
           FROM samples WHERE run_id = ?
           GROUP BY phase""",
        (run_id,),
    ).fetchall()
    total = conn.execute(
        "SELECT COUNT(*) FROM samples WHERE run_id = ?", (run_id,)
    ).fetchone()[0]
    conn.close()
    return {
        "total": total,
        "by_phase": [dict(r) for r in rows],
    }


def global_stats() -> dict:
    conn = _connect()
    total_samples = conn.execute("SELECT COUNT(*) FROM samples").fetchone()[0]
    total_runs    = conn.execute("SELECT COUNT(*) FROM runs").fetchone()[0]
    by_phase = conn.execute(
        """SELECT phase, COUNT(*) as count, AVG(outcome) as avg_outcome
           FROM samples GROUP BY phase"""
    ).fetchall()
    conn.close()
    return {
        "total_samples": total_samples,
        "total_runs": total_runs,
        "by_phase": [dict(r) for r in by_phase],
    }


def delete_sample(sample_id: int) -> bool:
    conn = _connect()
    cur = conn.execute("DELETE FROM samples WHERE id = ?", (sample_id,))
    affected = cur.rowcount
    conn.commit()
    conn.close()
    return affected > 0


def delete_run(run_id: str) -> dict:
    """Delete a run and all its samples. Returns counts."""
    conn = _connect()
    samples_deleted = conn.execute(
        "DELETE FROM samples WHERE run_id = ?", (run_id,)
    ).rowcount
    conn.execute("DELETE FROM runs WHERE id = ?", (run_id,))
    conn.commit()
    conn.close()
    return {"samples_deleted": samples_deleted}


def delete_by_keyword(keyword: str) -> dict:
    """Delete all samples whose text contains keyword (case-insensitive)."""
    conn = _connect()
    deleted = conn.execute(
        "DELETE FROM samples WHERE LOWER(text) LIKE LOWER(?)",
        (f"%{keyword}%",),
    ).rowcount
    conn.commit()
    conn.close()
    return {"deleted": deleted, "keyword": keyword}


def delete_by_phase(phase: str) -> dict:
    conn = _connect()
    deleted = conn.execute(
        "DELETE FROM samples WHERE phase = ?", (phase,)
    ).rowcount
    conn.commit()
    conn.close()
    return {"deleted": deleted, "phase": phase}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
