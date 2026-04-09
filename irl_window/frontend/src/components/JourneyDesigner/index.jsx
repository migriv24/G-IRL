import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { NODE_TYPES } from './nodes';
import useHistoryStore from '../../store/history';
import useInspectorStore from '../../store/inspector';
import useProjectStore from '../../store/project';
import useCanvasStore from '../../store/canvas';
import useWsStore from '../../store/ws';
import Tooltip from '../Tooltip';

// ── Frame grouping constants (must match FrameNode) ────────────────────────
const FRAME_TITLE_H = 22;
const FRAME_PAD     = 20; // canvas padding around grouped nodes

// ── Sample journey ─────────────────────────────────────────────────────────
const INITIAL_NODES = [
  { id: 'arch-1',           type: 'archetype', position: { x: 40,   y: 160 }, data: {
    archetype_type: 'persistent_introvert',
    age: { min: 20, max: 26 },
    str: { min: 0.17, max: 0.39 },
    dex: { min: 0.22, max: 0.44 },
    con: { min: 0.28, max: 0.50 },
    int: { min: 0.39, max: 0.61 },
    wis: { min: 0.17, max: 0.39 },
    cha: { min: 0.11, max: 0.33 },
  } },
  { id: 'goal-1',           type: 'goal',      position: { x: 320,  y: 160 }, data: { goal_text: 'get a girlfriend', horizon: '18 months' } },
  { id: 'voice-1',          type: 'voice',     position: { x: 320,  y: 360 }, data: { locus: 'internal', emotional_tone: 'subdued', self_awareness: 'medium' } },
  { id: 'phase-struggle',   type: 'phase',     position: { x: 600,  y: 60  }, data: { phase_type: 'struggle',     duration: '8–12 weeks', action_frequency: '2–3/wk', outcome_bias: '−0.7 to −0.3' } },
  { id: 'phase-growth',     type: 'phase',     position: { x: 860,  y: 60  }, data: { phase_type: 'growth',       duration: '6–10 weeks', action_frequency: '4–5/wk', outcome_bias: '−0.2 to +0.3' } },
  { id: 'phase-struggle-2', type: 'phase',     position: { x: 860,  y: 300 }, data: { phase_type: 'struggle',     duration: '4–6 weeks',  action_frequency: '1–2/wk', outcome_bias: '−0.5 to −0.1' } },
  { id: 'event-lucky',      type: 'event',     position: { x: 1120, y: 60  }, data: { event_type: 'lucky_break', probability: '0.4', outcome_override: '+0.7 to +1.0' } },
  { id: 'gap-1',            type: 'time_gap',  position: { x: 1120, y: 300 }, data: { gap_duration: '1–3 months', stat_drift: 'fitness −0.03' } },
  { id: 'phase-break',      type: 'phase',     position: { x: 1380, y: 160 }, data: { phase_type: 'breakthrough', duration: '4–8 weeks',  action_frequency: '3–4/wk', outcome_bias: '+0.2 to +0.9' } },
  { id: 'gen-1',            type: 'generate',  position: { x: 1660, y: 160 }, data: { n_personas: 3, provider: 'ollama', model: 'llama3.2:1b' } },
];

const INITIAL_EDGES = [
  { id: 'e1',  source: 'arch-1',          target: 'goal-1',           animated: true },
  { id: 'e2',  source: 'arch-1',          target: 'voice-1'                           },
  { id: 'e3',  source: 'goal-1',          target: 'phase-struggle',   animated: true },
  { id: 'e4',  source: 'voice-1',         target: 'phase-struggle'                    },
  { id: 'e5',  source: 'phase-struggle',  target: 'phase-growth',     animated: true },
  { id: 'e6',  source: 'phase-growth',    target: 'event-lucky',      animated: true },
  { id: 'e7',  source: 'phase-growth',    target: 'phase-struggle-2'                  },
  { id: 'e8',  source: 'phase-struggle-2',target: 'gap-1'                             },
  { id: 'e9',  source: 'event-lucky',     target: 'phase-break',      animated: true },
  { id: 'e10', source: 'gap-1',           target: 'phase-break'                       },
  { id: 'e11', source: 'phase-break',     target: 'gen-1',            animated: true },
];

// ── Node palette ───────────────────────────────────────────────────────────
// '__section' entries render as divider labels, not buttons.
const PALETTE = [
  { type: '__section', label: 'Character' },
  { type: 'archetype', label: 'Archetype', icon: '👤', tooltip: 'Core persona — DnD stat ranges', defaults: {
    archetype_type: 'growth_mindset',
    age: { min: 18, max: 28 },
    str: { min: 0.22, max: 0.50 }, dex: { min: 0.22, max: 0.50 },
    con: { min: 0.22, max: 0.50 }, int: { min: 0.22, max: 0.50 },
    wis: { min: 0.22, max: 0.50 }, cha: { min: 0.22, max: 0.50 },
  }},
  { type: 'ocean',    label: 'OCEAN',        icon: '🌊', tooltip: 'Big Five personality traits', defaults: {
    openness: { min: 1, max: 3 }, conscientiousness: { min: 1, max: 3 },
    extraversion: { min: 1, max: 2 }, agreeableness: { min: 2, max: 3 }, neuroticism: { min: 1, max: 2 },
  }},
  { type: 'mbti',             label: 'Myers-Briggs', icon: '🧠', tooltip: 'MBTI type mix + per-type prompts', defaults: { selected_types: [], type_prompts: {} } },
  { type: 'philosophy',       label: 'Philosophy',   icon: '📜', tooltip: 'Philosophical worldview + adherence', defaults: { philosophy: 'stoicism',          adherence: { min: 0.2, max: 0.7 } } },
  { type: 'religion',         label: 'Religion',     icon: '🕊️', tooltip: 'Religious identity + adherence',    defaults: { religion: 'secular / atheist', adherence: { min: 0.0, max: 0.3 } } },
  { type: 'political_compass',label: 'Politics',     icon: '🧭', tooltip: 'Political position on 2D compass',  defaults: { position: { x: 0, y: 0, radius: 0.15 } } },

  { type: '__section', label: 'Journey' },
  { type: 'goal',      label: 'Goal',     icon: '🎯', tooltip: 'Character goal + time horizon',      defaults: { goal_text: 'new goal', horizon: '6 months' } },
  { type: 'phase',     label: 'Phase',    icon: '📅', tooltip: 'Journey phase — duration + outcome', defaults: { phase_type: 'struggle', duration: '4–6 weeks' } },
  { type: 'voice',     label: 'Voice',    icon: '🗣️', tooltip: 'Narrative voice + emotional tone',  defaults: { locus: 'internal', emotional_tone: 'neutral' } },
  { type: 'event',     label: 'Event',    icon: '⚡', tooltip: 'Randomised plot event',             defaults: { event_type: 'lucky_break', probability: '0.3' } },
  { type: 'time_gap',  label: 'Time Gap', icon: '⏸️', tooltip: 'Elapsed time between phases',      defaults: { gap_duration: '1–3 months' } },
  { type: 'generate',  label: 'Generate', icon: '▶',  tooltip: 'Run generation with this journey', defaults: { n_personas: 3, provider: 'ollama', model: 'llama3.2:1b' } },
];

// MiniMap accent colors for all node types
const NODE_COLORS = {
  archetype: '#7c6af7', ocean: '#007777', mbti: '#8b2252',
  philosophy: '#5a4a00', religion: '#4a2800', political_compass: '#800000',
  goal: '#c8a000', phase: '#808080', voice: '#006060',
  event: '#cc6600', time_gap: '#444', generate: '#007700',
  frame: '#1e4060',
};

// ── Save notification toast ────────────────────────────────────────────────
function SaveToast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: 'absolute', bottom: 36, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--w95-gray)',
      border: '2px solid', borderColor: 'var(--bevel-tl) var(--bevel-outer-br) var(--bevel-outer-br) var(--bevel-tl)',
      boxShadow: '2px 2px 0 rgba(0,0,0,0.4)',
      padding: '4px 12px', fontSize: 11,
      fontFamily: 'var(--font-pixel)', letterSpacing: '0.03em',
      zIndex: 100, pointerEvents: 'none',
      whiteSpace: 'nowrap',
    }}>
      {message}
    </div>
  );
}

// ── Name edit inline ───────────────────────────────────────────────────────
function ProjectNameInput({ name, isDirty, onRename }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(name);

  useEffect(() => { setDraft(name); }, [name]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() && draft !== name) onRename(draft.trim());
  };

  if (editing) {
    return (
      <input
        autoFocus value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(name); setEditing(false); } }}
        style={{ fontSize: 10, padding: '1px 4px', fontFamily: 'var(--font-pixel)', width: 160 }}
      />
    );
  }

  return (
    <span
      onDoubleClick={() => setEditing(true)}
      title="Double-click to rename"
      style={{
        fontSize: 10, color: isDirty ? '#cc6600' : 'var(--text-dim)',
        fontFamily: 'var(--font-pixel)', cursor: 'default',
        userSelect: 'none', letterSpacing: '0.02em',
      }}
    >
      {name}{isDirty ? ' *' : ''}
    </span>
  );
}

// ── Journey name dialog ────────────────────────────────────────────────────
// Win95-style prompt shown on first save or new project.
function NameDialog({ mode, onConfirm, onCancel }) {
  const [value, setValue] = useState('');

  const title   = mode === 'new'  ? 'New Journey'        : 'Name Your Journey';
  const label   = mode === 'new'  ? 'Journey name:'      : 'Save as:';
  const btnText = mode === 'new'  ? 'Create'             : 'Save';
  const icon    = mode === 'new'  ? '⬜'                  : '💾';

  const submit = e => {
    e.preventDefault();
    if (value.trim()) onConfirm(value.trim());
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 2000 }}
      />
      {/* Dialog */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 2001, width: 320,
        background: 'var(--w95-gray)',
        border: '2px solid',
        borderColor: 'var(--bevel-tl) var(--bevel-outer-br) var(--bevel-outer-br) var(--bevel-tl)',
        boxShadow: 'inset 1px 1px 0 var(--w95-white), 4px 4px 0 rgba(0,0,0,0.45)',
      }}>
        {/* Title bar */}
        <div style={{
          background: 'var(--titlebar-active)', padding: '3px 6px',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 12 }}>{icon}</span>
          <span style={{
            color: 'var(--text-on-title)', fontFamily: 'var(--font-pixel)',
            fontSize: 12, flex: 1, letterSpacing: '0.03em',
          }}>
            {title}
          </span>
          <button onClick={onCancel} style={{ width: 16, height: 14, padding: 0, fontSize: 10, fontWeight: 'bold', minWidth: 'unset' }}>✕</button>
        </div>

        {/* Body */}
        <form onSubmit={submit} style={{ padding: '16px 14px 12px' }}>
          <div style={{ fontSize: 11, marginBottom: 6 }}>{label}</div>
          <input
            autoFocus
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && onCancel()}
            maxLength={64}
            placeholder="e.g. College Introvert Arc"
            style={{ width: '100%', fontSize: 11, boxSizing: 'border-box', marginBottom: 12 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <button type="button" onClick={onCancel} style={{ minWidth: 64, fontSize: 11 }}>Cancel</button>
            <button type="submit" disabled={!value.trim()} style={{ minWidth: 64, fontSize: 11, fontWeight: 'bold' }}>
              {btnText}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function JourneyDesigner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [toast, setToast] = useState('');
  const [nameDialog, setNameDialog] = useState(null); // null | { mode: 'save' | 'new' }

  const { pushSnapshot, undo, redo, canUndo, canRedo } = useHistoryStore();
  const { setSelectedNode, clearSelection } = useInspectorStore();
  const { sendMessage, onEvent, connected } = useWsStore();

  const {
    id: projectId, name, isDirty,
    markDirty, handleSaved, handleLoaded, setName,
    pendingLoad, clearPendingLoad, newProject,
  } = useProjectStore();

  // ── Apply loaded project from backend ─────────────────────────────────
  useEffect(() => {
    if (!pendingLoad) return;
    setNodes(pendingLoad.nodes);
    setEdges(pendingLoad.edges);
    clearPendingLoad();
  }, [pendingLoad]);

  // ── Listen for project.saved / project.loaded events ──────────────────
  useEffect(() => {
    const unsubSaved = onEvent('project.saved', (_, meta) => {
      handleSaved(meta);
      showToast(`💾 Saved "${meta.name}"`);
    });
    const unsubLoaded = onEvent('project.loaded', (_, data) => {
      handleLoaded(data);
    });
    return () => { unsubSaved(); unsubLoaded(); };
  }, []);

  // ── Toast helper ───────────────────────────────────────────────────────
  const showToast = msg => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // ── Name dialog confirm ────────────────────────────────────────────────
  const handleNameConfirm = useCallback((journeyName) => {
    const mode = nameDialog?.mode;
    setNameDialog(null);

    if (mode === 'save') {
      // First save: update the project name then persist
      useProjectStore.getState().setName(journeyName);
      if (!connected) { showToast('⚠ Backend offline'); return; }
      sendMessage('project.save', {
        id: projectId ?? undefined,
        name: journeyName,
        nodes,
        edges,
        description: useProjectStore.getState().description,
      });
    } else if (mode === 'new') {
      // Create new journey with given name
      setNodes(INITIAL_NODES);
      setEdges(INITIAL_EDGES);
      newProject();
      useProjectStore.getState().setName(journeyName);
      showToast(`⬜ "${journeyName}" created`);
    }
  }, [nameDialog, connected, projectId, nodes, edges, sendMessage, setNodes, setEdges, newProject]);

  // ── Save ───────────────────────────────────────────────────────────────
  const saveProject = useCallback(() => {
    if (!connected) { showToast('⚠ Backend offline'); return; }
    // First save — no project ID yet; ask for a name
    if (!projectId) { setNameDialog({ mode: 'save' }); return; }
    sendMessage('project.save', {
      id: projectId,
      name,
      nodes,
      edges,
      description: useProjectStore.getState().description,
    });
  }, [connected, projectId, name, nodes, edges, sendMessage]);

  // ── New project ────────────────────────────────────────────────────────
  const handleNew = useCallback(() => {
    if (isDirty && !window.confirm(`"${name}" has unsaved changes. Discard?`)) return;
    setNameDialog({ mode: 'new' });
  }, [isDirty, name]);

  // ── Selection ──────────────────────────────────────────────────────────
  const onSelectionChange = useCallback(({ nodes: sel }) => {
    if (sel.length === 1) setSelectedNode({ id: sel[0].id, type: sel[0].type, data: sel[0].data });
    else clearSelection();
  }, [setSelectedNode, clearSelection]);

  // ── Mark dirty on meaningful node/edge changes ─────────────────────────
  const onNodesChangeWithHistory = useCallback(changes => {
    const significant = changes.some(c => c.type === 'remove' || c.type === 'add');
    if (significant) { pushSnapshot(nodes, edges); markDirty(); }
    else if (changes.some(c => c.type === 'position' && c.dragging === false)) markDirty();
    onNodesChange(changes);
  }, [nodes, edges, onNodesChange, pushSnapshot, markDirty]);

  const onEdgesChangeWithHistory = useCallback(changes => {
    const significant = changes.some(c => c.type === 'remove' || c.type === 'add');
    if (significant) { pushSnapshot(nodes, edges); markDirty(); }
    onEdgesChange(changes);
  }, [nodes, edges, onEdgesChange, pushSnapshot, markDirty]);

  const onConnect = useCallback(params => {
    pushSnapshot(nodes, edges);
    markDirty();
    setEdges(eds => addEdge(params, eds));
  }, [nodes, edges, pushSnapshot, setEdges, markDirty]);

  // ── Sync canvas state for terminal / other consumers ──────────────────
  useEffect(() => {
    useCanvasStore.getState().setCanvas(nodes, edges);
  }, [nodes, edges]);

  // ── Shift+A — group selected nodes into a frame ────────────────────────
  const groupSelected = useCallback(() => {
    // Only consider top-level selected nodes (no existing parentId).
    // Children of a selected inner frame will auto-move with that frame —
    // we must NOT re-parent them or nesting breaks.
    const selected = nodes.filter(n => n.selected && !n.parentId);
    if (selected.length < 2) return;

    // Bounding box — frames store their size in style, others use measured
    const minX = Math.min(...selected.map(n => n.position.x));
    const minY = Math.min(...selected.map(n => n.position.y));
    const maxX = Math.max(...selected.map(n =>
      n.position.x + (n.style?.width  ?? n.measured?.width  ?? 240)));
    const maxY = Math.max(...selected.map(n =>
      n.position.y + (n.style?.height ?? n.measured?.height ?? 120)));

    const frameX = minX - FRAME_PAD;
    const frameY = minY - FRAME_TITLE_H - FRAME_PAD;
    const frameW = maxX - minX + FRAME_PAD * 2;
    const frameH = maxY - minY + FRAME_TITLE_H + FRAME_PAD * 2;

    const frameId = `frame-${Date.now()}`;

    pushSnapshot(nodes, edges);
    markDirty();

    setNodes(nds => [
      {
        id: frameId,
        type: 'frame',
        position: { x: frameX, y: frameY },
        style:    { width: frameW, height: frameH },
        data:     { label: 'Group' },
        zIndex:   -1,
        selected: false,
      },
      ...nds.map(n => {
        // Only reparent top-level selected nodes (no existing parentId)
        if (!n.selected || n.parentId) return n;
        return {
          ...n,
          parentId: frameId,
          position: {
            x: n.position.x - frameX,
            y: n.position.y - frameY,
          },
          selected: false,
        };
      }),
    ]);
  }, [nodes, edges, pushSnapshot, markDirty, setNodes]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = e => {
      // Shift+A — group selected nodes into a frame (no Ctrl modifier)
      if (e.key === 'A' && e.shiftKey && !e.ctrlKey) { e.preventDefault(); groupSelected(); return; }
      if (!e.ctrlKey) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(nodes, edges, setNodes, setEdges); }
      if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) { e.preventDefault(); redo(nodes, edges, setNodes, setEdges); }
      if (e.key === 's') { e.preventDefault(); saveProject(); }
      if (e.key === 'n') { e.preventDefault(); handleNew(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nodes, edges, undo, redo, setNodes, setEdges, saveProject, handleNew, groupSelected]);

  const addNode = useCallback((type, defaults) => {
    pushSnapshot(nodes, edges);
    markDirty();
    const id = `${type}-${Date.now()}`;
    setNodes(nds => [...nds, {
      id, type,
      position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 },
      data: { ...defaults },
    }]);
  }, [nodes, edges, pushSnapshot, setNodes, markDirty]);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative' }}>

      {/* ── Left sidebar ────────────────────────────────────────────── */}
      <div style={{
        width: 110, flexShrink: 0,
        background: 'var(--w95-gray)',
        borderRight: '2px solid', borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)',
        padding: 6,
        display: 'flex', flexDirection: 'column', gap: 3,
        overflowY: 'auto',
      }}>

        {/* ── File section ─────────────────────────────── */}
        <div style={{ fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 2, marginBottom: 1 }}>
          File
        </div>

        <ProjectNameInput name={name} isDirty={isDirty} onRename={setName} />

        <Tooltip text="Save journey  Ctrl+S">
          <button
            onClick={saveProject}
            disabled={!connected}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', fontSize: 11, textAlign: 'left', minWidth: 'unset', textTransform: 'none' }}
          >
            💾 Save
          </button>
        </Tooltip>

        <Tooltip text="New journey  Ctrl+N">
          <button
            onClick={handleNew}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', fontSize: 11, textAlign: 'left', minWidth: 'unset', textTransform: 'none' }}
          >
            ⬜ New
          </button>
        </Tooltip>

        {/* ── History section ───────────────────────────── */}
        <div style={{ marginTop: 4, borderTop: '1px solid var(--bevel-br)', paddingTop: 4, fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 2, marginBottom: 1 }}>
          History
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          <Tooltip text="Undo  Ctrl+Z">
            <button onClick={() => undo(nodes, edges, setNodes, setEdges)} disabled={!canUndo()}
              style={{ minWidth: 'unset', flex: 1, padding: '2px 4px', fontSize: 10 }}>↩</button>
          </Tooltip>
          <Tooltip text="Redo  Ctrl+Y">
            <button onClick={() => redo(nodes, edges, setNodes, setEdges)} disabled={!canRedo()}
              style={{ minWidth: 'unset', flex: 1, padding: '2px 4px', fontSize: 10 }}>↪</button>
          </Tooltip>
        </div>

        {/* ── Palette sections ──────────────────────────── */}
        {PALETTE.map((item, i) => {
          if (item.type === '__section') {
            return (
              <div key={`sec-${i}`} style={{
                marginTop: 6, borderTop: '1px solid var(--bevel-br)', paddingTop: 4,
                fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase',
                letterSpacing: '0.08em', paddingLeft: 2, marginBottom: 1,
              }}>
                {item.label}
              </div>
            );
          }
          return (
            <Tooltip key={item.type} text={item.tooltip}>
              <button
                onClick={() => addNode(item.type, item.defaults)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 6px', fontSize: 10.5,
                  textAlign: 'left', minWidth: 'unset', textTransform: 'none',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            </Tooltip>
          );
        })}
      </div>

      {/* ── Canvas ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes} edges={edges}
          onNodesChange={onNodesChangeWithHistory}
          onEdgesChange={onEdgesChangeWithHistory}
          onConnect={onConnect}
          nodeTypes={NODE_TYPES}
          onSelectionChange={onSelectionChange}
          deleteKeyCode="Delete"
          /* multi-select: Shift+drag = rubber-band box; Ctrl+click = add to selection */
          selectionKeyCode="Shift"
          multiSelectionKeyCode="Control"
          selectionOnDrag
          fitView
          style={{ background: 'var(--w95-desktop)' }}
        >
          <Controls />
          <MiniMap nodeColor={n => NODE_COLORS[n.type] ?? '#808080'} />
        </ReactFlow>

        <SaveToast message={toast} />
      </div>

      {nameDialog && (
        <NameDialog
          mode={nameDialog.mode}
          onConfirm={handleNameConfirm}
          onCancel={() => setNameDialog(null)}
        />
      )}
    </div>
  );
}
