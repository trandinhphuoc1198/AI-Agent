# AI Agent — Frontend

This folder contains the React + Vite frontend for the AI Agent project.

**Overview**
- Dev server: Vite (default port `5173`).
- WebSocket endpoint: `/ws/{sessionId}` (proxied to the backend in development).
- REST API endpoints used under `/api` (also proxied to the backend).

See configuration: [vite.config.js](vite.config.js#L1-L200) and client socket at [src/api.js](src/api.js#L1-L200).

**Prerequisites**
- Node.js (16+ recommended) and `npm`.
- Python 3.10+ for the backend and its dependencies (see `backend/requirements.txt`).

## Quick Start (development)
Run the backend first, then start the frontend dev server.

1) Start the backend (example — Windows PowerShell):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

Or macOS / Linux:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```

The backend exposes the WebSocket endpoint at `/ws/{sessionId}` (see [backend/main.py](../backend/main.py#L1-L200)). Vite is configured to proxy `/ws` and `/api` to `localhost:8000` during development (see [vite.config.js](vite.config.js#L1-L200)).

2) Start the frontend dev server:

```bash
cd frontend
npm install
npm run dev
```

Open the app at: http://localhost:5173

## Build & Preview

```bash
cd frontend
npm run build
npm run preview
```

This produces a `dist/` folder you can serve with any static hosting solution or integrate into a backend server.

## Tests

Run unit tests with Vitest:

```bash
npm run test
npm run test:watch
npm run test:ui
npm run test:coverage
```

## How the frontend talks to the backend
- The frontend `AgentSocket` (see [src/api.js](src/api.js#L1-L200)) opens a WebSocket to `/ws/{sessionId}` on the same origin.
- During development, Vite proxies `/ws` to `ws://localhost:8000` so the frontend can use the same origin (`localhost:5173`) while the backend runs on port `8000`.
- If you change the backend port or host, update `server.proxy` in [vite.config.js](vite.config.js#L1-L200) or serve the built frontend from the same origin as the backend.

## Troubleshooting
- WebSocket stays disconnected: confirm the backend is running on port `8000` and `uvicorn` shows no errors.
- CORS / proxy issues: check `vite.config.js` proxy and `backend/main.py` CORS allowlist.

## Helpful Links
- Package scripts: [package.json](package.json#L1-L60)
- Vite config (proxy): [vite.config.js](vite.config.js#L1-L200)
- WebSocket client: [src/api.js](src/api.js#L1-L200)

---

If you'd like, I can also add a short `frontend/.env.example` or update documentation to include how to run everything in one script/docker-compose. Let me know which you'd prefer.