/**
 * Model Lab — training, visualization, and inspection of IRL models.
 *
 * Layout (3 columns):
 *   [Models Library] | [3D Viz + Loss Chart] | [Train Config + Metrics]
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import useWsStore from '../../store/ws';
import ModelViz3D from './ModelViz3D';
import LossChart  from './LossChart';

const API = 'http://localhost:8000/api';

// ── Win95 primitives ──────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 9, color: '#888', textTransform: 'uppercase',
      letterSpacing: '0.1em', padding: '6px 8px 2px',
      fontFamily: 'var(--font-mono)',
    }}>
      {children}
    </div>
  );
}

function W95Field({ label, value, onChange, type = 'text', min, max, step }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 10, marginBottom: 2, color: '#555', fontFamily: 'var(--font-mono)' }}>{label}</div>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        min={min} max={max} step={step}
        style={{ width: '100%', fontSize: 11, boxSizing: 'border-box' }}
      />
    </div>
  );
}

function MetricBox({ label, value, good }) {
  const color = good === undefined ? '#444' : good ? '#007700' : '#cc3300';
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '3px 6px', borderBottom: '1px solid #ddd', fontSize: 11,
      fontFamily: 'var(--font-mono)',
    }}>
      <span style={{ color: '#666' }}>{label}</span>
      <span style={{ color, fontWeight: 'bold' }}>{value ?? '—'}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    complete: { bg: '#ccffcc', fg: '#006600', label: '● complete' },
    training: { bg: '#ffffcc', fg: '#886600', label: '◌ training' },
    error:    { bg: '#ffcccc', fg: '#cc0000', label: '✕ error'    },
    pending:  { bg: '#e0e0e0', fg: '#666',    label: '○ pending'  },
  };
  const s = map[status] ?? map.pending;
  return (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)',
      padding: '1px 5px', background: s.bg, color: s.fg,
      border: `1px solid ${s.fg}55`,
    }}>
      {s.label}
    </span>
  );
}

// ── Models Library (left column) ──────────────────────────────────────────────
function ModelsLibrary({ models, selectedId, onSelect, onRefresh }) {
  return (
    <div style={{
      width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderRight: '2px solid var(--bevel-outer-br)',
      background: 'var(--w95-gray)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 8px', borderBottom: '1px solid #ccc', flexShrink: 0,
      }}>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
          TRAINED MODELS
        </span>
        <button onClick={onRefresh} style={{ minWidth: 'unset', padding: '1px 6px', fontSize: 10 }}>↻</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {models.length === 0 && (
          <div style={{ padding: 12, fontSize: 11, color: '#aaa', fontFamily: 'var(--font-mono)' }}>
            No models yet.<br />Configure and train one →
          </div>
        )}
        {models.map(m => (
          <div
            key={m.id}
            onClick={() => onSelect(m.id)}
            style={{
              padding: '6px 8px', cursor: 'pointer',
              background: m.id === selectedId ? '#c5d8f5' : 'transparent',
              borderBottom: '1px solid #ddd',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: '#222' }}>
                {m.name || m.id.slice(0, 12)}
              </span>
              <StatusBadge status={m.status} />
            </div>
            {m.architecture && (
              <div style={{ fontSize: 10, color: '#666', fontFamily: 'var(--font-mono)' }}>
                [{m.architecture.join(' → ')}]
              </div>
            )}
            <div style={{ fontSize: 9, color: '#aaa', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
              {m.created_at?.slice(0, 16).replace('T', ' ')}
              {m.train_mse !== null && m.train_mse !== undefined ? ` · MSE ${m.train_mse.toFixed(4)}` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Train Config (right column) ───────────────────────────────────────────────
function TrainPanel({ selectedModel, onTrainComplete, globalStats }) {
  const [hidden, setHidden]   = useState('32, 16');
  const [maxIter, setMaxIter] = useState('200');
  const [lr, setLr]           = useState('0.001');
  const [name, setName]       = useState('');
  const [runId, setRunId]     = useState('');
  const [training, setTraining] = useState(false);
  const [msg, setMsg]         = useState(null);
  const { onEvent }           = useWsStore();

  useEffect(() => {
    const u1 = onEvent('model.training.started',  () => { setTraining(true); setMsg(null); });
    const u2 = onEvent('model.training.complete', (_, p) => {
      setTraining(false);
      setMsg({ ok: true, text: `Done! MSE=${p.mse?.toFixed(4)} R²=${p.r2?.toFixed(3)}` });
      onTrainComplete?.();
    });
    const u3 = onEvent('model.training.error', (_, p) => {
      setTraining(false);
      setMsg({ ok: false, text: p.error });
    });
    return () => { u1(); u2(); u3(); };
  }, [onEvent, onTrainComplete]);

  const handleTrain = async () => {
    const hiddenLayers = hidden.split(',').map(s => parseInt(s.trim())).filter(n => n > 0);
    if (hiddenLayers.length === 0) { setMsg({ ok: false, text: 'Invalid hidden layers' }); return; }
    setMsg(null);
    try {
      const res = await fetch(`${API}/models/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hidden_layers: hiddenLayers,
          max_iter: parseInt(maxIter) || 200,
          learning_rate: parseFloat(lr) || 0.001,
          name: name || undefined,
          run_id: runId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setMsg({ ok: false, text: err.detail || 'Server error' });
      }
    } catch (e) {
      setMsg({ ok: false, text: String(e) });
    }
  };

  return (
    <div style={{
      width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column',
      borderLeft: '2px solid var(--bevel-outer-br)',
      background: 'var(--w95-gray)', overflowY: 'auto',
    }}>

      {/* Train config */}
      <SectionLabel>Train Config</SectionLabel>
      <div style={{ padding: '0 8px 8px' }}>
        <W95Field label="Name (optional)" value={name} onChange={setName} />
        <W95Field label="Hidden layers (e.g. 32, 16)" value={hidden} onChange={setHidden} />
        <W95Field label="Max iterations" value={maxIter} onChange={setMaxIter} type="number" min="10" max="2000" />
        <W95Field label="Learning rate" value={lr} onChange={setLr} type="number" min="0.0001" max="0.1" step="0.0001" />
        <W95Field label="Filter by run ID (optional)" value={runId} onChange={setRunId} />

        <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
          <button
            onClick={handleTrain}
            disabled={training}
            style={{
              flex: 1,
              background: training ? '#ccc' : 'var(--w95-gray)',
              fontFamily: 'var(--font-mono)', fontSize: 11,
            }}
          >
            {training ? '◌ Training…' : '▶ Train'}
          </button>
        </div>

        {msg && (
          <div style={{
            marginTop: 6, padding: '3px 6px', fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: msg.ok ? '#006600' : '#cc0000',
            border: `1px solid ${msg.ok ? '#006600' : '#cc0000'}`,
            background: msg.ok ? '#f0fff0' : '#fff0f0',
          }}>
            {msg.text}
          </div>
        )}
      </div>

      <div style={{ height: 2, background: 'var(--bevel-br)', flexShrink: 0 }} />

      {/* Global dataset stats */}
      <SectionLabel>Dataset</SectionLabel>
      <div style={{ padding: '0 8px 8px' }}>
        <MetricBox label="Total samples" value={globalStats?.total_samples ?? 0} />
        <MetricBox label="Total runs"    value={globalStats?.total_runs ?? 0} />
      </div>

      <div style={{ height: 2, background: 'var(--bevel-br)', flexShrink: 0 }} />

      {/* Selected model metrics */}
      {selectedModel && (
        <>
          <SectionLabel>Selected Model Metrics</SectionLabel>
          <div style={{ padding: '0 8px 8px' }}>
            <MetricBox label="Status"     value={selectedModel.status} />
            <MetricBox label="Samples"    value={selectedModel.n_samples} />
            <MetricBox label="Iterations" value={selectedModel.max_iter} />
            <MetricBox
              label="Train MSE"
              value={selectedModel.train_mse?.toFixed(5) ?? '—'}
              good={selectedModel.train_mse !== null && selectedModel.train_mse < 0.1}
            />
            <MetricBox
              label="R² score"
              value={selectedModel.train_r2?.toFixed(4) ?? '—'}
              good={selectedModel.train_r2 !== null && selectedModel.train_r2 > 0.5}
            />
            <MetricBox label="Architecture" value={selectedModel.architecture?.join(' → ')} />
            {selectedModel.status === 'complete' && (
              <div style={{ marginTop: 6 }}>
                <a
                  href={`${API}/models/${selectedModel.id}/download`}
                  style={{
                    display: 'block', textAlign: 'center',
                    padding: '3px 8px', fontSize: 11, fontFamily: 'var(--font-mono)',
                    background: 'var(--w95-gray)',
                    border: '2px solid', textDecoration: 'none', color: 'var(--text-on-gray)',
                    borderColor: 'var(--bevel-tl) var(--bevel-outer-br) var(--bevel-outer-br) var(--bevel-tl)',
                  }}
                >
                  ⬇ Export ONNX
                </a>
              </div>
            )}
            {selectedModel.error && (
              <div style={{ marginTop: 4, fontSize: 10, color: '#cc0000', fontFamily: 'var(--font-mono)', wordBreak: 'break-word' }}>
                {selectedModel.error}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Main ModelLab ─────────────────────────────────────────────────────────────
export default function ModelLab() {
  const [models, setModels]             = useState([]);
  const [selectedId, setSelectedId]     = useState(null);
  const [isTraining, setIsTraining]     = useState(false);
  const [liveLoss, setLiveLoss]         = useState([]);
  const [globalStats, setGlobalStats]   = useState(null);
  const { onEvent } = useWsStore();

  const selectedModel = models.find(m => m.id === selectedId) ?? null;
  const displayArch   = selectedModel?.architecture ?? null;
  const lossCurve     = selectedModel?.loss_curve ?? liveLoss;

  const fetchModels = useCallback(async () => {
    try {
      const [mr, sr] = await Promise.all([
        fetch(`${API}/models`),
        fetch(`${API}/samples/stats`),
      ]);
      const [ms, stats] = await Promise.all([mr.json(), sr.json()]);
      setModels(Array.isArray(ms) ? ms : []);
      setGlobalStats(stats);
    } catch (e) { console.error('ModelLab fetch', e); }
  }, []);

  useEffect(() => { fetchModels(); }, [fetchModels]);

  useEffect(() => {
    const u1 = onEvent('model.training.started',  (_, p) => {
      setIsTraining(true);
      setLiveLoss([]);
      setSelectedId(p.model_id);
    });
    const u2 = onEvent('model.training.complete', (_, p) => {
      setIsTraining(false);
      setLiveLoss(p.loss_curve ?? []);
      fetchModels();
    });
    const u3 = onEvent('model.training.error', () => {
      setIsTraining(false);
      fetchModels();
    });
    return () => { u1(); u2(); u3(); };
  }, [onEvent, fetchModels]);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>

      <ModelsLibrary
        models={models}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onRefresh={fetchModels}
      />

      {/* Center: 3D viz (top) + loss chart (bottom) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* 3D Visualization — 65% height */}
        <div style={{ flex: '0 0 65%', overflow: 'hidden', position: 'relative' }}>
          <ModelViz3D architecture={displayArch} isTraining={isTraining} />

          {/* Architecture overlay */}
          {displayArch && (
            <div style={{
              position: 'absolute', top: 8, left: 8,
              background: 'rgba(5,5,16,0.75)',
              padding: '4px 8px', fontFamily: 'var(--font-mono)', fontSize: 10,
              color: '#8888ff', border: '1px solid #333',
            }}>
              [{displayArch.join(' → ')}] · {displayArch.reduce((a, b) => a + b, 0)} units
            </div>
          )}

          {isTraining && (
            <div style={{
              position: 'absolute', top: 8, right: 8,
              background: 'rgba(255,120,0,0.15)',
              padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 11,
              color: '#ff8844', border: '1px solid #ff8844',
              animation: 'none',
            }}>
              ◌ TRAINING
            </div>
          )}

          {!selectedModel && !isTraining && (
            <div style={{
              position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center',
              fontFamily: 'var(--font-pixel)', fontSize: 13,
              color: 'rgba(100,100,180,0.6)',
              letterSpacing: '0.05em',
            }}>
              select a model or train a new one
            </div>
          )}
        </div>

        {/* Loss chart — 35% height */}
        <div style={{
          flex: '0 0 35%', borderTop: '2px solid var(--bevel-outer-br)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '2px 8px', borderBottom: '1px solid #333',
            background: '#0a0a14', flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#555' }}>
              LOSS CURVE
            </span>
            {isTraining && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#ff8844' }}>
                live
              </span>
            )}
            {lossCurve.length > 0 && !isTraining && (
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#8844ff' }}>
                {lossCurve.length} iters · final {lossCurve[lossCurve.length - 1].toFixed(5)}
              </span>
            )}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <LossChart lossCurve={lossCurve} isTraining={isTraining} />
          </div>
        </div>
      </div>

      <TrainPanel
        selectedModel={selectedModel}
        onTrainComplete={fetchModels}
        globalStats={globalStats}
      />
    </div>
  );
}
