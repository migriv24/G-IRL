/**
 * Inspector store — tracks the currently selected node in the Journey Designer.
 * JourneyDesigner writes here; NodeInspector reads here.
 */
import { create } from 'zustand';

const useInspectorStore = create((set) => ({
  selectedNode: null,   // { id, type, data } | null
  setSelectedNode: (node) => set({ selectedNode: node }),
  clearSelection:  ()     => set({ selectedNode: null }),
}));

export default useInspectorStore;
