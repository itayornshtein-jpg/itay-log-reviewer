# itay-log-reviewer

This repository contains a FastAPI backend and React + Vite frontend scaffold for the Itay Log Reviewer project. Both stacks include linting, formatting, and simple health/UI starters so you can iterate quickly.

The backend now accepts `.log`, `.txt`, `.out`, and `.err` uploads, normalizes timestamps/severity/subsystems, and uses an LLM (or a deterministic heuristic fallback) to extract errors, timeframes, failed actions, and failures by system/agent. The frontend provides an upload form and renders the normalized log preview alongside the structured insights.

## Getting started

### Run the full stack with one command
After installing backend and frontend dependencies once, you can launch both services together:
```bash
./start.sh
```
This starts FastAPI on port 8000 and Vite on port 5173 in the same terminal (press Ctrl+C to stop).

### Backend (FastAPI)
1. Create a virtual environment and install dependencies:
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements-dev.txt
   ```
2. Run the development server only:
   ```bash
   uvicorn app.main:app --reload
   ```
3. Lint the backend:
   ```bash
   ruff check app
   ```
4. Run backend tests:
   ```bash
   pytest
   ```

#### Coralogix configuration
- `CORALOGIX_API_KEY` (required): API token used to authenticate requests to Coralogix.
- `CORALOGIX_BASE_URL` (optional): Override the Coralogix API base (defaults to `https://api.coralogix.com/api/v1`).
- `CORALOGIX_WEBHOOK_URL` (optional): Webhook URL you have configured in Coralogix; surfaced in the UI for visibility.

The backend exposes `GET /coralogix/logs` to proxy searches with `system`, `subsystem`, `query`, `page`, and `page_size` filters. Errors from Coralogix are translated into structured HTTP responses for the frontend.

### Frontend (React + Vite)
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Run the development server only:
   ```bash
   npm run dev
   ```
3. Lint the frontend:
   ```bash
   npm run lint
   ```

## Project structure
- `backend/`: FastAPI application with a `/health` endpoint and Ruff configuration.
- `frontend/`: React + Vite app scaffold with ESLint and Prettier.
- `.github/workflows/ci.yml`: CI workflow running linting for both backend and frontend.
- `.gitignore`: Ignores common virtual environment, Node, and editor artifacts.
