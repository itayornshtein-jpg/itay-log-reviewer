# itay-log-reviewer

This repository contains a FastAPI backend and React + Vite frontend scaffold for the Itay Log Reviewer project. Both stacks include linting, formatting, and simple health/UI starters so you can iterate quickly.

## Getting started

### Backend (FastAPI)
1. Create a virtual environment and install dependencies:
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements-dev.txt
   ```
2. Run the development server:
   ```bash
   uvicorn app.main:app --reload
   ```
3. Lint the backend:
   ```bash
   ruff check app
   ```

### Frontend (React + Vite)
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Run the development server:
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
