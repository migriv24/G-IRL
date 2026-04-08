/**
 * Settings dialog — Win95 modal style.
 * Opens from the IRL button in the status bar.
 * Contains: Provider config + General settings.
 */
import { useState } from 'react';
import useSettingsStore from '../../store/settings';
import ProviderConfig from '../ProviderConfig';

function TitleBarBtn({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 16, height: 14, minWidth: 'unset', padding: 0,
        fontSize: 10, fontWeight: 'bold',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function TabBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 14px', fontSize: 11,
        textTransform: 'none', letterSpacing: 0,
        background: active ? 'var(--w95-white)' : 'var(--w95-gray)',
        color: 'var(--text-on-gray)',
        borderBottom: active ? '2px solid var(--w95-white)' : undefined,
        marginBottom: active ? -2 : 0,
        position: 'relative', zIndex: active ? 1 : 0,
        minWidth: 'unset',
      }}
    >
      {label}
    </button>
  );
}

function Checkbox({ label, checked, onChange, description }) {
  return (
    <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'default', marginBottom: 12 }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 'auto', border: 'none', boxShadow: 'none', marginTop: 2, flexShrink: 0, accentColor: 'var(--w95-navy)' }}
      />
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-on-gray)' }}>{label}</div>
        {description && (
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.4 }}>{description}</div>
        )}
      </div>
    </label>
  );
}

function GeneralTab() {
  const { panelsDraggable, setSetting } = useSettingsStore();

  return (
    <div style={{ padding: '12px 16px' }}>
      <fieldset style={{ border: '2px groove var(--bevel-br)', padding: '8px 12px 12px', marginBottom: 12 }}>
        <legend style={{ fontSize: 11, padding: '0 4px' }}>Panels</legend>
        <Checkbox
          label="Enable panel dragging"
          checked={panelsDraggable}
          onChange={v => setSetting('panelsDraggable', v)}
          description="Allow panels to be rearranged by dragging their headers. Off by default to avoid conflicts with the node canvas."
        />
      </fieldset>

      <fieldset style={{ border: '2px groove var(--bevel-br)', padding: '8px 12px 12px' }}>
        <legend style={{ fontSize: 11, padding: '0 4px' }}>About</legend>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.8, color: 'var(--text-dim)' }}>
          IRL_Window v0.1<br />
          Synthetic Data Platform<br />
          <span style={{ color: '#aaa' }}>Part of the IRL → G-IRL project</span>
        </div>
      </fieldset>
    </div>
  );
}

const TABS = [
  { id: 'general',  label: 'General'  },
  { id: 'provider', label: 'Provider' },
];

export default function SettingsDialog() {
  const { settingsOpen, closeSettings } = useSettingsStore();
  const [activeTab, setActiveTab] = useState('general');

  if (!settingsOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={closeSettings}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.25)',
          zIndex: 1000,
        }}
      />

      {/* Dialog window — centered */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 460, maxWidth: '90vw',
        maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        background: 'var(--w95-gray)',
        border: '2px solid',
        borderColor: 'var(--bevel-tl) var(--bevel-outer-br) var(--bevel-outer-br) var(--bevel-tl)',
        boxShadow: 'inset 1px 1px 0 var(--w95-white), 4px 4px 0 rgba(0,0,0,0.5)',
        zIndex: 1001,
      }}>
        {/* Title bar */}
        <div style={{
          background: 'var(--titlebar-active)',
          padding: '3px 6px',
          display: 'flex', alignItems: 'center', gap: 6,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 14 }}>⚙</span>
          <span style={{
            color: 'var(--text-on-title)',
            fontFamily: 'var(--font-pixel)',
            fontSize: 13, flex: 1,
            letterSpacing: '0.04em',
          }}>
            IRL_Window Settings
          </span>
          <TitleBarBtn onClick={closeSettings}>✕</TitleBarBtn>
        </div>

        {/* Tab bar */}
        <div style={{
          background: 'var(--w95-gray)',
          borderBottom: '2px solid',
          borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)',
          padding: '4px 8px 0',
          display: 'flex', gap: 2,
          flexShrink: 0,
        }}>
          {TABS.map(t => (
            <TabBtn key={t.id} label={t.label} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {activeTab === 'general'  && <GeneralTab />}
          {activeTab === 'provider' && (
            <div style={{ height: '100%', minHeight: 400 }}>
              <ProviderConfig />
            </div>
          )}
        </div>

        {/* Button row */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end',
          padding: '8px 12px',
          borderTop: '2px solid',
          borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)',
          flexShrink: 0,
        }}>
          <button onClick={closeSettings} style={{ minWidth: 80 }}>Close</button>
        </div>
      </div>
    </>
  );
}
