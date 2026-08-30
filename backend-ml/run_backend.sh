#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

if [ -f ".venv/bin/uvicorn" ]; then
    echo "Starting FastAPI ML backend using Python 3.12 & XGBoost 3.4.1..."
    ./.venv/bin/uvicorn main:app --reload --port 8000
else
    echo "Starting with global uvicorn..."
    python3 -m uvicorn main:app --reload --port 8000
fi
