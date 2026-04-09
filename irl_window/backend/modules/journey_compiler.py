"""
journey_compiler.py — Compiles a raw React Flow canvas (nodes + edges) into a
typed JourneySpec domain object.

Pure functions only: no I/O, no side effects, no imports from other backend
modules. Safe to call from any adapter (WebSocket handler, CLI, tests).

Node type keys (from frontend NODE_TYPES):
  archetype, ocean, mbti, philosophy, religion, political_compass,
  goal, phase, voice, time_gap, event, generate, frame
"""

from __future__ import annotations
from dataclasses import dataclass, field


# ── Domain types ──────────────────────────────────────────────────────────────

@dataclass
class PhaseSpec:
    phase_type: str = "struggle"
    duration: str = ""
    action_frequency: str = ""
    outcome_bias: str = ""
    # VoiceNode data attached to this phase via an edge (None = use journey default)
    voice_override: dict | None = None


@dataclass
class JourneySpec:
    # Generation parameters (from GenerateNode)
    n_personas: int = 3
    provider: str = "ollama"
    model: str = "llama3.2:1b"

    # Goal (from GoalNode)
    goal: str = ""
    horizon: str = ""

    # Character layers (raw node data dicts, None = not present on canvas)
    archetype: dict | None = None
    ocean: dict | None = None
    mbti: dict | None = None
    philosophy: dict | None = None
    religion: dict | None = None
    political: dict | None = None

    # Default voice/locus (from a free-floating VoiceNode, if any)
    voice: dict | None = None

    # Ordered journey sequence (sorted left-to-right by canvas x position)
    phases: list[PhaseSpec] = field(default_factory=list)

    # Supplementary nodes
    events: list[dict] = field(default_factory=list)
    time_gaps: list[dict] = field(default_factory=list)


# ── Compiler ──────────────────────────────────────────────────────────────────

def compile(nodes: list[dict], edges: list[dict], overrides: dict | None = None) -> JourneySpec:
    """Compile a React Flow canvas into a JourneySpec.

    Args:
        nodes:     List of React Flow node objects ({ id, type, data, position, ... })
        edges:     List of React Flow edge objects ({ id, source, target, ... })
        overrides: Optional dict with 'n_personas', 'provider', 'model' keys
                   (from GenerateNode data, takes precedence over canvas values).

    Returns:
        JourneySpec — fully populated domain object, with safe defaults for any
        missing nodes.
    """
    overrides = overrides or {}

    # ── Bucket nodes by type ─────────────────────────────────────────────────
    by_type: dict[str, list[dict]] = {}
    by_id:   dict[str, dict]       = {}

    for node in nodes:
        t = node.get("type", "")
        by_type.setdefault(t, []).append(node)
        by_id[node["id"]] = node

    def first_data(node_type: str) -> dict | None:
        """Return .data of the first node of a given type, or None."""
        bucket = by_type.get(node_type, [])
        return bucket[0]["data"] if bucket else None

    # ── Build edge lookup: source_id → list[target_id] ───────────────────────
    edges_from: dict[str, list[str]] = {}
    for edge in edges:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        if src and tgt:
            edges_from.setdefault(src, []).append(tgt)

    # ── Extract simple single-node layers ────────────────────────────────────
    goal_data = first_data("goal")
    goal_text = goal_data.get("goal_text", "") if goal_data else ""
    horizon   = goal_data.get("horizon", "")   if goal_data else ""

    # GenerateNode data can override provider/model/n_personas
    generate_data = first_data("generate") or {}

    n_personas = int(overrides.get("n_personas", generate_data.get("n_personas", 3)))
    provider   = overrides.get("provider",   generate_data.get("provider",   "ollama"))
    model      = overrides.get("model",      generate_data.get("model",      "llama3.2:1b"))

    # ── Phases: sort by canvas x position (left-to-right = temporal order) ───
    phase_nodes = sorted(
        by_type.get("phase", []),
        key=lambda n: n.get("position", {}).get("x", 0),
    )

    # ── Build phase-to-voice map via edges ───────────────────────────────────
    # A VoiceNode connected to a PhaseNode overrides the journey-level voice.
    # Convention: voice → phase edge (source=voice, target=phase).
    # We also support phase → voice direction for canvas flexibility.
    voice_node_ids = {n["id"] for n in by_type.get("voice", [])}
    phase_node_ids = {n["id"] for n in by_type.get("phase", [])}

    # Map phase_id → voice data
    phase_voice: dict[str, dict] = {}
    for edge in edges:
        src, tgt = edge.get("source", ""), edge.get("target", "")
        if src in voice_node_ids and tgt in phase_node_ids:
            phase_voice[tgt] = by_id[src]["data"]
        elif tgt in voice_node_ids and src in phase_node_ids:
            phase_voice[src] = by_id[tgt]["data"]

    phases = [
        PhaseSpec(
            phase_type       = n["data"].get("phase_type", "struggle"),
            duration         = n["data"].get("duration", ""),
            action_frequency = n["data"].get("action_frequency", ""),
            outcome_bias     = n["data"].get("outcome_bias", ""),
            voice_override   = phase_voice.get(n["id"]),
        )
        for n in phase_nodes
    ]

    # ── Default fallback: if no phases on canvas, use a minimal single phase ─
    if not phases:
        phases = [PhaseSpec(phase_type="struggle")]

    # ── Free-floating VoiceNodes (not attached to any phase) ─────────────────
    # The first unattached voice becomes the journey-level default.
    attached_voice_ids = set()
    for edge in edges:
        src, tgt = edge.get("source", ""), edge.get("target", "")
        if src in voice_node_ids:
            attached_voice_ids.add(src)
        if tgt in voice_node_ids:
            attached_voice_ids.add(tgt)

    free_voices = [n for n in by_type.get("voice", []) if n["id"] not in attached_voice_ids]
    default_voice = free_voices[0]["data"] if free_voices else None

    # ── Assemble ─────────────────────────────────────────────────────────────
    return JourneySpec(
        n_personas = n_personas,
        provider   = provider,
        model      = model,
        goal       = goal_text,
        horizon    = horizon,
        archetype  = first_data("archetype"),
        ocean      = first_data("ocean"),
        mbti       = first_data("mbti"),
        philosophy = first_data("philosophy"),
        religion   = first_data("religion"),
        political  = first_data("political_compass"),
        voice      = default_voice,
        phases     = phases,
        events     = [n["data"] for n in by_type.get("event",    [])],
        time_gaps  = [n["data"] for n in by_type.get("time_gap", [])],
    )
