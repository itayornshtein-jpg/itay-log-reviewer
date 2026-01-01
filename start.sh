#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ -d "${ROOT_DIR}/backend/.venv" ]]; then
  # shellcheck source=/dev/null
  source "${ROOT_DIR}/backend/.venv/bin/activate"
fi

(cd "${ROOT_DIR}/backend" && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
BACKEND_PID=$!

cleanup() {
  kill "$BACKEND_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

cd "${ROOT_DIR}/frontend"
npm install
npm run dev -- --host --port 5173
