.PHONY: dev test-backend

# Run both backend and frontend with one command
# Assumes backend virtualenv and frontend dependencies are installed
# (start.sh will install frontend deps if missing)
dev:
	./start.sh

# Run backend unit tests
# Usage: make test-backend
# Optional: set VENV to use a specific virtualenv activation command
test-backend:
	cd backend && pytest
