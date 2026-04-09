/**
 * Context store — tracks the currently selected sample so other panels
 * (e.g. Node Inspector) can display relevant context.
 */
import { create } from 'zustand';

const useContextStore = create((set) => ({
  sampleId: null,
  sample: null,

  setSampleContext: (id, sample) => set({ sampleId: id, sample }),
  clearSampleContext: () => set({ sampleId: null, sample: null }),
}));

export default useContextStore;
