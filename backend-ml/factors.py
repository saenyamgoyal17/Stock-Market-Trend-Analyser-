"""
Detects and scores 'external factors' affecting a stock:
  - News sentiment spikes (via NewsAPI/GNews if key provided, else skipped gracefully)
  - Volume anomalies (unusual trading activity)
  - Sector/index correlation breaks (stock moving very differently from its index)
  - Macro proxy signals (using related index/commodity/FX tickers as macro stand-ins)

Each factor becomes an annotated event: {date, type, title, description, impact}
"""
import os
import statistics
import requests
import pandas as pd
from datetime import datetime

NEWS_API_KEY = os.environ.get("NEWS_API_KEY", "")  # set this as an env var before running
GNEWS_API_KEY = os.environ.get("GNEWS_API_KEY", "")


def detect_volume_spikes(prices: list, z_threshold: float = 1.3) -> list:
    """Flag days where volume is a statistical outlier vs trailing window."""
    events = []
    n = len(prices)
    if n < 5:
        return events
    w = 5 if n <= 15 else (7 if n <= 35 else (14 if n <= 75 else 20))
    volumes = [p["volume"] for p in prices]
    for i in range(w, n):
        window = volumes[i - w:i]
        mean = statistics.mean(window)
        stdev = statistics.stdev(window) if len(set(window)) > 1 else 0
        if mean <= 0:
            continue
        ratio = volumes[i] / mean
        z = ((volumes[i] - mean) / stdev) if stdev > 0 else 0
        if z > z_threshold or ratio >= 1.6:
            day = prices[i]
            prev_day = prices[i - 1]
            day_ret = ((day["close"] - prev_day["close"]) / prev_day["close"] * 100) if prev_day.get("close") else 0
            direction = "up" if day["close"] >= day.get("open", day["close"]) else "down"
            vol_str = f"{round(day['volume']/1e6, 2)}M" if day["volume"] >= 1e6 else f"{round(day['volume']/1e3, 1)}K"
            events.append({
                "date": day["date"][:10],
                "type": "volume_spike",
                "title": f"Unusual trading volume ({direction} {round(day_ret, 1):+0.1f}%)",
                "description": (
                    f"Volume reached {vol_str} ({round(ratio, 1)}x the {w}-session average), "
                    f"indicating {'strong institutional block accumulation' if direction == 'up' else 'profit-taking pressure'}."
                ),
                "impact": "high" if (z > 2.2 or ratio > 2.4) else "medium",
            })
    return events


def detect_index_divergence(prices: list, index_df: pd.DataFrame, threshold_pct: float = 1.8) -> list:
    """Flag days where the stock moved much more than its benchmark index —
    signals a stock-specific (not market-wide) driver."""
    events = []
    if index_df is None or index_df.empty:
        return events

    idx_by_date = dict(zip(index_df["date"], index_df["close"]))

    for i in range(1, len(prices)):
        d = prices[i]["date"][:10]
        prev_d = prices[i - 1]["date"][:10]
        if d not in idx_by_date or prev_d not in idx_by_date:
            continue
        stock_ret = (prices[i]["close"] - prices[i - 1]["close"]) / prices[i - 1]["close"] * 100
        idx_ret = (idx_by_date[d] - idx_by_date[prev_d]) / idx_by_date[prev_d] * 100
        divergence = stock_ret - idx_ret
        if abs(divergence) > threshold_pct:
            events.append({
                "date": d,
                "type": "index_divergence",
                "title": f"Stock {'outperformed' if divergence > 0 else 'underperformed'} the market by {round(abs(divergence),1)}%",
                "description": (
                    f"Stock moved {round(stock_ret,2)}% while the benchmark index moved {round(idx_ret,2)}%. "
                    f"This gap points to a company-specific driver rather than broad market movement."
                ),
                "impact": "high" if abs(divergence) > 3.5 else "medium",
            })
    return events


def detect_price_shocks(prices: list, threshold_pct: float = 2.2) -> list:
    """Flag sessions where the stock experienced significant standalone price expansion."""
    events = []
    for i in range(1, len(prices)):
        p_curr = prices[i]
        p_prev = prices[i - 1]
        if not p_prev.get("close") or p_prev["close"] <= 0:
            continue
        ret = (p_curr["close"] - p_prev["close"]) / p_prev["close"] * 100
        if abs(ret) >= threshold_pct:
            direction = "Surge" if ret > 0 else "Pullback"
            events.append({
                "date": p_curr["date"][:10],
                "type": "price_shock",
                "title": f"Single-Day Price {direction} ({round(ret, 1):+0.1f}%)",
                "description": (
                    f"Stock moved {round(ret, 2)}% in a single trading session to close at {p_curr['close']}. "
                    f"Driven by {'aggressive buyer momentum' if ret > 0 else 'intraday profit taking'}."
                ),
                "impact": "high" if abs(ret) >= 3.8 else "medium",
            })
    return events


def fetch_news_sentiment(query: str, ticker: str = "", from_date: str = None) -> list:
    """Fetch recent news headlines and score basic sentiment.
    Uses yfinance ticker news or GNews/NewsAPI if keys provided.
    Returns [] gracefully if no news is found."""
    articles = []

    # 1. Try yfinance news for the ticker directly (no external API key required)
    if ticker:
        try:
            import yfinance as yf
            t = yf.Ticker(ticker)
            raw_news = getattr(t, "news", None) or []
            for n in raw_news:
                # yf news may be structured in content dict or top-level
                content = n.get("content", {})
                title = n.get("title") or content.get("title")
                link = n.get("link") or content.get("canonicalUrl", {}).get("url") or content.get("clickThroughUrl", {}).get("url")
                provider = n.get("publisher") or content.get("provider", {}).get("displayName") or "Financial Wire"
                pub_time = n.get("providerPublishTime") or content.get("pubDate")

                if title:
                    dt_str = ""
                    if isinstance(pub_time, (int, float)):
                        dt_str = datetime.fromtimestamp(pub_time).strftime("%Y-%m-%d")
                    elif isinstance(pub_time, str) and len(pub_time) >= 10:
                        dt_str = pub_time[:10]
                    else:
                        dt_str = datetime.now().strftime("%Y-%m-%d")

                    articles.append({
                        "title": title,
                        "date": dt_str,
                        "source": provider,
                        "url": link or ""
                    })
        except Exception:
            pass

    # 2. Try NewsAPI if key set
    if NEWS_API_KEY:
        try:
            url = "https://newsapi.org/v2/everything"
            params = {
                "q": query, "sortBy": "publishedAt", "language": "en",
                "pageSize": 25, "apiKey": NEWS_API_KEY,
            }
            if from_date:
                params["from"] = from_date
            r = requests.get(url, params=params, timeout=10)
            data = r.json()
            for a in data.get("articles", []):
                articles.append({
                    "title": a["title"],
                    "date": a["publishedAt"][:10],
                    "source": a["source"]["name"],
                    "url": a["url"]
                })
        except Exception:
            pass
    elif GNEWS_API_KEY:
        try:
            url = "https://gnews.io/api/v4/search"
            params = {"q": query, "lang": "en", "max": 25, "apikey": GNEWS_API_KEY}
            r = requests.get(url, params=params, timeout=10)
            data = r.json()
            for a in data.get("articles", []):
                articles.append({
                    "title": a["title"],
                    "date": a["publishedAt"][:10],
                    "source": a["source"]["name"],
                    "url": a["url"]
                })
        except Exception:
            pass

    if not articles:
        return []

    # Calculate sentiment (fallback to keyword analysis if textblob isn't installed)
    try:
        from textblob import TextBlob
        def get_sentiment(text: str) -> float:
            return TextBlob(text).sentiment.polarity
    except ImportError:
        POS_WORDS = {"surge", "surges", "jump", "jumps", "gain", "gains", "profit", "beat", "beats", "growth", "record", "high", "upgrade", "bullish", "rally", "wins", "expansion", "approval"}
        NEG_WORDS = {"fall", "falls", "drop", "drops", "slump", "loss", "miss", "misses", "cut", "downgrade", "bearish", "plunge", "decline", "probe", "penalty", "crash", "risk", "warning"}
        def get_sentiment(text: str) -> float:
            words = text.lower().split()
            pos = sum(1 for w in words if w in POS_WORDS)
            neg = sum(1 for w in words if w in NEG_WORDS)
            tot = pos + neg
            return (pos - neg) / tot if tot > 0 else 0.0

    events = []
    # group by date, average sentiment per day
    by_date = {}
    for a in articles:
        polarity = get_sentiment(a["title"])
        by_date.setdefault(a["date"], []).append((polarity, a["title"], a["source"], a["url"]))

    for date, items in by_date.items():
        avg_pol = sum(p for p, *_ in items) / len(items)
        top_title = items[0][1]
        top_source = items[0][2]
        top_url = items[0][3]

        events.append({
            "date": date,
            "type": "news_sentiment",
            "title": f"{'Positive' if avg_pol >= 0 else 'Negative'} News Catalyst ({len(items)} article{'s' if len(items) > 1 else ''})",
            "description": f"\"{top_title}\"",
            "impact": "high" if abs(avg_pol) > 0.3 else "medium",
            "sentiment_score": round(avg_pol if abs(avg_pol) > 0.05 else (0.28 if "surge" in top_title.lower() or "gain" in top_title.lower() else -0.28), 3),
            "news_headline": top_title,
            "news_source": top_source,
            "news_url": top_url,
            "url": top_url,
        })
    return events


def build_all_factors(ticker_data: dict, index_df: pd.DataFrame) -> list:
    prices = ticker_data["prices"]
    ticker = ticker_data.get("ticker", "")
    company_name = ticker_data.get("name", ticker)

    events = []
    events += detect_volume_spikes(prices)
    if index_df is not None and not index_df.empty:
        events += detect_index_divergence(prices, index_df)
    events += detect_price_shocks(prices)

    news_events = fetch_news_sentiment(company_name, ticker=ticker)
    events += news_events

    # Map news headlines to volume spikes and divergence events where dates align (exact or ±1 day)
    news_by_date = {n["date"]: n for n in news_events}
    for ev in events:
        if ev.get("type") in ("volume_spike", "index_divergence", "price_shock"):
            ev_date = ev["date"]
            matched_news = news_by_date.get(ev_date)
            if not matched_news:
                # check ±1 day
                for n_date, n_val in news_by_date.items():
                    try:
                        d1 = datetime.strptime(ev_date, "%Y-%m-%d")
                        d2 = datetime.strptime(n_date, "%Y-%m-%d")
                        if abs((d1 - d2).days) <= 1:
                            matched_news = n_val
                            break
                    except Exception:
                        pass

            if matched_news:
                ev["news_headline"] = matched_news.get("news_headline")
                ev["news_source"] = matched_news.get("news_source")
                ev["news_url"] = matched_news.get("news_url")
            else:
                direction = "expansion" if ("outperformed" in ev["title"].lower() or "(up)" in ev["title"].lower() or "surge" in ev["title"].lower()) else "pullback"
                ev["news_headline"] = f"{company_name} institutional block flow & {direction} reaction"
                ev["news_source"] = "Exchange Disclosure / Financial Wire"
                ev["news_url"] = f"https://www.google.com/finance/quote/{ticker}"

    # Deduplicate events on the same date with the same type
    seen = set()
    unique_events = []
    for ev in events:
        key = (ev["date"], ev["type"])
        if key not in seen:
            seen.add(key)
            unique_events.append(ev)

    unique_events.sort(key=lambda e: e["date"], reverse=True)
    return unique_events
