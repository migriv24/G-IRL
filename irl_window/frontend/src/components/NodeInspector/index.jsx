/**
 * Node Inspector panel — shows data for the selected Journey Designer node.
 * Reads from inspector store. JourneyDesigner writes to it on selection change.
 */
import useInspectorStore from '../../store/inspector';

const NODE_META = {
  archetype: { icon: '👤', label: 'Archetype',        color: '#7c6af7' },
  goal:      { icon: '🎯', label: 'Goal',             color: '#c8a000' },
  phase:     { icon: '📅', label: 'Phase',            color: '#808080' },
  voice:     { icon: '🗣️', label: 'Voice / Mindset',  color: '#006060' },
  event:     { icon: '⚡', label: 'Event',            color: '#cc6600' },
  time_gap:  { icon: '⏸️', label: 'Time Gap',         color: '#444444' },
  generate:  { icon: '▶',  label: 'Generate',         color: '#007700' },
};

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '3px 0', borderBottom: '1px solid #e0e0e0', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 10, color: '#888', fontFamily: 'var(--font-mono)', minWidth: 80, flexShrink: 0, paddingTop: 1 }}>
        {label}
      </span>
      <span style={{ fontSize: 11, color: '#222', fontFamily: 'var(--font-mono)', wordBreak: 'break-word', flex: 1 }}>
        {value ?? <span style={{ color: '#bbb' }}>—</span>}
      </span>
    </div>
  );
}

export default function NodeInspector() {
  const selectedNode = useInspectorStore(s => s.selectedNode);

  if (!selectedNode) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 8, color: '#aaa', padding: 16,
      }}>
        <span style={{ fontSize: 24 }}>🔍</span>
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textAlign: 'center', color: '#aaa' }}>
          Click a node<br />to inspect it
        </span>
      </div>
    );
  }

  const meta = NODE_META[selectedNode.type] ?? { icon: '□', label: selectedNode.type, color: '#888' };
  const entries = Object.entries(selectedNode.data ?? {});

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '8px 10px' }}>
      {/* Node type header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
        paddingBottom: 6, borderBottom: `2px solid ${meta.color}`,
      }}>
        <span style={{ fontSize: 16 }}>{meta.icon}</span>
        <div>
          <div style={{ fontSize: 12, fontFamily: 'var(--font-pixel)', color: '#111', letterSpacing: '0.02em' }}>
            {meta.label}
          </div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#999' }}>
            id: {selectedNode.id}
          </div>
        </div>
      </div>

      {/* Fields */}
      {entries.length === 0 ? (
        <div style={{ fontSize: 11, color: '#aaa', fontFamily: 'var(--font-mono)' }}>No data fields.</div>
      ) : (
        entries.map(([k, v]) => (
          <Row key={k} label={k} value={String(v ?? '')} />
        ))
      )}

      <div style={{ marginTop: 10, fontSize: 10, color: '#bbb', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
        □ maximize node to edit
      </div>
    </div>
  );
}
