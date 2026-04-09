/**
 * canvas.js — Bridge store so non-ReactFlow components (e.g. CommandTerminal)
 * can read the current Journey Designer canvas state without prop-drilling.
 *
 * JourneyDesigner calls setCanvas() on every nodes/edges change.
 * Consumers call getState().nodes / .edges directly (no hook needed).
 */
import { create } from 'zustand';

const useCanvasStore = create((set) => ({
  nodes: [],
  edges: [],
  setCanvas: (nodes, edges) => set({ nodes, edges }),
}));

export default useCanvasStore;
