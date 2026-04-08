/**
 * WebSocket store — manages connection to the IRL_Window backend.
 * Components subscribe to events via onEvent(type, callback).
 * Send commands via sendCommand(input).
 */

import { create } from 'zustand';

const WS_URL = 'ws://localhost:8000/ws';

const useWsStore = create((set, get) => ({
  socket: null,
  connected: false,
  activeProvider: null,
  availableCommands: [],
  eventLog: [],        // All raw events received (for debugging)

  // Per-event-type subscribers: { 'command.result': [fn, fn], ... }
  _subscribers: {},

  connect() {
    const existing = get().socket;
    if (existing && existing.readyState <= 1) return; // already connecting/open

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      set({ socket: ws, connected: true });
    };

    ws.onclose = () => {
      set({ socket: null, connected: false });
      // Reconnect after 2s
      setTimeout(() => get().connect(), 2000);
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      const { event, payload } = msg;

      // Update derived state for known events
      if (event === 'ws.connected') {
        set({
          activeProvider: payload.active_provider,
          availableCommands: payload.commands ?? [],
        });
      }

      // Append to event log (cap at 500)
      set((s) => ({
        eventLog: [...s.eventLog.slice(-499), { event, payload, ts: Date.now() }],
      }));

      // Fire subscribers
      const subs = get()._subscribers;
      const handlers = [...(subs[event] ?? []), ...(subs['*'] ?? [])];
      handlers.forEach((fn) => {
        try { fn(event, payload); } catch (err) { console.error('[WS subscriber]', err); }
      });
    };

    set({ socket: ws });
  },

  onEvent(type, callback) {
    set((s) => ({
      _subscribers: {
        ...s._subscribers,
        [type]: [...(s._subscribers[type] ?? []), callback],
      },
    }));
    // Return unsubscribe fn
    return () => {
      set((s) => ({
        _subscribers: {
          ...s._subscribers,
          [type]: (s._subscribers[type] ?? []).filter((fn) => fn !== callback),
        },
      }));
    };
  },

  sendCommand(input) {
    const { socket, connected } = get();
    if (!connected || !socket) return false;
    socket.send(JSON.stringify({ type: 'command', input }));
    return true;
  },
}));

export default useWsStore;
