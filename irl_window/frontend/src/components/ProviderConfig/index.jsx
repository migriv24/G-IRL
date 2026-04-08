/** Win95 dialog panel style */
import { useState, useEffect } from 'react';
import useWsStore from '../../store/ws';

const PROVIDERS = [
  { name: 'ollama',    label: 'Ollama (local)',    needsKey: false, defaultUrl: 'http://localhost:11434', defaultModel: 'llama3.2:1b' },
  { name: 'anthropic', label: 'Anthropic',          needsKey: true,  defaultUrl: '',                      defaultModel: 'claude-sonnet-4-6' },
  { name: 'openai',    label: 'OpenAI',             needsKey: true,  defaultUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-4o-mini' },
  { name: 'deepseek',  label: 'DeepSeek',           needsKey: true,  defaultUrl: 'https://api.deepseek.com/v1', defaultModel: 'deepseek-chat' },
  { name: 'groq',      label: 'Groq',               needsKey: true,  defaultUrl: 'https://api.groq.com/openai/v1', defaultModel: 'mixtral-8x7b-32768' },
];

function W95Label({ children }) {
  return <div style={{ fontSize: 11, marginBottom: 2, color: 'var(--text-on-gray)' }}>{children}</div>;
}

function W95Field({ label, value, onChange, type = 'text' }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <W95Label>{label}</W95Label>
      <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} style={{ width: '100%', fontSize: 11 }} />
    </div>
  );
}

export default function ProviderConfig() {
  const { sendCommand, connected, activeProvider } = useWsStore();
  const [selected, setSelected] = useState('ollama');
  const [fields, setFields] = useState({});
  const [msg, setMsg] = useState(null);
  const def = PROVIDERS.find(p => p.name === selected);

  useEffect(() => {
    if (!def) return;
    setFields({ url: def.defaultUrl, model: def.defaultModel, key: '' });
    setMsg(null);
  }, [selected]);

  const apply = () => {
    if (!connected) { setMsg({ ok: false, text: 'Not connected' }); return; }
    const parts = [`provider add ${selected}`, `--model ${fields.model}`];
    if (fields.key) parts.push(`--key ${fields.key}`);
    if (fields.url && def.name !== 'anthropic') parts.push(`--url ${fields.url}`);
    sendCommand(parts.join(' '));
    sendCommand(`provider set ${selected}`);
    setMsg({ ok: true, text: 'Applied.' });
  };

  const ping = () => connected && sendCommand('ping');

  return (
    <div style={{ padding: 8, background: 'var(--w95-gray)', height: '100%', overflowY: 'auto' }}>

      {/* Active provider display — sunken well */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '3px 6px', marginBottom: 10,
        border: '2px solid',
        borderColor: 'var(--bevel-outer-br) var(--bevel-tl) var(--bevel-tl) var(--bevel-outer-br)',
        boxShadow: 'inset 1px 1px 0 var(--bevel-br)',
        background: 'var(--w95-white)',
      }}>
        <div style={{ width: 8, height: 8, background: connected ? '#00cc00' : '#cc0000', border: '1px solid #000', flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, flex: 1 }}>
          {activeProvider ?? 'none'}
        </span>
        <button onClick={ping} style={{ padding: '1px 6px', minWidth: 'unset', fontSize: 10 }}>Ping</button>
      </div>

      {/* Provider radio buttons — Win95 GroupBox style */}
      <fieldset style={{
        border: '2px groove var(--bevel-br)',
        padding: '4px 8px 8px',
        marginBottom: 10,
      }}>
        <legend style={{ fontSize: 11, padding: '0 4px' }}>Provider</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
          {PROVIDERS.map(p => (
            <label key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'default' }}>
              <input
                type="radio"
                name="provider"
                value={p.name}
                checked={selected === p.name}
                onChange={() => setSelected(p.name)}
                style={{ width: 'auto', border: 'none', boxShadow: 'none', background: 'transparent', accentColor: 'var(--w95-navy)' }}
              />
              {p.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Fields */}
      <W95Field label="Model" value={fields.model} onChange={v => setFields(f => ({ ...f, model: v }))} />
      {def?.name !== 'anthropic' && (
        <W95Field label="Base URL" value={fields.url} onChange={v => setFields(f => ({ ...f, url: v }))} />
      )}
      {def?.needsKey && (
        <W95Field label="API Key" type="password" value={fields.key} onChange={v => setFields(f => ({ ...f, key: v }))} />
      )}
      {!def?.needsKey && (
        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 8 }}>No API key required.</div>
      )}

      {/* Win95-style button row */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 4 }}>
        <button onClick={apply} style={{ minWidth: 75 }}>OK</button>
        <button onClick={() => setMsg(null)} style={{ minWidth: 75 }}>Cancel</button>
      </div>

      {msg && (
        <div style={{
          marginTop: 8, padding: '3px 6px', fontSize: 11,
          color: msg.ok ? 'var(--green)' : 'var(--red)',
          border: '1px solid',
          borderColor: msg.ok ? 'var(--green)' : 'var(--red)',
        }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
