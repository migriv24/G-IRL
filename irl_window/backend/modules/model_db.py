"""
SQLite persistence for trained models and their metadata.
"""

import json
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Reuse the same DB as samples
from backend.modules.samples_db import _connect, _now

MODELS_DIR = Path(__file__).parent.parent.parent / "data" / "models"


def init_model_db():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    conn = _connect()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS trained_models (
            id           TEXT PRIMARY KEY,
            created_at   TEXT NOT NULL,
            name         TEXT,
            status       TEXT NOT NULL DEFAULT 'pending',
            n_samples    INTEGER,
            architecture TEXT,        -- JSON: [n_input, h1, h2, ..., n_output]
            hidden_layers TEXT,       -- JSON: [h1, h2, ...]
            max_iter     INTEGER,
            learning_rate REAL,
            train_mse    REAL,
            train_r2     REAL,
            loss_curve   TEXT,        -- JSON: [float, ...]
            onnx_path    TEXT,
            error        TEXT,
            notes        TEXT
        );
    """)
    conn.commit()
    conn.close()
    logger.info("[ModelDB] Initialized")


def new_model_record(hidden_layers: list, max_iter: int, learning_rate: float,
                     n_samples: int, name: str = None) -> str:
    model_id = str(uuid.uuid4())
    conn = _connect()
    conn.execute(
        """INSERT INTO trained_models
           (id, created_at, name, status, n_samples, hidden_layers, max_iter, learning_rate)
           VALUES (?, ?, ?, 'training', ?, ?, ?, ?)""",
        (model_id, _now(), name or f"model_{model_id[:8]}", n_samples,
         json.dumps(hidden_layers), max_iter, learning_rate),
    )
    conn.commit()
    conn.close()
    return model_id


def update_model(model_id: str, **kwargs):
    if not kwargs:
        return
    # Serialize lists/dicts to JSON
    for k in ('architecture', 'hidden_layers', 'loss_curve'):
        if k in kwargs and isinstance(kwargs[k], (list, dict)):
            kwargs[k] = json.dumps(kwargs[k])
    fields = ', '.join(f'{k} = ?' for k in kwargs)
    values = list(kwargs.values()) + [model_id]
    conn = _connect()
    conn.execute(f"UPDATE trained_models SET {fields} WHERE id = ?", values)
    conn.commit()
    conn.close()


def list_models(limit: int = 50) -> list[dict]:
    conn = _connect()
    rows = conn.execute(
        "SELECT * FROM trained_models ORDER BY created_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        for k in ('architecture', 'hidden_layers', 'loss_curve'):
            if d.get(k):
                try: d[k] = json.loads(d[k])
                except: pass
        result.append(d)
    return result


def get_model(model_id: str) -> Optional[dict]:
    conn = _connect()
    row = conn.execute(
        "SELECT * FROM trained_models WHERE id = ?", (model_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    for k in ('architecture', 'hidden_layers', 'loss_curve'):
        if d.get(k):
            try: d[k] = json.loads(d[k])
            except: pass
    return d


def onnx_path_for(model_id: str) -> Path:
    return MODELS_DIR / f"{model_id}.onnx"
