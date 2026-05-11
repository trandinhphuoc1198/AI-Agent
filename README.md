# AI Agent — Project Overview

## What It Is
A full-stack AI chat agent with tool-calling, RAG (Retrieval-Augmented Generation), and real-time WebSocket streaming.

## Stack
- **Backend**: Python, FastAPI, LangChain (LangGraph `create_agent`), ChromaDB, Uvicorn
- **Frontend**: React (Vite), Tailwind CSS
- **LLM Provider**: OpenRouter (`https://openrouter.ai/api/v1`) via `ChatOpenAI` with `OPENROUTER_API_KEY`
- **Embeddings**: `text-embedding-3-small` via OpenRouter (same key, `OPENAI_API_KEY` field also exists as fallback)
- **Vector DB**: ChromaDB persistent at `chroma_db/` (project root)

## Directory Layout
```
/ (project root)
├── .env                    # secrets & config (never committed)
├── backend/
│   ├── main.py             # FastAPI app, lifespan (RAG startup + watcher), REST + WebSocket endpoints
│   ├── agent.py            # LangGraph agent, per-session history, RAG injection, LLM logging
│   ├── config.py           # Pydantic Settings (ENV_FILE = repo-root .env)
│   ├── requirements.txt
│   ├── tools/
│   │   ├── __init__.py     # ALL_TOOLS registry
│   │   ├── calculator.py   # numexpr-based calculator tool
│   │   ├── file_ops.py     # read/write/list/delete — sandboxed to WORKSPACE_DIR
│   │   ├── shell.py        # run_command with permission gate (bypass | permission mode)
│   │   ├── web_search.py   # DuckDuckGo search (ddgs)
│   │   ├── web_scrape.py   # URL scraper (requests + html2text)
│   │   └── rag_search.py   # search_knowledge_base LangChain tool
│   └── rag/
│       ├── embeddings.py   # OpenAIEmbeddings pointed at OpenRouter
│       ├── chroma_client.py# PersistentClient singleton + get_vectorstore()
│       ├── ingestor.py     # file loaders (.txt/.md/plain read, .pdf/PyPDF), chunking, hash dedup, upsert
│       ├── retriever.py    # similarity_search_with_score → formatted string
│       └── watcher.py      # watchdog Observer watching rag_docs/; on create/modify→ingest, on delete→remove
├── frontend/
│   ├── src/
│   │   ├── api.js          # AgentSocket WebSocket client class
│   │   ├── App.jsx         # top-level state: messages, streaming, permissions, session
│   │   └── components/     # ChatWindow, MessageBubble, ToolCallCard, PermissionModal, SettingsPanel
│   └── vite.config.js      # proxies /api and /ws to http://127.0.0.1:8000
├── rag_docs/               # drop .txt/.md/.pdf here → auto-ingested at startup + live via watcher
├── chroma_db/              # ChromaDB persistent storage (gitignored)
├── workspace/              # file-tools sandbox (agent read/write restricted here)
└── logs/                   # JSONL LLM request/response logs (llm-YYYY-MM-DD.jsonl)
```

## Key Settings (config.py / .env)
| Env var | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | sk-placeholder | LLM + embedding calls |
| `MODEL` | nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free | LangChain model name |
| `CMD_MODE` | permission | shell tool gate: `bypass` or `permission` |
| `WORKSPACE_DIR` | `<root>/workspace` | file_ops sandbox boundary |
| `LOGS_DIR` | `<root>/logs` | LLM JSONL log output |
| `RAG_DOCS_DIR` | `<root>/rag_docs` | watched folder for knowledge base docs |
| `CHROMA_PERSIST_DIR` | `<root>/chroma_db` | ChromaDB storage |
| `RAG_COLLECTION_NAME` | default | ChromaDB collection |
| `RAG_TOP_K` | 5 | chunks returned per query |

## Agent Flow (per turn)
1. Frontend sends `{ type: "message", content }` over WebSocket `/ws/{session_id}`
2. `main.py` dispatches to `run_agent(session_id, content, ws_send)` (async task)
3. `agent.py` calls `rag_retrieve(user_message)` → prepends as `SystemMessage` if non-empty
4. LangGraph agent streams events: `on_chat_model_stream` → `token`, `on_tool_start/end` → `tool_start/tool_end`
5. Shell tool in `permission` mode sends `permission_request` WS event; frontend shows modal; user reply `{ type: "permission_response", approved }` unblocks the gate
6. Turn ends with `{ type: "done" }`

## WebSocket Message Protocol
**Server → Client**: `connected`, `token`, `tool_start`, `tool_end`, `permission_request`, `done`, `error`
**Client → Server**: `message`, `permission_response`

## ALL_TOOLS (registered in tools/__init__.py)
`calculator`, `read_file`, `write_file`, `list_directory`, `delete_file`, `run_command`, `web_search`, `scrape_url`, `search_knowledge_base`

## RAG Pipeline
- **Startup**: lifespan scans `rag_docs/` → ingest only new/changed files (hash-based dedup via `is_file_ingested`)
- **Live**: watchdog watcher runs concurrently; triggers ingest on file create/modify, removes chunks on delete
- **Retrieval**: `retriever.retrieve(query)` → `[Source: path]\nchunk\n\n---\n\n...`
- **Injection**: prepended as SystemMessage before agent run (skipped if KB empty)
- **Tool**: `search_knowledge_base(query)` also available explicitly to the LLM

## Dev Setup
```powershell
# Backend
cd backend
python -m venv .venv && .venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

# Frontend
cd frontend
npm install
npm run dev   # dev server at :5173 proxied to backend :8000
```
Or run `.\run_all.ps1` from project root.

## Tests
- Backend: `pytest backend/tests/` (covers agent, config, tools, RAG ingestor/retriever/search/watcher)
- Frontend: `npm test` in `frontend/` (Vitest, covers all components + api)

## Important Constraints
- `file_ops.py` rejects any path resolving outside `WORKSPACE_DIR` (security boundary)
- Shell permission gate uses `asyncio.Event` + `ContextVar` (session_id_var, ws_send_var) injected per turn
- `config.py` uses `ENV_FILE` module-level variable (tests can monkey-patch it); settings cached as singleton, cleared via `reset_settings()`
- LLM log entries are JSONL appended to `logs/llm-YYYY-MM-DD.jsonl`
