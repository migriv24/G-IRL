"""
Generate command — streams synthetic persona generation via active LLM provider.
Usage: generate [N] [--provider NAME] [--model MODEL]
"""

import asyncio
import logging
from backend.core import graph, Command, CommandResult
from backend.core.event_bus import bus
from backend.modules.providers import provider_manager, ProviderConfig
from backend.modules.samples_db import new_run, save_sample

logger = logging.getLogger(__name__)

PERSONA_SYSTEM = """You are a synthetic data generator for a self-improvement app.
Generate a realistic user persona: a short journal entry (2-4 sentences) written in first person,
describing ONE real-life action or event the person took toward their goal.
Match the tone and psychological voice described. Do not add meta-commentary.
Return only the journal entry text."""

def _persona_prompt(index: int, n: int, phase: str, locus: str, goal: str, outcome: float) -> str:
    tone_desc = "internal (blames self, reflects)" if locus == "internal" else "external (blames others, deflects)"
    outcome_desc = (
        "complete failure or rejection" if outcome < -0.3
        else "neutral / nothing happened" if outcome < 0.3
        else "partial success" if outcome < 0.7
        else "clear success"
    )
    return (
        f"Persona {index}/{n}. Goal: '{goal}'. Current life phase: {phase}. "
        f"Psychological voice: {tone_desc}. Outcome of this action: {outcome_desc} ({outcome:.1f}). "
        f"Write their journal entry."
    )


async def cmd_generate(args: list[str], piped) -> CommandResult:
    # Parse args: generate [N] [--provider NAME] [--model MODEL]
    n = 3
    provider_name = None
    model_name = None

    i = 0
    while i < len(args):
        if args[i].lstrip('-').isdigit():
            n = max(1, min(int(args[i].lstrip('-')), 50))
        elif args[i] == '--provider' and i + 1 < len(args):
            provider_name = args[i + 1]; i += 1
        elif args[i] == '--model' and i + 1 < len(args):
            model_name = args[i + 1]; i += 1
        i += 1

    # Configure provider for this run if specified
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
        return CommandResult(success=False, error=f"Provider '{provider.name}' is not reachable. Is it running?")

    await bus.publish("generate.started", {"n": n, "provider": provider.name})

    # Simple journey template defaults (will be replaced by Journey Designer data later)
    phases  = ["struggle", "growth", "plateau", "breakthrough", "struggle"]
    locuses = ["internal", "internal", "external", "internal", "external"]
    goal    = "get a girlfriend"

    import random
    samples = []

    run_id = new_run(provider.name, getattr(provider, 'model', ''), n, goal)

    for idx in range(1, n + 1):
        phase  = phases[(idx - 1) % len(phases)]
        locus  = locuses[(idx - 1) % len(locuses)]
        outcome = round(random.uniform(-0.8, 0.9), 2)

        await bus.publish("generate.progress", {
            "current": idx,
            "total":   n,
            "status":  f"Generating persona #{idx} ({phase} phase)..."
        })

        prompt = _persona_prompt(idx, n, phase, locus, goal, outcome)

        try:
            text = await provider.complete(prompt, system=PERSONA_SYSTEM)
            text = text.strip()
            samples.append({
                "index":   idx,
                "phase":   phase,
                "locus":   locus,
                "outcome": outcome,
                "text":    text,
            })
            save_sample(run_id, idx, phase, locus, outcome, goal, text)
            await bus.publish("generate.sample", {"index": idx, "text": text, "outcome": outcome, "phase": phase, "run_id": run_id})
        except Exception as e:
            logger.error(f"[Generate] Persona #{idx} failed: {e}")
            await bus.publish("generate.sample", {"index": idx, "text": f"[ERROR: {e}]", "outcome": 0.0, "phase": phase})

        # Small delay so the UI can breathe
        await asyncio.sleep(0.1)

    await bus.publish("generate.complete", {"n": n, "samples": len(samples), "run_id": run_id})

    return CommandResult(success=True, output={
        "type": "table",
        "columns": ["#", "phase", "outcome", "preview"],
        "rows": [[str(s["index"]), s["phase"], str(s["outcome"]), s["text"][:60] + "…"] for s in samples],
    })


def register_generate_command():
    graph.register(Command(
        name="generate",
        description="Generate N synthetic personas using the active LLM provider",
        usage="generate [N] [--provider NAME] [--model MODEL]",
        handler=cmd_generate,
        output_type="table",
    ))
