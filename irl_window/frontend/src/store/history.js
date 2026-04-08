/**
 * Commander pattern for undo/redo.
 * Snapshot-based: every mutation saves {nodes, edges} before the change.
 * Ctrl+Z = undo, Ctrl+Y or Ctrl+Shift+Z = redo.
 *
 * Usage:
 *   const { pushSnapshot, undo, redo, canUndo, canRedo } = useHistoryStore();
 *
 *   // Before mutating nodes/edges:
 *   pushSnapshot(nodes, edges);
 *   setNodes(...);   // then mutate
 */

import { create } from 'zustand';

const MAX = 50;

const snap = (nodes, edges) => ({
  nodes: nodes.map(n => ({ ...n, data: { ...n.data } })),
  edges: edges.map(e => ({ ...e })),
});

const useHistoryStore = create((set, get) => ({
  past:   [],   // [{nodes, edges}, ...]  oldest → newest
  future: [],   // [{nodes, edges}, ...]  most-recent-undone first

  /** Call BEFORE any mutation to save current state. */
  pushSnapshot(nodes, edges) {
    set(s => ({
      past:   [...s.past.slice(-(MAX - 1)), snap(nodes, edges)],
      future: [],   // any new action clears redo stack
    }));
  },

  undo(currentNodes, currentEdges, setNodes, setEdges) {
    const { past, future } = get();
    if (past.length === 0) return false;

    const prev    = past[past.length - 1];
    const current = snap(currentNodes, currentEdges);

    set(s => ({
      past:   s.past.slice(0, -1),
      future: [current, ...s.future.slice(0, MAX - 1)],
    }));

    setNodes(prev.nodes);
    setEdges(prev.edges);
    return true;
  },

  redo(currentNodes, currentEdges, setNodes, setEdges) {
    const { past, future } = get();
    if (future.length === 0) return false;

    const next    = future[0];
    const current = snap(currentNodes, currentEdges);

    set(s => ({
      past:   [...s.past.slice(-(MAX - 1)), current],
      future: s.future.slice(1),
    }));

    setNodes(next.nodes);
    setEdges(next.edges);
    return true;
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));

export default useHistoryStore;
