import { useCallback, useEffect } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { NODE_TYPES } from './nodes';
import useHistoryStore from '../../store/history';
import useInspectorStore from '../../store/inspector';

// ── Sample journey ─────────────────────────────────────────────────────────
const INITIAL_NODES = [
  { id: 'arch-1',           type: 'archetype', position: { x: 40,   y: 160 }, data: { archetype_type: 'persistent_introvert', age_range: '20–26', charisma: '0.2–0.4', social_anxiety: '0.6–0.9' } },
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
  { id: 'e1',  source: 'arch-1',         target: 'goal-1',           animated: true  },
  { id: 'e2',  source: 'arch-1',         target: 'voice-1'                            },
  { id: 'e3',  source: 'goal-1',         target: 'phase-struggle',   animated: true  },
  { id: 'e4',  source: 'voice-1',        target: 'phase-struggle'                     },
  { id: 'e5',  source: 'phase-struggle', target: 'phase-growth',     animated: true  },
  { id: 'e6',  source: 'phase-growth',   target: 'event-lucky',      animated: true  },
  { id: 'e7',  source: 'phase-growth',   target: 'phase-struggle-2'                  },
  { id: 'e8',  source: 'phase-struggle-2',target: 'gap-1'                            },
  { id: 'e9',  source: 'event-lucky',    target: 'phase-break',      animated: true  },
  { id: 'e10', source: 'gap-1',          target: 'phase-break'                       },
  { id: 'e11', source: 'phase-break',    target: 'gen-1',            animated: true  },
];

// ── Node palette ───────────────────────────────────────────────────────────
const PALETTE = [
  { type: 'archetype', label: 'Archetype', icon: '👤', defaults: { archetype_type: 'growth_mindset', age_range: '18–28' } },
  { type: 'goal',      label: 'Goal',      icon: '🎯', defaults: { goal_text: 'new goal', horizon: '6 months' } },
  { type: 'phase',     label: 'Phase',     icon: '📅', defaults: { phase_type: 'struggle', duration: '4–6 weeks' } },
  { type: 'voice',     label: 'Voice',     icon: '🗣️', defaults: { locus: 'internal', emotional_tone: 'neutral' } },
  { type: 'event',     label: 'Event',     icon: '⚡', defaults: { event_type: 'lucky_break', probability: '0.3' } },
  { type: 'time_gap',  label: 'Time Gap',  icon: '⏸️', defaults: { gap_duration: '1–3 months' } },
  { type: 'generate',  label: 'Generate',  icon: '▶',  defaults: { n_personas: 3, provider: 'ollama', model: 'llama3.2:1b' } },
];

export default function JourneyDesigner() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const { pushSnapshot, undo, redo, canUndo, canRedo } = useHistoryStore();
  const { setSelectedNode, clearSelection } = useInspectorStore();

  const onSelectionChange = useCallback(({ nodes: selectedNodes }) => {
    if (selectedNodes.length === 1) {
      const n = selectedNodes[0];
      setSelectedNode({ id: n.id, type: n.type, data: n.data });
    } else {
      clearSelection();
    }
  }, [setSelectedNode, clearSelection]);

  // ── Undo/redo keyboard shortcuts ─────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (!e.ctrlKey) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo(nodes, edges, setNodes, setEdges);
      }
      if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo(nodes, edges, setNodes, setEdges);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nodes, edges, undo, redo, setNodes, setEdges]);

  const onConnect = useCallback((params) => {
    pushSnapshot(nodes, edges);
    setEdges(eds => addEdge(params, eds));
  }, [nodes, edges, pushSnapshot, setEdges]);

  const addNode = useCallback((type, defaults) => {
    pushSnapshot(nodes, edges);
    const id = `${type}-${Date.now()}`;
    setNodes(nds => [...nds, {
      id, type,
      position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 },
      data: { ...defaults },
    }]);
  }, [nodes, edges, pushSnapshot, setNodes]);

  // Wrap node/edge changes to push snapshots on drag-end, delete, etc.
  const onNodesChangeWithHistory = useCallback((changes) => {
    const significant = changes.some(c => c.type === 'remove' || c.type === 'add');
    if (significant) pushSnapshot(nodes, edges);
    onNodesChange(changes);
  }, [nodes, edges, onNodesChange, pushSnapshot]);

  const onEdgesChangeWithHistory = useCallback((changes) => {
    const significant = changes.some(c => c.type === 'remove' || c.type === 'add');
    if (significant) pushSnapshot(nodes, edges);
    onEdgesChange(changes);
  }, [nodes, edges, onEdgesChange, pushSnapshot]);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%' }}>

      {/* ── Left palette ───────────────────────────────────────────────── */}
      <div style={{
        width: 110,
        flexShrink: 0,
        background: 'var(--w95-gray)',
        borderRight: '2px solid',
        borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)',
        padding: 6,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        overflowY: 'auto',
      }}>
        {/* Undo / Redo */}
        <div style={{ marginBottom: 6, display: 'flex', gap: 3 }}>
          <button
            onClick={() => undo(nodes, edges, setNodes, setEdges)}
            disabled={!canUndo()}
            style={{ minWidth: 'unset', flex: 1, padding: '2px 4px', fontSize: 10 }}
            title="Undo (Ctrl+Z)"
          >↩</button>
          <button
            onClick={() => redo(nodes, edges, setNodes, setEdges)}
            disabled={!canRedo()}
            style={{ minWidth: 'unset', flex: 1, padding: '2px 4px', fontSize: 10 }}
            title="Redo (Ctrl+Y)"
          >↪</button>
        </div>

        <div style={{
          fontSize: 9, color: 'var(--text-dim)', textTransform: 'uppercase',
          letterSpacing: '0.08em', paddingLeft: 2, marginBottom: 2,
        }}>
          Add Node
        </div>

        {PALETTE.map(({ type, label, icon, defaults }) => (
          <button
            key={type}
            onClick={() => addNode(type, defaults)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 6px',
              fontSize: 11,
              textAlign: 'left',
              minWidth: 'unset',
              textTransform: 'none',
            }}
          >
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── Canvas ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChangeWithHistory}
          onEdgesChange={onEdgesChangeWithHistory}
          onConnect={onConnect}
          nodeTypes={NODE_TYPES}
          onSelectionChange={onSelectionChange}
          deleteKeyCode="Delete"
          fitView
          style={{ background: 'var(--w95-desktop)' }}
        >
          {/* Win95 teal desktop — subtle dot texture via CSS, no RF background needed */}
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const m = { archetype: '#7c6af7', goal: '#c8a000', phase: '#808080', voice: '#006060', event: '#cc6600', time_gap: '#444', generate: '#007700' };
              return m[n.type] ?? '#808080';
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
