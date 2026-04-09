/**
 * Settings dialog — Win95 modal style.
 * Tabs: User | Projects | General | Provider
 */

import { useState, useEffect } from 'react';
import useSettingsStore from '../../store/settings';
import useProjectStore from '../../store/project';
import useWsStore from '../../store/ws';
import ProviderConfig from '../ProviderConfig';

const APP_VERSION = '0.1.0';

// ── Primitives ────────────────────────────────────────────────────────────────

function TitleBarBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: 16, height: 14, minWidth: 'unset', padding: 0,
      fontSize: 10, fontWeight: 'bold',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {children}
    </button>
  );
}

function TabBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '3px 14px', fontSize: 11,
      textTransform: 'none', letterSpacing: 0, minWidth: 'unset',
      background: active ? 'var(--w95-white)' : 'var(--w95-gray)',
      color: 'var(--text-on-gray)',
      borderBottom: active ? '2px solid var(--w95-white)' : undefined,
      marginBottom: active ? -2 : 0,
      position: 'relative', zIndex: active ? 1 : 0,
    }}>
      {label}
    </button>
  );
}

function Checkbox({ label, checked, onChange, description }) {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'default', marginBottom: 12 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 'auto', border: 'none', boxShadow: 'none', marginTop: 2, flexShrink: 0, accentColor: 'var(--w95-navy)' }}
      />
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-on-gray)' }}>{label}</div>
        {description && <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>{description}</div>}
      </div>
    </label>
  );
}

function LabelRow({ label, children }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, marginBottom: 3 }}>{label}:</div>
      {children}
    </div>
  );
}

function ReadField({ value }) {
  return (
    <div style={{
      fontSize: 11, padding: '2px 5px', fontFamily: 'var(--font-mono)',
      background: 'var(--w95-gray)', color: 'var(--text-dim)',
      border: '1px solid', borderColor: 'var(--bevel-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-br)',
    }}>
      {value || '—'}
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

// ── Tab: User ─────────────────────────────────────────────────────────────────

function UserTab() {
  const { username, userCreated, applyUserConfig } = useSettingsStore();
  const { sendMessage, connected } = useWsStore();
  const [draft, setDraft] = useState(username);
  const [feedback, setFeedback] = useState('');

  useEffect(() => { setDraft(username); }, [username]);

  const saveUsername = () => {
    if (!draft.trim()) return;
    sendMessage('user.config.set', { username: draft.trim() });
    setFeedback('Saved!');
    setTimeout(() => setFeedback(''), 2000);
  };

  return (
    <div style={{ padding: '12px 16px' }}>
      <fieldset style={{ border: '2px groove var(--bevel-br)', padding: '8px 12px 12px', marginBottom: 12 }}>
        <legend style={{ fontSize: 11, padding: '0 4px' }}>Profile</legend>

        <LabelRow label="Username">
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveUsername()}
              maxLength={32} disabled={!connected}
              style={{ flex: 1, fontSize: 11 }}
            />
            <button onClick={saveUsername} disabled={!connected || !draft.trim()} style={{ minWidth: 60, fontSize: 11 }}>
              {feedback || 'Save'}
            </button>
          </div>
          {!connected && <div style={{ fontSize: 9, color: 'var(--text-dim)', marginTop: 2 }}>backend offline</div>}
        </LabelRow>

        <LabelRow label="Account created">
          <ReadField value={fmtDate(userCreated)} />
        </LabelRow>
      </fieldset>

      <fieldset style={{ border: '2px groove var(--bevel-br)', padding: '8px 12px 12px' }}>
        <legend style={{ fontSize: 11, padding: '0 4px' }}>Application</legend>
        <LabelRow label="App version"><ReadField value={`IRL_Window v${APP_VERSION}`} /></LabelRow>
        <LabelRow label="Save format"><ReadField value="girl-journey v1.0 (.json)" /></LabelRow>
        <LabelRow label="Data directory"><ReadField value="~/.girl/projects/" /></LabelRow>
      </fieldset>
    </div>
  );
}

// ── Tab: Projects ─────────────────────────────────────────────────────────────

function ProjectsTab({ onClose }) {
  const { projectList, setProjectList, removeFromList, isDirty, name: currentName } = useProjectStore();
  const { sendMessage, onEvent, connected } = useWsStore();
  const [loading, setLoading] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameVal, setRenameVal]   = useState('');

  useEffect(() => {
    if (!connected) return;
    setLoading(true);
    sendMessage('project.list');
    const unsub = onEvent('project.list', (_, payload) => {
      setProjectList(payload.projects ?? []);
      setLoading(false);
    });
    return unsub;
  }, [connected]);

  useEffect(() => {
    const unsubDelete = onEvent('project.deleted', (_, p) => {
      if (p.success) removeFromList(p.id);
    });
    const unsubRename = onEvent('project.renamed', (_, meta) => {
      setProjectList(projectList.map(p => p.id === meta.id ? meta : p));
    });
    return () => { unsubDelete(); unsubRename(); };
  }, [projectList]);

  const openProject = id => {
    if (isDirty && !window.confirm(`"${currentName}" has unsaved changes. Discard and open?`)) return;
    sendMessage('project.load', { id });
    onClose();
  };

  const deleteProject = (id, nm) => {
    if (!window.confirm(`Delete "${nm}"? This cannot be undone.`)) return;
    sendMessage('project.delete', { id });
  };

  const commitRename = id => {
    if (renameVal.trim()) sendMessage('project.rename', { id, name: renameVal.trim() });
    setRenamingId(null);
  };

  if (!connected) return <div style={{ padding: 20, fontSize: 11, color: 'var(--text-dim)' }}>Backend offline.</div>;

  return (
    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 280 }}>
      <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
          {projectList.length} project{projectList.length !== 1 ? 's' : ''} · ~/.girl/projects/
        </span>
        <button onClick={() => { sendMessage('project.list'); setLoading(true); }} style={{ fontSize: 9, padding: '1px 6px' }}>↻</button>
      </div>

      <div style={{
        flex: 1, overflowY: 'auto',
        border: '2px solid', borderColor: 'var(--bevel-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-br)',
        background: 'white',
      }}>
        {loading && <div style={{ padding: 12, fontSize: 11, color: 'var(--text-dim)' }}>Loading...</div>}
        {!loading && projectList.length === 0 && (
          <div style={{ padding: 12, fontSize: 11, color: 'var(--text-dim)' }}>No saved projects yet.</div>
        )}
        {!loading && projectList.map((proj, i) => (
          <div key={proj.id} style={{
            padding: '5px 8px', borderBottom: '1px solid #e8e8e8',
            background: i % 2 === 0 ? 'white' : '#f9f9f9',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {renamingId === proj.id ? (
                <input autoFocus value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onBlur={() => commitRename(proj.id)}
                  onKeyDown={e => { if (e.key === 'Enter') commitRename(proj.id); if (e.key === 'Escape') setRenamingId(null); }}
                  style={{ fontSize: 11, width: '100%', boxSizing: 'border-box' }}
                />
              ) : (
                <div style={{ fontSize: 11, fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {proj.name}
                </div>
              )}
              <div style={{ fontSize: 9, color: 'var(--text-dim)' }}>
                {fmtDate(proj.saved_at)} · {proj.node_count ?? '?'} nodes · {proj.created_by ?? '?'}
              </div>
              {proj.description && (
                <div style={{ fontSize: 9, color: '#777', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {proj.description}
                </div>
              )}
            </div>
            <button onClick={() => openProject(proj.id)} style={{ fontSize: 9, padding: '1px 6px', flexShrink: 0 }}>Open</button>
            <button onClick={() => { setRenamingId(proj.id); setRenameVal(proj.name); }} style={{ fontSize: 9, padding: '1px 6px', flexShrink: 0 }}>✎</button>
            <button onClick={() => deleteProject(proj.id, proj.name)} style={{ fontSize: 9, padding: '1px 6px', flexShrink: 0, color: '#800000' }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: General ──────────────────────────────────────────────────────────────

function GeneralTab() {
  const { panelsDraggable, setSetting } = useSettingsStore();
  return (
    <div style={{ padding: '12px 16px' }}>
      <fieldset style={{ border: '2px groove var(--bevel-br)', padding: '8px 12px 12px' }}>
        <legend style={{ fontSize: 11, padding: '0 4px' }}>Panels</legend>
        <Checkbox
          label="Enable panel dragging"
          checked={panelsDraggable}
          onChange={v => setSetting('panelsDraggable', v)}
          description="Allow panels to be rearranged by dragging their headers. Off by default to avoid conflicts with the node canvas."
        />
      </fieldset>
    </div>
  );
}

// ── Main dialog ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'user',     label: 'User'     },
  { id: 'projects', label: 'Projects' },
  { id: 'general',  label: 'General'  },
  { id: 'provider', label: 'Provider' },
];

export default function SettingsDialog() {
  const { settingsOpen, activeTab, setActiveTab, closeSettings, applyUserConfig } = useSettingsStore();
  const { sendMessage, onEvent, connected } = useWsStore();

  // Load user config whenever dialog opens
  useEffect(() => {
    if (!settingsOpen || !connected) return;
    sendMessage('user.config.get');
  }, [settingsOpen, connected]);

  // Apply user config from backend
  useEffect(() => {
    return onEvent('user.config', (_, cfg) => applyUserConfig(cfg));
  }, []);

  // Apply loaded project (triggered from Projects tab)
  useEffect(() => {
    return onEvent('project.loaded', (_, data) => {
      useProjectStore.getState().handleLoaded(data);
    });
  }, []);

  if (!settingsOpen) return null;

  return (
    <>
      <div onClick={closeSettings} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 1000,
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 480, maxWidth: '92vw', maxHeight: '82vh',
        display: 'flex', flexDirection: 'column',
        background: 'var(--w95-gray)',
        border: '2px solid', borderColor: 'var(--bevel-tl) var(--bevel-outer-br) var(--bevel-outer-br) var(--bevel-tl)',
        boxShadow: 'inset 1px 1px 0 var(--w95-white), 4px 4px 0 rgba(0,0,0,0.5)',
        zIndex: 1001,
      }}>
        {/* Title bar */}
        <div style={{
          background: 'var(--titlebar-active)', padding: '3px 6px',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <span style={{ fontSize: 14 }}>⚙</span>
          <span style={{ color: 'var(--text-on-title)', fontFamily: 'var(--font-pixel)', fontSize: 13, flex: 1, letterSpacing: '0.04em' }}>
            IRL_Window Settings
          </span>
          <TitleBarBtn onClick={closeSettings}>✕</TitleBarBtn>
        </div>

        {/* Tab bar */}
        <div style={{
          background: 'var(--w95-gray)',
          borderBottom: '2px solid', borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)',
          padding: '4px 8px 0', display: 'flex', gap: 2, flexShrink: 0,
        }}>
          {TABS.map(t => (
            <TabBtn key={t.id} label={t.label} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {activeTab === 'user'     && <UserTab />}
          {activeTab === 'projects' && <ProjectsTab onClose={closeSettings} />}
          {activeTab === 'general'  && <GeneralTab />}
          {activeTab === 'provider' && <div style={{ height: '100%', minHeight: 400 }}><ProviderConfig /></div>}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end',
          padding: '8px 12px', flexShrink: 0,
          borderTop: '2px solid', borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)',
        }}>
          <button onClick={closeSettings} style={{ minWidth: 80 }}>Close</button>
        </div>
      </div>
    </>
  );
}
