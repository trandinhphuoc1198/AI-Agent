# Backend — AI Agent

This folder contains the FastAPI backend for the AI Agent application. The server exposes a small REST API for configuration and a WebSocket endpoint that powers a LangChain-based, tool-calling agent with streaming responses.

## Key files

- [backend/main.py](backend/main.py#L1-L400): FastAPI app, REST config endpoints and WebSocket endpoint `/ws/{session_id}`.
- [backend/agent.py](backend/agent.py#L1-L400): LangChain agent runtime, per-session chat history, and streaming event logic.
- [backend/config.py](backend/config.py#L1-L400): Settings management and helper to persist `.env` values.
- [backend/requirements.txt](backend/requirements.txt#L1-L200): Python dependencies used by the backend.

## Overview

Features:

- REST endpoints
  - `GET /api/config` — returns public config (`model`, `cmd_mode`).
  - `PUT /api/config` — update `MODEL` and/or `CMD_MODE` (persists to the repository `.env`).
- WebSocket endpoint
  - `ws://<host>:<port>/ws/{session_id}` — real-time agent interaction with streaming tokens and tool events.
- Agent
  - Implemented in `agent.py` using `langchain` and `langchain_openai` (OpenRouter base URL). Tools are imported from `backend/tools` and provided to the agent as `ALL_TOOLS`.

Message flow (WebSocket)

- Client -> Server
  - `{"type": "message", "content": "..."}` — ask the agent a question.
  - `{"type": "permission_response", "approved": true|false}` — respond to a shell permission gate.
- Server -> Client (examples emitted by the agent)
  - `{"type": "connected", "session_id": "..."}` — initial connection ack.
  - `{"type": "token", "content": "..."}` — streaming text chunk from the LLM.
  - `{"type": "tool_start", "tool": "name", "input": {...}}` — tool invocation began.
  - `{"type": "tool_end", "tool": "name", "output": "..."}` — tool invocation finished.
  - `{"type": "error", "content": "..."}` — unhandled exception or failure.
  - `{"type": "done"}` — turn complete.

## Environment / configuration

The backend uses a `.env` file located at the project root (one level above `backend/`). The following environment variables are recognized:

- `OPENROUTER_API_KEY` — API key for the OpenRouter provider (required for LLM calls).
- `MODEL` — model identifier (defaults to the value in `config.py`).
- `CMD_MODE` — `permission` (default) or `bypass` (controls shell permission gating).

Example `.env` (project root):

```
OPENROUTER_API_KEY=sk-...
MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free
CMD_MODE=permission
```

`config.py` exposes `get_settings()` and `update_env_file()` helpers. The REST `PUT /api/config` endpoint uses `update_env_file()` to persist changes and then reloads settings so changes take effect immediately.

## Quickstart (backend)

From the `backend` directory:

Windows (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Unix / macOS:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Notes:

- If you prefer to run from the repository root, use `uvicorn backend.main:app` instead of `main:app`.
- The FastAPI CORS middleware currently allows `http://localhost:5173` and `http://127.0.0.1:5173` (the default Vite dev server used by the frontend).

## Config API examples

Read config:

```bash
curl http://127.0.0.1:8000/api/config
```

Update model or cmd_mode:

```bash
curl -X PUT http://127.0.0.1:8000/api/config \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","cmd_mode":"bypass"}'
```

## Running tests

From the `backend` directory run:

```bash
pytest -v --asyncio-mode=auto
```

If you run into network-dependent tests, you may temporarily skip them, or set necessary credentials in the `.env`.

## Troubleshooting

- If you receive authentication errors from the LLM provider, confirm `OPENROUTER_API_KEY` is set in the project root `.env`.
- If the frontend cannot connect to the WebSocket, verify the CORS origins and host/port in the `uvicorn` command.

## Where to look next

- `backend/main.py` — WebSocket handshake and message routing.
- `backend/agent.py` — streaming agent implementation and tool events.
- `backend/tools/` — implementations of available tools used by the agent.

If you'd like, I can also:

- Add a short example WebSocket client snippet.
- Expand the tools section to list available tool names and their responsibilities.
