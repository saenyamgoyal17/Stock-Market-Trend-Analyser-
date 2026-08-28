"""
Handles fetching price data + basic info for any ticker (Indian or foreign),
auto-detecting currency and exchange with smart NSE/BSE fallback.
"""
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta

INDIAN_SUFFIXES = (".NS", ".BO")

# Common Indian bluechips that might be requested without .NS suffix
KNOWN_INDIAN = {
    "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "BHARTIARTL",
    "ITC", "KOTAKBANK", "LT", "HINDUNILVR", "AXISBANK", "BAJFINANCE", "MARUTI",
    "ASIANPAINT", "TITAN", "SUNPHARMA", "TATAMOTORS", "WIPRO", "HCLTECH",
    "NTPC", "POWERGRID", "ONGC", "COALINDIA", "TATASTEEL", "JSWSTEEL",
    "ADANIENT", "ADANIPORTS", "BAJAJFINSV", "NESTLEIND", "ULTRACEMCO",
    "GRASIM", "HINDZINC", "BSE", "CDSL", "ZOMATO", "PAYTM", "NYKAA",
    "JIOFIN", "BEL", "HAL", "VEDL", "IRFC", "RVNL", "IOC", "BPCL"
}


def normalize_ticker(ticker: str) -> str:
    t = ticker.strip().upper()
    if not (t.endswith(INDIAN_SUFFIXES) or "." in t or t.startswith("^")):
        if t in KNOWN_INDIAN:
            return f"{t}.NS"
    return t


def get_currency_and_exchange(ticker: str, info: dict) -> dict:
    is_indian = ticker.endswith(INDIAN_SUFFIXES) or ticker in KNOWN_INDIAN
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
    target_ticker = normalize_ticker(ticker)
    t = yf.Ticker(target_ticker)

    try:
        hist = t.history(period=period, interval=interval)
    except Exception:
        hist = pd.DataFrame()

    # Smart fallback for Indian tickers without suffix if first try returned empty
    if hist.empty and not target_ticker.endswith(INDIAN_SUFFIXES) and "." not in target_ticker:
        for suffix in [".NS", ".BO"]:
            try:
                candidate = f"{target_ticker}{suffix}"
                t_cand = yf.Ticker(candidate)
                h_cand = t_cand.history(period=period, interval=interval)
                if not h_cand.empty:
                    target_ticker = candidate
                    t = t_cand
                    hist = h_cand
                    break
            except Exception:
                continue

    if hist.empty:
        raise ValueError(
            f"No data found for ticker '{ticker}'. Check the symbol "
            f"(e.g. 'RELIANCE.NS', 'TCS.NS' for India, 'AAPL', 'NVDA' for US)."
        )

    hist = hist.reset_index()
    date_col = "Date" if "Date" in hist.columns else "Datetime"
    hist["date"] = hist[date_col].dt.strftime("%Y-%m-%d")

    info = {}
    try:
        info = t.info or {}
    except Exception:
        info = {}

    meta = get_currency_and_exchange(target_ticker, info)

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
        if pd.notna(row["Close"]) and float(row["Close"]) > 0
    ]

    if not price_data:
        raise ValueError(f"Price history for '{ticker}' contains no valid records.")

    latest = price_data[-1]
    prev = price_data[-2] if len(price_data) > 1 else latest
    change = latest["close"] - prev["close"]
    change_pct = (change / prev["close"] * 100) if prev["close"] else 0

    return {
        "ticker": target_ticker,
        "name": info.get("longName", info.get("shortName", target_ticker)),
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
        "prices": price_data,
    }


def fetch_sector_peers(ticker: str, is_indian: bool) -> list:
    if is_indian or ticker.endswith(INDIAN_SUFFIXES) or ticker in KNOWN_INDIAN:
        return ["^NSEI", "^BSESN"]
    return ["^GSPC", "^DJI", "^IXIC"]


def fetch_index_series(index_ticker: str, period: str = "1y") -> pd.DataFrame:
    t = yf.Ticker(index_ticker)
    hist = t.history(period=period)
    if hist.empty:
        raise ValueError(f"No benchmark index data for {index_ticker}")
    hist = hist.reset_index()
    date_col = "Date" if "Date" in hist.columns else "Datetime"
    hist["date"] = hist[date_col].dt.strftime("%Y-%m-%d")
    return hist[["date", "Close"]].rename(columns={"Close": "close"})
