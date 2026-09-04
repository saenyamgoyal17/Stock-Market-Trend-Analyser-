"""
Handles fetching price data + basic info for any ticker (Indian or foreign),
auto-detecting currency and exchange.
"""
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta


INDIAN_SUFFIXES = (".NS", ".BO")


def normalize_ticker(ticker: str) -> str:
    """Allow users to type 'RELIANCE' or 'TCS' and default to NSE if no suffix given
    and it looks like an Indian stock (heuristic: user can also just type AAPL etc.)"""
    return ticker.strip().upper()


def get_currency_and_exchange(ticker: str, info: dict) -> dict:
    is_indian = ticker.endswith(INDIAN_SUFFIXES)
    currency = info.get("currency")
    if not currency:
        currency = "INR" if is_indian else "USD"
    exchange = info.get("exchange", "NSE" if is_indian else "UNKNOWN")
    symbol_map = {
        "INR": "₹", "USD": "$", "EUR": "€", "GBP": "£",
        "JPY": "¥", "CNY": "¥", "HKD": "HK$",
    }
    return {
        "currency": currency,
        "currency_symbol": symbol_map.get(currency, currency + " "),
        "exchange": exchange,
        "is_indian": is_indian,
    }


def fetch_stock_data(ticker: str, period: str = "1y", interval: str = "1d") -> dict:
    ticker = normalize_ticker(ticker)
    t = yf.Ticker(ticker)

    # fetch price history first — this is the critical path and shouldn't be
    # blocked by .info (which is a separate, flakier network call)
    try:
        hist = t.history(period=period, interval=interval)
    except Exception as e:
        raise ValueError(f"Could not fetch price data for '{ticker}': {e}")

    if hist.empty:
        raise ValueError(f"No data found for ticker '{ticker}'. Check the symbol "
                          f"(e.g. 'RELIANCE.NS', 'TCS.NS' for India, 'AAPL', 'MSFT' for US).")

    hist = hist.reset_index()
    date_col = "Date" if "Date" in hist.columns else "Datetime"
    hist["date"] = hist[date_col].dt.strftime("%Y-%m-%d %H:%M:%S")

    info = {}
    try:
        info = t.info or {}
    except Exception:
        info = {}

    meta = get_currency_and_exchange(ticker, info)

    price_data = [
        {
            "date": row["date"],
            "open": round(float(row["Open"]), 2),
            "high": round(float(row["High"]), 2),
            "low": round(float(row["Low"]), 2),
            "close": round(float(row["Close"]), 2),
            "volume": int(row["Volume"]) if pd.notna(row["Volume"]) else 0,
        }
        for _, row in hist.iterrows()
    ]

    latest = price_data[-1]
    prev = price_data[-2] if len(price_data) > 1 else latest
    change = latest["close"] - prev["close"]
    change_pct = (change / prev["close"] * 100) if prev["close"] else 0

    def _round(v, n=2):
        try:
            return round(float(v), n) if v is not None else None
        except (TypeError, ValueError):
            return None

    return {
        "ticker": ticker,
        "name": info.get("longName", info.get("shortName", ticker)),
        "sector": info.get("sector", "N/A"),
        "industry": info.get("industry", "N/A"),
        "currency": meta["currency"],
        "currency_symbol": meta["currency_symbol"],
        "exchange": meta["exchange"],
        "is_indian": meta["is_indian"],
        "current_price": latest["close"],
        "change": round(change, 2),
        "change_pct": round(change_pct, 2),
        "market_cap": info.get("marketCap"),
        # ── Fundamental metrics ────────────────────────────────────────────
        "pe_ratio":             _round(info.get("trailingPE")),
        "forward_pe":           _round(info.get("forwardPE")),
        "eps":                  _round(info.get("trailingEps")),
        "fifty_two_week_high":  _round(info.get("fiftyTwoWeekHigh")),
        "fifty_two_week_low":   _round(info.get("fiftyTwoWeekLow")),
        "beta":                 _round(info.get("beta")),
        "analyst_target":       _round(info.get("targetMeanPrice")),
        "recommendation":       info.get("recommendationKey"),          # e.g. "buy", "hold"
        "dividend_yield":       _round(info.get("dividendYield"), 4),   # e.g. 0.0058 → 0.58 %
        "debt_to_equity":       _round(info.get("debtToEquity")),
        "profit_margin":        _round(info.get("profitMargins"), 4),
        # ──────────────────────────────────────────────────────────────────
        "prices": price_data,
    }


def fetch_sector_peers(ticker: str, is_indian: bool) -> list:
    """Return a small set of index/sector tickers to compare volume & correlation against."""
    if is_indian:
        return ["^NSEI", "^BSESN"]  # Nifty 50, Sensex
    return ["^GSPC", "^DJI", "^IXIC"]  # S&P500, Dow, Nasdaq


def fetch_index_series(index_ticker: str, period: str = "1y") -> pd.DataFrame:
    t = yf.Ticker(index_ticker)
    hist = t.history(period=period)
    hist = hist.reset_index()
    date_col = "Date" if "Date" in hist.columns else "Datetime"
    hist["date"] = hist[date_col].dt.strftime("%Y-%m-%d")
    return hist[["date", "Close"]].rename(columns={"Close": "close"})
