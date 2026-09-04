#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

export OMP_NUM_THREADS=1
export KMP_DUPLICATE_LIB_OK=TRUE

if [ -f ".venv/bin/uvicorn" ]; then
    echo "Starting FastAPI ML backend with Python 3.13 & SOTA Models (XGBoost 3.4.1, LightGBM 4.7.0, CatBoost 1.2.10, PyTorch 2.14.0)..."
    ./.venv/bin/uvicorn main:app --reload --port 8000
else
    echo "Starting with global uvicorn..."
    python3 -m uvicorn main:app --reload --port 8000
fi
