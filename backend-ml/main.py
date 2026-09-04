"""
Run with:  uvicorn main:app --reload --port 8000
Then the React dashboard (running in the browser) calls http://localhost:8000

Optional: set NEWS_API_KEY or GNEWS_API_KEY env var before running to enable
live news sentiment factors. Without it, the app still works — it just skips
that factor type.
"""
import os
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from data_fetch import fetch_stock_data, fetch_sector_peers, fetch_index_series
from factors import build_all_factors
from ml_models import run_all_forecasts

app = FastAPI(title="Stock Market Analyser API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # fine for a local course project
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
ASSETS_DIR = os.path.join(STATIC_DIR, "assets")
if os.path.exists(ASSETS_DIR):
    app.mount("/assets", StaticFiles(directory=ASSETS_DIR), name="assets")
if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def root():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"status": "ok", "message": "Stock Market Analyser API is running"}


@app.get("/api/stock/{ticker}")
def get_stock(ticker: str, period: str = Query("1y")):
    """Core endpoint: price history + metadata + currency."""
    try:
        return fetch_stock_data(ticker, period=period)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")


@app.get("/api/factors/{ticker}")
def get_factors(ticker: str, period: str = Query("1y")):
    """External factors: news sentiment, volume spikes, index divergence."""
    try:
        stock = fetch_stock_data(ticker, period=period)
        peers = fetch_sector_peers(ticker, stock["is_indian"])
        index_df = None
        for peer in peers:
            try:
                index_df = fetch_index_series(peer, period=period)
                break
            except Exception:
                continue
        events = build_all_factors(stock, index_df)
        return {"ticker": ticker, "factors": events, "benchmark_used": peers[0] if peers else None}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")


@app.get("/api/predict/{ticker}")
def get_predictions(ticker: str, period: str = Query("1y"), horizon: int = Query(15)):
    """ML forecasts: ARIMA, Prophet, LSTM + direction classifier."""
    try:
        stock = fetch_stock_data(ticker, period=period)
        results = run_all_forecasts(stock["prices"], horizon=horizon)
        return {"ticker": ticker, "currency_symbol": stock["currency_symbol"], **results}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")


@app.get("/api/full/{ticker}")
def get_full(ticker: str, period: str = Query("1y"), horizon: int = Query(15)):
    """Convenience endpoint: everything in one call (price + factors + predictions).
    Slower, but simplest for the frontend to use."""
    try:
        stock = fetch_stock_data(ticker, period=period)
        peers = fetch_sector_peers(ticker, stock["is_indian"])
        index_df = None
        for peer in peers:
            try:
                index_df = fetch_index_series(peer, period=period)
                break
            except Exception:
                continue
        factors = build_all_factors(stock, index_df)
        predictions = run_all_forecasts(stock["prices"], horizon=horizon)

        return {
            "stock": stock,
            "factors": factors,
            "predictions": predictions,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")
