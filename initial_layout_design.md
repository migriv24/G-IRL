# IRL / G-IRL — AI Agent Project Briefing
> Version 0.1 — Foundation Setup
> Read this entire document before writing a single line of code.

---

## 1. What You Are Building

Two layered software projects:

**IRL (In Real Life)** — A federated, open-source "abstract goal pursuit" engine. Users log real-world actions and events with outcome ratings. A lightweight on-device model learns what sequences of actions lead toward abstract goals. Think of it as autocorrect for your life decisions — small, fast, runs on-device, gets smarter with more users.

**G-IRL (Goals In Real Life)** — A specific application layer built on top of IRL, themed as a retro RPG, targeting the goal of "getting a girlfriend." Uses all IRL infrastructure plus additional domain-specific stat dimensions, a community action vocabulary, and social-context models.

You are building **IRL first**. G-IRL comes later and will be a separate layer on top.

The overall philosophy: anonymous, honest, collective. Users share gradient updates (not raw data). Models are public. Accuracy is displayed openly. Nobody profits from user data.

---

## 2. Technology Choices

### Primary App Language: Rust
- Fast, small binaries, no garbage collector pauses
- Excellent for mobile-bound ONNX inference via `ort` crate
- Strong async story with `tokio`
- Target: desktop first, mobile later (same codebase via Tauri for desktop UI)

### UI Framework: Tauri + Svelte
- Tauri wraps Rust backend, Svelte handles frontend
- Produces small desktop apps (~5MB vs Electron's ~150MB)
- Later: React Native or Flutter for mobile (Rust core stays the same via FFI)

### ML Inference: ONNX Runtime (`ort` crate in Rust)
- All trained models exported as `.onnx` files
- Runs on CPU, GPU optional, works on mobile
- Same model file works on desktop and mobile
- No Python needed at runtime — Python only for training pipeline

### ML Training Pipeline: Python (separate from app)
- Use existing conda environment
- Ollama for synthetic data generation (already installed)
- PyTorch for training, then export to ONNX
- `sentence-transformers` for base text embeddings
- Federated aggregation server: lightweight Python FastAPI service

### Database (local, on-device): SQLite via `rusqlite`
- All user data stays on device
- Schema defined in Rust migration files
- Never transmitted — only gradient updates leave the device

### Federated Aggregation Server: Python FastAPI
- Receives gradient updates from clients
- Runs FedAvg aggregation
- Serves updated global model weights as ONNX files
- Can be self-hosted by anyone — no central authority required
- Intentionally minimal: this is not a data server, it is a math server

---

## 3. Repository Structure

```
irl/
├── README.md
├── ARCHITECTURE.md          # Link back to this document
├── app/                     # Tauri + Svelte desktop app
│   ├── src-tauri/           # Rust backend
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── db/          # SQLite schema + migrations
│   │   │   │   ├── mod.rs
│   │   │   │   ├── schema.sql
│   │   │   │   └── migrations/
│   │   │   ├── models/      # ONNX inference wrappers
│   │   │   │   ├── mod.rs
│   │   │   │   ├── text_encoder.rs
│   │   │   │   └── outcome_predictor.rs
│   │   │   ├── federated/   # Gradient computation + server comms
│   │   │   │   ├── mod.rs
│   │   │   │   ├── client.rs
│   │   │   │   └── aggregator_client.rs
│   │   │   ├── stats/       # Stat vector logic
│   │   │   │   └── mod.rs
│   │   │   └── commands.rs  # Tauri command handlers (Rust↔JS bridge)
│   │   ├── Cargo.toml
│   │   └── tauri.conf.json
│   └── src/                 # Svelte frontend
│       ├── app.html
│       ├── lib/
│       │   ├── components/
│       │   └── stores/
│       └── routes/
│           ├── +page.svelte         # Dashboard
│           ├── onboarding/
│           ├── log/                 # Log an action or event
│           ├── goals/               # Goal tree view
│           └── stats/               # Stat profile view
│
├── ml/                      # Python training pipeline (separate from app)
│   ├── README.md
│   ├── requirements.txt
│   ├── synthetic/
│   │   ├── generate.py      # Ollama-powered synthetic data generator
│   │   ├── personas.py      # User persona templates
│   │   └── scenarios.py     # Action/event scenario templates
│   ├── models/
│   │   ├── text_encoder/
│   │   │   ├── train.py     # Fine-tune MiniLM on action vocab
│   │   │   └── export.py    # Export to ONNX
│   │   ├── outcome_predictor/
│   │   │   ├── model.py     # PyTorch model definition
│   │   │   ├── train.py
│   │   │   └── export.py
│   │   └── fusion/
│   │       ├── model.py     # Multi-modal fusion layer
│   │       ├── train.py
│   │       └── export.py
│   ├── federated/
│   │   ├── server.py        # FastAPI aggregation server
│   │   └── fedavg.py        # FedAvg implementation
│   └── eval/
│       ├── benchmark.py     # Model accuracy benchmarks
│       └── metrics.py       # Accuracy metrics displayed in app
│
├── models/                  # Committed ONNX model files (versioned)
│   ├── text_encoder_v0.1.onnx
│   ├── outcome_predictor_v0.1.onnx
│   └── MODEL_CARD.md        # Public model documentation
│
└── docs/
    ├── DATA_SCHEMA.md        # Full schema reference (see Section 5)
    ├── FEDERATED.md          # Federated learning protocol
    ├── SYNTHETIC_DATA.md     # How synthetic data is generated
    └── PRIVACY.md            # Privacy guarantees and boundaries
```

---

## 4. Build Order (Do Not Skip Steps)

### Stage 0 — Scaffold (Do This First)
1. `cargo new` the Tauri project with Svelte template
2. Set up SQLite with `rusqlite`, run schema migration on first launch
3. Stub all Tauri commands (empty functions that compile)
4. Verify the desktop app opens and closes without errors
5. Set up the Python `ml/` directory with a conda `environment.yml`

### Stage 1 — Data Layer
1. Implement the full SQLite schema (Section 5)
2. Write Rust structs that map to every table
3. Implement CRUD operations for: User, StatSnapshot, ActionLog, Goal
4. Write unit tests for all DB operations
5. No UI yet — test via Rust unit tests only

### Stage 2 — Synthetic Data Pipeline
1. Build `ml/synthetic/generate.py` using Ollama
2. Generate 500+ synthetic user personas with varied stat profiles
3. Generate 5000+ synthetic action logs with outcome ratings
4. Store output as JSONL files for training
5. Document the generation prompts in `SYNTHETIC_DATA.md`

### Stage 3 — First Models (Baseline, Non-Federated)
1. Take `all-MiniLM-L6-v2` from sentence-transformers as the text encoder base
2. Fine-tune lightly on the synthetic action vocabulary
3. Export to ONNX: `models/text_encoder_v0.1.onnx`
4. Build a simple outcome predictor MLP in PyTorch (stat_vector + action_embedding → outcome_float)
5. Train on synthetic data, export to ONNX: `models/outcome_predictor_v0.1.onnx`
6. Verify both ONNX files run correctly via `ort` in Rust

### Stage 4 — Formula Fallback Layer
1. Implement simple weighted formula in Rust (no model needed):
   `p_success = weighted_sum(relevant_stats) * action_difficulty_factor`
2. This is the cold-start fallback shown to users when model confidence is low
3. Display formula vs. model accuracy side-by-side in the UI
4. Formula stays as a sanity check even after model is trained

### Stage 5 — Basic UI (RPG aesthetic, minimal)
1. Onboarding flow: username, 16x16 pixel avatar builder, initial stat assessment
2. Dashboard: stat radar chart, recent action log, current goal
3. Log action screen: text input for action description, outcome slider (-1 to 1)
4. Goal view: placeholder skill tree (static for now)
5. Model stats view: accuracy %, number of contributing users, training rounds

### Stage 6 — Federated Infrastructure
1. Build `ml/federated/server.py` (FastAPI, FedAvg)
2. Implement gradient computation on-device in Rust (simple gradient of outcome predictor)
3. Implement the client-side federated round: compute gradients → send to server → receive updated weights → hot-swap ONNX model
4. Test with 2 simulated clients on localhost
5. Document the protocol in `FEDERATED.md`

### Stage 7 — Integration + Polish
1. Connect all layers: UI → Tauri commands → DB → Model inference → Federated client
2. Model accuracy updates in real-time as federated rounds complete
3. Action similarity surface (show user "similar actions others have tried")
4. Basic goal path prediction (top-3 recommended next actions)

---

## 5. Data Schema

### users
```sql
CREATE TABLE users (
    id          TEXT PRIMARY KEY,  -- UUID, generated locally, never sent to server
    username    TEXT NOT NULL UNIQUE,
    avatar_data TEXT NOT NULL,      -- 16x16 pixel grid as JSON array of hex colors
    created_at  INTEGER NOT NULL,   -- Unix timestamp
    last_active INTEGER NOT NULL
);
```

### stat_snapshots
One row per stat assessment. Stats are re-assessed periodically, so history is preserved.
```sql
CREATE TABLE stat_snapshots (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    snapshot_at     INTEGER NOT NULL,  -- Unix timestamp

    -- Cognitive
    iq_estimate     REAL,              -- 0.0–1.0 normalized
    education_level INTEGER,           -- 0=none, 1=HS, 2=some college, 3=degree, 4=postgrad

    -- Physical
    fitness_level   REAL,              -- 0.0–1.0 self-reported composite
    max_lift_kg     REAL,
    run_5k_seconds  INTEGER,

    -- Social / Personality
    mbti_code       TEXT,              -- e.g. "INTJ"
    charisma        REAL,              -- 0.0–1.0 self-reported
    social_anxiety  REAL,              -- 0.0–1.0 self-reported (higher = more anxious)

    -- Mental
    mental_health   REAL,              -- 0.0–1.0 self-reported wellbeing

    -- Abstract Representation (derived, not self-reported)
    -- Updated automatically by the writing style analyzer over time
    abstract_rep    REAL,              -- 0.0–1.0, starts at 0.5, drifts based on log entries

    -- Experience
    age             INTEGER,
    total_xp        INTEGER NOT NULL DEFAULT 0
);
```

### goals
```sql
CREATE TABLE goals (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    title           TEXT NOT NULL,       -- e.g. "Get a girlfriend"
    description     TEXT,
    goal_embedding  BLOB,                -- 128-dim float32 vector, stored as raw bytes
    status          TEXT NOT NULL DEFAULT 'active',  -- active | achieved | abandoned
    created_at      INTEGER NOT NULL,
    achieved_at     INTEGER
);
```

### action_logs
The core data unit. Every logged action or event creates one row.
```sql
CREATE TABLE action_logs (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id),
    goal_id         TEXT REFERENCES goals(id),

    entry_type      TEXT NOT NULL,       -- 'action' | 'event'
    -- action = something the user chose to do
    -- event  = something that happened to the user

    raw_text        TEXT NOT NULL,       -- Exactly what the user typed
    clean_summary   TEXT,               -- Optional user-edited clean version

    -- Computed embeddings (stored as raw float32 bytes)
    text_embedding  BLOB,               -- 128-dim from text encoder model
    style_embedding BLOB,               -- 64-dim writing style/tone vector

    -- Outcome
    outcome         REAL,               -- -1.0 to 1.0, user self-reported
    outcome_notes   TEXT,               -- Optional elaboration

    -- Stat snapshot at time of logging (foreign key to closest snapshot)
    snapshot_id     TEXT REFERENCES stat_snapshots(id),

    -- Metadata
    logged_at       INTEGER NOT NULL,   -- When the user logged it
    occurred_at     INTEGER,            -- When it actually happened (can be earlier)

    -- Abstract Representation signal extracted from raw_text
    -- These are derived by the writing style analyzer, not user-input
    locus_internal  REAL,               -- 0.0–1.0: how much user attributes outcome to themselves
    emotional_tone  REAL,               -- -1.0 (negative) to 1.0 (positive)
    self_awareness  REAL                -- 0.0–1.0: reflection markers detected
);
```

### action_relations
Community-tagged similarity between actions. Used as weak supervision for embedding training.
```sql
CREATE TABLE action_relations (
    id          TEXT PRIMARY KEY,
    log_id_a    TEXT NOT NULL REFERENCES action_logs(id),
    log_id_b    TEXT NOT NULL REFERENCES action_logs(id),
    relation    TEXT NOT NULL,   -- 'similar' | 'prerequisite' | 'follow_up' | 'opposite'
    confidence  REAL NOT NULL DEFAULT 1.0,
    tagged_by   TEXT,            -- 'user' | 'model'
    created_at  INTEGER NOT NULL
);
```

### federated_rounds
Tracks participation in federated learning rounds.
```sql
CREATE TABLE federated_rounds (
    id              TEXT PRIMARY KEY,
    round_number    INTEGER NOT NULL,
    model_version   TEXT NOT NULL,       -- e.g. "outcome_predictor_v0.3"
    participated_at INTEGER NOT NULL,
    gradient_norm   REAL,                -- L2 norm of submitted gradient (for debugging)
    model_accuracy  REAL                 -- Global model accuracy at time of this round
);
```

### model_metadata
Cached model performance stats, displayed in the UI transparency dashboard.
```sql
CREATE TABLE model_metadata (
    model_name      TEXT PRIMARY KEY,   -- e.g. "outcome_predictor"
    current_version TEXT NOT NULL,
    onnx_path       TEXT NOT NULL,      -- Local path to current ONNX file
    accuracy        REAL,               -- Validation accuracy (0.0–1.0)
    contributing_users INTEGER,         -- How many users have contributed gradients
    training_rounds INTEGER,
    last_updated    INTEGER             -- Unix timestamp
);
```

---

## 6. Core Rust Types

These should be defined in `src-tauri/src/` and used throughout.

```rust
// src-tauri/src/stats/mod.rs

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct StatVector {
    pub iq_estimate: f32,           // 0.0–1.0
    pub education_level: u8,        // 0–4
    pub fitness_level: f32,         // 0.0–1.0
    pub charisma: f32,              // 0.0–1.0
    pub social_anxiety: f32,        // 0.0–1.0 (higher = more anxious)
    pub mental_health: f32,         // 0.0–1.0
    pub abstract_rep: f32,          // 0.0–1.0 derived, not self-reported
    pub age: u8,
    pub total_xp: u32,
}

impl StatVector {
    /// Convert to flat f32 array for model input
    pub fn to_tensor(&self) -> Vec<f32> {
        vec![
            self.iq_estimate,
            self.education_level as f32 / 4.0,  // normalize to 0–1
            self.fitness_level,
            self.charisma,
            self.social_anxiety,
            self.mental_health,
            self.abstract_rep,
            (self.age as f32 - 13.0) / (60.0 - 13.0),  // normalize age range
        ]
    }

    /// Dimensionality of stat vector (keep in sync with to_tensor)
    pub const DIM: usize = 8;
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ActionLog {
    pub id: String,
    pub entry_type: EntryType,
    pub raw_text: String,
    pub outcome: f32,               // -1.0 to 1.0
    pub text_embedding: Vec<f32>,   // 128-dim
    pub style_embedding: Vec<f32>,  // 64-dim
    pub logged_at: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub enum EntryType {
    Action,  // User chose to do this
    Event,   // This happened to the user
}

#[derive(Debug, Clone)]
pub struct PredictionResult {
    pub predicted_outcome: f32,     // -1.0 to 1.0
    pub confidence: f32,            // 0.0 to 1.0
    pub source: PredictionSource,
}

#[derive(Debug, Clone)]
pub enum PredictionSource {
    Formula,        // Cold start weighted formula
    ModelV(String), // Trained model, version string
}
```

---

## 7. Model Architecture (ONNX Targets)

All models must fit these constraints: <10MB file size, <50ms inference on a mid-range CPU.

### text_encoder
- **Input:** Tokenized text (max 64 tokens)
- **Output:** 128-dim float32 embedding vector
- **Base:** `all-MiniLM-L6-v2` (22MB base, distill further if needed)
- **Purpose:** Encode action/event descriptions into shared latent space

### style_encoder
- **Input:** Same tokenized text as text_encoder
- **Output:** 64-dim float32 style vector
- **Architecture:** Separate shallow head on top of text_encoder
- **Purpose:** Capture writing tone, locus of control, emotional valence
- **Note:** Shares text_encoder backbone, separate output head

### outcome_predictor
- **Input:** [stat_vector (8-dim) || action_embedding (128-dim)] = 136-dim concat
- **Output:** Scalar float32 in range [-1.0, 1.0]
- **Architecture:** 3-layer MLP: 136 → 64 → 32 → 1 with ReLU + tanh output
- **Purpose:** Predict outcome of an action given user's current stats
- **This is the federated model** — gradients from this are what users share

### sequence_predictor (Stage 6+, not MVP)
- **Input:** Sequence of (action_embedding, outcome) pairs + goal_embedding
- **Architecture:** Small transformer encoder, 2 layers, 4 heads, 128-dim
- **Output:** Distribution over next action embeddings
- **Purpose:** "Given your history and goal, what should you try next?"

---

## 8. Federated Learning Protocol

### Overview
Users never send raw logs to any server. They send only compressed gradient updates.

### Round Protocol
```
1. Server broadcasts: current model version + round number
2. Client checks: do I have enough new logs since last round? (threshold: 10 new logs)
3. Client computes: loss on local data using current global model
4. Client computes: gradients via backprop on the outcome_predictor ONNX model
5. Client applies: differential privacy noise (clip gradients, add Gaussian noise)
6. Client sends: {round_number, clipped_noisy_gradients, local_data_count}
7. Server receives N clients' gradients, runs FedAvg:
   global_gradient = weighted_average(client_gradients, weights=data_counts)
8. Server updates model weights, increments version, broadcasts new ONNX file
9. Clients download new ONNX, hot-swap inference model, log round participation
```

### Privacy Parameters (starting defaults, tune later)
- Gradient clipping norm: 1.0
- Gaussian noise sigma: 0.1
- Minimum clients per round: 5 (queue rounds until threshold met)
- Client data threshold to participate: 10 new logs since last round

### What Leaves the Device
- Round number (integer)
- Gradient tensor (same shape as model weights, after clipping + noise)
- Local data count (integer, used for weighted averaging)
- Model version string

### What Never Leaves the Device
- Raw action log text
- Outcome ratings
- Stat vectors
- User identity (server sees anonymous gradient submissions only)

---

## 9. Synthetic Data Generation

### Goal
Generate enough synthetic user/action/outcome data to pre-train the `outcome_predictor` before real users exist.

### Generation Script (`ml/synthetic/generate.py`)

The script uses Ollama with a locally running model (e.g. `llama3` or `mistral`) to generate:

1. **Personas** — 200 synthetic users with varied stat profiles
   - Draw stats from realistic distributions (e.g., fitness_level ~ Beta(2, 3))
   - Include personality archetypes (shy introvert, confident extrovert, etc.)

2. **Action vocabulary** — 300 distinct actions with descriptions
   - Varied contexts: social, fitness, work, creative, self-improvement
   - For each action, estimated difficulty and stat requirements

3. **Simulated logs** — For each persona, simulate 6 months of activity:
   - Sample actions probabilistically weighted by persona's stats
   - Generate outcome using: `outcome = f(stat_alignment, difficulty, noise)`
   - Use LLM to write the raw_text entry in the persona's voice

### Ollama Prompt Template (for log generation)
```
You are simulating a user of a self-improvement app. 
User persona: {persona_description}
User stats: {stat_vector_description}
Action taken: {action_title}
Actual outcome (internal): {outcome_float}

Write a short, honest journal entry (1–3 sentences) as this user logging this action.
Write in first person. Match the user's personality. Do not mention the numeric outcome.
Return only the journal entry text, nothing else.
```

### Output Format
```jsonl
{"user_id": "synth_001", "action": "approached stranger at coffee shop", "raw_text": "...", "outcome": 0.3, "stats": {...}}
```

---

## 10. Abstract Representation — Writing Style Analysis

### What It Is
A derived stat (0.0–1.0) that updates automatically based on how a user writes their log entries. It is never self-reported. It reflects psychological patterns that correlate with social success.

### What It Measures (composite of 3 sub-signals)
1. **locus_internal** — Does the user attribute outcomes to themselves or externals?
   - High: "I was nervous and probably came across wrong"
   - Low: "She was being stuck up and unfair"
2. **emotional_tone** — Valence of language around social interactions
   - Positive framing vs. hostile/bitter framing
3. **self_awareness** — Presence of reflection, hedging, growth language
   - "I think next time I could..." vs. "whatever, not my fault"

### How It Updates
After each log entry is saved, the style_encoder runs on `raw_text` and extracts these sub-signals. The `abstract_rep` stat is a rolling exponential moving average:
```
abstract_rep = 0.9 * previous_abstract_rep + 0.1 * new_signal
```
Starting value: 0.5 (neutral). Drifts slowly over time.

### Why This Matters
Two users with identical external stats may have very different outcomes. The writing style signal captures psychological factors (growth mindset, blame attribution, emotional regulation) that likely predict real-world social success but can't be self-reported honestly.

---

## 11. Model Transparency Dashboard

This is a first-class UI screen, not an afterthought. Users should always be able to see:

- Current model version for each model
- Model accuracy on held-out validation data (updated each federated round)
- Number of users who have contributed gradients
- Number of federated rounds completed
- Whether the current recommendation came from: formula / model (and which version)
- A plain English explanation of what each model does

This builds trust and makes the "we're in this together" framing tangible.

---

## 12. What NOT to Build Yet

Do not build these in the initial pass. They are future work.

- Appearance embedding / photo upload (CV model, privacy complexity)
- Full sequence_predictor / dynamic skill tree (needs real data first)
- G-IRL specific layer (dating framing, social stats, etc.)
- Mobile app (Rust core is mobile-ready but don't target it yet)
- Multi-player / social features (leaderboards, comparing stats)
- IQ test or knowledge test in onboarding (use education level + self-report for now)

---

## 13. First Commands to Run

```bash
# 1. Create Tauri + Svelte project
cargo install create-tauri-app
cargo create-tauri-app irl --template svelte

# 2. Add Rust dependencies (in src-tauri/Cargo.toml)
# ort = "2"               (ONNX Runtime)
# rusqlite = { version = "0.31", features = ["bundled"] }
# serde = { version = "1", features = ["derive"] }
# serde_json = "1"
# tokio = { version = "1", features = ["full"] }
# uuid = { version = "1", features = ["v4"] }
# reqwest = { version = "0.12", features = ["json"] }  (for federated client)

# 3. Set up Python ML environment
conda create -n irl-ml python=3.11
conda activate irl-ml
pip install torch sentence-transformers onnx onnxruntime fastapi uvicorn ollama numpy pandas

# 4. Verify Ollama is running and has a model
ollama list
# Should show at least one model (llama3, mistral, etc.)
# If not: ollama pull llama3

# 5. Initialize git repo
git init
echo "target/" >> .gitignore
echo "__pycache__/" >> .gitignore
echo "*.pyc" >> .gitignore
echo "ml/synthetic/output/" >> .gitignore  # don't commit raw synthetic data
```

---

## 14. Key Design Constraints (Never Violate These)

1. **No raw user data ever leaves the device.** Gradients only.
2. **All models ship as ONNX.** No runtime Python dependency in the app.
3. **Formula fallback always exists.** Model can be disabled, app still works.
4. **Model accuracy is always visible to the user.** No black boxes.
5. **User identity is never sent to the federated server.** Submissions are anonymous.
6. **abstract_rep is never shown as a judgment.** It's a stat like any other, displayed neutrally.
7. **The app works fully offline.** Federated sync is optional, not required for core functionality.

---

## 15. Success Criteria for Stage 0–3

You have successfully completed the foundation when:

- [ ] Desktop app launches, shows placeholder dashboard
- [ ] SQLite database initializes with correct schema on first run
- [ ] User can complete onboarding (username, avatar, initial stats)
- [ ] User can log an action with text + outcome slider
- [ ] Logged action is stored in SQLite and visible in the UI
- [ ] Synthetic data generator produces 5000+ JSONL records via Ollama
- [ ] `text_encoder_v0.1.onnx` loads and runs inference in Rust (< 50ms)
- [ ] `outcome_predictor_v0.1.onnx` loads and runs inference in Rust (< 10ms)
- [ ] Formula fallback produces a plausible prediction for any stat + action input
- [ ] Model transparency dashboard shows version, accuracy, and data source label