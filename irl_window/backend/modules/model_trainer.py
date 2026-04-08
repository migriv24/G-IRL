"""
Model trainer — trains a sklearn MLP on synthetic samples and exports to ONNX.

Feature engineering:
  Input (7 dims): phase_onehot (6) + locus_binary (1)
  Output (1 dim): outcome [-1, 1]

The MLP learns which phase/locus combinations correlate with which outcomes —
a simplified proxy for what the on-device IRL model will do with sequences.
"""

import asyncio
import logging
import numpy as np
from typing import Optional

logger = logging.getLogger(__name__)

PHASES = ['struggle', 'growth', 'plateau', 'breakthrough', 'spiral', 'return']
N_FEATURES = len(PHASES) + 1   # 6 phase one-hot + 1 locus binary = 7


def _encode_samples(samples: list[dict]) -> tuple:
    """Convert raw sample dicts to numpy X, y arrays."""
    X_rows, y_rows = [], []
    for s in samples:
        phase = (s.get('phase') or '').lower()
        locus = (s.get('locus') or '').lower()
        outcome = s.get('outcome', 0.0)

        phase_oh = [1.0 if phase == p else 0.0 for p in PHASES]
        locus_bin = [1.0 if locus == 'external' else 0.0]
        X_rows.append(phase_oh + locus_bin)
        y_rows.append(float(outcome))

    return np.array(X_rows, dtype=np.float32), np.array(y_rows, dtype=np.float32)


def _export_onnx(sklearn_model, onnx_path, n_features: int):
    """Convert a fitted sklearn MLPRegressor to ONNX and save to disk."""
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType

    initial_type = [('float_input', FloatTensorType([None, n_features]))]
    onnx_model = convert_sklearn(sklearn_model, initial_types=initial_type,
                                  target_opset=17)
    with open(onnx_path, 'wb') as f:
        f.write(onnx_model.SerializeToString())
    logger.info(f"[Trainer] ONNX saved → {onnx_path}")
    return onnx_model


async def train_model_async(
    model_id: str,
    hidden_layers: list[int],
    max_iter: int,
    learning_rate: float,
    run_id: Optional[str],
    event_publish,
):
    """
    Async wrapper — runs sklearn training in a thread executor so FastAPI
    doesn't block. Publishes WS events throughout.
    """
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(
        None,
        _train_blocking,
        model_id, hidden_layers, max_iter, learning_rate, run_id, event_publish, loop,
    )


def _train_blocking(model_id, hidden_layers, max_iter, learning_rate, run_id,
                    event_publish, loop):
    import asyncio

    def emit(event, payload):
        asyncio.run_coroutine_threadsafe(event_publish(event, payload), loop)

    try:
        from sklearn.neural_network import MLPRegressor
        from sklearn.metrics import mean_squared_error, r2_score
        from backend.modules.samples_db import list_samples
        from backend.modules.model_db import update_model, onnx_path_for

        emit('model.training.started', {'model_id': model_id})

        # ── Load data ─────────────────────────────────────────────────────────
        samples = list_samples(run_id=run_id, limit=10000)
        if len(samples) < 5:
            raise ValueError(f"Not enough samples to train ({len(samples)} found, need ≥ 5)")

        emit('model.training.progress', {
            'model_id': model_id,
            'step': 'encoding',
            'message': f'Encoding {len(samples)} samples...',
        })

        X, y = _encode_samples(samples)

        # ── Train ─────────────────────────────────────────────────────────────
        hidden_tuple = tuple(hidden_layers)
        architecture = [N_FEATURES] + list(hidden_layers) + [1]

        emit('model.training.progress', {
            'model_id': model_id,
            'step': 'training',
            'message': f'Training MLP {architecture} for up to {max_iter} iterations...',
        })

        mlp = MLPRegressor(
            hidden_layer_sizes=hidden_tuple,
            max_iter=max_iter,
            learning_rate_init=learning_rate,
            early_stopping=True,
            validation_fraction=0.15,
            n_iter_no_change=20,
            random_state=42,
            warm_start=False,
            verbose=False,
        )
        mlp.fit(X, y)

        # ── Evaluate ──────────────────────────────────────────────────────────
        y_pred = mlp.predict(X)
        mse = float(mean_squared_error(y, y_pred))
        r2  = float(r2_score(y, y_pred))
        loss_curve = [float(v) for v in mlp.loss_curve_]
        n_iter_actual = mlp.n_iter_

        emit('model.training.progress', {
            'model_id': model_id,
            'step': 'exporting',
            'message': f'Done in {n_iter_actual} iterations (MSE={mse:.4f}, R²={r2:.3f}). Exporting ONNX...',
        })

        # ── ONNX export ───────────────────────────────────────────────────────
        onnx_path = onnx_path_for(model_id)
        _export_onnx(mlp, onnx_path, N_FEATURES)

        # ── Persist results ───────────────────────────────────────────────────
        update_model(
            model_id,
            status='complete',
            architecture=architecture,
            hidden_layers=hidden_layers,
            train_mse=mse,
            train_r2=r2,
            loss_curve=loss_curve,
            onnx_path=str(onnx_path),
            n_samples=len(samples),
        )

        emit('model.training.complete', {
            'model_id': model_id,
            'mse': mse,
            'r2': r2,
            'n_iter': n_iter_actual,
            'architecture': architecture,
            'loss_curve': loss_curve,
        })

    except Exception as e:
        logger.error(f"[Trainer] Training failed: {e}", exc_info=True)
        from backend.modules.model_db import update_model
        update_model(model_id, status='error', error=str(e))
        emit('model.training.error', {'model_id': model_id, 'error': str(e)})


def run_inference(model_id: str, phase: str, locus: str) -> Optional[float]:
    """Run a quick inference using the saved ONNX model."""
    try:
        import onnxruntime as rt
        from backend.modules.model_db import onnx_path_for
        onnx_path = onnx_path_for(model_id)
        if not onnx_path.exists():
            return None
        sess = rt.InferenceSession(str(onnx_path))
        phase_oh = [1.0 if phase.lower() == p else 0.0 for p in PHASES]
        locus_bin = [1.0 if locus.lower() == 'external' else 0.0]
        x = np.array([phase_oh + locus_bin], dtype=np.float32)
        pred = sess.run(None, {'float_input': x})
        return float(pred[0][0])
    except Exception as e:
        logger.error(f"[Trainer] Inference failed: {e}")
        return None
