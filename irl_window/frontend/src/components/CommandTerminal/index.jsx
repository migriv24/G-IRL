/** Win95 CMD.exe style terminal — context-aware, filesystem metaphor.
 *
 * Directory model:
 *   C:\IRL           — root (list of sections)
 *   C:\IRL\JD        — Journey Designer  (ls lists nodes)
 *   C:\IRL\S         — Samples           (ls lists sample count)
 *   C:\IRL\ML        — Model Lab
 *
 * Tab switches in the UI push a path change here via the activeTab prop.
 * The terminal can also be navigated independently with `cd`.
 * Everything not matched locally is forwarded to the backend.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import useWsStore from '../../store/ws';
import useProjectStore from '../../store/project';
import useCanvasStore from '../../store/canvas';

// ── Path helpers ─────────────────────────────────────────────────────────────

const TAB_TO_PATH = {
  journey: 'C:\\IRL\\JD',
  samples: 'C:\\IRL\\S',
  model:   'C:\\IRL\\ML',
};

const PATH_SECTIONS = {
  'C:\\IRL':    { dirs: ['JD', 'S', 'ML'], desc: 'IRL root' },
  'C:\\IRL\\JD': { dirs: [],               desc: 'Journey Designer' },
  'C:\\IRL\\S':  { dirs: [],               desc: 'Samples' },
  'C:\\IRL\\ML': { dirs: [],               desc: 'Model Lab' },
};

function resolvePath(current, input) {
  if (!input || input === '.') return current;
  if (input === '..') {
    const parts = current.split('\\');
    return parts.length > 2 ? parts.slice(0, -1).join('\\') : current;
  }
  // Absolute path shorthand e.g. 'JD', 'S', 'ML' or full path
  const upper = input.toUpperCase();
  const mapped = {
    JD:  'C:\\IRL\\JD',
    S:   'C:\\IRL\\S',
    ML:  'C:\\IRL\\ML',
    IRL: 'C:\\IRL',
  };
  if (mapped[upper]) return mapped[upper];
  // Full path typed
  const candidate = input.startsWith('C:\\') ? input : `${current}\\${input}`;
  return PATH_SECTIONS[candidate] ? candidate : null; // null = not found
}

// ── ls output per context ────────────────────────────────────────────────────

function lsOutput(path) {
  if (path === 'C:\\IRL') {
    return {
      type: 'table',
      columns: ['DIR', 'DESCRIPTION'],
      rows: [
        ['JD',  'Journey Designer — node canvas'],
        ['S',   'Samples — generated persona logs'],
        ['ML',  'Model Lab — LLM provider config'],
      ],
    };
  }

  if (path === 'C:\\IRL\\JD') {
    const { nodes, edges } = useCanvasStore.getState();
    const { name } = useProjectStore.getState();
    if (nodes.length === 0) {
      return { type: 'text', text: `Journey "${name}" — no nodes loaded.` };
    }
    const rows = nodes.map(n => [
      n.id,
      n.type,
      n.type === 'frame'
        ? `[group: ${nodes.filter(c => c.parentId === n.id).length} nodes]`
        : `(${Math.round(n.position.x)}, ${Math.round(n.position.y)})`,
    ]);
    return {
      type: 'table',
      columns: ['ID', 'TYPE', 'POS / INFO'],
      rows,
      header: `Journey: ${name}  |  ${nodes.length} nodes, ${edges.length} edges`,
    };
  }

  if (path === 'C:\\IRL\\S') {
    return { type: 'text', text: 'Samples panel — use the Samples tab to browse generated logs.' };
  }

  if (path === 'C:\\IRL\\ML') {
    return { type: 'text', text: 'Model Lab — use the Model Lab tab to configure providers.' };
  }

  return { type: 'text', text: `No listing available for ${path}` };
}

// ── Help text ────────────────────────────────────────────────────────────────

const HELP_TEXT = `Available commands:
  ls              List contents of current directory
  cd <dir>        Change directory (JD / S / ML / ..)
  pwd             Print current path
  clear           Clear terminal
  help            Show this help

Journey Designer (C:\\IRL\\JD):
  add <type>      Add a node (e.g. add phase)
  generate <n>    Run persona generation
  save            Save current journey
  load <name>     Load a journey

Keyboard shortcuts (canvas):
  Shift+drag      Box-select multiple nodes
  Ctrl+click      Add node to selection
  Shift+A         Group selected nodes into a frame`;

// ── Output renderers ─────────────────────────────────────────────────────────

function TableOutput({ header, columns, rows }) {
  const colWidths = columns.map((col, i) =>
    Math.max(col.length, ...rows.map(r => String(r[i] ?? '').length))
  );
  const pad = (str, len) => String(str ?? '').padEnd(len);
  const bar = colWidths.map(w => '─'.repeat(w + 2)).join('┼');

  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, lineHeight: 1.7 }}>
      {header && <div style={{ color: '#88bbdd', marginBottom: 2 }}>{header}</div>}
      <div style={{ color: '#aaffaa' }}>
        {'│'}{columns.map((c, i) => ` ${pad(c, colWidths[i])} │`).join('')}
      </div>
      <div style={{ color: '#55aa55' }}>{'├'}{bar}{'┤'}</div>
      {rows.map((row, ri) => (
        <div key={ri} style={{ color: '#ccffcc' }}>
          {'│'}{row.map((cell, ci) => {
            const s = String(cell ?? '');
            const color = s === 'ACTIVE' ? '#00ff00' : s === 'UNREACHABLE' ? '#ff4444' : s === 'OK' ? '#00ff00' : '#ccffcc';
            return <span key={ci} style={{ color }}>{` ${pad(s, colWidths[ci])} │`}</span>;
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
        <span style={{ color: '#00ff00' }}>{entry.prompt} </span>{entry.text}
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
    if (out.type === 'table')  return <div style={{ overflowX: 'auto', maxWidth: '100%' }}><TableOutput header={out.header} columns={out.columns} rows={out.rows} /></div>;
    if (out.type === 'text')   return <div style={{ color: '#ccffcc', whiteSpace: 'pre-wrap' }}>{out.text}</div>;
    return <pre style={{ color: '#aaffaa', fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(out, null, 2)}</pre>;
  }
  if (entry.type === 'node_save') {
    return <div style={{ color: '#cc88ff', fontSize: 11, fontFamily: 'var(--font-mono)' }}>[{entry.title}] SAVED</div>;
  }
  if (entry.type === 'nav') {
    return <div style={{ color: '#4488cc', fontSize: 11, fontStyle: 'italic' }}>  → {entry.text}</div>;
  }
  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CommandTerminal({ activeTab }) {
  const [history, setHistory] = useState([
    { type: 'system', text: 'IRL_Window Command Interface v0.2' },
    { type: 'system', text: 'Type HELP for available commands.' },
    { type: 'system', text: '' },
  ]);
  const [input,   setInput]   = useState('');
  const [histIdx, setHistIdx] = useState(-1);
  const [cmdHist, setCmdHist] = useState([]);
  const [path,    setPath]    = useState('C:\\IRL\\JD');

  const inputRef  = useRef(null);
  const bottomRef = useRef(null);
  const { connected, sendCommand, onEvent } = useWsStore();

  const prompt = `${path}>`;

  // ── Update path when the user switches tabs ──────────────────────────
  const prevTabRef = useRef(activeTab);
  useEffect(() => {
    if (activeTab && activeTab !== prevTabRef.current) {
      const newPath = TAB_TO_PATH[activeTab] ?? 'C:\\IRL';
      prevTabRef.current = activeTab;
      setPath(newPath);
      setHistory(h => [...h, {
        type: 'nav',
        text: `Tab switched → ${newPath}`,
      }]);
    }
  }, [activeTab]);

  // ── Backend event listeners ───────────────────────────────────────────
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
    const u6 = onEvent('node.saved', (_, p) =>
      setHistory(h => [...h, { type: 'node_save', title: p.title }])
    );
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, [onEvent]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'auto' }); }, [history]);

  // ── Local command handler (intercepts before backend) ─────────────────
  const handleLocalCommand = useCallback((cmd) => {
    const parts = cmd.trim().split(/\s+/);
    const verb  = parts[0].toLowerCase();
    const arg   = parts.slice(1).join(' ');

    if (verb === 'clear' || verb === 'cls') {
      setHistory([{ type: 'system', text: 'Terminal cleared.' }, { type: 'system', text: '' }]);
      return true;
    }

    if (verb === 'pwd') {
      setHistory(h => [...h, { type: 'result', output: { type: 'text', text: path } }]);
      return true;
    }

    if (verb === 'help') {
      setHistory(h => [...h, { type: 'result', output: { type: 'text', text: HELP_TEXT } }]);
      return true;
    }

    if (verb === 'cd') {
      if (!arg) {
        setHistory(h => [...h, { type: 'result', output: { type: 'text', text: path } }]);
        return true;
      }
      const next = resolvePath(path, arg);
      if (next === null) {
        setHistory(h => [...h, { type: 'result', error: `Path not found: ${arg}` }]);
      } else {
        setPath(next);
        setHistory(h => [...h, { type: 'result', output: { type: 'text', text: next } }]);
      }
      return true;
    }

    if (verb === 'ls' || verb === 'dir') {
      const out = lsOutput(path);
      setHistory(h => [...h, { type: 'result', output: out }]);
      return true;
    }

    return false; // not handled locally → send to backend
  }, [path]);

  // ── Submit ────────────────────────────────────────────────────────────
  const submit = useCallback(() => {
    const cmd = input.trim();
    if (!cmd) return;

    setHistory(h => [...h, { type: 'input', text: cmd, prompt }]);
    setCmdHist(h => [cmd, ...h.slice(0, 99)]);
    setHistIdx(-1);
    setInput('');

    if (handleLocalCommand(cmd)) return;

    if (!connected) {
      setHistory(h => [...h, { type: 'result', error: 'Not connected to backend.' }]);
      return;
    }
    sendCommand(cmd);
  }, [input, prompt, connected, sendCommand, handleLocalCommand]);

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
        <span style={{ color: '#00ff00', fontSize: 11, fontFamily: 'var(--font-mono)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          {prompt}
        </span>
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
