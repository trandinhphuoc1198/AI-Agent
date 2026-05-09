from __future__ import annotations

import asyncio
import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import get_settings, reset_settings, update_env_file

logger = logging.getLogger(__name__)

_SUPPORTED_SUFFIXES = {".txt", ".md", ".pdf"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ---------------------------------------------------------------
    # Startup — ingest existing docs, then launch the file watcher
    # ---------------------------------------------------------------
    from rag.ingestor import ingest_file
    from rag.watcher import start_watcher

    settings = get_settings()
    rag_docs_dir = Path(settings.rag_docs_dir)
    rag_docs_dir.mkdir(parents=True, exist_ok=True)

    # Scan and ingest all files already present in rag_docs/
    def _startup_ingest() -> None:
        print(f"Scanning {rag_docs_dir} for files to ingest...")
        for p in rag_docs_dir.rglob("*"):
            if p.is_file() and p.suffix.lower() in _SUPPORTED_SUFFIXES:
                try:
                    print(f"Ingesting {p}...")
                    n = ingest_file(p)
                    logger.info("RAG startup: ingested %d chunk(s) from %s", n, p)
                except Exception as exc:
                    print(f"Error ingesting {p}: {exc}")
                    logger.warning("RAG startup: skipped %s — %s", p, exc)

    # await asyncio.get_event_loop().run_in_executor(None, _startup_ingest)

    observer = await asyncio.get_event_loop().run_in_executor(None, start_watcher)

    yield

    # ---------------------------------------------------------------
    # Shutdown — stop the file watcher
    # ---------------------------------------------------------------
    observer.stop()
    observer.join()
    logger.info("RAG watcher stopped")


app = FastAPI(title="AI Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["GET", "PUT", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------

class ConfigUpdate(BaseModel):
    model: Optional[str] = None
    cmd_mode: Optional[Literal["bypass", "permission"]] = None


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/api/config")
def read_config() -> dict:
    """Return the current public configuration (API key is never exposed)."""
    s = get_settings()
    return {"model": s.model, "cmd_mode": s.cmd_mode}


@app.put("/api/config")
def write_config(update: ConfigUpdate) -> dict:
    """Persist model and/or cmd_mode changes to .env, then reload settings."""
    if update.model is not None:
        update_env_file("MODEL", update.model)
    if update.cmd_mode is not None:
        update_env_file("CMD_MODE", update.cmd_mode)
    reset_settings()
    s = get_settings()
    return {"model": s.model, "cmd_mode": s.cmd_mode}


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

async def _run_agent_safe(
    session_id: str,
    content: str,
    ws_send: Any,
) -> None:
    """Run the agent, catching any unhandled exception into an error event."""
    from agent import run_agent  # local import avoids circular dependency at startup

    try:
        await run_agent(session_id, content, ws_send)
    except Exception as exc:  # noqa: BLE001
        try:
            await ws_send({"type": "error", "content": str(exc)})
        except Exception:
            pass


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    await websocket.send_json({"type": "connected", "session_id": session_id})

    async def ws_send(data: dict) -> None:
        await websocket.send_json(data)

    try:
        while True:
            raw = await websocket.receive_text()
            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type in {"message", "token"}:
                content = msg.get("content", "")
                # Run agent concurrently so the receive loop stays live for
                # permission_response messages during shell permission gates.
                asyncio.create_task(_run_agent_safe(session_id, content, ws_send))

            elif msg_type == "permission_response":
                from tools.shell import resolve_permission
                approved = bool(msg.get("approved", False))
                resolve_permission(session_id, approved)

    except WebSocketDisconnect:
        pass
