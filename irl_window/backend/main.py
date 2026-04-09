"""
IRL_Window backend — FastAPI app.
Run with: uvicorn backend.main:app --reload --port 8000
"""

import asyncio
import json
import logging
import pydantic
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from backend.core import bus, registry, graph
from backend.modules.providers import provider_manager
from backend.modules.samples_db import (
    init_db, list_runs, get_run, list_samples, get_sample, run_stats, global_stats,
    delete_sample, delete_run, delete_by_keyword, delete_by_phase,
)
from backend.modules.model_db import init_model_db, new_model_record, list_models, get_model
from backend.modules.model_trainer import train_model_async
from backend.commands import register_all_commands

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── Active WebSocket connections (broadcast target) ─────────────────────────
_ws_clients: set[WebSocket] = set()


async def broadcast(event_type: str, payload: dict):
    """Send an event to all connected WebSocket clients."""
    message = json.dumps({"event": event_type, "payload": payload})
    dead = set()
    for ws in _ws_clients:
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)
    _ws_clients.difference_update(dead)


# ── Event bus → WebSocket bridge ────────────────────────────────────────────
async def on_any_event(event_type: str, payload):
    await broadcast(event_type, payload if isinstance(payload, dict) else {"data": payload})


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== IRL_Window starting ===")

    # Init databases
    init_db()
    init_model_db()

    # Register modules
    registry.register("provider_manager", provider_manager)
    registry.register("command_graph", graph)

    # Register all commands
    register_all_commands()

    # Subscribe broadcast to all bus events
    bus.subscribe("*", on_any_event)

    # Start event bus
    await bus.start()

    await bus.publish("system.started", {"message": "IRL_Window backend ready"})
    logger.info("=== IRL_Window ready — listening on http://localhost:8000 ===")

    yield

    bus.stop()
    logger.info("=== IRL_Window shutdown ===")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="IRL_Window", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST endpoints ────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}


@app.get("/api/providers")
async def get_providers():
    return await provider_manager.status()


@app.get("/api/commands")
async def get_commands():
    return graph.help_text()


# ── Sample / Run endpoints ────────────────────────────────────────────────────

@app.get("/api/runs")
async def api_list_runs(limit: int = 50):
    return list_runs(limit=limit)


@app.get("/api/runs/{run_id}")
async def api_get_run(run_id: str):
    run = get_run(run_id)
    if not run:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@app.get("/api/runs/{run_id}/stats")
async def api_run_stats(run_id: str):
    return run_stats(run_id)


@app.get("/api/samples")
async def api_list_samples(run_id: str | None = None, phase: str | None = None,
                            limit: int = 200, offset: int = 0):
    return list_samples(run_id=run_id, phase=phase, limit=limit, offset=offset)


@app.get("/api/samples/stats")
async def api_global_stats():
    return global_stats()


@app.get("/api/samples/{sample_id}")
async def api_get_sample(sample_id: int):
    s = get_sample(sample_id)
    if not s:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Sample not found")
    return s


@app.delete("/api/samples/{sample_id}")
async def api_delete_sample(sample_id: int):
    ok = delete_sample(sample_id)
    if not ok:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Sample not found")
    return {"deleted": sample_id}


@app.delete("/api/runs/{run_id}")
async def api_delete_run(run_id: str):
    return delete_run(run_id)


@app.delete("/api/samples")
async def api_delete_bulk(keyword: str | None = None, phase: str | None = None):
    from fastapi import HTTPException
    if keyword:
        return delete_by_keyword(keyword)
    if phase:
        return delete_by_phase(phase)
    raise HTTPException(status_code=400, detail="Provide keyword or phase query param")


# ── Model endpoints ───────────────────────────────────────────────────────────

class TrainRequest(pydantic.BaseModel):
    hidden_layers: list[int] = [32, 16]
    max_iter: int = 200
    learning_rate: float = 0.001
    run_id: str | None = None
    name: str | None = None


@app.get("/api/models")
async def api_list_models(limit: int = 50):
    return list_models(limit=limit)


@app.get("/api/models/{model_id}")
async def api_get_model(model_id: str):
    m = get_model(model_id)
    if not m:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Model not found")
    return m


@app.post("/api/models/train")
async def api_train_model(req: TrainRequest):
    from backend.modules.samples_db import list_samples as _ls
    n_samples = len(_ls(run_id=req.run_id, limit=10000))
    if n_samples < 5:
        from fastapi import HTTPException
        raise HTTPException(status_code=400,
                            detail=f"Need ≥ 5 samples to train, found {n_samples}. Run 'generate' first.")

    model_id = new_model_record(
        hidden_layers=req.hidden_layers,
        max_iter=req.max_iter,
        learning_rate=req.learning_rate,
        n_samples=n_samples,
        name=req.name,
    )
    # Fire and forget — results arrive via WS events
    asyncio.create_task(train_model_async(
        model_id=model_id,
        hidden_layers=req.hidden_layers,
        max_iter=req.max_iter,
        learning_rate=req.learning_rate,
        run_id=req.run_id,
        event_publish=bus.publish,
    ))
    return {"model_id": model_id, "status": "training"}


@app.get("/api/models/{model_id}/download")
async def api_download_model(model_id: str):
    from fastapi import HTTPException
    from fastapi.responses import FileResponse
    m = get_model(model_id)
    if not m or not m.get('onnx_path'):
        raise HTTPException(status_code=404, detail="ONNX file not found")
    from pathlib import Path
    p = Path(m['onnx_path'])
    if not p.exists():
        raise HTTPException(status_code=404, detail="ONNX file missing from disk")
    return FileResponse(str(p), filename=f"{m['name'] or model_id}.onnx",
                        media_type='application/octet-stream')


# ── WebSocket endpoint ────────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    _ws_clients.add(ws)
    client_id = id(ws)
    logger.info(f"[WS] Client connected: {client_id}")

    await ws.send_text(json.dumps({
        "event": "ws.connected",
        "payload": {
            "message": "Connected to IRL_Window",
            "active_provider": provider_manager.active_name,
            "commands": graph.all_names(),
        }
    }))

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_text(json.dumps({
                    "event": "error",
                    "payload": {"message": "Invalid JSON"}
                }))
                continue

            msg_type = msg.get("type")

            # ── Command execution ─────────────────────────────────────────
            if msg_type == "command":
                cmd_input = msg.get("input", "").strip()
                if not cmd_input:
                    continue

                await bus.publish("command.received", {"input": cmd_input})

                result = await graph.execute(cmd_input)

                await ws.send_text(json.dumps({
                    "event": "command.result",
                    "payload": {
                        "input": cmd_input,
                        "success": result.success,
                        "output": result.output,
                        "error": result.error,
                    }
                }))

                await bus.publish(
                    "command.executed" if result.success else "command.failed",
                    {"input": cmd_input, "success": result.success}
                )

            # ── Project: save ─────────────────────────────────────────────
            elif msg_type == "project.save":
                from backend.modules.project_manager import save_project
                p = msg.get("payload", {})
                try:
                    meta = save_project(
                        name=p.get("name", "Untitled Journey"),
                        nodes=p.get("nodes", []),
                        edges=p.get("edges", []),
                        description=p.get("description", ""),
                        project_id=p.get("id"),
                    )
                    await ws.send_text(json.dumps({"event": "project.saved", "payload": meta}))
                except Exception as e:
                    await ws.send_text(json.dumps({"event": "error", "payload": {"message": f"Save failed: {e}"}}))

            # ── Project: load ─────────────────────────────────────────────
            elif msg_type == "project.load":
                try:
                    from backend.modules.project_manager import load_project
                    project_id = msg.get("payload", {}).get("id")
                    data = load_project(project_id) if project_id else None
                    if data:
                        await ws.send_text(json.dumps({"event": "project.loaded", "payload": data}))
                    else:
                        await ws.send_text(json.dumps({"event": "error", "payload": {"message": f"Project not found: {project_id}"}}))
                except Exception as e:
                    await ws.send_text(json.dumps({"event": "error", "payload": {"message": f"Load failed: {e}"}}))

            # ── Project: list ─────────────────────────────────────────────
            elif msg_type == "project.list":
                try:
                    from backend.modules.project_manager import list_projects
                    projects = list_projects()
                    await ws.send_text(json.dumps({"event": "project.list", "payload": {"projects": projects}}))
                except Exception as e:
                    await ws.send_text(json.dumps({"event": "error", "payload": {"message": f"List failed: {e}"}}))

            # ── Project: delete ───────────────────────────────────────────
            elif msg_type == "project.delete":
                try:
                    from backend.modules.project_manager import delete_project
                    project_id = msg.get("payload", {}).get("id")
                    success = delete_project(project_id) if project_id else False
                    await ws.send_text(json.dumps({"event": "project.deleted", "payload": {"id": project_id, "success": success}}))
                except Exception as e:
                    await ws.send_text(json.dumps({"event": "error", "payload": {"message": f"Delete failed: {e}"}}))

            # ── Project: rename ───────────────────────────────────────────
            elif msg_type == "project.rename":
                try:
                    from backend.modules.project_manager import rename_project
                    p = msg.get("payload", {})
                    meta = rename_project(p.get("id"), p.get("name", ""))
                    if meta:
                        await ws.send_text(json.dumps({"event": "project.renamed", "payload": meta}))
                    else:
                        await ws.send_text(json.dumps({"event": "error", "payload": {"message": "Project not found"}}))
                except Exception as e:
                    await ws.send_text(json.dumps({"event": "error", "payload": {"message": f"Rename failed: {e}"}}))

            # ── Canvas: auto-save ─────────────────────────────────────────
            elif msg_type == "canvas.autosave":
                p = msg.get("payload", {})
                try:
                    from backend.modules.canvas_manager import save_canvas
                    save_canvas(p.get("nodes", []), p.get("edges", []))
                    # Intentionally no response — fire-and-forget
                except Exception as e:
                    logger.error(f"[canvas.autosave] {e}")

            # ── Canvas: load ──────────────────────────────────────────────
            elif msg_type == "canvas.load":
                try:
                    from backend.modules.canvas_manager import load_canvas
                    canvas = load_canvas()
                    await ws.send_text(json.dumps({"event": "canvas.loaded", "payload": canvas}))
                except Exception as e:
                    await ws.send_text(json.dumps({"event": "error", "payload": {"message": f"canvas.load failed: {e}"}}))

            # ── Models: list ─────────────────────────────────────────────
            elif msg_type == "models.list":
                try:
                    models = await provider_manager.active.list_models()
                    await ws.send_text(json.dumps({"event": "models.list", "payload": {
                        "provider": provider_manager.active_name,
                        "models":   models,
                    }}))
                except Exception as e:
                    await ws.send_text(json.dumps({"event": "error", "payload": {"message": f"models.list failed: {e}"}}))

            # ── Journey: run ─────────────────────────────────────────────
            elif msg_type == "journey.run":
                p = msg.get("payload", {})
                try:
                    from backend.modules.canvas_manager import load_canvas
                    from backend.modules.journey_compiler import compile as compile_journey
                    from backend.modules.providers import ProviderConfig
                    from backend.modules.samples_db import new_run
                    from backend.commands.generate import generate_from_spec

                    # Source of truth: the saved canvas file, not in-memory React state
                    canvas = load_canvas()

                    spec = compile_journey(
                        nodes     = canvas["nodes"],
                        edges     = canvas["edges"],
                        overrides = {
                            "n_personas": p.get("n_personas", 3),
                            "provider":   p.get("provider", "ollama"),
                            "model":      p.get("model", "llama3.2:1b"),
                        },
                    )

                    # Switch provider if requested
                    if spec.provider and spec.provider != provider_manager.active_name:
                        cfg = ProviderConfig(name=spec.provider, model=spec.model or '')
                        provider_manager.add_provider(cfg)
                        provider_manager.set_active(spec.provider)

                    health = await provider_manager.active.health_check()
                    if not health:
                        await ws.send_text(json.dumps({"event": "error", "payload": {
                            "message": f"Provider '{provider_manager.active.name}' is not reachable."
                        }}))
                    else:
                        run_id = new_run(
                            provider_manager.active.name,
                            getattr(provider_manager.active, 'model', ''),
                            spec.n_personas,
                            spec.goal,
                        )
                        asyncio.create_task(generate_from_spec(spec, run_id))
                        await ws.send_text(json.dumps({"event": "journey.run.started", "payload": {
                            "run_id":     run_id,
                            "n_personas": spec.n_personas,
                            "goal":       spec.goal,
                            "phases":     [ph.phase_type for ph in spec.phases],
                        }}))
                except Exception as e:
                    logger.error(f"[journey.run] {e}")
                    await ws.send_text(json.dumps({"event": "error", "payload": {"message": f"Journey run failed: {e}"}}))

            # ── User config: get ──────────────────────────────────────────
            elif msg_type == "user.config.get":
                try:
                    from backend.modules.user_config import load_config
                    cfg = load_config()
                    await ws.send_text(json.dumps({"event": "user.config", "payload": cfg}))
                except Exception as e:
                    await ws.send_text(json.dumps({"event": "error", "payload": {"message": f"Config load failed: {e}"}}))

            # ── User config: set ──────────────────────────────────────────
            elif msg_type == "user.config.set":
                try:
                    from backend.modules.user_config import load_config, set_username
                    updates = msg.get("payload", {})
                    if "username" in updates:
                        cfg = set_username(updates["username"])
                    else:
                        cfg = load_config()
                    await ws.send_text(json.dumps({"event": "user.config", "payload": cfg}))
                except Exception as e:
                    await ws.send_text(json.dumps({"event": "error", "payload": {"message": f"Config save failed: {e}"}}))

            else:
                await ws.send_text(json.dumps({
                    "event": "error",
                    "payload": {"message": f"Unknown message type: '{msg_type}'"}
                }))

    except WebSocketDisconnect:
        logger.info(f"[WS] Client disconnected: {client_id}")
    finally:
        _ws_clients.discard(ws)
