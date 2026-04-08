import { useState, useEffect, lazy, Suspense } from 'react';
import useWsStore from './store/ws';
import useSettingsStore from './store/settings';
import StatusBar from './components/StatusBar';
import CommandTerminal from './components/CommandTerminal';
import NodeInspector from './components/NodeInspector';
import SettingsDialog from './components/Settings';

const JourneyDesigner = lazy(() => import('./components/JourneyDesigner'));
const SampleViewer    = lazy(() => import('./components/SampleViewer'));
const ModelLab        = lazy(() => import('./components/ModelLab'));

const TABS = [
  { id: 'journey', label: 'Journey Designer', icon: '🗺' },
  { id: 'samples', label: 'Samples',          icon: '📋' },
  { id: 'model',   label: 'Model Lab',         icon: '🧠' },
];

// ── Win95 menu bar tab ────────────────────────────────────────────────────────
function MenuTab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 12px',
        minWidth: 'unset',
        fontSize: 12,
        textTransform: 'none',
        letterSpacing: 0,
        background: active ? 'var(--w95-white)' : 'var(--w95-gray)',
        color: 'var(--text-on-gray)',
        borderBottom: active ? '2px solid var(--w95-white)' : undefined,
        marginBottom: active ? -2 : 0,
        position: 'relative',
        zIndex: active ? 1 : 0,
      }}
    >
      {label}
    </button>
  );
}

// ── App title bar ─────────────────────────────────────────────────────────────
function AppTitleBar() {
  return (
    <div style={{
      background: 'var(--titlebar-active)',
      padding: '3px 6px',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0,
      userSelect: 'none',
    }}>
      <span style={{ fontSize: 14 }}>🪟</span>
      <span style={{
        color: 'var(--text-on-title)',
        fontFamily: 'var(--font-pixel)',
        fontSize: 14,
        letterSpacing: '0.05em',
        flex: 1,
      }}>
        IRL_Window v0.1
      </span>
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
        Synthetic Data Platform
      </span>
    </div>
  );
}

// ── Menu bar ──────────────────────────────────────────────────────────────────
function MenuBar({ active, setActive }) {
  return (
    <div style={{
      background: 'var(--w95-gray)',
      borderBottom: '2px solid',
      borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)',
      padding: '4px 8px 0',
      display: 'flex',
      alignItems: 'flex-end',
      gap: 2,
      flexShrink: 0,
    }}>
      {TABS.map(t => (
        <MenuTab key={t.id} label={t.label} active={active === t.id} onClick={() => setActive(t.id)} />
      ))}
    </div>
  );
}

// ── Placeholder for unbuilt panels ────────────────────────────────────────────
function PlaceholderPanel({ label }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--w95-gray)',
      color: 'var(--text-dim)',
      fontFamily: 'var(--font-pixel)',
      fontSize: 18,
      flexDirection: 'column',
      gap: 12,
    }}>
      <span style={{ fontSize: 48 }}>📁</span>
      <span>{label} — coming in next stage</span>
    </div>
  );
}

// ── Panel wrapper — the core "Blender-style panel" primitive ──────────────────
// Every panel has: title bar (with drag handle + title) + scrollable body.
// Draggability is visual-only unless settings.panelsDraggable is true.
function Panel({ title, icon, children, style = {} }) {
  const panelsDraggable = useSettingsStore(s => s.panelsDraggable);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',   // ← critical: panel never leaks size to parent
      background: 'var(--w95-gray)',
      border: '2px solid',
      borderColor: 'var(--bevel-tl) var(--bevel-outer-br) var(--bevel-outer-br) var(--bevel-tl)',
      ...style,
    }}>
      {/* Panel header */}
      <div style={{
        background: 'var(--titlebar-active)',
        padding: '2px 6px',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        flexShrink: 0,
        userSelect: 'none',
        cursor: panelsDraggable ? 'grab' : 'default',
      }}>
        {/* Drag handle dots — always visible, only functional when enabled */}
        <span style={{
          fontSize: 8,
          color: panelsDraggable ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
          letterSpacing: '-1px',
          fontFamily: 'monospace',
          lineHeight: 1,
          flexShrink: 0,
        }}>
          ⠿
        </span>
        {icon && <span style={{ fontSize: 11, flexShrink: 0 }}>{icon}</span>}
        <span style={{
          color: 'var(--text-on-title)',
          fontFamily: 'var(--font-pixel)',
          fontSize: 11,
          letterSpacing: '0.03em',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {title}
        </span>
      </div>

      {/* Panel body — scrolls internally, never bleeds out */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

// ── Main canvas area (left side) ──────────────────────────────────────────────
function MainCanvas({ activeTab }) {
  return (
    <Panel
      title={TABS.find(t => t.id === activeTab)?.label ?? ''}
      icon={TABS.find(t => t.id === activeTab)?.icon}
      style={{ flex: 1, borderLeft: 'none', borderTop: 'none', borderBottom: 'none' }}
    >
      <Suspense fallback={<PlaceholderPanel label="Loading..." />}>
        {activeTab === 'journey' && <JourneyDesigner />}
        {activeTab === 'samples' && <SampleViewer />}
        {activeTab === 'model'   && <ModelLab />}
      </Suspense>
    </Panel>
  );
}

// ── Right sidebar ─────────────────────────────────────────────────────────────
function RightSidebar() {
  return (
    <div style={{
      width: 290,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',   // ← sidebar never grows beyond its column
    }}>
      {/* Inspector panel — top ~40% */}
      <Panel
        title="Node Inspector"
        icon="🔍"
        style={{ height: '40%', flexShrink: 0 }}
      >
        <NodeInspector />
      </Panel>

      {/* Terminal panel — bottom ~60%, fills remaining space */}
      <Panel
        title="Command Terminal"
        icon="📟"
        style={{ flex: 1 }}
      >
        <CommandTerminal />
      </Panel>
    </div>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('journey');
  const connect = useWsStore(s => s.connect);
  useEffect(() => { connect(); }, [connect]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      background: 'var(--w95-gray)',
      border: '3px solid',
      borderColor: 'var(--bevel-tl) var(--bevel-outer-br) var(--bevel-outer-br) var(--bevel-tl)',
      boxShadow: 'inset 1px 1px 0 var(--w95-white)',
      overflow: 'hidden',   // ← app never overflows viewport
    }}>
      <AppTitleBar />
      <MenuBar active={activeTab} setActive={setActiveTab} />

      {/* Main content row — fills remaining height, never overflows */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        <MainCanvas activeTab={activeTab} />
        <RightSidebar />
      </div>

      <StatusBar />

      {/* Settings dialog — rendered as portal-style overlay at root level */}
      <SettingsDialog />
    </div>
  );
}
