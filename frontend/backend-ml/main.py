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
def get_stock(ticker: str, period: str = Query("1y"), interval: str = Query(None)):
    """Core endpoint: price history + metadata + currency."""
    try:
        return fetch_stock_data(ticker, period=period, interval=interval)
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


@app.get("/api/macro/realtime")
def get_realtime_macro():
    """Real-time macroeconomic feeds: Crude Oil, Gold, 10Y Treasury, VIX, US Dollar Index."""
    import yfinance as yf
    from datetime import datetime

    macro_specs = [
        {"symbol": "CL=F", "name": "WTI Crude Oil", "unit": "$/bbl", "category": "Energy", "description": "Global petroleum benchmark reflecting Middle East geopolitical tensions and supply shocks."},
        {"symbol": "GC=F", "name": "Gold Spot", "unit": "$/oz", "category": "Precious Metals", "description": "Safe haven asset and inflation hedge during currency devaluation and conflict."},
        {"symbol": "^TNX", "name": "US 10Y Treasury Yield", "unit": "%", "category": "Rates", "description": "Benchmark risk-free discount rate dictating equity valuations and borrowing costs."},
        {"symbol": "^VIX", "name": "CBOE Volatility (VIX)", "unit": "pts", "category": "Market Sentiment", "description": "Wall Street fear gauge measuring 30-day forward implied volatility."},
        {"symbol": "DX-Y.NYB", "name": "US Dollar Index (DXY)", "unit": "pts", "category": "Currencies", "description": "Strength of USD against a basket of 6 major global currencies."},
        {"symbol": "^GSPC", "name": "S&P 500 Index", "unit": "pts", "category": "Global Equity", "description": "Core benchmark for US large-cap institutional equity exposure."},
        {"symbol": "^NSEI", "name": "NIFTY 50 Index", "unit": "₹", "category": "Emerging Market", "description": "Benchmark for Indian equity market and foreign institutional inflow sentiment."},
    ]

    results = []
    for spec in macro_specs:
        try:
            t = yf.Ticker(spec["symbol"])
            h = t.history(period="5d")
            if not h.empty:
                last_price = float(h["Close"].iloc[-1])
                prev_price = float(h["Close"].iloc[-2]) if len(h) > 1 else last_price
                change = round(last_price - prev_price, 2)
                change_pct = round((change / prev_price) * 100, 2) if prev_price else 0.0

                signal = "bullish" if change >= 0 else "bearish"
                if spec["symbol"] in ["^VIX", "CL=F", "^TNX"]:
                    # Spikes in VIX or Yields often act as bearish drag on growth equities
                    implication = f"{'Elevated' if change > 0 else 'Subdued'} pressure on growth equities and corporate margins."
                elif spec["symbol"] == "GC=F":
                    implication = f"{'Capital fleeing to safe-havens' if change > 0 else 'Risk-on capital rotation away from safety'}."
                else:
                    implication = f"{'Momentum expansion' if change > 0 else 'Momentum deceleration'} across major liquidity pools."

                results.append({
                    "symbol": spec["symbol"],
                    "name": spec["name"],
                    "unit": spec["unit"],
                    "category": spec["category"],
                    "description": spec["description"],
                    "value": round(last_price, 2),
                    "change": change,
                    "change_pct": change_pct,
                    "signal": signal,
                    "implication": implication,
                    "timestamp": datetime.now().isoformat(),
                })
        except Exception as e:
            continue

    return {
        "timestamp": datetime.now().isoformat(),
        "macro_indicators": results,
        "summary": "Real-time macroeconomic feeds active with live volatility, yields, and commodity pricing.",
    }

