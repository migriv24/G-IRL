/**
 * project.js — Current journey project state.
 *
 * Tracks the open project's identity, dirty state, and metadata.
 * Also provides a pendingLoad mechanism: when a project is loaded from
 * the backend, JourneyDesigner picks up pendingLoad and applies it to
 * the React Flow canvas state.
 */

import { create } from 'zustand';

const useProjectStore = create((set, get) => ({
  // ── Identity ──────────────────────────────────────────────────────────────
  id:          null,               // project ID (backend-assigned, 8-char hex)
  name:        'Untitled Journey',
  description: '',
  createdBy:   null,
  createdAt:   null,
  savedAt:     null,
  nodeCount:   0,

  // ── Session ───────────────────────────────────────────────────────────────
  isDirty:          false,         // unsaved changes exist
  sessionStartedAt: Date.now(),    // for tracking time-on-project

  // ── Pending canvas load ───────────────────────────────────────────────────
  // Set by handleLoad(); consumed and cleared by JourneyDesigner's useEffect.
  pendingLoad: null,   // { nodes, edges } | null

  // ── Project list (from backend) ───────────────────────────────────────────
  projectList: [],     // array of meta objects

  // ── Actions ───────────────────────────────────────────────────────────────

  setName:        name => set({ name, isDirty: true }),
  setDescription: desc => set({ description: desc }),

  markDirty: () => {
    if (!get().isDirty) set({ isDirty: true });
  },

  /** Called after a successful save — clears dirty flag and stores meta. */
  handleSaved: (meta) => set({
    id:          meta.id,
    name:        meta.name,
    description: meta.description ?? '',
    createdBy:   meta.created_by,
    createdAt:   meta.created_at,
    savedAt:     meta.saved_at,
    nodeCount:   meta.node_count ?? 0,
    isDirty:     false,
  }),

  /** Called when a project.loaded event arrives from backend. */
  handleLoaded: (data) => {
    const { meta, journey } = data;
    set({
      id:          meta.id,
      name:        meta.name,
      description: meta.description ?? '',
      createdBy:   meta.created_by,
      createdAt:   meta.created_at,
      savedAt:     meta.saved_at,
      nodeCount:   meta.node_count ?? 0,
      isDirty:     false,
      sessionStartedAt: Date.now(),
      pendingLoad: { nodes: journey.nodes, edges: journey.edges },
    });
  },

  /** Consumed by JourneyDesigner — call this after applying the load. */
  clearPendingLoad: () => set({ pendingLoad: null }),

  /** Reset to a blank new project. */
  newProject: () => set({
    id:               null,
    name:             'Untitled Journey',
    description:      '',
    createdBy:        null,
    createdAt:        null,
    savedAt:          null,
    nodeCount:        0,
    isDirty:          false,
    sessionStartedAt: Date.now(),
    pendingLoad:      null,
  }),

  /** Store the list of projects returned by project.list event. */
  setProjectList: (list) => set({ projectList: list }),

  /** Remove a project from the local list (after delete). */
  removeFromList: (id) => set(s => ({
    projectList: s.projectList.filter(p => p.id !== id),
  })),
}));

export default useProjectStore;
