/** Win95 taskbar */
import useWsStore from '../../store/ws';
import useSettingsStore from '../../store/settings';
import Tooltip from '../Tooltip';

export default function StatusBar() {
  const { connected, activeProvider } = useWsStore();
  const { toggleSettings, settingsOpen } = useSettingsStore();
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: 28,
      background: 'var(--w95-gray)',
      borderTop: '2px solid',
      borderColor: 'var(--bevel-tl) var(--bevel-outer-br) var(--bevel-outer-br) var(--bevel-tl)',
      boxShadow: 'inset 0 1px 0 var(--w95-white)',
      padding: '0 4px',
      gap: 4,
      flexShrink: 0,
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
    }}>
      {/* Start button */}
      <Tooltip text="Settings & projects">
        <button
          onClick={toggleSettings}
          style={{
            padding: '2px 8px',
            fontFamily: 'var(--font-pixel)',
            fontSize: 13,
            fontWeight: 'bold',
            minWidth: 'unset',
            letterSpacing: '0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            borderColor: settingsOpen
              ? 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)'
              : undefined,
          }}
        >
          <img src="/favicon.ico" alt="" style={{ width: 16, height: 16, imageRendering: 'pixelated' }} />
          IRL
        </button>
      </Tooltip>

      {/* Divider */}
      <div style={{ width: 2, height: 20, background: 'var(--bevel-br)', borderLeft: '1px solid var(--w95-white)', marginLeft: 4 }} />

      {/* Connection status — sunken inset panel */}
      <Tooltip text={connected ? 'Backend WebSocket connected' : 'Backend offline — start uvicorn'}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '1px 8px',
          border: '2px solid',
          borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)',
          boxShadow: 'inset 1px 1px 0 var(--bevel-br)',
          background: 'var(--w95-gray)',
          minWidth: 120,
        }}>
          <div style={{
            width: 8, height: 8,
            background: connected ? '#00cc00' : '#cc0000',
            border: '1px solid var(--bevel-outer-br)',
          }} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </Tooltip>

      <Tooltip text="Active LLM provider">
        <div style={{
          padding: '1px 8px',
          border: '2px solid',
          borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)',
          boxShadow: 'inset 1px 1px 0 var(--bevel-br)',
          minWidth: 100,
        }}>
          Provider: <strong>{activeProvider ?? '—'}</strong>
        </div>
      </Tooltip>

      {/* Right-aligned clock */}
      <Tooltip text="Local time">
        <div style={{
          marginLeft: 'auto',
          padding: '1px 10px',
          border: '2px solid',
          borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)',
          boxShadow: 'inset 1px 1px 0 var(--bevel-br)',
          fontFamily: 'var(--font-mono)',
        }}>
          {now}
        </div>
      </Tooltip>
    </div>
  );
}
