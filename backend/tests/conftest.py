import sys
from pathlib import Path

# Ensure the backend/app package is importable when running pytest directly from the backend folder
ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
