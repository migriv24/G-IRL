"""
stat_words.py — Convert normalized float stats to descriptive words for LLM prompts.

Research basis:
  Verbal descriptors outperform numerical rating scales by ~10% accuracy when
  prompting LLMs for personality trait expression (PersonaLLM, 2024;
  "Personality Traits in Large Language Models", arxiv 2307.00184).
  Numerical scores also reduce LLM compliance in annotation tasks
  ("What's in a Prompt?", AAAI ICWSM 2024, arxiv 2406.11980).

All DnD stats are stored as normalized floats (0.0–1.0), mapping to 3–18 display.
OCEAN levels are stored as integer indices (0–4) into OCEAN_LEVELS.
Adherence is stored as float (0.0–1.0), displayed as 0–100%.
"""

from __future__ import annotations

# ── DnD stat descriptors ──────────────────────────────────────────────────────
# Each stat maps to 6 bands across the normalized [0.0, 1.0] range.
# These correspond to the DnD display range 3–18 (bands of ~2.5 points each).
#
# Psychological mappings:
#   STR → Grit / Willpower / Drive (Duckworth 2016; PsyCap Resilience)
#   DEX → Adaptability / Openness to Experience (Big Five O facet)
#   CON → Resilience / Emotional Endurance (PsyCap HERO model)
#   INT → Analytical Cognition / Intellect (Big Five Intellect facet)
#   WIS → Self-Awareness / Emotional Intelligence (low Neuroticism + insight)
#   CHA → Extraversion + Social Efficacy (Big Five E + A combined)

_DND_BANDS = [
    (0.00, 0.17),  # 3–5   very low
    (0.17, 0.33),  # 6–7   low
    (0.33, 0.50),  # 8–10  below average → average
    (0.50, 0.67),  # 11–13 above average
    (0.67, 0.83),  # 14–16 high
    (0.83, 1.01),  # 17–18 very high
]

DND_DESCRIPTORS: dict[str, list[str]] = {
    "str": [
        "extremely weak-willed, gives up easily, very low drive",
        "below average willpower, often abandons goals under pressure",
        "average drive and perseverance, pushes through moderate challenges",
        "strong-willed, sustains effort through adversity",
        "high determination and grit, rarely backs down",
        "exceptional willpower and drive, near-indefatigable",
    ],
    "dex": [
        "rigid and inflexible thinker, strongly resists change",
        "prefers predictable routines, slow to adapt to new situations",
        "moderately adaptable, adjusts to change with some friction",
        "flexible and agile, handles uncertainty comfortably",
        "highly adaptable, embraces novelty and ambiguity",
        "extremely flexible, thrives in chaotic and rapidly changing environments",
    ],
    "con": [
        "emotionally fragile, breaks down under minor stress",
        "below average resilience, stress and setbacks accumulate quickly",
        "moderate resilience, bounces back from setbacks slowly",
        "resilient, recovers well from adversity and failure",
        "highly resilient, maintains composure under sustained pressure",
        "exceptional endurance, almost immune to burnout and emotional collapse",
    ],
    "int": [
        "concrete thinker with limited analytical ability",
        "below average reasoning, relies on intuition over analysis",
        "average intelligence, practical problem-solver",
        "sharp analytical mind, learns quickly and thinks clearly",
        "highly intelligent, enjoys complex ideas and systematic reasoning",
        "exceptional intellect, deeply analytical and conceptually creative",
    ],
    "wis": [
        "very low self-awareness, acts impulsively, frequently misreads social cues",
        "limited self-reflection, often unaware of own biases and blind spots",
        "average wisdom, some self-awareness and moderate emotional insight",
        "self-aware and perceptive, reads situations and people well",
        "high emotional intelligence, thoughtful and deeply empathetic",
        "exceptional wisdom, profound self-understanding and insight into others",
    ],
    "cha": [
        "socially awkward, struggles to connect or communicate effectively",
        "below average social confidence, tends to withdraw from interaction",
        "average social presence, comfortable in familiar and low-stakes settings",
        "socially confident, draws people in naturally",
        "charismatic and persuasive, commands presence in groups",
        "magnetic personality, effortlessly commands attention and trust",
    ],
}


def dnd_stat_to_words(stat: str, value: float) -> str:
    """Convert a normalized float DnD stat (0.0–1.0) to descriptive words.

    Args:
        stat: one of 'str', 'dex', 'con', 'int', 'wis', 'cha'
        value: normalized float in [0.0, 1.0]

    Returns:
        Descriptive string for LLM prompt injection.
    """
    descriptors = DND_DESCRIPTORS.get(stat.lower())
    if not descriptors:
        return f"{stat}={value:.2f}"
    for i, (lo, hi) in enumerate(_DND_BANDS):
        if lo <= value < hi:
            return descriptors[i]
    return descriptors[-1]


def dnd_range_to_words(stat: str, min_val: float, max_val: float) -> str:
    """Describe a stat range using the midpoint for LLM prompting.

    For range prompts, we use the midpoint so the LLM receives a single
    coherent description rather than two potentially contradictory ones.
    The range is noted parenthetically so the LLM knows there is variation.
    """
    mid = (min_val + max_val) / 2
    desc = dnd_stat_to_words(stat, mid)
    min_disp = round(3 + min_val * 15)
    max_disp = round(3 + max_val * 15)
    return f"{desc} (varies {min_disp}–{max_disp}/18)"


# ── OCEAN descriptors ─────────────────────────────────────────────────────────
# Levels 0–4 correspond to: very low, low, medium, high, very high.
# Based on Big Five / OCEAN model (Costa & McCrae; replicated cross-culturally).

OCEAN_LEVELS = ["very low", "low", "medium", "high", "very high"]

OCEAN_DESCRIPTORS: dict[str, list[str]] = {
    "openness": [
        "closed to new experience, highly conventional, dislikes novelty",
        "prefers familiarity and routine, limited curiosity",
        "moderately open, selectively curious about new ideas",
        "curious and creative, enjoys exploring ideas and perspectives",
        "highly imaginative and intellectually adventurous, seeks out novelty constantly",
    ],
    "conscientiousness": [
        "highly disorganized, impulsive, struggles to follow through",
        "below average discipline, easily distracted from goals",
        "moderately organized, follows through inconsistently",
        "disciplined and goal-oriented, reliable and methodical",
        "highly conscientious, meticulous, and exceptionally self-directed",
    ],
    "extraversion": [
        "strongly introverted, prefers solitude, drained by social interaction",
        "mostly introverted, limited social energy, selective about engagement",
        "ambivert, comfortable in both social and solitary settings",
        "extroverted, energized by social interaction and group environments",
        "strongly extroverted, thrives in social situations, seeks stimulation constantly",
    ],
    "agreeableness": [
        "competitive and skeptical, frequently challenges others, low trust",
        "below average agreeableness, can be blunt and self-focused",
        "moderately agreeable, cooperative when personally motivated",
        "kind and cooperative, values harmony and others' feelings",
        "highly agreeable, deeply empathetic, accommodating to a fault",
    ],
    "neuroticism": [
        "very emotionally stable, calm under pressure, rarely stressed",
        "mostly stable, handles setbacks and pressure well",
        "moderate neuroticism, occasionally anxious or emotionally reactive",
        "frequently anxious and emotionally reactive, stress-sensitive",
        "highly neurotic, prone to intense mood swings, anxiety, and worry",
    ],
}


def ocean_to_words(trait: str, level: int) -> str:
    """Convert an OCEAN trait level index (0–4) to descriptive words."""
    descriptors = OCEAN_DESCRIPTORS.get(trait.lower())
    if not descriptors:
        return f"{trait}={OCEAN_LEVELS[max(0, min(level, 4))]}"
    return descriptors[max(0, min(level, 4))]


def ocean_range_to_words(trait: str, min_level: int, max_level: int) -> str:
    """Describe an OCEAN range. Uses midpoint for prompt coherence."""
    mid = round((min_level + max_level) / 2)
    desc = ocean_to_words(trait, mid)
    if min_level == max_level:
        return desc
    return f"{desc} (ranges {OCEAN_LEVELS[min_level]} to {OCEAN_LEVELS[max_level]})"


# ── Adherence descriptor ──────────────────────────────────────────────────────

def adherence_to_words(subject: str, adherence: float) -> str:
    """Describe how closely a persona follows a philosophy or religion."""
    if adherence < 0.1:
        return f"nominally identifies with {subject} but does not actively practice it"
    elif adherence < 0.3:
        return f"loosely follows {subject}, occasionally references its ideas"
    elif adherence < 0.5:
        return f"moderately follows {subject}, applies its principles in some areas of life"
    elif adherence < 0.7:
        return f"sincerely practices {subject}, it shapes their values and decisions"
    elif adherence < 0.9:
        return f"deeply committed to {subject}, it is central to their identity"
    else:
        return f"devoutly devoted to {subject}, it governs virtually all aspects of their life"


def adherence_range_to_words(subject: str, min_val: float, max_val: float) -> str:
    """Describe an adherence range using midpoint."""
    mid = (min_val + max_val) / 2
    return adherence_to_words(subject, mid)


# ── Political compass descriptor ──────────────────────────────────────────────

def political_to_words(x: float, y: float) -> str:
    """Convert political compass coordinates to descriptive words.

    Args:
        x: Economic axis. -1 = far left, 0 = center, +1 = far right.
        y: Social axis.   +1 = authoritarian, 0 = center, -1 = libertarian.
    """
    if abs(x) < 0.15 and abs(y) < 0.15:
        return "politically centrist, holds mixed or moderate views on most issues"

    econ = (
        "strongly left-wing economically (socialist / collective ownership)" if x < -0.6
        else "left-leaning economically (progressive, pro-redistribution)" if x < -0.2
        else "economically centrist" if x < 0.2
        else "right-leaning economically (free market, pro-business)" if x < 0.6
        else "strongly right-wing economically (laissez-faire / libertarian market)"
    )
    social = (
        "strongly authoritarian (values order, tradition, strong central authority)" if y > 0.6
        else "somewhat authoritarian (prefers structure and social order)" if y > 0.2
        else "socially centrist" if y > -0.2
        else "somewhat libertarian (values individual freedom and civil liberties)" if y > -0.6
        else "strongly libertarian (anti-authoritarian, freedom-maximizing)"
    )
    return f"{econ}; {social}"


# ── Full archetype prompt builder ─────────────────────────────────────────────

def build_archetype_prompt(node_data: dict) -> str:
    """Build a descriptive prompt fragment from an Archetype node's data dict.

    This converts all numerical stats to words, ready for LLM injection.
    """
    parts: list[str] = []

    archetype_type = node_data.get("archetype_type", "")
    if archetype_type:
        parts.append(f"Persona archetype: {archetype_type}.")

    age = node_data.get("age", {})
    if age:
        parts.append(f"Age: {age.get('min', 18)}–{age.get('max', 26)} years old.")

    stat_labels = {
        "str": "Drive/Willpower",
        "dex": "Adaptability",
        "con": "Resilience",
        "int": "Intelligence",
        "wis": "Self-awareness",
        "cha": "Social presence",
    }
    stat_parts = []
    for stat, label in stat_labels.items():
        sv = node_data.get(stat, {})
        if sv:
            desc = dnd_range_to_words(stat, sv.get("min", 0.3), sv.get("max", 0.6))
            stat_parts.append(f"{label}: {desc}")
    if stat_parts:
        parts.append("Psychological profile — " + "; ".join(stat_parts) + ".")

    return " ".join(parts)


def build_ocean_prompt(node_data: dict) -> str:
    """Build a prompt fragment from an OCEAN node's data dict."""
    trait_labels = {
        "openness": "Openness",
        "conscientiousness": "Conscientiousness",
        "extraversion": "Extraversion",
        "agreeableness": "Agreeableness",
        "neuroticism": "Neuroticism",
    }
    parts = []
    for trait, label in trait_labels.items():
        tv = node_data.get(trait, {})
        if tv:
            desc = ocean_range_to_words(trait, tv.get("min", 1), tv.get("max", 3))
            parts.append(f"{label}: {desc}")
    if not parts:
        return ""
    return "Big Five personality — " + "; ".join(parts) + "."


def build_philosophy_prompt(node_data: dict) -> str:
    """Build a prompt fragment from a Philosophy node's data dict."""
    philosophy = node_data.get("philosophy", "")
    if not philosophy:
        return ""
    adherence = node_data.get("adherence", {})
    mid = (adherence.get("min", 0.2) + adherence.get("max", 0.7)) / 2
    desc = adherence_range_to_words(philosophy, adherence.get("min", 0.2), adherence.get("max", 0.7))
    context = node_data.get("context", "")
    result = f"Philosophy: {desc}."
    if context:
        result += f" {context}"
    return result


def build_religion_prompt(node_data: dict) -> str:
    """Build a prompt fragment from a Religion node's data dict."""
    religion = node_data.get("religion", "")
    if not religion or religion == "secular / atheist":
        adherence = node_data.get("adherence", {})
        mid = (adherence.get("min", 0.0) + adherence.get("max", 0.3)) / 2
        if mid < 0.15:
            return "Religion: secular / atheist, no religious practice."
    adherence = node_data.get("adherence", {})
    desc = adherence_range_to_words(religion, adherence.get("min", 0.1), adherence.get("max", 0.5))
    context = node_data.get("context", "")
    result = f"Religion: {desc}."
    if context:
        result += f" {context}"
    return result


def build_political_prompt(node_data: dict) -> str:
    """Build a prompt fragment from a PoliticalCompass node's data dict."""
    pos = node_data.get("position", {})
    if not pos:
        return ""
    x = pos.get("x", 0.0)
    y = pos.get("y", 0.0)
    return f"Political views: {political_to_words(x, y)}."


def build_voice_prompt(node_data: dict) -> str:
    """Build a prompt fragment from a Voice/Mindset node's data dict."""
    parts = []
    locus = node_data.get("locus", "")
    tone  = node_data.get("emotional_tone", "")
    aware = node_data.get("self_awareness", "")
    if locus:
        desc = (
            "internalising (blames self, reflects on own failures)"
            if "internal" in locus.lower()
            else "externalising (attributes outcomes to others or circumstance)"
        )
        parts.append(f"Psychological locus: {desc}.")
    if tone:
        parts.append(f"Emotional tone: {tone}.")
    if aware:
        parts.append(f"Self-awareness level: {aware}.")
    return " ".join(parts)


def build_mbti_prompt(node_data: dict, selected_type: str | None = None) -> str:
    """Build a prompt fragment from a Myers-Briggs node.

    If selected_type is provided (e.g. 'INTJ'), includes the custom prompt for
    that specific type if one was written. Otherwise describes the allowed range.
    """
    selected = node_data.get("selected_types", [])
    prompts = node_data.get("type_prompts", {})

    if not selected:
        return ""

    if selected_type and selected_type in selected:
        base = f"Myers-Briggs type: {selected_type}."
        custom = prompts.get(selected_type, "").strip()
        if custom:
            base += f" {custom}"
        return base

    type_list = ", ".join(selected)
    return f"Myers-Briggs type is one of: {type_list}."


# ── Full persona context builder ──────────────────────────────────────────────

def build_full_persona_context(
    spec,           # JourneySpec — imported lazily to avoid circular deps
    phase,          # PhaseSpec
    outcome: float,
    persona_index: int,
    n_total: int,
    mbti_type: str | None = None,
) -> str:
    """Assemble a complete LLM prompt context for one persona + phase combination.

    Draws on every node layer present in the JourneySpec, converting all
    numerical values to descriptive words via the build_*_prompt helpers.
    Layers that are absent (None) are silently omitted — minimal canvases
    work without noise.

    Output format: labeled sections separated by blank lines. This structure
    helps the LLM attend to each layer distinctly rather than treating the
    context as a single dense blob.

    Args:
        spec:          Compiled JourneySpec for this run.
        phase:         The PhaseSpec this persona is currently in.
        outcome:       Sampled outcome float (-1.0 to +1.0).
        persona_index: 1-based index within the run.
        n_total:       Total personas being generated.
        mbti_type:     Randomly-drawn MBTI type for this persona, or None.

    Returns:
        A structured multi-section prompt string ready for LLM injection.
    """
    sections: list[str] = []

    # ── Section 1: Situation ──────────────────────────────────────────────────
    situation: list[str] = [f"[SITUATION — persona {persona_index}/{n_total}]"]

    if spec.goal:
        horizon_note = f"  horizon: {spec.horizon}" if spec.horizon else ""
        situation.append(f"Goal: {spec.goal}{horizon_note}")

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

    # ── Section 2: Character profile ─────────────────────────────────────────
    profile: list[str] = ["[CHARACTER PROFILE]"]
    added_profile = False

    if spec.archetype:
        ap = build_archetype_prompt(spec.archetype)
        if ap:
            profile.append(ap)
            added_profile = True

    if spec.ocean:
        op = build_ocean_prompt(spec.ocean)
        if op:
            profile.append(op)
            added_profile = True

    if spec.mbti:
        mp = build_mbti_prompt(spec.mbti, selected_type=mbti_type)
        if mp:
            profile.append(mp)
            added_profile = True

    if added_profile:
        sections.append("\n".join(profile))

    # ── Section 3: Worldview ──────────────────────────────────────────────────
    worldview: list[str] = ["[WORLDVIEW]"]
    added_worldview = False

    if spec.philosophy:
        pp = build_philosophy_prompt(spec.philosophy)
        if pp:
            worldview.append(pp)
            added_worldview = True

    if spec.religion:
        rp = build_religion_prompt(spec.religion)
        if rp:
            worldview.append(rp)
            added_worldview = True

    if spec.political:
        polp = build_political_prompt(spec.political)
        if polp:
            worldview.append(polp)
            added_worldview = True

    if added_worldview:
        sections.append("\n".join(worldview))

    # ── Section 4: Voice & mindset ────────────────────────────────────────────
    # Phase-level voice override takes precedence over journey-level default.
    active_voice = phase.voice_override if phase.voice_override is not None else spec.voice
    if active_voice:
        vp = build_voice_prompt(active_voice)
        if vp:
            sections.append(f"[VOICE & MINDSET]\n{vp}")

    return "\n\n".join(sections)
