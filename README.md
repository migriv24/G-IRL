# G-IRL / IRL Project

> **Transparency notice:** All code in this repository was written by [Claude Code](https://claude.ai/claude-code) (Anthropic's AI coding assistant). This project was not programmed by a human. The human behind this project is the architect and operator — designing the system, making product decisions, and directing the AI that writes the code.

---

## What Is This?

This is a three-layer project stack. Each layer builds on the one beneath it:

```
G-IRL          ← mobile RPG app (specific goal: "get a girlfriend")
  └─ IRL       ← federated, privacy-first goal-pursuit engine
       └─ IRL_Window  ← developer tool: synthetic data + model training pipeline
```

The vision: a real-life skill tree. An ML model that learns what sequences of actions actually move people toward abstract goals — trained on real-world human experience, federated so your raw data never leaves your device.

---

## Layer 1 — IRL_Window (building now)

**What:** A web-based developer dashboard for creating synthetic training data, managing model training pipelines, and visualizing models.

**Who it's for:** ML engineers and CS people who want to build their own IRL-style goal model, or fork this stack for a different goal domain.

**Tech stack:**
- Backend: Python + FastAPI
- Frontend: React
- 3D visualization: Three.js / WebGL
- LLM providers: pluggable abstraction (OpenAI-compatible, Anthropic SDK, Ollama)
- Storage: SQLite + JSONL export

**Key features:**
- **Journey Designer** — a React Flow node graph editor for designing synthetic persona archetypes. Think ComfyUI, but for life journeys. Design narrative arcs like "unlucky person who wins at the end" or "overconfident early success who plateaus."
- **Command interface** — a structured command terminal with autocomplete, piping, and rich output (tables, progress bars, JSON trees). Not a real shell — a purpose-built interface that talks to internal modules via event bus.
- **Generation panel** — live streaming view of synthetic data being generated, with real-time logs and progress.
- **Sample viewer** — view generated samples as raw text, as they'd appear in the IRL/G-IRL app, or as structured JSON.
- **Model visualization** — artistic Three.js 3D graph of model architecture. Primarily aesthetic.

**Architecture:** Hexagonal modular + central event bus. Each functional module has defined ports. Commands are graph nodes that chain and pipe to other nodes. Node-based thinking at three levels: journey design, command system, and model visualization.

---

## Layer 2 — IRL (next)

**What:** A federated, open-source "abstract goal pursuit" engine. The ML model at the center of everything.

**Core idea:** Users log real-world actions and events with self-reported outcome ratings (-1 to 1). An on-device model learns what sequences of actions lead toward abstract goals. Only gradient updates leave the device — never raw data.

**Key design principles:**
- Works fully offline
- Formula-based fallback always exists (model accuracy is always visible)
- Privacy-first: federated learning, no raw personal data ever transmitted
- Goal-agnostic: the model layer doesn't know or care what the goal is

**What the model predicts:** "Action blocks" — given a goal, a person's current stats, and their history of previous action blocks, what should they do next?

**What makes it different from advice apps:** The writing style of your logs IS the signal. Two people can log the same rejection with the same outcome score, but write it completely differently:
- *"Pretty bummed, she wasn't interested"* → internal locus, growth trajectory likely
- *"This fucking BITCH, women are stupid!"* → external locus, model predicts stagnation

Same rating. Radically different predicted futures. The model learns this from patterns in training data, not from hard-coded rules.

**Sub-goals emerge from data:** The model discovers that "talk to a girl" is almost always a prerequisite — not because it was programmed in, but because it appears in the data. No predefined skill trees.

---

## Layer 3 — G-IRL (last)

**What:** A mobile-first RPG app with one specific goal domain: getting a girlfriend.

**Who it's for:** Average users, not developers. Retro video game aesthetic, RPG mechanics, community features.

**Built on:** IRL infrastructure underneath, with G-IRL-specific additions:
- Community action tags and shared action vocabulary
- Social stats (appearance, social confidence, etc.)
- Action relationship graph (populated by model + user community)
- Shared leaderboards, community-validated action sequences

**Why "get a girlfriend":** It's a concrete, universally understood abstract goal with rich sub-goal structure, high variance in outcomes, and a large potential user base that would benefit from systematic, data-driven guidance. The IRL layer is completely generic — G-IRL is just one application of it.

---

## Synthetic Data Design

Before IRL can be trained on real-world data, it needs synthetic data to bootstrap. IRL_Window generates this.

**The fundamental training unit is a full journey, not a single action.**

Each synthetic persona has:
- A psychological archetype (growth mindset, external blamer, self-aware introvert, overconfident, comeback story, extremely unlucky but persistent, etc.)
- A goal and life phase structure (struggle → growth → plateau → spiral → return)
- A writing style (locus of control, emotional tone, self-awareness level)
- Stat progression over time (stats change based on outcomes and time gaps)
- Time gaps that matter — inactivity IS a feature, not metadata

The LLM writes the raw text in the persona's psychological voice. Everything else (stats, timestamps, outcome values) is rule-based.

---

## Project Status

| Layer | Status |
|---|---|
| IRL_Window | In development |
| IRL | Design phase |
| G-IRL | Concept phase |

---

## Open Source

IRL_Window and IRL are intended to be fully open source. The goal is for the community to be able to fork IRL for any abstract goal domain — not just dating.

G-IRL is a specific application. Its community action tags and social graph are G-IRL-specific and live at that layer only.

---

## Note on AI Authorship

This project is an experiment in AI-assisted development taken to its logical conclusion. The human behind it is the product designer, system architect, and operator. Claude Code (Anthropic) writes all the code based on direction and feedback. This is intentional and transparent.

If you're curious about the development process or want to fork this for your own goal domain, open an issue.
