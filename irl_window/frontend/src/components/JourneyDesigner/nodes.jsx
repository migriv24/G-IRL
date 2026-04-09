/**
 * Journey Designer nodes — styled as Windows 95 windows.
 *
 * States:
 *   normal    — compact read-only display
 *   minimized — title bar only
 *   maximized — expanded editable state
 *
 * Internal stat storage: normalized floats (0.0–1.0).
 * Display scale: integers (DnD: 3–18, age: years, adherence: 0–100%).
 * LLM prompt output: descriptive words (see backend/utils/stat_words.py).
 * Research basis: verbal descriptors outperform numerical scales by ~10%
 * for personality trait prompting in LLMs (PersonaLLM, 2024).
 */

import { useState, useRef, useCallback } from 'react';
import { Handle, Position, useReactFlow, NodeResizer } from '@xyflow/react';
import useWsStore from '../../store/ws';

// ── Win95 primitives ──────────────────────────────────────────────────────────

function TitleBarBtn({ children, onClick, title }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      title={title}
      style={{
        width: 16, height: 14, minWidth: 'unset', padding: 0,
        fontSize: 10, lineHeight: '12px', fontFamily: 'var(--font-mono)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontWeight: 'bold',
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
        type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
        className="nodrag nopan"
        style={{ width: '100%', fontSize: 11, boxSizing: 'border-box' }}
      />
    </div>
  );
}

function EditTextarea({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, marginBottom: 2 }}>{label}:</div>
      <textarea
        value={value ?? ''} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={3}
        className="nodrag nopan"
        style={{ width: '100%', fontSize: 11, resize: 'vertical', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }}
      />
    </div>
  );
}

// ── DnD range row ─────────────────────────────────────────────────────────────
// Stores normalized 0.0–1.0 floats, displays as integers 3–18.
// Two number inputs + filled range bar between them.

function DndRangeRow({ label, value, onChange }) {
  const toDisp = f => Math.round(3 + (f ?? 0.3) * 15);
  const toNorm = d => (d - 3) / 15;
  const minD = toDisp(value?.min ?? 0.17);
  const maxD = toDisp(value?.max ?? 0.56);

  const setMin = d => {
    const clamped = Math.max(3, Math.min(parseInt(d) || 3, maxD));
    onChange({ min: toNorm(clamped), max: value?.max ?? 0.56 });
  };
  const setMax = d => {
    const clamped = Math.min(18, Math.max(parseInt(d) || 18, minD));
    onChange({ min: value?.min ?? 0.17, max: toNorm(clamped) });
  };

  const fillLeft = `${((minD - 3) / 15) * 100}%`;
  const fillWidth = `${((maxD - minD) / 15) * 100}%`;

  return (
    <div className="nodrag nopan" style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
      <span style={{
        fontSize: 10, color: 'var(--text-dim)', width: 24, flexShrink: 0,
        fontFamily: 'var(--font-pixel)', letterSpacing: '0.05em',
      }}>{label}</span>
      <input
        type="number" min={3} max={18} value={minD}
        onChange={e => setMin(e.target.value)}
        style={{ width: 30, fontSize: 10, padding: '1px 2px', textAlign: 'center', boxSizing: 'border-box' }}
      />
      {/* filled range bar */}
      <div style={{
        flex: 1, height: 10,
        border: '1px solid', borderColor: 'var(--bevel-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-br)',
        background: '#c0c0c0', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: fillLeft, width: fillWidth,
          top: 0, bottom: 0, background: '#000080',
        }} />
      </div>
      <input
        type="number" min={3} max={18} value={maxD}
        onChange={e => setMax(e.target.value)}
        style={{ width: 30, fontSize: 10, padding: '1px 2px', textAlign: 'center', boxSizing: 'border-box' }}
      />
    </div>
  );
}

// Read-only DnD stat bar for normal (non-edit) mode
function DndStatBar({ label, value }) {
  const toDisp = f => Math.round(3 + (f ?? 0.3) * 15);
  const minD = toDisp(value?.min ?? 0.17);
  const maxD = toDisp(value?.max ?? 0.56);
  const fillLeft = `${((minD - 3) / 15) * 100}%`;
  const fillWidth = `${((maxD - minD) / 15) * 100}%`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2 }}>
      <span style={{
        fontSize: 9, color: 'var(--text-dim)', width: 22, flexShrink: 0,
        fontFamily: 'var(--font-pixel)',
      }}>{label}</span>
      <div style={{
        flex: 1, height: 7,
        border: '1px solid', borderColor: 'var(--bevel-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-br)',
        background: '#c0c0c0', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', left: fillLeft, width: fillWidth,
          top: 0, bottom: 0, background: '#000080',
        }} />
      </div>
      <span style={{ fontSize: 9, minWidth: 28, textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--text-on-gray)' }}>
        {minD}–{maxD}
      </span>
    </div>
  );
}

// ── OCEAN trait row ───────────────────────────────────────────────────────────
// Two <select> dropdowns (min level → max level) for each Big Five trait.
// Stored as { min: 0–4, max: 0–4 } index into 5 descriptive levels.

const OCEAN_LEVELS = ['very low', 'low', 'medium', 'high', 'very high'];

function OceanTraitRow({ label, value, onChange }) {
  const min = value?.min ?? 1;
  const max = value?.max ?? 3;
  return (
    <div className="nodrag nopan" style={{ marginBottom: 5 }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 2 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <select
          value={min}
          onChange={e => { const v = Number(e.target.value); onChange({ min: v, max: Math.max(v, max) }); }}
          style={{ fontSize: 10, flex: 1 }}
        >
          {OCEAN_LEVELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
        </select>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', flexShrink: 0 }}>→</span>
        <select
          value={max}
          onChange={e => { const v = Number(e.target.value); onChange({ min: Math.min(min, v), max: v }); }}
          style={{ fontSize: 10, flex: 1 }}
        >
          {OCEAN_LEVELS.map((l, i) => <option key={i} value={i}>{l}</option>)}
        </select>
      </div>
    </div>
  );
}

// ── Adherence range row ───────────────────────────────────────────────────────
// Two integer % inputs (0–100). Stored as { min: 0.0–1.0, max: 0.0–1.0 }.

function AdherenceRangeRow({ label, value, onChange }) {
  const minP = Math.round((value?.min ?? 0.2) * 100);
  const maxP = Math.round((value?.max ?? 0.7) * 100);
  return (
    <div className="nodrag nopan" style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>{label}:</span>
      <input type="number" min={0} max={100} value={minP}
        onChange={e => {
          const p = Math.max(0, Math.min(parseInt(e.target.value) || 0, maxP));
          onChange({ ...value, min: p / 100 });
        }}
        style={{ width: 36, fontSize: 10, textAlign: 'center' }}
      />
      <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>%  –</span>
      <input type="number" min={0} max={100} value={maxP}
        onChange={e => {
          const p = Math.min(100, Math.max(parseInt(e.target.value) || 0, minP));
          onChange({ ...value, max: p / 100 });
        }}
        style={{ width: 36, fontSize: 10, textAlign: 'center' }}
      />
      <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>%</span>
    </div>
  );
}

// ── Political Compass 2D point picker ─────────────────────────────────────────
// Click anywhere in the sunken panel to place the point.
// Axes: X = economic left(−1) → right(+1), Y = authoritarian(+1) → libertarian(−1).
// Radius = spread of allowed variation (stored as 0.0–1.0 fraction of half-space).

function PointPicker2D({ value, onChange }) {
  const SIZE = 130;
  const x = value?.x ?? 0;
  const y = value?.y ?? 0;
  const radius = value?.radius ?? 0.15;

  const px = ((x + 1) / 2) * SIZE;
  const py = ((1 - y) / 2) * SIZE; // Y axis inverted (auth at top)
  const rPx = (radius / 2) * SIZE;

  const handleClick = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / SIZE) * 2 - 1;
    const ny = -(((e.clientY - rect.top) / SIZE) * 2 - 1);
    onChange({
      x: Math.max(-1, Math.min(1, nx)),
      y: Math.max(-1, Math.min(1, ny)),
      radius,
    });
  };

  return (
    <div>
      <div
        className="nodrag nopan"
        onClick={handleClick}
        style={{
          width: SIZE, height: SIZE,
          border: '2px solid',
          borderColor: 'var(--bevel-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-br)',
          background: '#d4d0c8', position: 'relative',
          cursor: 'crosshair', margin: '0 auto', overflow: 'hidden',
        }}
      >
        {/* axis lines */}
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#a0a0a0' }} />
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: '#a0a0a0' }} />
        {/* axis labels */}
        <span style={{ position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)', fontSize: 8, color: '#555', fontFamily: 'var(--font-pixel)', pointerEvents: 'none' }}>AUTH</span>
        <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', fontSize: 8, color: '#555', fontFamily: 'var(--font-pixel)', pointerEvents: 'none' }}>LIB</span>
        <span style={{ position: 'absolute', left: 2, top: '50%', transform: 'translateY(-50%)', fontSize: 8, color: '#555', fontFamily: 'var(--font-pixel)', pointerEvents: 'none' }}>L</span>
        <span style={{ position: 'absolute', right: 2, top: '50%', transform: 'translateY(-50%)', fontSize: 8, color: '#555', fontFamily: 'var(--font-pixel)', pointerEvents: 'none' }}>R</span>
        {/* spread circle */}
        {rPx > 2 && (
          <div style={{
            position: 'absolute', left: px - rPx, top: py - rPx,
            width: rPx * 2, height: rPx * 2,
            border: '1px dashed #000080', borderRadius: '50%', pointerEvents: 'none',
          }} />
        )}
        {/* point marker */}
        <div style={{
          position: 'absolute', left: px - 4, top: py - 4,
          width: 8, height: 8, background: '#000080',
          border: '1px solid white', pointerEvents: 'none',
        }} />
      </div>
      {/* spread control */}
      <div className="nodrag nopan" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5 }}>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', flexShrink: 0 }}>spread:</span>
        <input
          type="range" min={0} max={100} value={Math.round(radius * 100)}
          onChange={e => onChange({ ...value, radius: Number(e.target.value) / 100 })}
          style={{ flex: 1, height: 12 }}
        />
        <span style={{ fontSize: 9, minWidth: 26, textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
          ±{Math.round(radius * 100)}%
        </span>
      </div>
    </div>
  );
}

// ── MBTI type grid ────────────────────────────────────────────────────────────
// 16 toggle buttons in a 4×4 grid. Selected types appear pressed (inverted).

const MBTI_TYPES = [
  'ISTJ','ISFJ','INFJ','INTJ',
  'ISTP','ISFP','INFP','INTP',
  'ESTP','ESFP','ENFP','ENTP',
  'ESTJ','ESFJ','ENFJ','ENTJ',
];

const MBTI_DICHOTOMIES = [
  { pair: 'I/E', desc: 'Introversion / Extraversion' },
  { pair: 'N/S', desc: 'Intuition / Sensing' },
  { pair: 'T/F', desc: 'Thinking / Feeling' },
  { pair: 'J/P', desc: 'Judging / Perceiving' },
];

function MBTIGrid({ selected, onToggle }) {
  return (
    <div className="nodrag nopan" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
      {MBTI_TYPES.map(t => {
        const on = selected?.includes(t);
        return (
          <button
            key={t} onClick={() => onToggle(t)}
            style={{
              fontSize: 9, padding: '3px 0',
              fontFamily: 'var(--font-pixel)', letterSpacing: '0.02em',
              background: on ? '#000080' : 'var(--w95-gray)',
              color: on ? 'white' : 'var(--text-on-gray)',
              border: '1px solid',
              borderColor: on
                ? 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)'
                : 'var(--bevel-tl) var(--bevel-outer-br) var(--bevel-outer-br) var(--bevel-tl)',
            }}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}

// ── Win95 Window wrapper ──────────────────────────────────────────────────────

function Win95Window({ id, icon, title, accentColor, handles, children, editChildren, extraStyle }) {
  const [windowState, setWindowState] = useState('normal');
  const { deleteElements } = useReactFlow();

  const toggle = target => setWindowState(s => s === target ? 'normal' : target);
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
      maxWidth: isMax ? 360 : 260,
      userSelect: 'none',
      ...extraStyle,
    }}>
      {/* Title bar */}
      <div style={{
        background: 'var(--titlebar-active)',
        padding: '2px 3px',
        display: 'flex', alignItems: 'center', gap: 4,
        cursor: 'move',
      }}>
        <span style={{ fontSize: 12, flexShrink: 0 }}>{icon}</span>
        <span style={{
          color: 'var(--text-on-title)', fontSize: 12,
          fontFamily: 'var(--font-pixel)', flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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

      {/* Body — nodrag: only the title bar should move the node */}
      {!isMin && (
        <div className="nodrag" style={{ padding: '6px 8px', borderTop: '1px solid var(--bevel-br)' }}>
          <div style={{
            height: 3, background: accentColor, marginBottom: 8,
            border: '1px solid',
            borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)',
          }} />
          {isMax ? editChildren : children}
        </div>
      )}

      {handles?.left  && <Handle type="target" position={Position.Left}  style={{ background: 'var(--w95-gray)', border: '2px solid var(--bevel-outer-br)', borderRadius: 0, width: 10, height: 10 }} />}
      {handles?.right && <Handle type="source" position={Position.Right} style={{ background: 'var(--w95-gray)', border: '2px solid var(--bevel-outer-br)', borderRadius: 0, width: 10, height: 10 }} />}
    </div>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 9, color: 'var(--text-dim)', marginBottom: 5, marginTop: 2,
      borderBottom: '1px solid var(--bevel-br)', paddingBottom: 3,
      fontFamily: 'var(--font-pixel)', letterSpacing: '0.05em',
    }}>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// NODE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Archetype Node ────────────────────────────────────────────────────────────
// Defines the base persona: name/type, age range, and all 6 D&D stats as ranges.
// D&D stats: STR=Willpower/Drive, DEX=Adaptability, CON=Resilience,
//            INT=Analytical Ability, WIS=Self-Awareness, CHA=Social Magnetism

const DND_STATS = [
  { key: 'str', label: 'STR', full: 'Strength / Willpower' },
  { key: 'dex', label: 'DEX', full: 'Dexterity / Adaptability' },
  { key: 'con', label: 'CON', full: 'Constitution / Resilience' },
  { key: 'int', label: 'INT', full: 'Intelligence / Analytical' },
  { key: 'wis', label: 'WIS', full: 'Wisdom / Self-Awareness' },
  { key: 'cha', label: 'CHA', full: 'Charisma / Social Magnetism' },
];

export function ArchetypeNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const upd = (k, v) => updateNodeData(id, { [k]: v });

  const ageMin = data.age?.min ?? 18;
  const ageMax = data.age?.max ?? 26;

  return (
    <Win95Window
      id={id} icon="👤" title="Archetype" accentColor="#7c6af7"
      handles={{ right: true }}
      editChildren={<>
        <EditField label="Name / Type" value={data.archetype_type} onChange={v => upd('archetype_type', v)} />
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, marginBottom: 2 }}>Age min:</div>
            <input type="number" min={1} max={99} value={ageMin}
              onChange={e => upd('age', { ...data.age, min: parseInt(e.target.value) || 1 })}
              className="nodrag nopan"
              style={{ width: '100%', fontSize: 10, boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, marginBottom: 2 }}>Age max:</div>
            <input type="number" min={1} max={99} value={ageMax}
              onChange={e => upd('age', { ...data.age, max: parseInt(e.target.value) || 1 })}
              className="nodrag nopan"
              style={{ width: '100%', fontSize: 10, boxSizing: 'border-box' }}
            />
          </div>
        </div>
        <SectionLabel>── D&amp;D STATS (3–18) ──────────────</SectionLabel>
        {DND_STATS.map(({ key, label, full }) => (
          <div key={key} title={full}>
            <DndRangeRow label={label} value={data[key]} onChange={v => upd(key, v)} />
          </div>
        ))}
      </>}
    >
      <Field label="type" value={data.archetype_type ?? 'persistent_introvert'} />
      <Field label="age"  value={`${ageMin}–${ageMax}`} />
      <div style={{ marginTop: 5, paddingTop: 4, borderTop: '1px solid var(--bevel-br)' }}>
        {DND_STATS.map(({ key, label }) => (
          <DndStatBar key={key} label={label} value={data[key]} />
        ))}
      </div>
    </Win95Window>
  );
}

// ── OCEAN / Big Five Node ─────────────────────────────────────────────────────
// Each trait is a range from one of 5 descriptive levels.
// Stored as { min: 0–4, max: 0–4 } index into OCEAN_LEVELS.

const OCEAN_TRAITS = [
  { key: 'openness',          label: 'Openness',          short: 'O' },
  { key: 'conscientiousness', label: 'Conscientiousness', short: 'C' },
  { key: 'extraversion',      label: 'Extraversion',      short: 'E' },
  { key: 'agreeableness',     label: 'Agreeableness',     short: 'A' },
  { key: 'neuroticism',       label: 'Neuroticism',       short: 'N' },
];

export function OceanNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const upd = (k, v) => updateNodeData(id, { [k]: v });

  return (
    <Win95Window
      id={id} icon="🌊" title="OCEAN / Big Five" accentColor="#007777"
      handles={{ left: true, right: true }}
      editChildren={<>
        {OCEAN_TRAITS.map(({ key, label }) => (
          <OceanTraitRow key={key} label={label} value={data[key]} onChange={v => upd(key, v)} />
        ))}
      </>}
    >
      {OCEAN_TRAITS.map(({ key, label, short }) => {
        const v = data[key];
        const minL = OCEAN_LEVELS[v?.min ?? 1];
        const maxL = OCEAN_LEVELS[v?.max ?? 3];
        const display = minL === maxL ? minL : `${minL} → ${maxL}`;
        return <Field key={key} label={`[${short}] ${label.slice(0, 8)}`} value={display} />;
      })}
    </Win95Window>
  );
}

// ── Myers-Briggs Node ─────────────────────────────────────────────────────────
// Multi-select 16 MBTI types. Per-type optional prompt injection.
// Dichotomy legend shown in both normal and edit modes.

export function MBTINode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const selected = data.selected_types ?? [];
  const prompts  = data.type_prompts ?? {};

  const toggleType = t => {
    const next = selected.includes(t) ? selected.filter(x => x !== t) : [...selected, t];
    updateNodeData(id, { selected_types: next });
  };
  const setPrompt = (t, v) => updateNodeData(id, { type_prompts: { ...prompts, [t]: v } });

  const legend = (
    <div style={{
      marginBottom: 6, padding: 4,
      background: '#d4d0c8',
      border: '1px solid', borderColor: 'var(--bevel-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-br)',
    }}>
      {MBTI_DICHOTOMIES.map(({ pair, desc }) => (
        <div key={pair} style={{ fontSize: 9, marginBottom: 1 }}>
          <span style={{ fontFamily: 'var(--font-pixel)', color: '#000080', marginRight: 4 }}>{pair}</span>
          <span style={{ color: 'var(--text-dim)' }}>{desc}</span>
        </div>
      ))}
    </div>
  );

  return (
    <Win95Window
      id={id} icon="🧠" title="Myers-Briggs" accentColor="#8b2252"
      handles={{ left: true, right: true }}
      extraStyle={{ maxWidth: 300 }}
      editChildren={<>
        {legend}
        <SectionLabel>── SELECT TYPES ──────────────────</SectionLabel>
        <MBTIGrid selected={selected} onToggle={toggleType} />
        {selected.length > 0 && <>
          <SectionLabel style={{ marginTop: 8 }}>── TYPE PROMPTS (optional) ────</SectionLabel>
          {selected.map(t => (
            <div key={t} style={{ marginBottom: 5 }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--font-pixel)', color: '#000080', marginBottom: 2 }}>{t}:</div>
              <textarea
                value={prompts[t] ?? ''}
                onChange={e => setPrompt(t, e.target.value)}
                placeholder={`Extra context for ${t} personas...`}
                rows={2}
                className="nodrag nopan"
                style={{ width: '100%', fontSize: 10, fontFamily: 'var(--font-mono)', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
          ))}
        </>}
      </>}
    >
      {legend}
      {selected.length === 0
        ? <span style={{ fontSize: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>no types selected — all allowed</span>
        : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 2 }}>
            {selected.map(t => (
              <span key={t} style={{
                fontSize: 9, background: '#000080', color: 'white',
                padding: '1px 4px', fontFamily: 'var(--font-pixel)',
              }}>{t}</span>
            ))}
          </div>
        )
      }
    </Win95Window>
  );
}

// ── Philosophy Node ───────────────────────────────────────────────────────────

const PHILOSOPHIES = [
  'stoicism', 'nihilism', 'absurdism', 'existentialism', 'individualism',
  'hedonism', 'pragmatism', 'idealism', 'rationalism', 'empiricism',
  'minimalism', 'optimism', 'pessimism', 'humanism', 'marxism',
  'postmodernism', 'utilitarianism', 'other',
];

export function PhilosophyNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const upd = (k, v) => updateNodeData(id, { [k]: v });
  const philosophy = data.philosophy ?? 'stoicism';
  const minP = Math.round((data.adherence?.min ?? 0.2) * 100);
  const maxP = Math.round((data.adherence?.max ?? 0.7) * 100);

  return (
    <Win95Window
      id={id} icon="📜" title="Philosophy" accentColor="#5a4a00"
      handles={{ left: true, right: true }}
      editChildren={<>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, marginBottom: 2 }}>Philosophy:</div>
          <select value={philosophy} onChange={e => upd('philosophy', e.target.value)}
            className="nodrag nopan" style={{ width: '100%', fontSize: 11 }}>
            {PHILOSOPHIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <AdherenceRangeRow label="adherence" value={data.adherence} onChange={v => upd('adherence', v)} />
        <EditTextarea label="Additional context" value={data.context} onChange={v => upd('context', v)}
          placeholder="e.g. follows stoic journaling practice daily" />
      </>}
    >
      <Field label="philosophy" value={philosophy} />
      <Field label="adherence"  value={`${minP}–${maxP}%`} />
    </Win95Window>
  );
}

// ── Religion Node ─────────────────────────────────────────────────────────────

const RELIGIONS = [
  'secular / atheist', 'agnostic', 'spiritual (non-religious)',
  'christian (general)', 'catholic', 'protestant', 'orthodox christian',
  'islam (sunni)', 'islam (shia)', 'judaism', 'hinduism',
  'buddhism', 'taoism', 'shintoism', 'sikhism',
  'new age / eclectic', 'other',
];

export function ReligionNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const upd = (k, v) => updateNodeData(id, { [k]: v });
  const religion = data.religion ?? 'secular / atheist';
  const minP = Math.round((data.adherence?.min ?? 0.0) * 100);
  const maxP = Math.round((data.adherence?.max ?? 0.3) * 100);

  return (
    <Win95Window
      id={id} icon="🕊️" title="Religion" accentColor="#4a2800"
      handles={{ left: true, right: true }}
      editChildren={<>
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10, marginBottom: 2 }}>Religion:</div>
          <select value={religion} onChange={e => upd('religion', e.target.value)}
            className="nodrag nopan" style={{ width: '100%', fontSize: 11 }}>
            {RELIGIONS.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <AdherenceRangeRow label="adherence" value={data.adherence} onChange={v => upd('adherence', v)} />
        <EditTextarea label="Additional context" value={data.context} onChange={v => upd('context', v)}
          placeholder="e.g. attends weekly, culturally observant but not devout" />
      </>}
    >
      <Field label="religion"  value={religion} />
      <Field label="adherence" value={`${minP}–${maxP}%`} />
    </Win95Window>
  );
}

// ── Political Compass Node ────────────────────────────────────────────────────
// Click the 2D panel to place the political position.
// Axes: Economic L/R × Social Auth/Lib. Spread = radius of variation.

export function PoliticalCompassNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const upd = (k, v) => updateNodeData(id, { [k]: v });

  const pos = data.position ?? { x: 0, y: 0, radius: 0.15 };
  const xLabel = pos.x < -0.15 ? 'Left' : pos.x > 0.15 ? 'Right' : 'Center';
  const yLabel = pos.y > 0.15  ? 'Auth'  : pos.y < -0.15 ? 'Lib'  : 'Center';

  return (
    <Win95Window
      id={id} icon="🧭" title="Political Compass" accentColor="#800000"
      handles={{ left: true, right: true }}
      extraStyle={{ minWidth: 200, maxWidth: 240 }}
      editChildren={<>
        <PointPicker2D value={pos} onChange={v => upd('position', v)} />
      </>}
    >
      <div style={{ textAlign: 'center', marginBottom: 6 }}>
        <PointPicker2D value={pos} onChange={v => upd('position', v)} />
      </div>
      <Field label="economic" value={`${xLabel} (${pos.x > 0 ? '+' : ''}${pos.x.toFixed(2)})`} />
      <Field label="social"   value={`${yLabel} (${pos.y > 0 ? '+' : ''}${pos.y.toFixed(2)})`} />
      <Field label="spread"   value={`±${Math.round(pos.radius * 100)}%`} />
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
  struggle:     '#cc2200',
  growth:       '#007700',
  plateau:      '#808080',
  breakthrough: '#000080',
  spiral:       '#cc6600',
  return:       '#007700',
};

export function PhaseNode({ id, data }) {
  const { updateNodeData } = useReactFlow();
  const upd = (k, v) => updateNodeData(id, { [k]: v });
  const color = PHASE_COLORS[data.phase_type] ?? '#808080';
  return (
    <Win95Window id={id} icon="📅" title={`Phase: ${data.phase_type ?? 'struggle'}`} accentColor={color} handles={{ left: true, right: true }}
      editChildren={<>
        <EditField label="Phase Type"   value={data.phase_type}       onChange={v => upd('phase_type', v)} />
        <EditField label="Duration"     value={data.duration}         onChange={v => upd('duration', v)} />
        <EditField label="Action Freq"  value={data.action_frequency} onChange={v => upd('action_frequency', v)} />
        <EditField label="Outcome Bias" value={data.outcome_bias}     onChange={v => upd('outcome_bias', v)} />
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
        <EditField label="Locus"          value={data.locus}          onChange={v => upd('locus', v)} />
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
      <Field label="duration"   value={data.gap_duration ?? '2–6 months'} />
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
      <div style={{ marginTop: 8, paddingTop: 6, borderTop: '1px solid var(--bevel-br)', display: 'flex', justifyContent: 'center' }}>
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

// ── Frame Node ────────────────────────────────────────────────────────────────
// A Win95-style container that groups child nodes together.
// Children move with the frame (ReactFlow parent-node system).
// Close = unparent children (restore absolute positions) + delete frame.
// Minimize = hide children + collapse to title bar.
// Nested frames are supported naturally via the parentId chain.

const FRAME_TITLE_H = 22; // px — title bar height
const FRAME_BODY_PAD = 4; // px — inner padding shown in body

export function FrameNode({ id, data, selected }) {
  const { setNodes, getNodes, updateNodeData } = useReactFlow();
  const [minimized, setMinimized] = useState(false);

  const onClose = useCallback(() => {
    const thisNode = getNodes().find(n => n.id === id);
    if (!thisNode) return;
    setNodes(nds =>
      nds
        .filter(n => n.id !== id)           // remove the frame
        .map(n => n.parentId !== id ? n : { // unparent children
          ...n,
          parentId: undefined,
          hidden: false,
          position: {
            x: n.position.x + thisNode.position.x,
            y: n.position.y + thisNode.position.y,
          },
        })
    );
  }, [id, getNodes, setNodes]);

  const onMinimize = useCallback(() => {
    const next = !minimized;
    setMinimized(next);
    // Only collapse the frame's visual height — children stay visible so edges persist.
    setNodes(nds => nds.map(n => {
      if (n.id !== id) return n;
      const origH = n.data._origH ?? (n.style?.height ?? 200);
      return {
        ...n,
        style: { ...n.style, height: next ? FRAME_TITLE_H : origH },
        data:  { ...n.data,  _origH: next ? origH : undefined },
      };
    }));
  }, [id, minimized, setNodes]);

  // Allow inline label editing via double-click
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelDraft, setLabelDraft]     = useState(data.label ?? 'Group');

  const commitLabel = () => {
    setEditingLabel(false);
    if (labelDraft.trim()) updateNodeData(id, { label: labelDraft.trim() });
  };

  return (
    <div style={{
      width: '100%',
      height: minimized ? FRAME_TITLE_H : '100%',
      background: minimized ? '#1a2a3a' : 'rgba(10, 20, 50, 0.13)',
      border: `2px solid ${selected ? '#ffd700' : '#3a5a7a'}`,
      boxSizing: 'border-box',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Resize handles (visible when selected, not minimized) */}
      {!minimized && (
        <NodeResizer
          isVisible={selected}
          minWidth={120} minHeight={60}
          lineStyle={{ border: '1px dashed #3a5a7a' }}
          handleStyle={{ background: '#3a5a7a', width: 8, height: 8, border: 'none' }}
        />
      )}

      {/* Title bar — this is the drag handle; do NOT add nodrag here */}
      <div
        style={{
          background: 'linear-gradient(90deg, #162840 0%, #1e4060 100%)',
          padding: `1px 3px`,
          height: FRAME_TITLE_H,
          display: 'flex', alignItems: 'center', gap: 4,
          cursor: 'move',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, flexShrink: 0 }}>📁</span>

        {editingLabel ? (
          <input
            autoFocus
            value={labelDraft}
            onChange={e => setLabelDraft(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={e => {
              if (e.key === 'Enter') commitLabel();
              if (e.key === 'Escape') { setLabelDraft(data.label ?? 'Group'); setEditingLabel(false); }
            }}
            className="nodrag nopan"
            style={{
              flex: 1, fontSize: 10, padding: '0 2px',
              background: '#0a1a2a', color: '#aaccee',
              border: '1px solid #3a5a7a', outline: 'none',
              fontFamily: 'var(--font-pixel)',
            }}
          />
        ) : (
          <span
            onDoubleClick={() => setEditingLabel(true)}
            style={{
              color: '#aaccee', fontSize: 11,
              fontFamily: 'var(--font-pixel)', flex: 1,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              letterSpacing: '0.03em', cursor: 'default',
            }}
          >
            {data.label ?? 'Group'}
          </span>
        )}

        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
          <TitleBarBtn onClick={onMinimize} title={minimized ? 'Restore' : 'Minimize'}>_</TitleBarBtn>
          <TitleBarBtn onClick={() => {}} title="Maximize (drag to resize)">□</TitleBarBtn>
          <TitleBarBtn onClick={onClose} title="Ungroup (keeps nodes)">✕</TitleBarBtn>
        </div>
      </div>

      {/* Body — nodrag so only the title bar moves the frame */}
      {!minimized && (
        <div className="nodrag" style={{ position: 'absolute', inset: `${FRAME_TITLE_H}px 0 0 0` }}>
          <div style={{
            position: 'absolute', bottom: FRAME_BODY_PAD, right: FRAME_BODY_PAD,
            fontSize: 9, color: 'rgba(100,160,220,0.35)',
            fontFamily: 'var(--font-pixel)', pointerEvents: 'none',
            userSelect: 'none',
          }}>
            {data.label ?? 'Group'}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Node type registry ────────────────────────────────────────────────────────

export const NODE_TYPES = {
  // Character definition nodes
  archetype:         ArchetypeNode,
  ocean:             OceanNode,
  mbti:              MBTINode,
  philosophy:        PhilosophyNode,
  religion:          ReligionNode,
  political_compass: PoliticalCompassNode,
  // Journey nodes
  goal:              GoalNode,
  phase:             PhaseNode,
  voice:             VoiceNode,
  time_gap:          TimeGapNode,
  event:             EventNode,
  generate:          GenerateNode,
  // Container
  frame:             FrameNode,
};
