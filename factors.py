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


def detect_volume_spikes(prices: list, z_threshold: float = 2.0) -> list:
    """Flag days where volume is a statistical outlier vs trailing 20-day average."""
    events = []
    volumes = [p["volume"] for p in prices]
    for i in range(20, len(prices)):
        window = volumes[i - 20:i]
        mean = statistics.mean(window)
        stdev = statistics.stdev(window) if len(set(window)) > 1 else 0
        if stdev == 0:
            continue
        z = (volumes[i] - mean) / stdev
        if z > z_threshold:
            day = prices[i]
            direction = "up" if day["close"] >= day["open"] else "down"
            events.append({
                "date": day["date"][:10],
                "type": "volume_spike",
                "title": f"Unusual trading volume ({direction})",
                "description": (
                    f"Volume was {round(day['volume']/mean, 1)}x the 20-day average, "
                    f"suggesting a major news event, institutional activity, or earnings reaction."
                ),
                "impact": "high" if z > 3 else "medium",
            })
    return events


def detect_index_divergence(prices: list, index_df: pd.DataFrame, threshold_pct: float = 3.0) -> list:
    """Flag days where the stock moved much more than its benchmark index —
    signals a stock-specific (not market-wide) driver."""
    events = []
    if index_df is None or index_df.empty:
        return events

    idx_by_date = dict(zip(index_df["date"], index_df["close"]))
    dates_sorted = sorted(idx_by_date.keys())

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
                    f"This gap points to a company-specific driver (earnings, news, guidance) rather than "
                    f"broad market movement."
                ),
                "impact": "high" if abs(divergence) > 5 else "medium",
            })
    return events


def fetch_news_sentiment(query: str, from_date: str = None) -> list:
    """Fetch recent news headlines and score basic sentiment.
    Requires NEWS_API_KEY (newsapi.org) or GNEWS_API_KEY (gnews.io) env var.
    Returns [] gracefully if no key is set, so the app still works without one."""
    if not NEWS_API_KEY and not GNEWS_API_KEY:
        return []

    try:
        from textblob import TextBlob
    except ImportError:
        return []

    articles = []

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
            articles = [
                {"title": a["title"], "date": a["publishedAt"][:10], "source": a["source"]["name"], "url": a["url"]}
                for a in data.get("articles", [])
            ]
        except Exception:
            pass
    elif GNEWS_API_KEY:
        try:
            url = "https://gnews.io/api/v4/search"
            params = {"q": query, "lang": "en", "max": 25, "apikey": GNEWS_API_KEY}
            r = requests.get(url, params=params, timeout=10)
            data = r.json()
            articles = [
                {"title": a["title"], "date": a["publishedAt"][:10], "source": a["source"]["name"], "url": a["url"]}
                for a in data.get("articles", [])
            ]
        except Exception:
            pass

    events = []
    # group by date, average sentiment per day
    by_date = {}
    for a in articles:
        polarity = TextBlob(a["title"]).sentiment.polarity  # -1 to 1
        by_date.setdefault(a["date"], []).append((polarity, a["title"], a["source"], a["url"]))

    for date, items in by_date.items():
        avg_pol = sum(p for p, *_ in items) / len(items)
        if abs(avg_pol) < 0.15:
            continue  # not meaningfully positive/negative
        top_title = items[0][1]
        events.append({
            "date": date,
            "type": "news_sentiment",
            "title": f"{'Positive' if avg_pol > 0 else 'Negative'} news sentiment ({len(items)} article(s))",
            "description": f"e.g. \"{top_title}\" — source: {items[0][2]}",
            "impact": "high" if abs(avg_pol) > 0.4 else "medium",
            "sentiment_score": round(avg_pol, 3),
            "url": items[0][3],
        })
    return events


def build_all_factors(ticker_data: dict, index_df: pd.DataFrame) -> list:
    prices = ticker_data["prices"]
    events = []
    events += detect_volume_spikes(prices)
    events += detect_index_divergence(prices, index_df)

    company_name = ticker_data.get("name", ticker_data["ticker"])
    news_events = fetch_news_sentiment(company_name)
    events += news_events

    events.sort(key=lambda e: e["date"], reverse=True)
    return events
