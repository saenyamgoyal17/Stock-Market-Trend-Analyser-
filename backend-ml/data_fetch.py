"""
Handles fetching price data + basic info for any ticker (Indian or foreign),
auto-detecting currency and exchange.
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
    "JIOFIN", "BEL", "HAL", "VEDL", "IRFC", "RVNL", "IOC", "BPCL",
    "TECHM", "DIVISLAB", "DRREDDY", "EICHERMOT", "HEROMOTOCO", "CIPLA",
    "APOLLOHOSP", "SHRIRAMFIN", "INDUSINDBK", "CHOLAFIN", "TRENT", "POLYCAB",
    "DLF", "VBL", "SWIGGY", "DMART", "MOTHERSON", "PIDILITIND", "SIEMENS", "ABB"
}

# Real-world demerger and ticker transition aliases (e.g. Tata Motors demerger, Zomato -> Eternal)
TICKER_ALIASES = {
    "TATAMOTORS": "TMPV.NS",
    "TATAMOTORS.NS": "TMPV.NS",
    "TATAMOTORS.BO": "TMPV.BO",
    "ZOMATO": "ETERNAL.NS",
    "ZOMATO.NS": "ETERNAL.NS",
    "ZOMATO.BO": "ETERNAL.BO",
}


def normalize_ticker(ticker: str) -> str:
    """Allow users to type 'RELIANCE' or 'TCS' and default to NSE if no suffix given
    and it looks like an Indian stock (heuristic: user can also just type AAPL etc.)"""
    t = ticker.strip().upper()
    if t in TICKER_ALIASES:
        return TICKER_ALIASES[t]
    if not (t.endswith(INDIAN_SUFFIXES) or "." in t or t.startswith("^")):
        if t in KNOWN_INDIAN:
            return f"{t}.NS"
    return t


def get_currency_and_exchange(ticker: str, info: dict) -> dict:
    is_indian = ticker.endswith(INDIAN_SUFFIXES) or ticker in KNOWN_INDIAN or ticker in ("TMPV.NS", "ETERNAL.NS", "TMCV.NS")
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


def fetch_stock_data(ticker: str, period: str = "1y", interval: str = None) -> dict:
    target_ticker = normalize_ticker(ticker)

    # Automatically resolve optimal interval based on requested timeframe
    if not interval or interval == "auto":
        if period == "1d":
            interval = "2m"
        elif period in ("5d", "1w"):
            interval = "15m"
        elif period in ("1mo", "3mo", "6mo"):
            interval = "1d"
        elif period in ("1y", "2y"):
            interval = "1d"
        else:
            interval = "1wk"

    t = yf.Ticker(target_ticker)

    # fetch price history first — this is the critical path and shouldn't be
    # blocked by .info (which is a separate, flakier network call)
    try:
        hist = t.history(period=period, interval=interval)
    except Exception as e:
        hist = pd.DataFrame()

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

    if (hist.empty or len(hist) < 10) and target_ticker.endswith(".BO"):
        try:
            ns_cand = target_ticker[:-3] + ".NS"
            t_ns = yf.Ticker(ns_cand)
            h_ns = t_ns.history(period=period, interval=interval)
            if not h_ns.empty and len(h_ns) > len(hist):
                target_ticker = ns_cand
                t = t_ns
                hist = h_ns
        except Exception:
            pass

    if hist.empty:
        raise ValueError(
            f"No data found for ticker '{ticker}'. Check the symbol "
            f"(e.g. 'RELIANCE.NS', 'TCS.NS' for India, 'AAPL', 'MSFT' for US)."
        )

    hist = hist.reset_index()
    date_col = "Date" if "Date" in hist.columns else "Datetime"
    hist["date"] = hist[date_col].dt.strftime("%Y-%m-%d %H:%M:%S")

    info = {}
    try:
        info = t.info or {}
    except Exception:
        try:
            f_info = t.fast_info
            info = {
                "currency": f_info.get("currency"),
                "exchange": f_info.get("exchange"),
                "marketCap": f_info.get("market_cap"),
                "fiftyTwoWeekHigh": f_info.get("year_high"),
                "fiftyTwoWeekLow": f_info.get("year_low"),
            }
        except Exception:
            info = {}

    meta = get_currency_and_exchange(target_ticker, info)

    price_data = []
    total_rows = len(hist)
    for idx_row, (_, row) in enumerate(hist.iterrows()):
        close_val = row["Close"]
        open_val = row["Open"]
        high_val = row["High"]
        low_val = row["Low"]
        vol_val = int(row["Volume"]) if pd.notna(row["Volume"]) else 0

        # If last row (latest trading day) has unfinalized NaN, recover real trade prices from fast_info
        if (pd.isna(close_val) or float(close_val) <= 0) and idx_row == total_rows - 1:
            try:
                f_lp = getattr(t.fast_info, "last_price", None) or info.get("regularMarketPrice") or info.get("currentPrice")
                if f_lp and float(f_lp) > 0:
                    close_val = float(f_lp)
                    open_val = getattr(t.fast_info, "open", None) or open_val or close_val
                    high_val = getattr(t.fast_info, "day_high", None) or high_val or close_val
                    low_val = getattr(t.fast_info, "day_low", None) or low_val or close_val
                    f_vol = getattr(t.fast_info, "last_volume", None)
                    if f_vol and int(f_vol) > 0:
                        vol_val = int(f_vol)
            except Exception:
                pass

        if pd.isna(close_val) or float(close_val) <= 0:
            continue

        dt_val = row[date_col]
        try:
            epoch_ms = int(dt_val.timestamp() * 1000)
        except Exception:
            epoch_ms = int(pd.to_datetime(row["date"]).timestamp() * 1000)
        try:
            iso_str = dt_val.strftime("%Y-%m-%d")
        except Exception:
            iso_str = str(row["date"])[:10]

        price_data.append({
            "time": epoch_ms,
            "date": row["date"],
            "isoDate": iso_str,
            "open": round(float(open_val if pd.notna(open_val) else close_val), 2),
            "high": round(float(high_val if pd.notna(high_val) else close_val), 2),
            "low": round(float(low_val if pd.notna(low_val) else close_val), 2),
            "close": round(float(close_val), 2),
            "volume": vol_val,
        })

    if not price_data:
        raise ValueError(f"Price history for '{ticker}' contains no valid records.")

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
        # ── Fundamental metrics ────────────────────────────────────────────
        "pe_ratio":             _round(info.get("trailingPE")),
        "forward_pe":           _round(info.get("forwardPE")),
        "eps":                  _round(info.get("trailingEps")),
        "fifty_two_week_high":  _round(info.get("fiftyTwoWeekHigh")),
        "fifty_two_week_low":   _round(info.get("fiftyTwoWeekLow")),
        "beta":                 _round(info.get("beta")),
        "analyst_target":       _round(info.get("targetMeanPrice")),
        "recommendation":       info.get("recommendationKey"),
        "dividend_yield":       _round(info.get("dividendYield"), 4),
        "debt_to_equity":       _round(info.get("debtToEquity")),
        "profit_margin":        _round(info.get("profitMargins"), 4),
        # ──────────────────────────────────────────────────────────────────
        "prices": price_data,
    }


def fetch_sector_peers(ticker: str, is_indian: bool) -> list:
    """Return appropriate benchmark indices for the stock's regional exchange."""
    t = (ticker or "").upper().strip()
    if is_indian or t.endswith(INDIAN_SUFFIXES) or t in KNOWN_INDIAN:
        return ["^NSEI", "^BSESN"]  # Nifty 50, Sensex
    if t.endswith(".L"):
        return ["^FTSE", "^GSPC"]   # FTSE 100, S&P 500
    if any(t.endswith(s) for s in [".DE", ".PA", ".AS", ".MI", ".MC", ".BR", ".LS"]):
        return ["^GDAXI", "^STOXX50E", "^GSPC"]  # DAX, Euro Stoxx 50
    if t.endswith((".TO", ".V")):
        return ["^GSPTSE", "^GSPC"]  # TSX
    if t.endswith((".AX", ".AXP")):
        return ["^AXJO", "^GSPC"]   # ASX 200
    if t.endswith((".T", ".TYO")):
        return ["^N225", "^GSPC"]   # Nikkei 225
    return ["^GSPC", "^IXIC", "^DJI"]  # S&P 500, Nasdaq, Dow


def fetch_index_series(index_ticker: str, period: str = "1y") -> pd.DataFrame:
    t = yf.Ticker(index_ticker)
    hist = t.history(period=period)
    if hist.empty:
        raise ValueError(f"No benchmark index data for {index_ticker}")
    hist = hist.reset_index()
    date_col = "Date" if "Date" in hist.columns else "Datetime"
    hist["date"] = hist[date_col].dt.strftime("%Y-%m-%d")
    return hist[["date", "Close"]].rename(columns={"Close": "close"})
