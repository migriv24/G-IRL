/**
 * Sample Viewer — multi-mode browser for generated samples.
 * Modes: Raw (journal text) | Structured (full record) | Overview (stats)
 * Supports: delete individual samples, delete whole runs, delete by keyword/phase
 */
import { useState, useEffect, useCallback } from 'react';
import useContextStore from '../../store/context';

const API = 'http://localhost:8000/api';

// ── Primitives ────────────────────────────────────────────────────────────────

function W95Btn({ children, active, onClick, small, danger, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '1px 8px' : '3px 14px',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        background: danger ? '#ffdddd' : active ? '#aaaaaa' : 'var(--w95-gray)',
        color: danger ? '#cc0000' : 'var(--text-on-gray)',
        border: '2px solid',
        borderColor: active
          ? 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)'
          : 'var(--bevel-tl) var(--bevel-outer-br) var(--bevel-outer-br) var(--bevel-tl)',
        cursor: disabled ? 'default' : 'pointer',
        userSelect: 'none', minWidth: 'unset', textTransform: 'none', letterSpacing: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

const PHASE_COLORS = {
  struggle:     { bg: '#6b2b2b', fg: '#ffaaaa' },
  growth:       { bg: '#2b5c2b', fg: '#aaffaa' },
  plateau:      { bg: '#3a3a6b', fg: '#aaaaff' },
  breakthrough: { bg: '#5c4a0a', fg: '#ffe090' },
  return:       { bg: '#2b5c5c', fg: '#aaffff' },
};

function PhaseBadge({ phase }) {
  const c = PHASE_COLORS[phase] ?? { bg: '#444', fg: '#ccc' };
  return (
    <span style={{
      background: c.bg, color: c.fg, padding: '1px 6px',
      fontSize: 10, fontFamily: 'var(--font-mono)',
      border: `1px solid ${c.fg}44`, flexShrink: 0,
    }}>{phase}</span>
  );
}

function OutcomeBar({ value }) {
  const pct = ((value + 1) / 2) * 100;
  const color = value < -0.3 ? '#ff4444' : value < 0.3 ? '#aaaaaa' : '#44ff44';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <div style={{ width: 48, height: 7, background: '#222', border: '1px solid #444', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: color }} />
      </div>
      <span style={{ color, fontSize: 10, fontFamily: 'var(--font-mono)', width: 34 }}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  );
}

// ── Win95 confirm dialog ──────────────────────────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <>
      <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 2000 }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 2001, background: 'var(--w95-gray)',
        border: '2px solid', borderColor: 'var(--bevel-tl) var(--bevel-outer-br) var(--bevel-outer-br) var(--bevel-tl)',
        boxShadow: '2px 2px 0 rgba(0,0,0,0.5)',
        minWidth: 300,
      }}>
        <div style={{ background: 'var(--titlebar-active)', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>⚠</span>
          <span style={{ color: 'white', fontFamily: 'var(--font-pixel)', fontSize: 12 }}>Confirm Delete</span>
        </div>
        <div style={{ padding: '14px 16px', fontSize: 12, fontFamily: 'var(--font-mono)', lineHeight: 1.5 }}>
          {message}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '8px 12px',
          borderTop: '1px solid var(--bevel-br)' }}>
          <W95Btn onClick={onConfirm} danger>Delete</W95Btn>
          <W95Btn onClick={onCancel}>Cancel</W95Btn>
        </div>
      </div>
    </>
  );
}

// ── RAW MODE ─────────────────────────────────────────────────────────────────
function RawMode({ samples, selectedId, onSelect, onDeleteSample, setSampleContext }) {
  const selected = samples.find(s => s.id === selectedId);

  const handleSelect = (s) => {
    onSelect(s.id);
    setSampleContext(s.id, s);
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* List */}
      <div style={{ width: 280, flexShrink: 0, overflowY: 'auto', borderRight: '2px solid var(--bevel-outer-br)', background: '#fff' }}>
        {samples.length === 0 && (
          <div style={{ padding: 16, color: '#888', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
            No samples yet. Run <strong>generate</strong> in the terminal.
          </div>
        )}
        {samples.map(s => (
          <div
            key={s.id}
            onClick={() => handleSelect(s)}
            style={{
              padding: '5px 8px', borderBottom: '1px solid #ddd', cursor: 'pointer',
              background: s.id === selectedId ? '#c5d8f5' : 'transparent',
              display: 'flex', flexDirection: 'column', gap: 2,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, color: '#666', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>#{s.id}</span>
              <PhaseBadge phase={s.phase} />
              <OutcomeBar value={s.outcome} />
              <button
                onClick={e => { e.stopPropagation(); onDeleteSample(s.id); }}
                title="Delete this sample"
                style={{
                  marginLeft: 'auto', border: 'none', background: 'none',
                  cursor: 'pointer', color: '#ccc', fontSize: 11, padding: '0 2px',
                  flexShrink: 0,
                }}
                onMouseEnter={e => e.target.style.color = '#cc0000'}
                onMouseLeave={e => e.target.style.color = '#ccc'}
              >✕</button>
            </div>
            <div style={{ fontSize: 11, color: '#333', lineHeight: 1.4, overflow: 'hidden',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {s.text}
            </div>
          </div>
        ))}
      </div>

      {/* Detail pane */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, background: '#f8f8f8' }}>
        {!selected ? (
          <div style={{ color: '#aaa', fontSize: 12, fontFamily: 'var(--font-mono)', marginTop: 40, textAlign: 'center' }}>
            ← select a sample
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <PhaseBadge phase={selected.phase} />
              <OutcomeBar value={selected.outcome} />
              <span style={{ fontSize: 10, color: '#888', fontFamily: 'var(--font-mono)' }}>locus: {selected.locus}</span>
              <span style={{ fontSize: 10, color: '#888', fontFamily: 'var(--font-mono)' }}>goal: {selected.goal}</span>
              <button
                onClick={() => onDeleteSample(selected.id)}
                style={{
                  marginLeft: 'auto', padding: '2px 10px', fontSize: 11,
                  fontFamily: 'var(--font-mono)', background: '#ffdddd', color: '#cc0000',
                  border: '2px solid', borderColor: 'var(--bevel-tl) var(--bevel-outer-br) var(--bevel-outer-br) var(--bevel-tl)',
                  cursor: 'pointer',
                }}
              >
                ✕ Delete
              </button>
            </div>
            <div style={{
              background: '#fff', border: '1px solid #ddd', padding: 16,
              fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.8,
              color: '#222', whiteSpace: 'pre-wrap',
            }}>
              {selected.text}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: '#aaa', fontFamily: 'var(--font-mono)' }}>
              {selected.created_at} · run {selected.run_id?.slice(0, 8)}…
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── STRUCTURED MODE ──────────────────────────────────────────────────────────
function StructuredMode({ samples, selectedId, onSelect, onDeleteSample, setSampleContext }) {
  const selected = samples.find(s => s.id === selectedId) ?? samples[0];

  const handleSelect = (s) => {
    onSelect(s.id);
    setSampleContext(s.id, s);
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div style={{ width: 200, flexShrink: 0, overflowY: 'auto', borderRight: '2px solid var(--bevel-outer-br)', background: '#111' }}>
        {samples.map(s => (
          <div
            key={s.id}
            onClick={() => handleSelect(s)}
            style={{
              padding: '4px 8px', cursor: 'pointer',
              background: s.id === selectedId ? '#1a3a1a' : 'transparent',
              borderBottom: '1px solid #222',
              display: 'flex', gap: 5, alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 10, color: '#555', fontFamily: 'var(--font-mono)' }}>#{s.id}</span>
            <PhaseBadge phase={s.phase} />
            <button
              onClick={e => { e.stopPropagation(); onDeleteSample(s.id); }}
              style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: '#555', fontSize: 10 }}
              onMouseEnter={e => e.target.style.color = '#ff4444'}
              onMouseLeave={e => e.target.style.color = '#555'}
            >✕</button>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', background: '#0d0d0d', padding: 12 }}>
        {selected ? (
          <pre style={{ margin: 0, fontSize: 11, fontFamily: 'var(--font-mono)', color: '#aaffaa', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {JSON.stringify(selected, null, 2)}
          </pre>
        ) : (
          <div style={{ color: '#555', fontFamily: 'var(--font-mono)', fontSize: 11 }}>no samples</div>
        )}
      </div>
    </div>
  );
}

// ── OVERVIEW MODE ─────────────────────────────────────────────────────────────
function StatBox({ label, value }) {
  return (
    <div style={{
      border: '2px solid', padding: '10px 16px', minWidth: 120,
      borderColor: 'var(--bevel-tl) var(--bevel-outer-br) var(--bevel-outer-br) var(--bevel-tl)',
      background: 'var(--w95-gray)',
    }}>
      <div style={{ fontSize: 22, fontFamily: 'var(--font-mono)', color: '#000', fontWeight: 'bold' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#555', fontFamily: 'var(--font-mono)' }}>{label}</div>
    </div>
  );
}

function PhaseRow({ phase, count, avg_outcome }) {
  const c = PHASE_COLORS[phase] ?? { bg: '#444', fg: '#ccc' };
  const barW = Math.round(Math.abs(avg_outcome) * 80);
  const barColor = avg_outcome < 0 ? '#ff4444' : '#44ff44';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderBottom: '1px solid #ccc' }}>
      <PhaseBadge phase={phase} />
      <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', width: 30, textAlign: 'right' }}>{count}</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 80, height: 10, background: '#ddd', position: 'relative' }}>
          <div style={{ position: 'absolute', left: avg_outcome >= 0 ? '50%' : `calc(50% - ${barW / 2}px)`, width: barW / 2, height: '100%', background: barColor }} />
        </div>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: avg_outcome < 0 ? '#c00' : '#060' }}>
          avg {avg_outcome >= 0 ? '+' : ''}{avg_outcome.toFixed(3)}
        </span>
      </div>
    </div>
  );
}

function OverviewMode({ stats, runs, selectedRunId, onSelectRun, onDeleteRun }) {
  const displayStats = stats ?? { total_samples: 0, total_runs: 0, by_phase: [] };
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatBox label="total samples" value={displayStats.total_samples} />
        <StatBox label="total runs" value={displayStats.total_runs} />
        <StatBox label="phases tracked" value={displayStats.by_phase?.length ?? 0} />
      </div>

      {displayStats.by_phase?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 'bold', marginBottom: 6, color: '#333' }}>PHASE BREAKDOWN</div>
          <div style={{ border: '2px solid', borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)', background: '#fff' }}>
            {displayStats.by_phase.map(p => <PhaseRow key={p.phase} {...p} />)}
          </div>
        </div>
      )}

      {runs?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 'bold', marginBottom: 6, color: '#333' }}>GENERATED RUNS</div>
          <div style={{ border: '2px solid', borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)', background: '#fff' }}>
            {runs.map(r => (
              <div
                key={r.id}
                onClick={() => onSelectRun(r.id)}
                style={{
                  padding: '5px 10px', borderBottom: '1px solid #eee', cursor: 'pointer',
                  display: 'flex', gap: 10, alignItems: 'center',
                  background: r.id === selectedRunId ? '#c5d8f5' : 'transparent',
                }}
              >
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#888' }}>{r.id.slice(0, 8)}…</span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)' }}>n={r.n}</span>
                <span style={{ fontSize: 10, color: '#666', fontFamily: 'var(--font-mono)' }}>{r.provider}</span>
                <span style={{ fontSize: 10, color: '#aaa', fontFamily: 'var(--font-mono)', flex: 1 }}>
                  {r.created_at?.slice(0, 19).replace('T', ' ')}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); onDeleteRun(r.id, r.n); }}
                  title="Delete this run and all its samples"
                  style={{
                    border: 'none', background: 'none', cursor: 'pointer',
                    color: '#ccc', fontSize: 12, padding: '0 4px', flexShrink: 0,
                  }}
                  onMouseEnter={e => e.target.style.color = '#cc0000'}
                  onMouseLeave={e => e.target.style.color = '#ccc'}
                >🗑</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {displayStats.total_samples === 0 && (
        <div style={{ color: '#aaa', fontSize: 12, fontFamily: 'var(--font-mono)', textAlign: 'center', marginTop: 40 }}>
          No samples generated yet.<br />Run <strong>generate N</strong> in the terminal.
        </div>
      )}
    </div>
  );
}

// ── Main SampleViewer ─────────────────────────────────────────────────────────
export default function SampleViewer() {
  const [mode, setMode]           = useState('overview');
  const [samples, setSamples]     = useState([]);
  const [runs, setRuns]           = useState([]);
  const [stats, setStats]         = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filterRunId, setFilterRunId] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [confirm, setConfirm]     = useState(null);   // { message, onConfirm }

  // Keyword-delete toolbar state
  const [keyword, setKeyword]     = useState('');
  const [showKeyword, setShowKeyword] = useState(false);

  const setSampleContext = useContextStore(s => s.setSampleContext);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sr, rr, str] = await Promise.all([
        fetch(`${API}/samples?limit=500${filterRunId ? `&run_id=${filterRunId}` : ''}`),
        fetch(`${API}/runs`),
        fetch(`${API}/samples/stats`),
      ]);
      const [s, r, st] = await Promise.all([sr.json(), rr.json(), str.json()]);
      setSamples(Array.isArray(s) ? s : []);
      setRuns(Array.isArray(r) ? r : []);
      setStats(st);
    } catch (e) { console.error('SampleViewer fetch', e); }
    finally { setLoading(false); }
  }, [filterRunId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Delete helpers ────────────────────────────────────────────────────────
  const deleteSample = useCallback((id) => {
    setConfirm({
      message: `Delete sample #${id}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null);
        await fetch(`${API}/samples/${id}`, { method: 'DELETE' });
        if (selectedId === id) { setSelectedId(null); setSampleContext(null, null); }
        fetchAll();
      },
    });
  }, [selectedId, fetchAll, setSampleContext]);

  const deleteRun = useCallback((runId, n) => {
    setConfirm({
      message: `Delete entire run (${n} samples)? This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null);
        await fetch(`${API}/runs/${runId}`, { method: 'DELETE' });
        if (filterRunId === runId) setFilterRunId(null);
        fetchAll();
      },
    });
  }, [filterRunId, fetchAll]);

  const deleteByKeyword = useCallback(() => {
    if (!keyword.trim()) return;
    setConfirm({
      message: `Delete all samples containing "${keyword}"? This cannot be undone.`,
      onConfirm: async () => {
        setConfirm(null);
        await fetch(`${API}/samples?keyword=${encodeURIComponent(keyword)}`, { method: 'DELETE' });
        setKeyword('');
        setShowKeyword(false);
        fetchAll();
      },
    });
  }, [keyword, fetchAll]);

  const handleSelectRun = (runId) => {
    setFilterRunId(prev => prev === runId ? null : runId);
    setMode('raw');
  };

  const MODES = [
    { id: 'overview', label: 'Overview' },
    { id: 'raw', label: 'Raw Text' },
    { id: 'structured', label: 'Structured' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--w95-gray)' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
        borderBottom: '2px solid var(--bevel-outer-br)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#444', marginRight: 4 }}>View:</span>
        {MODES.map(m => (
          <W95Btn key={m.id} active={mode === m.id} onClick={() => setMode(m.id)} small>{m.label}</W95Btn>
        ))}

        <div style={{ width: 1, height: 16, background: '#aaa', margin: '0 4px' }} />

        {/* Keyword delete */}
        {showKeyword ? (
          <>
            <input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && deleteByKeyword()}
              placeholder="keyword…"
              style={{ fontSize: 11, width: 110, padding: '1px 4px' }}
              autoFocus
            />
            <W95Btn onClick={deleteByKeyword} danger small disabled={!keyword.trim()}>Delete matches</W95Btn>
            <W95Btn onClick={() => { setShowKeyword(false); setKeyword(''); }} small>✕</W95Btn>
          </>
        ) : (
          <W95Btn onClick={() => setShowKeyword(true)} small>🗑 By keyword</W95Btn>
        )}

        <div style={{ flex: 1 }} />

        {filterRunId && (
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#666', background: '#e0e0e0', padding: '2px 6px' }}>
            run: {filterRunId.slice(0, 8)}…
            <button onClick={() => setFilterRunId(null)} style={{ marginLeft: 4, border: 'none', background: 'none', cursor: 'pointer', color: '#c00', fontWeight: 'bold', fontSize: 11 }}>✕</button>
          </span>
        )}

        <W95Btn onClick={fetchAll} small>{loading ? '↻ …' : '↻'}</W95Btn>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#888' }}>{samples.length} samples</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {mode === 'raw' && (
          <RawMode
            samples={samples} selectedId={selectedId} onSelect={setSelectedId}
            onDeleteSample={deleteSample} setSampleContext={setSampleContext}
          />
        )}
        {mode === 'structured' && (
          <StructuredMode
            samples={samples} selectedId={selectedId} onSelect={setSelectedId}
            onDeleteSample={deleteSample} setSampleContext={setSampleContext}
          />
        )}
        {mode === 'overview' && (
          <OverviewMode
            stats={stats} runs={runs} selectedRunId={filterRunId}
            onSelectRun={handleSelectRun} onDeleteRun={deleteRun}
          />
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
