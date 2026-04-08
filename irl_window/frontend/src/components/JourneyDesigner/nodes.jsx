/**
 * Journey Designer nodes — styled as Windows 95 windows.
 * Each node has: title bar (icon + label + min/restore/X), body (normal/maximized), minimized state.
 *
 * States:
 *   normal    — compact read-only field display
 *   minimized — title bar only (collapsed)
 *   maximized — expanded with editable input fields
 */

import { useState } from 'react';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import useWsStore from '../../store/ws';

// ── Win95 primitives ──────────────────────────────────────────────────────────

function TitleBarBtn({ children, onClick, title }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      title={title}
      style={{
        width: 16, height: 14,
        minWidth: 'unset',
        padding: '0',
        fontSize: 10,
        lineHeight: '12px',
        fontFamily: 'var(--font-mono)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        fontWeight: 'bold',
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 2, alignItems: 'baseline' }}>
      <span style={{ color: 'var(--text-dim)', fontSize: 11, minWidth: 80, flexShrink: 0 }}>{label}:</span>
      <span style={{ color: 'var(--text-on-gray)', fontSize: 11, wordBreak: 'break-all' }}>{value ?? '—'}</span>
    </div>
  );
}

function EditField({ label, value, onChange, type = 'text' }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, marginBottom: 2 }}>{label}:</div>
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        className="nodrag nopan"
        style={{ width: '100%', fontSize: 11, boxSizing: 'border-box' }}
      />
    </div>
  );
}

function EditTextarea({ label, value, onChange }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, marginBottom: 2 }}>{label}:</div>
      <textarea
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        rows={3}
        className="nodrag nopan"
        style={{ width: '100%', fontSize: 11, resize: 'vertical', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }}
      />
    </div>
  );
}

// ── Win95 Window wrapper ──────────────────────────────────────────────────────

function Win95Window({ id, icon, title, accentColor, handles, children, editChildren }) {
  const [windowState, setWindowState] = useState('normal'); // 'normal' | 'minimized' | 'maximized'
  const { deleteElements } = useReactFlow();

  const toggle = (target) => setWindowState(s => s === target ? 'normal' : target);
  const onClose = () => deleteElements({ nodes: [{ id }] });

  const isMin = windowState === 'minimized';
  const isMax = windowState === 'maximized';

  return (
    <div style={{
      background: 'var(--w95-gray)',
      border: '2px solid',
      borderColor: 'var(--bevel-tl) var(--bevel-outer-br) var(--bevel-outer-br) var(--bevel-tl)',
      boxShadow: 'inset 1px 1px 0 var(--w95-white), inset -1px -1px 0 var(--bevel-br), 2px 2px 0 rgba(0,0,0,0.4)',
      minWidth: isMax ? 260 : 200,
      maxWidth: isMax ? 340 : 240,
      userSelect: 'none',
    }}>
      {/* Title bar */}
      <div style={{
        background: 'var(--titlebar-active)',
        padding: '2px 3px',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        cursor: 'move',
      }}>
        <span style={{ fontSize: 12, flexShrink: 0 }}>{icon}</span>
        <span style={{
          color: 'var(--text-on-title)',
          fontSize: 12,
          fontFamily: 'var(--font-pixel)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: '0.03em',
        }}>{title}</span>

        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <TitleBarBtn onClick={() => toggle('minimized')} title="Minimize">_</TitleBarBtn>
          <TitleBarBtn onClick={() => toggle('maximized')} title={isMax ? 'Restore' : 'Maximize'}>
            {isMax ? '❐' : '□'}
          </TitleBarBtn>
          <TitleBarBtn onClick={onClose} title="Delete node">✕</TitleBarBtn>
        </div>
      </div>

      {/* Body */}
      {!isMin && (
        <div style={{ padding: '6px 8px', borderTop: '1px solid var(--bevel-br)' }}>
          {/* Accent strip */}
          <div style={{
            height: 3,
            background: accentColor,
            marginBottom: 8,
            border: '1px solid',
            borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)',
          }} />
          {isMax ? editChildren : children}
        </div>
      )}

      {/* Handles */}
      {handles?.left  && <Handle type="target" position={Position.Left}  style={{ background: 'var(--w95-gray)', border: '2px solid var(--bevel-outer-br)', borderRadius: 0, width: 10, height: 10 }} />}
      {handles?.right && <Handle type="source" position={Position.Right} style={{ background: 'var(--w95-gray)', border: '2px solid var(--bevel-outer-br)', borderRadius: 0, width: 10, height: 10 }} />}
    </div>
  );
}

// ── Node types ────────────────────────────────────────────────────────────────

export function ArchetypeNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const upd = (k, v) => updateNodeData(id, { [k]: v });

  return (
    <Win95Window id={id} icon="👤" title="Archetype" accentColor="#7c6af7" handles={{ right: true }}
      editChildren={<>
        <EditField label="Archetype Type" value={data.archetype_type} onChange={v => upd('archetype_type', v)} />
        <EditField label="Age Range"      value={data.age_range}      onChange={v => upd('age_range', v)} />
        <EditField label="Charisma"       value={data.charisma}       onChange={v => upd('charisma', v)} />
        <EditField label="Social Anxiety" value={data.social_anxiety} onChange={v => upd('social_anxiety', v)} />
      </>}
    >
      <Field label="type"     value={data.archetype_type ?? 'growth_mindset'} />
      <Field label="age"      value={data.age_range ?? '18–28'} />
      <Field label="charisma" value={data.charisma ?? '0.3–0.6'} />
      <Field label="anxiety"  value={data.social_anxiety ?? '0.5–0.8'} />
    </Win95Window>
  );
}

// ── Goal Node ─────────────────────────────────────────────────────────────────
export function GoalNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const upd = (k, v) => updateNodeData(id, { [k]: v });
  return (
    <Win95Window id={id} icon="🎯" title="Goal" accentColor="#c8a000" handles={{ left: true, right: true }}
      editChildren={<>
        <EditTextarea label="Goal Text" value={data.goal_text} onChange={v => upd('goal_text', v)} />
        <EditField    label="Horizon"   value={data.horizon}   onChange={v => upd('horizon', v)} />
      </>}
    >
      <Field label="goal"    value={data.goal_text ?? 'get a girlfriend'} />
      <Field label="horizon" value={data.horizon ?? '12 months'} />
    </Win95Window>
  );
}

// ── Phase Node ────────────────────────────────────────────────────────────────
const PHASE_COLORS = {
  struggle:    '#cc2200',
  growth:      '#007700',
  plateau:     '#808080',
  breakthrough:'#000080',
  spiral:      '#cc6600',
  return:      '#007700',
};

export function PhaseNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const upd = (k, v) => updateNodeData(id, { [k]: v });
  const color = PHASE_COLORS[data.phase_type] ?? '#808080';
  const title = `Phase: ${data.phase_type ?? 'struggle'}`;
  return (
    <Win95Window id={id} icon="📅" title={title} accentColor={color} handles={{ left: true, right: true }}
      editChildren={<>
        <EditField label="Phase Type"    value={data.phase_type}        onChange={v => upd('phase_type', v)} />
        <EditField label="Duration"      value={data.duration}          onChange={v => upd('duration', v)} />
        <EditField label="Action Freq"   value={data.action_frequency}  onChange={v => upd('action_frequency', v)} />
        <EditField label="Outcome Bias"  value={data.outcome_bias}      onChange={v => upd('outcome_bias', v)} />
      </>}
    >
      <Field label="duration" value={data.duration ?? '4–8 weeks'} />
      <Field label="freq"     value={data.action_frequency ?? '2–3 / week'} />
      <Field label="bias"     value={data.outcome_bias ?? '−0.6 to −0.2'} />
    </Win95Window>
  );
}

// ── Voice Node ────────────────────────────────────────────────────────────────
export function VoiceNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const upd = (k, v) => updateNodeData(id, { [k]: v });
  return (
    <Win95Window id={id} icon="🗣️" title="Voice / Mindset" accentColor="#006060" handles={{ left: true, right: true }}
      editChildren={<>
        <EditField label="Locus"        value={data.locus}          onChange={v => upd('locus', v)} />
        <EditField label="Emotional Tone" value={data.emotional_tone} onChange={v => upd('emotional_tone', v)} />
        <EditField label="Self-Awareness" value={data.self_awareness} onChange={v => upd('self_awareness', v)} />
      </>}
    >
      <Field label="locus"     value={data.locus ?? 'internal'} />
      <Field label="tone"      value={data.emotional_tone ?? 'neutral'} />
      <Field label="awareness" value={data.self_awareness ?? 'high'} />
    </Win95Window>
  );
}

// ── Time Gap Node ─────────────────────────────────────────────────────────────
export function TimeGapNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const upd = (k, v) => updateNodeData(id, { [k]: v });
  return (
    <Win95Window id={id} icon="⏸️" title="Time Gap" accentColor="#444444" handles={{ left: true, right: true }}
      editChildren={<>
        <EditField label="Duration"   value={data.gap_duration} onChange={v => upd('gap_duration', v)} />
        <EditField label="Stat Drift" value={data.stat_drift}   onChange={v => upd('stat_drift', v)} />
      </>}
    >
      <Field label="duration"  value={data.gap_duration ?? '2–6 months'} />
      <Field label="stat drift" value={data.stat_drift ?? 'fitness −0.05'} />
    </Win95Window>
  );
}

// ── Event Node ────────────────────────────────────────────────────────────────
export function EventNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const upd = (k, v) => updateNodeData(id, { [k]: v });
  return (
    <Win95Window id={id} icon="⚡" title="Event (External)" accentColor="#cc6600" handles={{ left: true, right: true }}
      editChildren={<>
        <EditField label="Event Type"  value={data.event_type}       onChange={v => upd('event_type', v)} />
        <EditField label="Probability" value={data.probability}      onChange={v => upd('probability', v)} />
        <EditField label="Outcome"     value={data.outcome_override} onChange={v => upd('outcome_override', v)} />
      </>}
    >
      <Field label="type"        value={data.event_type ?? 'lucky_break'} />
      <Field label="probability" value={data.probability ?? '0.3'} />
      <Field label="outcome"     value={data.outcome_override ?? '+0.8'} />
    </Win95Window>
  );
}

// ── Generate Node ─────────────────────────────────────────────────────────────
export function GenerateNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const { sendCommand, connected } = useWsStore();
  const upd = (k, v) => updateNodeData(id, { [k]: v });

  const n = data.n_personas ?? 3;

  const handleGenerate = () => {
    if (!connected) return;
    sendCommand(`generate ${n} --provider ${data.provider ?? 'ollama'} --model ${data.model ?? 'llama3.2:1b'}`);
  };

  return (
    <Win95Window id={id} icon="▶" title="Generate" accentColor="#007700" handles={{ left: true }}
      editChildren={<>
        <EditField label="N Personas" value={n}             onChange={v => upd('n_personas', Number(v))} type="number" />
        <EditField label="Provider"   value={data.provider} onChange={v => upd('provider', v)} />
        <EditField label="Model"      value={data.model}    onChange={v => upd('model', v)} />
      </>}
    >
      <Field label="personas" value={n} />
      <Field label="provider" value={data.provider ?? 'ollama'} />
      <Field label="model"    value={data.model ?? 'llama3.2:1b'} />

      {/* Win95-style dialog button row */}
      <div style={{
        marginTop: 8,
        paddingTop: 6,
        borderTop: '1px solid var(--bevel-br)',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <button
          onClick={handleGenerate}
          style={{
            minWidth: 80,
            background: connected ? 'var(--w95-gray)' : '#d4d0c8',
            color: connected ? 'var(--text-on-gray)' : 'var(--text-dim)',
          }}
        >
          ▶ Run
        </button>
      </div>
    </Win95Window>
  );
}

export const NODE_TYPES = {
  archetype: ArchetypeNode,
  goal:      GoalNode,
  phase:     PhaseNode,
  voice:     VoiceNode,
  time_gap:  TimeGapNode,
  event:     EventNode,
  generate:  GenerateNode,
};
