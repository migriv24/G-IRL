/** Win95 CMD.exe style terminal */
import { useState, useEffect, useRef, useCallback } from 'react';
import useWsStore from '../../store/ws';

function TableOutput({ columns, rows }) {
  const colWidths = columns.map((col, i) =>
    Math.max(col.length, ...rows.map(r => String(r[i] ?? '').length))
  );
  const pad = (str, len) => String(str ?? '').padEnd(len);
  const bar = colWidths.map(w => '─'.repeat(w + 2)).join('┼');

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7 }}>
      <div style={{ color: '#aaffaa' }}>
        {'│'}{columns.map((c, i) => ` ${pad(c, colWidths[i])} │`).join('')}
      </div>
      <div style={{ color: '#55aa55' }}>{'├'}{bar}{'┤'}</div>
      {rows.map((row, ri) => (
        <div key={ri} style={{ color: '#ccffcc' }}>
          {'│'}{row.map((cell, ci) => {
            const highlight = cell === 'ACTIVE' ? '#00ff00' : cell === 'UNREACHABLE' ? '#ff4444' : cell === 'OK' ? '#00ff00' : '#ccffcc';
            return <span key={ci} style={{ color: highlight }}>{` ${pad(cell, colWidths[ci])} │`}</span>;
          })}
        </div>
      ))}
    </div>
  );
}

function OutputEntry({ entry }) {
  if (entry.type === 'system') {
    return <div style={{ color: '#aaaaaa', fontSize: 11 }}>{entry.text}</div>;
  }
  if (entry.type === 'input') {
    return (
      <div style={{ color: '#ffffff' }}>
        <span style={{ color: '#00ff00' }}>C:\IRL&gt; </span>{entry.text}
      </div>
    );
  }
  if (entry.type === 'event') {
    return <div style={{ color: '#ffff00', fontSize: 11, fontStyle: 'italic', wordBreak: 'break-word' }}>[{entry.event}] {entry.text}</div>;
  }
  if (entry.type === 'result') {
    if (entry.error) return <div style={{ color: '#ff4444' }}>ERROR: {entry.error}</div>;
    const out = entry.output;
    if (!out) return null;
    if (out.type === 'table') return <div style={{ overflowX: 'auto', maxWidth: '100%' }}><TableOutput columns={out.columns} rows={out.rows} /></div>;
    if (out.type === 'text') return <div style={{ color: '#ccffcc' }}>{out.text}</div>;
    return <pre style={{ color: '#aaffaa', fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(out, null, 2)}</pre>;
  }
  return null;
}

export default function CommandTerminal() {
  const [history, setHistory] = useState([
    { type: 'system', text: 'IRL_Window Command Interface v0.1' },
    { type: 'system', text: 'Type HELP for available commands.' },
    { type: 'system', text: '' },
  ]);
  const [input, setInput]       = useState('');
  const [histIdx, setHistIdx]   = useState(-1);
  const [cmdHist, setCmdHist]   = useState([]);
  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const { connected, sendCommand, onEvent } = useWsStore();

  useEffect(() => {
    const u1 = onEvent('command.result', (_, p) =>
      setHistory(h => [...h, { type: 'result', output: p.output, error: p.error }])
    );
    const u2 = onEvent('generate.started',  (_, p) =>
      setHistory(h => [...h, { type: 'event', event: 'GEN', text: `Starting generation of ${p.n} personas...` }])
    );
    const u3 = onEvent('generate.progress', (_, p) =>
      setHistory(h => [...h, { type: 'event', event: 'GEN', text: `[${p.current}/${p.total}] ${p.status}` }])
    );
    const u4 = onEvent('generate.sample',   (_, p) =>
      setHistory(h => [...h, { type: 'event', event: 'SAMPLE', text: `#${p.index}: ${String(p.text).slice(0, 120)}...` }])
    );
    const u5 = onEvent('generate.complete', (_, p) =>
      setHistory(h => [...h, { type: 'event', event: 'GEN', text: `Done. Generated ${p.n} personas.` }])
    );
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [onEvent]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'auto' }); }, [history]);

  const submit = useCallback(() => {
    const cmd = input.trim();
    if (!cmd) return;
    setHistory(h => [...h, { type: 'input', text: cmd }]);
    setCmdHist(h => [cmd, ...h.slice(0, 99)]);
    setHistIdx(-1);
    setInput('');
    if (!connected) {
      setHistory(h => [...h, { type: 'result', error: 'Not connected to backend.' }]);
      return;
    }
    sendCommand(cmd);
  }, [input, connected, sendCommand]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); const n = Math.min(histIdx + 1, cmdHist.length - 1); setHistIdx(n); setInput(cmdHist[n] ?? ''); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const n = Math.max(histIdx - 1, -1); setHistIdx(n); setInput(n === -1 ? '' : cmdHist[n] ?? ''); }
  }, [submit, histIdx, cmdHist]);

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#000000', cursor: 'text' }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Output */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {history.map((entry, i) => <OutputEntry key={i} entry={entry} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input line */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        borderTop: '1px solid #333',
        padding: '4px 8px',
        gap: 4,
        background: '#000',
      }}>
        <span style={{ color: '#00ff00', fontSize: 12, fontFamily: 'var(--font-mono)', flexShrink: 0 }}>C:\IRL&gt;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          autoFocus
          spellCheck={false}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#ffffff',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            caretColor: '#00ff00',
            boxShadow: 'none',
          }}
          placeholder={connected ? '' : 'connecting...'}
        />
        <div style={{ width: 8, height: 14, background: connected ? '#00ff00' : '#ff0000', flexShrink: 0 }} />
      </div>
    </div>
  );
}
