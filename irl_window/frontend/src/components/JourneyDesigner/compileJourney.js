/**
 * compileJourney — serialize the current React Flow canvas into a journey.run payload.
 *
 * Pure function: no React, no hooks, no side effects.
 * Mirrors the node type keys from NODE_TYPES in nodes.jsx.
 *
 * The backend JourneyCompiler does all prompt-building; this function only
 * groups and forwards the raw node data faithfully.
 */

/**
 * @param {Array} nodes  - React Flow node objects
 * @param {Array} edges  - React Flow edge objects
 * @returns {Object}     - Payload for the journey.run WebSocket message
 */
export function compileJourney(nodes, edges) {
  // Group nodes by type, preserving position for phase ordering
  const byType = {};
  for (const node of nodes) {
    const t = node.type;
    if (!t || t === 'frame') continue; // skip layout-only nodes
    (byType[t] ??= []).push(node);
  }

  const first = (type) => byType[type]?.[0]?.data ?? null;

  // Phases sorted left-to-right — must match the backend compiler's ordering
  const phases = (byType['phase'] ?? [])
    .sort((a, b) => (a.position?.x ?? 0) - (b.position?.x ?? 0))
    .map((n) => n.data);

  return {
    // Raw node data — backend compiler owns interpretation
    archetype:  first('archetype'),
    ocean:      first('ocean'),
    mbti:       first('mbti'),
    goal:       first('goal'),
    philosophy: first('philosophy'),
    religion:   first('religion'),
    political:  first('political_compass'),
    voice:      first('voice'),
    phases,
    events:    (byType['event']    ?? []).map((n) => n.data),
    time_gaps: (byType['time_gap'] ?? []).map((n) => n.data),
    // Full node + edge lists for the backend compiler's edge-walking logic
    nodes,
    edges,
  };
}
