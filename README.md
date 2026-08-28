# Market Signal — Stock Analyser (EDA Project)

## What this does
- Fetches price history for **any Indian (`.NS`/`.BO`) or foreign stock** in its native currency (yfinance)
- Detects **external factors** affecting price: news sentiment spikes, unusual volume, and divergence from the sector/market index
- Runs **three forecasting models** (ARIMA, Prophet, LSTM) so you can compare classical vs deep-learning approaches — plus a RandomForest **up/down direction classifier** with backtest accuracy
- React dashboard shows factors as **clickable markers directly on the price graph**, plus full cards below it

## Setup

### 1. Backend (Python)
```bash
cd backend
pip install fastapi uvicorn yfinance pandas numpy scikit-learn prophet statsmodels textblob requests python-multipart

# Optional but recommended — for news sentiment factors:
export NEWS_API_KEY="your_key_from_newsapi.org"   # free tier available
# or
export GNEWS_API_KEY="your_key_from_gnews.io"

# Optional — only if you want LSTM forecasts (ARIMA/Prophet work without it):
pip install tensorflow

uvicorn main:app --reload --port 8000
```
Backend runs at `http://localhost:8000`. Test it: open `http://localhost:8000/api/full/AAPL` in a browser.

### 2. Frontend
The React component (`frontend/StockAnalyser.jsx`) is the dashboard artifact — it calls `localhost:8000` directly from the browser. Just make sure the backend is running before you use it.

## Try it
- Foreign: `AAPL`, `MSFT`, `TSLA`, `GOOGL`
- Indian: `RELIANCE.NS`, `TCS.NS`, `INFY.NS`, `HDFCBANK.NS`

## Notes for your report
- **ARIMA**: classical, order (5,1,0), good baseline, explainable
- **Prophet**: handles seasonality/trend decomposition, gives interpretable components
- **LSTM**: deep learning, sequence-based (30-day lookback), needs `tensorflow` — degrades gracefully if not installed
- **Direction classifier**: RandomForest on engineered features (returns, MA5/MA20, momentum, volume change) with an 85/15 backtest split reported to the UI — a good talking point for model evaluation in your EDA writeup
- **Factor detection logic** lives in `factors.py` — it's rule-based/statistical (z-score on volume, % divergence vs index, sentiment polarity via TextBlob), which is good EDA material to explain and justify with your own threshold tuning
