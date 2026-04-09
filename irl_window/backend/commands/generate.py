"""
Generate command — streams synthetic persona generation via active LLM provider.

Two entry points:
  cmd_generate(args, piped)          — CLI adapter, called by the command graph
  generate_from_spec(spec, run_id)   — domain core, called directly by the WS
                                       journey.run handler or any other adapter

CLI usage: generate [N] [--provider NAME] [--model MODEL]
"""

import asyncio
import logging

from backend.core import graph, Command, CommandResult
from backend.core.event_bus import bus
from backend.modules.journey_compiler import JourneySpec, PhaseSpec
from backend.modules.providers import provider_manager, ProviderConfig
from backend.modules.samples_db import new_run, save_sample
from backend.modules.sampling_engine import SamplingEngine

logger = logging.getLogger(__name__)

PERSONA_SYSTEM = """You are a synthetic data generator for a self-improvement app.

Your task: write a short first-person journal entry (2–4 sentences) for a specific user persona.
The entry must describe ONE real-life action or event this person took toward their goal.

You will receive a persona context block. Use every layer of it:

GOAL & PHASE — The entry must be about this goal, in this life phase.
  The phase shapes the emotional register: struggle = low energy, doubt, setbacks;
  growth = effort with friction; plateau = numbness, going through motions;
  breakthrough = sudden clarity or momentum; spiral = regression or relapse;
  return = picking things back up after an absence.

OUTCOME — The entry must make the outcome felt, not stated.
  Failure: the action didn't land, got rejected, or fell apart.
  Neutral: nothing meaningful happened, routine, flat.
  Partial success: something worked but left doubt or cost.
  Clear success: a genuine win, however small.

ARCHETYPE & PERSONALITY — Let these traits colour the voice and reasoning.
  A high-willpower persona pushes through; a low-willpower one gives up early.
  High neuroticism = anxious inner monologue; low = detached or matter-of-fact.
  High conscientiousness = tracking, planning language; low = impulsive, scattered.

PSYCHOLOGICAL LOCUS — This governs attribution, the most important voice dimension.
  Internalising: "I messed up", "I wasn't good enough", self-directed blame or reflection.
  Externalising: "they didn't give me a chance", "the situation was unfair", blame outward.

PHILOSOPHY / RELIGION — Subtly colour worldview, framing, and what the person notices.
  A stoic focuses on what they controlled; a nihilist may question the point.
  Don't name the philosophy explicitly — let it shape the framing.

RULES:
- Write entirely in first person. Never describe the character from outside.
- Do NOT label or announce the traits ("As an INTJ..."). Embody them.
- Do NOT add meta-commentary, preamble, or closing reflection outside the entry.
- Return ONLY the journal entry text. Nothing else."""


# ── Core ──────────────────────────────────────────────────────────────────────

async def generate_from_spec(spec: JourneySpec, run_id: str) -> list[dict]:
    """Generate personas from a compiled JourneySpec via the SamplingEngine.

    Publishes bus events:
      generate.started   — once, before the loop
      generate.progress  — once per persona
      generate.sample    — once per persona (success or error)
      generate.complete  — once, after the loop

    Returns a list of sample dicts (same shape saved to DB).
    """
    provider = provider_manager.active

    # Build static and dynamic parts once — engine handles per-sample variation
    template = SamplingEngine.build_template(spec)
    sequence = SamplingEngine.build_sequence(spec)

    await bus.publish("generate.started", {"n": spec.n_personas, "provider": provider.name})

    samples: list[dict] = []

    for idx in range(1, spec.n_personas + 1):
        # Engine draws the phase, rolls events, samples outcome, assembles prompt
        prompt = SamplingEngine.draw_sample(template, sequence, idx, spec.n_personas)

        # Reconstruct the phase used for this index (for DB / event metadata)
        phase = sequence.phases[(idx - 1) % len(sequence.phases)]
        locus = (phase.voice_override or sequence.default_voice or {}).get("locus", "")

        await bus.publish("generate.progress", {
            "current": idx,
            "total":   spec.n_personas,
            "status":  f"Generating persona #{idx} ({phase.phase_type} phase)...",
        })

        try:
            text = await provider.complete(prompt, system=PERSONA_SYSTEM)
            text = text.strip()

            # Extract the outcome from the prompt (engine embedded it — parse it back)
            # Fallback: use 0.0 if parsing fails
            import re as _re
            outcome_match = _re.search(r'Action outcome: .+\(([+-]?\d+\.\d+)\)', prompt)
            outcome = float(outcome_match.group(1)) if outcome_match else 0.0

            samples.append({
                "index":   idx,
                "phase":   phase.phase_type,
                "locus":   locus,
                "outcome": outcome,
                "text":    text,
            })
            save_sample(run_id, idx, phase.phase_type, locus, outcome, spec.goal, text)
            await bus.publish("generate.sample", {
                "index":   idx,
                "text":    text,
                "outcome": outcome,
                "phase":   phase.phase_type,
                "run_id":  run_id,
            })
        except Exception as e:
            logger.error(f"[Generate] Persona #{idx} failed: {e}")
            await bus.publish("generate.sample", {
                "index":   idx,
                "text":    f"[ERROR: {e}]",
                "outcome": 0.0,
                "phase":   phase.phase_type,
            })

        await asyncio.sleep(0.1)

    await bus.publish("generate.complete", {
        "n":       spec.n_personas,
        "samples": len(samples),
        "run_id":  run_id,
    })

    return samples


# ── CLI adapter ───────────────────────────────────────────────────────────────

async def cmd_generate(args: list[str], piped) -> CommandResult:
    """CLI entry point: parse args, build a minimal JourneySpec, delegate to core.

    Usage: generate [N] [--provider NAME] [--model MODEL]
    """
    n             = 3
    provider_name = None
    model_name    = None

    i = 0
    while i < len(args):
        if args[i].lstrip('-').isdigit():
            n = max(1, min(int(args[i].lstrip('-')), 50))
        elif args[i] == '--provider' and i + 1 < len(args):
            provider_name = args[i + 1]; i += 1
        elif args[i] == '--model' and i + 1 < len(args):
            model_name = args[i + 1]; i += 1
        i += 1

    if provider_name and provider_name != provider_manager.active_name:
        try:
            cfg = ProviderConfig(name=provider_name, model=model_name or '')
            provider_manager.add_provider(cfg)
            provider_manager.set_active(provider_name)
        except Exception as e:
            return CommandResult(success=False, error=f"Provider error: {e}")

    provider = provider_manager.active
    health = await provider.health_check()
    if not health:
        return CommandResult(
            success=False,
            error=f"Provider '{provider.name}' is not reachable. Is it running?",
        )

    # Build a minimal spec from CLI args (no canvas data)
    spec = JourneySpec(
        n_personas = n,
        provider   = provider.name,
        model      = model_name or getattr(provider, 'model', ''),
        goal       = "",
    )

    run_id = new_run(provider.name, getattr(provider, 'model', ''), n, spec.goal)
    samples = await generate_from_spec(spec, run_id)

    return CommandResult(
        success=True,
        output={
            "type":    "table",
            "columns": ["#", "phase", "outcome", "preview"],
            "rows":    [
                [str(s["index"]), s["phase"], str(s["outcome"]), s["text"][:60] + "…"]
                for s in samples
            ],
        },
    )


def register_generate_command():
    graph.register(Command(
        name        = "generate",
        description = "Generate N synthetic personas using the active LLM provider",
        usage       = "generate [N] [--provider NAME] [--model MODEL]",
        handler     = cmd_generate,
        output_type = "table",
    ))
