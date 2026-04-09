"""
sampling_engine.py — Constructs LLM prompts from a compiled JourneySpec.

Separates the two fundamentally different kinds of node:

  PersonaTemplate  (static — built ONCE per run)
    Encodes WHO the persona is: archetype, OCEAN, MBTI, philosophy,
    religion, political views. These traits are constant across all samples
    in a run — the same person experiences the whole journey.

  JourneySequence  (dynamic — drives PER-SAMPLE variation)
    Encodes WHAT HAPPENS to the persona: the ordered phase progression,
    probabilistic events that fire per-sample, and time gaps.

Usage:
    template = SamplingEngine.build_template(spec)
    sequence = SamplingEngine.build_sequence(spec)
    for idx in range(1, spec.n_personas + 1):
        prompt = SamplingEngine.draw_sample(template, sequence, idx, spec.n_personas)
        text   = await provider.complete(prompt, system=PERSONA_SYSTEM)
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

from backend.modules.journey_compiler import JourneySpec, PhaseSpec
from backend.utils.stat_words import (
    build_archetype_prompt,
    build_ocean_prompt,
    build_mbti_prompt,
    build_philosophy_prompt,
    build_religion_prompt,
    build_political_prompt,
    build_voice_prompt,
)


# ── Domain types ──────────────────────────────────────────────────────────────

@dataclass
class PersonaTemplate:
    """The static character description, compiled once per run.

    All verbal-descriptor conversion happens here. `compiled` is a
    ready-to-inject multi-line string used as the [CHARACTER] section
    of every prompt in the run.
    """
    compiled: str
    mbti_pool: list[str]          # Allowed MBTI types to draw from per sample
    mbti_prompts: dict[str, str]  # Per-type custom prompts from the MBTI node


@dataclass
class SampleContext:
    """The dynamic context for a single sample: phase + events + voice."""
    phase: PhaseSpec
    fired_events: list[dict]       # Event nodes whose probability check passed
    outcome: float                 # Sampled outcome value


@dataclass
class JourneySequence:
    """The dynamic journey structure used to vary samples across a run."""
    phases: list[PhaseSpec]
    events: list[dict]             # Raw event node data dicts
    goal: str
    horizon: str
    default_voice: dict | None


# ── Engine ────────────────────────────────────────────────────────────────────

class SamplingEngine:

    # ── Build phase ───────────────────────────────────────────────────────

    @staticmethod
    def build_template(spec: JourneySpec) -> PersonaTemplate:
        """Compile all static character layers into a reusable prompt fragment.

        Called once per run. The result is injected identically into every
        sample prompt — only the dynamic context (phase, events, outcome)
        changes per sample.
        """
        sections: list[str] = ["[CHARACTER PROFILE]"]
        has_content = False

        if spec.archetype:
            ap = build_archetype_prompt(spec.archetype)
            if ap:
                sections.append(ap)
                has_content = True

        if spec.ocean:
            op = build_ocean_prompt(spec.ocean)
            if op:
                sections.append(op)
                has_content = True

        # MBTI: store the pool here; actual type drawn per sample in draw_sample()
        mbti_pool: list[str] = []
        mbti_prompts: dict[str, str] = {}
        if spec.mbti:
            mbti_pool   = spec.mbti.get("selected_types", [])
            mbti_prompts = spec.mbti.get("type_prompts", {})
            if mbti_pool:
                # Show the allowed range in the template; specific type injected per sample
                mp = build_mbti_prompt(spec.mbti, selected_type=None)
                if mp:
                    sections.append(mp)
                    has_content = True

        worldview: list[str] = []
        if spec.philosophy:
            pp = build_philosophy_prompt(spec.philosophy)
            if pp:
                worldview.append(pp)
        if spec.religion:
            rp = build_religion_prompt(spec.religion)
            if rp:
                worldview.append(rp)
        if spec.political:
            polp = build_political_prompt(spec.political)
            if polp:
                worldview.append(polp)
        if worldview:
            sections.append("[WORLDVIEW]\n" + "\n".join(worldview))
            has_content = True

        compiled = "\n".join(sections) if has_content else ""

        return PersonaTemplate(
            compiled     = compiled,
            mbti_pool    = mbti_pool,
            mbti_prompts = mbti_prompts,
        )

    @staticmethod
    def build_sequence(spec: JourneySpec) -> JourneySequence:
        """Extract the dynamic journey structure from a JourneySpec."""
        return JourneySequence(
            phases        = spec.phases if spec.phases else [PhaseSpec(phase_type="struggle")],
            events        = spec.events,
            goal          = spec.goal,
            horizon       = spec.horizon,
            default_voice = spec.voice,
        )

    # ── Sample phase ──────────────────────────────────────────────────────

    @staticmethod
    def draw_sample(
        template: PersonaTemplate,
        sequence: JourneySequence,
        persona_index: int,
        n_total: int,
    ) -> str:
        """Assemble a complete LLM prompt for one persona.

        Dynamic decisions made here (per-sample randomness):
          - Which phase this persona is in (round-robin)
          - Which MBTI type this persona has (drawn from pool)
          - Whether each event fires (probability check)
          - Outcome value (sampled within phase's bias range)
        """
        # ── Pick phase ────────────────────────────────────────────────────
        phase = sequence.phases[(persona_index - 1) % len(sequence.phases)]

        # ── Sample outcome within phase's bias range ──────────────────────
        lo, hi  = _parse_outcome_bias(phase.outcome_bias)
        outcome = round(random.uniform(lo, hi), 2)

        # ── Roll events ───────────────────────────────────────────────────
        fired_events: list[dict] = []
        for ev in sequence.events:
            prob = _parse_float(ev.get("probability"), default=0.3)
            if random.random() < prob:
                fired_events.append(ev)

        # ── Draw MBTI type for this persona ───────────────────────────────
        mbti_type: str | None = None
        if template.mbti_pool:
            mbti_type = random.choice(template.mbti_pool)

        # ── Assemble prompt ───────────────────────────────────────────────
        return _assemble_prompt(
            template      = template,
            sequence      = sequence,
            phase         = phase,
            outcome       = outcome,
            fired_events  = fired_events,
            mbti_type     = mbti_type,
            persona_index = persona_index,
            n_total       = n_total,
        )


# ── Prompt assembly ───────────────────────────────────────────────────────────

def _assemble_prompt(
    template:      PersonaTemplate,
    sequence:      JourneySequence,
    phase:         PhaseSpec,
    outcome:       float,
    fired_events:  list[dict],
    mbti_type:     str | None,
    persona_index: int,
    n_total:       int,
) -> str:
    sections: list[str] = []

    # ── Section 1: Situation ──────────────────────────────────────────────
    situation: list[str] = [f"[SITUATION — persona {persona_index}/{n_total}]"]

    if sequence.goal:
        horizon_note = f"  horizon: {sequence.horizon}" if sequence.horizon else ""
        situation.append(f"Goal: {sequence.goal}{horizon_note}")

    phase_line = f"Life phase: {phase.phase_type}"
    if phase.duration:
        phase_line += f"  ({phase.duration})"
    if phase.action_frequency:
        phase_line += f"  |  frequency: {phase.action_frequency}"
    situation.append(phase_line)

    outcome_desc = (
        "complete failure or rejection"   if outcome < -0.3
        else "neutral / nothing happened"  if outcome < 0.3
        else "partial success"             if outcome < 0.7
        else "clear success"
    )
    situation.append(f"Action outcome: {outcome_desc}")
    sections.append("\n".join(situation))

    # ── Section 2: Character profile (static, pre-compiled) ──────────────
    if template.compiled:
        # If a specific MBTI type was drawn, inject a personalized type line
        profile = template.compiled
        if mbti_type and template.mbti_pool:
            specific = build_mbti_prompt(
                {"selected_types": template.mbti_pool, "type_prompts": template.mbti_prompts},
                selected_type=mbti_type,
            )
            # Replace the generic MBTI range line with the specific one
            for line in profile.split("\n"):
                if line.startswith("Myers-Briggs type is one of:"):
                    profile = profile.replace(line, specific)
                    break
        sections.append(profile)

    # ── Section 3: Active events ──────────────────────────────────────────
    if fired_events:
        event_lines = ["[ACTIVE EVENTS]"]
        for ev in fired_events:
            etype   = ev.get("event_type", "external event")
            outcome_override = ev.get("outcome_override", "")
            desc = f"An external event occurred: {etype}."
            if outcome_override:
                desc += f" Expected outcome modifier: {outcome_override}."
            event_lines.append(desc)
        sections.append("\n".join(event_lines))

    # ── Section 4: Voice & mindset ────────────────────────────────────────
    active_voice = phase.voice_override if phase.voice_override is not None else sequence.default_voice
    if active_voice:
        vp = build_voice_prompt(active_voice)
        if vp:
            sections.append(f"[VOICE & MINDSET]\n{vp}")

    return "\n\n".join(sections)


# ── Utilities ─────────────────────────────────────────────────────────────────

def _parse_outcome_bias(bias_str: str) -> tuple[float, float]:
    """Parse a phase outcome_bias string like '-0.6 to -0.2' into (lo, hi)."""
    if not bias_str:
        return (-0.8, 0.9)
    parts = [p.strip() for p in bias_str.replace("to", " ").split() if p.strip()]
    floats = []
    for p in parts:
        try:
            floats.append(float(p))
        except ValueError:
            pass
    if len(floats) >= 2:
        return (floats[0], floats[1])
    if len(floats) == 1:
        return (floats[0], floats[0])
    return (-0.8, 0.9)


def _parse_float(value, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
