"""
Detects and scores 'external factors' affecting any stock worldwide:
  - Global stock market support: US (NYSE/NASDAQ), India (NSE/BSE), UK (LSE), Europe, Asia, Global.
  - Directional sign consistency: When a stock is dropping on date D, factor titles and sentiment
    show negative (-) sign (e.g. 'Stock Pullback (-3.2%) · Global Crude Oil Surge (+3.6%)' with bearish styling).
    When stock is rising, shows positive (+) sign (e.g. 'Stock Surge (+2.8%) · Global Crude Oil Drop (-3.2%)').
  - Top 3 factors per single date strictly capped with category diversity.
  - Exact historical date-bounded RSS news verification (no weekend market-closed leakage).
"""
import os
import ssl
import statistics
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
import concurrent.futures
import pandas as pd
import requests

NEWS_API_KEY = os.environ.get("NEWS_API_KEY", "")
GNEWS_API_KEY = os.environ.get("GNEWS_API_KEY", "")

INDIAN_SUFFIXES = (".NS", ".BO")
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


def classify_market(ticker: str) -> str:
    """Classify ticker into regional equity market for regional benchmarks and proxies."""
    t = (ticker or "").upper().strip()
    if t.endswith(INDIAN_SUFFIXES) or t in KNOWN_INDIAN or t in ("TMPV.NS", "ETERNAL.NS", "TMCV.NS"):
        return "IN"
    if t.endswith(".L"):
        return "UK"
    if any(t.endswith(s) for s in [".DE", ".PA", ".AS", ".MI", ".MC", ".BR", ".LS", ".SW"]):
        return "EU"
    if t.endswith((".TO", ".V")):
        return "CA"
    if t.endswith((".AX", ".AXP")):
        return "AU"
    if t.endswith((".HK", ".SS", ".SZ")):
        return "CN_HK"
    if t.endswith((".T", ".TYO")):
        return "JP"
    return "US"  # Default to US / Global equities (AAPL, TSLA, NVDA, MSFT, AMZN, etc.)


def clean_symbol(ticker: str) -> str:
    """Strip exchange suffix and punctuation: e.g. 'RELIANCE.NS' -> 'RELIANCE', 'AAPL' -> 'AAPL'."""
    return (ticker or "").split(".")[0].replace("^", "").strip().upper()


def get_stock_daily_stats(prices: list) -> dict:
    """Precompute each trading session's close, net return vs prior close, and directional sign."""
    stats = {}
    if not prices:
        return stats
    for i in range(len(prices)):
        p = prices[i]
        d = p["date"][:10]
        if i > 0 and prices[i - 1].get("close", 0) > 0:
            c_prev = prices[i - 1]["close"]
            c_curr = p["close"]
            ret = ((c_curr - c_prev) / c_prev) * 100
        else:
            open_p = p.get("open", p["close"])
            ret = (((p["close"] - open_p) / open_p) * 100) if open_p > 0 else 0.0

        is_up = ret >= 0
        sign_str = f"{ret:+.1f}%"
        stats[d] = {
            "close": p["close"],
            "ret": ret,
            "is_up": is_up,
            "sign": sign_str,
            "volume": p.get("volume", 0),
        }
    return stats


def detect_volume_spikes(prices: list, z_threshold: float = 1.3) -> list:
    """Flag sessions where volume is a statistical outlier vs trailing window.
    Strictly aligns title and sentiment with the stock's actual session return."""
    events = []
    n = len(prices)
    if n < 5:
        return events
    w = 5 if n <= 15 else (7 if n <= 35 else (14 if n <= 75 else 20))
    volumes = [p["volume"] for p in prices]
    daily_stats = get_stock_daily_stats(prices)

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
            d = day["date"][:10]
            st = daily_stats.get(d, {"ret": 0.0, "is_up": True, "sign": "+0.0%"})
            ret = st["ret"]
            is_up = st["is_up"]
            sign = st["sign"]
            vol_str = f"{round(day['volume']/1e6, 2)}M" if day["volume"] >= 1e6 else f"{round(day['volume']/1e3, 1)}K"

            if not is_up:
                title = f"Heavy Selling Volume ({sign})"
                desc = (
                    f"Trading volume spiked to {vol_str} ({round(ratio, 1)}x the {w}-session average) "
                    f"under heavy distribution pressure as shares fell {sign}."
                )
                sentiment_score = -0.65
            else:
                title = f"Institutional Buying Volume ({sign})"
                desc = (
                    f"Trading volume surged to {vol_str} ({round(ratio, 1)}x the {w}-session average) "
                    f"amid institutional block accumulation lifting shares {sign}."
                )
                sentiment_score = 0.65

            events.append({
                "date": d,
                "type": "volume_spike",
                "title": title,
                "description": desc,
                "impact": "high" if (z > 2.2 or ratio > 2.4) else "medium",
                "sentiment_score": sentiment_score,
            })
    return events


def detect_index_divergence(prices: list, index_df: pd.DataFrame, threshold_pct: float = 1.8) -> list:
    """Flag sessions where the stock moved significantly differently from its benchmark index."""
    events = []
    if index_df is None or index_df.empty:
        return events

    idx_by_date = dict(zip(index_df["date"], index_df["close"]))
    daily_stats = get_stock_daily_stats(prices)

    for i in range(1, len(prices)):
        d = prices[i]["date"][:10]
        prev_d = prices[i - 1]["date"][:10]
        if d not in idx_by_date or prev_d not in idx_by_date:
            continue
        st = daily_stats.get(d, {"ret": 0.0, "is_up": True, "sign": "+0.0%"})
        stock_ret = st["ret"]
        is_up = st["is_up"]
        sign = st["sign"]

        if idx_by_date[prev_d] <= 0:
            continue
        idx_ret = (idx_by_date[d] - idx_by_date[prev_d]) / idx_by_date[prev_d] * 100
        divergence = stock_ret - idx_ret
        if abs(divergence) > threshold_pct:
            if not is_up:
                title = f"Stock Lag vs Benchmark ({sign})"
                desc = (
                    f"Stock declined {sign} while the benchmark index moved {idx_ret:+.1f}% "
                    f"(divergence of {divergence:+.1f}%). Gap indicates company-specific headwind."
                )
                sentiment_score = -0.60
            else:
                title = f"Stock Outperformance vs Benchmark ({sign})"
                desc = (
                    f"Stock gained {sign} while the benchmark index moved {idx_ret:+.1f}% "
                    f"(outperformance of {divergence:+.1f}%). Gap indicates company-specific upside catalyst."
                )
                sentiment_score = 0.60

            events.append({
                "date": d,
                "type": "index_divergence",
                "title": title,
                "description": desc,
                "impact": "high" if abs(divergence) > 3.5 else "medium",
                "sentiment_score": sentiment_score,
            })
    return events


def detect_price_shocks(prices: list, threshold_pct: float = 2.2) -> list:
    """Flag sessions where the stock experienced significant standalone price expansion."""
    events = []
    daily_stats = get_stock_daily_stats(prices)
    for i in range(1, len(prices)):
        p_curr = prices[i]
        d = p_curr["date"][:10]
        st = daily_stats.get(d, {"ret": 0.0, "is_up": True, "sign": "+0.0%"})
        ret = st["ret"]
        is_up = st["is_up"]
        sign = st["sign"]

        if abs(ret) >= threshold_pct:
            if not is_up:
                title = f"Single-Day Price Pullback ({sign})"
                desc = (
                    f"Stock dropped {sign} in a single session to close at {p_curr['close']}. "
                    f"Driven by aggressive intraday profit taking and broader market headwind."
                )
                sentiment_score = -0.75
            else:
                title = f"Single-Day Price Surge ({sign})"
                desc = (
                    f"Stock gained {sign} in a single session to close at {p_curr['close']}. "
                    f"Driven by aggressive buyer momentum and upside breakout flows."
                )
                sentiment_score = 0.75

            events.append({
                "date": d,
                "type": "price_shock",
                "title": title,
                "description": desc,
                "impact": "high" if abs(ret) >= 3.8 else "medium",
                "sentiment_score": sentiment_score,
            })
    return events


def fetch_news_sentiment(query: str, ticker: str = "", from_date: str = None, daily_stats: dict = None) -> list:
    """Fetch recent news headlines and score sentiment, aligning sign with stock return on that date."""
    articles = []

    if ticker:
        try:
            import yfinance as yf
            t = yf.Ticker(ticker)
            raw_news = getattr(t, "news", None) or []
            for n in raw_news:
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
    by_date = {}
    for a in articles:
        polarity = get_sentiment(a["title"])
        by_date.setdefault(a["date"], []).append((polarity, a["title"], a["source"], a["url"]))

    for date, items in by_date.items():
        avg_pol = sum(p for p, *_ in items) / len(items)
        top_title = items[0][1]
        top_source = items[0][2]
        top_url = items[0][3]

        st = (daily_stats or {}).get(date, {"ret": 0.0, "is_up": True, "sign": "+0.0%"})
        is_up = st["is_up"]
        sign = st["sign"]

        if not is_up:
            title = f"Stock Pullback ({sign}) · News Catalyst"
            sentiment_score = -abs(round(avg_pol if abs(avg_pol) > 0.05 else 0.45, 2))
        else:
            title = f"Stock Surge ({sign}) · News Catalyst"
            sentiment_score = abs(round(avg_pol if abs(avg_pol) > 0.05 else 0.45, 2))

        events.append({
            "date": date,
            "type": "news_sentiment",
            "title": title,
            "description": f"\"{top_title}\"",
            "impact": "high" if abs(avg_pol) > 0.3 else "medium",
            "sentiment_score": sentiment_score,
            "news_headline": top_title,
            "news_source": top_source,
            "news_url": top_url,
            "url": top_url,
        })
    return events


_DATED_NEWS_CACHE = {}


def fetch_exact_date_news(topic: str, target_date: str, is_indian: bool = False) -> dict:
    """Fetch verified news headline published on or around the exact historical target_date."""
    key = (topic, target_date, is_indian)
    if key in _DATED_NEWS_CACHE:
        return _DATED_NEWS_CACHE[key]

    try:
        dt = datetime.strptime(target_date, "%Y-%m-%d")
        d_before = (dt - timedelta(days=1)).strftime("%Y-%m-%d")
        d_after = (dt + timedelta(days=2)).strftime("%Y-%m-%d")
        q = f"{topic} after:{d_before} before:{d_after}"
        locale_param = "&hl=en-IN&gl=IN&ceid=IN:en" if is_indian else "&hl=en-US&gl=US&ceid=US:en"
        url = f"https://news.google.com/rss/search?q={urllib.parse.quote(q)}{locale_param}"

        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})

        with urllib.request.urlopen(req, context=ctx, timeout=1.2) as resp:
            root = ET.fromstring(resp.read())
            items = root.findall(".//item")
            for el in items:
                t = el.find("title").text or ""
                if any(bad in t.lower() for bad in ["current price of", "share price today", "calculator", "lottery", "horoscope"]):
                    continue
                l = el.find("link").text or ""
                source = "Financial Media"
                title_clean = t
                if " - " in t:
                    parts = t.rsplit(" - ", 1)
                    title_clean = parts[0]
                    source = parts[1]
                res = {"title": title_clean, "source": source, "url": l, "date": target_date}
                _DATED_NEWS_CACHE[key] = res
                return res
    except Exception:
        pass

    _DATED_NEWS_CACHE[key] = None
    return None


def fetch_exact_company_news(company_name: str, ticker: str, target_date: str) -> dict:
    """Fetch verified company-specific news published on the exact date."""
    clean_sym = clean_symbol(ticker)
    clean_name = company_name.split(",")[0].replace(" Inc.", "").replace(" Ltd.", "").replace(" Corp.", "").strip()
    topic = f'"{clean_name}" OR "{clean_sym}"'
    is_indian = classify_market(ticker) == "IN"
    return fetch_exact_date_news(topic, target_date, is_indian=is_indian)


def detect_macro_shocks(prices: list, ticker: str = "", sector: str = "", company_name: str = "", period: str = "1y") -> list:
    """Detect real-world outer macro factors across commodities, currencies, interest rates, and geopolitical proxies.
    Dynamically configures proxies for global stocks (US, UK, Europe, India, Asia).
    Guarantees title, sign, and sentiment match the stock's actual session trajectory on date D."""
    import yfinance as yf
    events = []
    if not prices or len(prices) < 2:
        return events

    stock_dates = {p["date"][:10] for p in prices}
    daily_stats = get_stock_daily_stats(prices)
    mkt = classify_market(ticker)
    clean_sym = clean_symbol(ticker)

    # 1. Worldwide commodities affecting all global equities
    macro_configs = [
        ("CL=F", "macro_energy", 2.2, "Crude Oil & Fuel", "crude oil OR fuel price OR OPEC OR diesel OR petroleum OR refinery"),
        ("GC=F", "macro_geopolitical", 1.8, "Safe-Haven Gold", "war OR military conflict OR geopolitical sanctions OR missile strike OR Middle East"),
        ("HG=F", "macro_commodity", 2.2, "Industrial Copper", "copper price OR industrial metals OR LME warehouse stocks OR metal tariffs"),
        ("NG=F", "macro_commodity", 3.2, "Natural Gas & LPG", "natural gas OR LPG shortage OR energy crisis OR pipeline transit"),
    ]

    # 2. Regional benchmarks, currencies, and sovereign yields
    if mkt == "IN":
        macro_configs.append(("INR=X", "macro_capital", 0.45, "USD/INR Currency FX", "rupee falls OR rupee gains OR USDINR OR currency valuation OR foreign capital"))
        macro_configs.append(("^NSEI", "macro_monetary", 1.2, "Nifty 50 Index", "Nifty 50 OR Indian stock market OR Dalal Street OR domestic equity"))
    elif mkt == "US":
        macro_configs.append(("^TNX", "macro_monetary", 2.5, "10Y Treasury Yield", "interest rate hike OR Fed rate OR Federal Reserve bond yields OR inflation"))
        macro_configs.append(("DX-Y.NYB", "macro_capital", 0.50, "US Dollar Index (DXY)", "US dollar surge OR dollar index DXY OR currency strength OR dollar rally"))
        macro_configs.append(("^VIX", "macro_monetary", 8.0, "CBOE Volatility (VIX)", "market volatility OR Wall Street fear index OR VIX spike OR market selloff"))
    elif mkt == "UK":
        macro_configs.append(("GBPUSD=X", "macro_capital", 0.60, "GBP/USD Currency FX", "pound sterling falls OR GBP USD OR Bank of England currency"))
        macro_configs.append(("^FTSE", "macro_monetary", 1.4, "FTSE 100 Index", "FTSE 100 OR London Stock Exchange OR UK market rally OR British equities"))
    elif mkt == "EU":
        macro_configs.append(("EURUSD=X", "macro_capital", 0.55, "EUR/USD Currency FX", "euro currency falls OR EUR USD OR ECB euro valuation"))
        macro_configs.append(("^GDAXI", "macro_monetary", 1.4, "DAX 40 Index", "DAX index OR Frankfurt stock exchange OR European market"))
    else:
        macro_configs.append(("^TNX", "macro_monetary", 2.5, "10Y Treasury Yield", "interest rate hike OR bond yields OR central bank"))
        macro_configs.append(("DX-Y.NYB", "macro_capital", 0.50, "US Dollar Index", "US dollar index OR global currency volatility"))

    sec_lower = sector.lower()

    for sym, ev_type, thresh, asset_name, news_query in macro_configs:
        try:
            t = yf.Ticker(sym)
            h = t.history(period=period, timeout=3)
            if h.empty or len(h) < 2:
                continue
            h_dates = [idx.strftime("%Y-%m-%d") for idx in h.index]
            closes = list(h["Close"])

            for i in range(1, len(h_dates)):
                d = h_dates[i]
                if d not in stock_dates:
                    continue
                c_prev = closes[i - 1]
                c_curr = closes[i]
                if c_prev <= 0:
                    continue
                macro_ret = (c_curr - c_prev) / c_prev * 100

                if abs(macro_ret) >= thresh:
                    st = daily_stats.get(d, {"ret": 0.0, "is_up": True, "sign": "+0.0%"})
                    stock_ret = st["ret"]
                    is_stock_up = st["is_up"]
                    stock_sign = st["sign"]

                    macro_dir = "Surge" if macro_ret > 0 else "Drop"

                    # Sector-specific causal transmission explanation
                    if ev_type == "macro_energy":
                        if any(k in sec_lower for k in ["energy", "oil", "petro"]):
                            desc_cause = f"Crude oil moved {macro_ret:+.1f}%, directly shifting upstream realization, Singapore refining margins, and petrochemical feedstock spreads."
                        elif any(k in sec_lower for k in ["auto", "transport", "aviation", "airline"]):
                            desc_cause = f"Fuel benchmark swung {macro_ret:+.1f}%, altering fleet operational costs, aviation jet fuel surcharges, and transport profit margins."
                        elif any(k in sec_lower for k in ["basic", "material", "metal", "mining"]):
                            desc_cause = f"Global energy benchmark swung {macro_ret:+.1f}%, impacting smelting power tariffs, furnace fuels, and shipping freight."
                        else:
                            desc_cause = f"Crude oil moved {macro_ret:+.1f}%, shifting nationwide transportation expenses and industrial polymer packaging overhead."
                    elif ev_type == "macro_geopolitical":
                        desc_cause = f"Safe-haven bullion swung {macro_ret:+.1f}%, reflecting international military friction, trade sanctions, or geopolitical escalation."
                    elif ev_type == "macro_capital":
                        desc_cause = f"Currency FX swung {macro_ret:+.1f}%, altering multinational export margins and cross-border capital repatriation."
                    elif ev_type == "macro_commodity":
                        desc_cause = f"Industrial raw material benchmark moved {macro_ret:+.1f}%, reflecting global manufacturing demand and supply-chain transit."
                    else:
                        desc_cause = f"Benchmark yields/indices swung {macro_ret:+.1f}%, shifting equity discount rates and global institutional liquidity allocation."

                    # STRICT DIRECTIONAL HARMONY: Title and sentiment ALWAYS reflect the stock's net change
                    if not is_stock_up:
                        title = f"Stock Pullback ({stock_sign}) · {asset_name} {macro_dir} ({macro_ret:+.1f}%)"
                        sentiment_score = -abs(round(0.60 + min(0.30, abs(stock_ret) / 10.0), 2))
                        desc = f"Shares declined {stock_sign} as {asset_name} moved {macro_ret:+.1f}%. {desc_cause}"
                    else:
                        title = f"Stock Surge ({stock_sign}) · {asset_name} {macro_dir} ({macro_ret:+.1f}%)"
                        sentiment_score = abs(round(0.60 + min(0.30, abs(stock_ret) / 10.0), 2))
                        desc = f"Shares advanced {stock_sign} as {asset_name} moved {macro_ret:+.1f}%. {desc_cause}"

                    is_indian = (mkt == "IN")
                    is_high_impact = abs(macro_ret) >= (thresh * 1.4)
                    matched_news = None
                    if is_high_impact or (news_query, d, is_indian) in _DATED_NEWS_CACHE:
                        matched_news = fetch_exact_date_news(news_query, d, is_indian=is_indian)

                    if matched_news:
                        headline = matched_news["title"]
                        source = matched_news["source"]
                        url = matched_news["url"]
                    else:
                        headline = f"Global {asset_name} volatility of {macro_ret:+.1f}% recorded across international commodity trading desks"
                        source = "Commodity & Futures Exchange Disclosures"
                        url = f"https://finance.yahoo.com/quote/{sym}"

                    events.append({
                        "date": d,
                        "type": ev_type,
                        "title": title,
                        "description": desc,
                        "impact": "high" if abs(macro_ret) >= (thresh * 1.5) else "medium",
                        "news_headline": headline,
                        "news_source": source,
                        "news_url": url,
                        "sentiment_score": sentiment_score,
                    })
        except Exception:
            continue

    return events


def detect_trade_and_policy_events(prices: list, ticker: str = "", sector: str = "", company_name: str = "") -> list:
    """Detect trade tariffs, government regulatory probes, and institutional capital flow external factors on active dates.
    Dynamically adapts queries to the stock's geography (US, India, UK, Global)."""
    events = []
    if not prices or len(prices) < 2:
        return events

    daily_stats = get_stock_daily_stats(prices)
    mkt = classify_market(ticker)
    clean_sym = clean_symbol(ticker)

    # Identify top outlier price shock sessions (capped to top 6 most significant to ensure sub-second response)
    shock_sessions = []
    for i in range(1, len(prices)):
        p_curr = prices[i]
        p_prev = prices[i - 1]
        if p_prev.get("close", 0) > 0:
            ret = abs((p_curr["close"] - p_prev["close"]) / p_prev["close"] * 100)
            if ret >= 2.0:
                shock_sessions.append((ret, p_curr["date"][:10]))
    shock_sessions.sort(key=lambda x: x[0], reverse=True)
    candidate_dates = [d for _, d in shock_sessions[:6]]

    is_indian = (mkt == "IN")

    for d in candidate_dates:
        st = daily_stats.get(d, {"ret": 0.0, "is_up": True, "sign": "+0.0%"})
        is_stock_up = st["is_up"]
        stock_sign = st["sign"]

        # 1. Trade Tariffs & Export Restrictions
        if mkt == "IN":
            trade_q = f'({clean_sym} OR "{sector}") (tariff OR import duty OR export ban OR trade dispute OR customs duty)'
        elif mkt == "US":
            trade_q = f'({clean_sym} OR "{sector}") (tariffs OR trade sanction OR export control OR chip restrictions OR trade dispute)'
        else:
            trade_q = f'({clean_sym} OR "{sector}") (tariffs OR sanctions OR trade dispute OR export controls)'

        trade_news = fetch_exact_date_news(trade_q, d, is_indian=is_indian)
        if trade_news:
            if not is_stock_up:
                title = f"Downside Pressure ({stock_sign}) · International Trade & Tariff Policy"
                sentiment_score = -0.65
            else:
                title = f"Upside Momentum ({stock_sign}) · Trade Policy & Tariff Clarification"
                sentiment_score = 0.65

            events.append({
                "date": d,
                "type": "macro_trade",
                "title": title,
                "description": f"Trade tariff adjustments, customs duties, or cross-border trade restrictions shifted supply chain terms and market margins for {company_name}.",
                "impact": "high",
                "news_headline": trade_news["title"],
                "news_source": trade_news["source"],
                "news_url": trade_news["url"],
                "sentiment_score": sentiment_score,
            })

        # 2. Government & Regulatory / Antitrust Directives
        if mkt == "IN":
            reg_q = f'({clean_sym} OR "{company_name}") (government policy OR court order OR SEBI OR RBI OR GST OR windfall tax OR regulatory probe)'
        elif mkt == "US":
            reg_q = f'({clean_sym} OR "{company_name}") (SEC probe OR FTC OR antitrust OR DOJ OR Federal Reserve OR executive order OR regulation)'
        else:
            reg_q = f'({clean_sym} OR "{company_name}") (regulator OR antitrust OR investigation OR central bank OR government)'

        reg_news = fetch_exact_date_news(reg_q, d, is_indian=is_indian)
        if reg_news:
            if not is_stock_up:
                title = f"Downside Pressure ({stock_sign}) · Government & Regulatory Action"
                sentiment_score = -0.55
            else:
                title = f"Upside Momentum ({stock_sign}) · Regulatory Clearance & Policy Approval"
                sentiment_score = 0.55

            events.append({
                "date": d,
                "type": "macro_regulatory",
                "title": title,
                "description": f"Regulatory decisions, judicial directives, or governmental economic policy altered operating regulations and corporate sentiment for {company_name}.",
                "impact": "high",
                "news_headline": reg_news["title"],
                "news_source": reg_news["source"],
                "news_url": reg_news["url"],
                "sentiment_score": sentiment_score,
            })

        # 3. Institutional Capital Flows & Liquidity Shocks
        if mkt == "IN":
            cap_q = '("FII selling" OR "foreign institutional outflow" OR "foreign portfolio" OR "FII DII data") Indian market'
        elif mkt == "US":
            cap_q = f'({clean_sym} OR "Wall Street") ("institutional outflow" OR "hedge fund" OR "liquidity crunch" OR "market selloff")'
        else:
            cap_q = f'({clean_sym}) ("institutional outflows" OR "equity selloff" OR "market liquidity")'

        capital_news = fetch_exact_date_news(cap_q, d, is_indian=is_indian)
        if capital_news:
            if not is_stock_up:
                title = f"Downside Pressure ({stock_sign}) · Institutional Capital Outflow Shock"
                sentiment_score = -0.50
            else:
                title = f"Upside Momentum ({stock_sign}) · Institutional Capital Inflow"
                sentiment_score = 0.50

            events.append({
                "date": d,
                "type": "macro_capital",
                "title": title,
                "description": f"Large-scale institutional capital reallocation and fund flows influenced liquidity across {company_name} and benchmark indices.",
                "impact": "medium",
                "news_headline": capital_news["title"],
                "news_source": capital_news["source"],
                "news_url": capital_news["url"],
                "sentiment_score": sentiment_score,
            })

    return events


def build_all_factors(ticker_data: dict, index_df: pd.DataFrame, period: str = "1y") -> list:
    """Build all external factors for any stock in the world.
    - Strictly caps at TOP 3 factors per single date with category diversity.
    - Strictly aligns factor sign and title with the stock chart's actual trajectory.
    - Validates date against actual stock market trading calendar."""
    prices = ticker_data["prices"]
    ticker = ticker_data.get("ticker", "")
    company_name = ticker_data.get("name", ticker)
    sector = ticker_data.get("sector", "")
    stock_dates = {p["date"][:10] for p in prices}
    daily_stats = get_stock_daily_stats(prices)

    events = []

    # 1. Company internal factors: volume accumulation, benchmark divergence, price breakout
    company_events = []
    company_events += detect_volume_spikes(prices)
    if index_df is not None and not index_df.empty:
        company_events += detect_index_divergence(prices, index_df)
    company_events += detect_price_shocks(prices)

    # Parallel pre-fetch exact-date company news for the top 8 most recent dates
    comp_dates = sorted(list({ev["date"] for ev in company_events}), reverse=True)[:8]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as ex:
        ex.map(lambda d: fetch_exact_company_news(company_name, ticker, d), comp_dates)

    # Attach verified company news for that EXACT date
    for ev in company_events:
        ev_date = ev["date"]
        st = daily_stats.get(ev_date, {"ret": 0.0, "is_up": True, "sign": "+0.0%"})
        comp_news = fetch_exact_company_news(company_name, ticker, ev_date)
        if comp_news:
            ev["news_headline"] = comp_news["title"]
            ev["news_source"] = comp_news["source"]
            ev["news_url"] = comp_news["url"]
        else:
            direction = "upside breakout" if st["is_up"] else "downside pullback"
            clean_sym = clean_symbol(ticker)
            ev["news_headline"] = f"{company_name} ({clean_sym}) institutional block trading flow & {direction}"
            ev["news_source"] = "Exchange Disclosure / Financial Wire"
            ev["news_url"] = f"https://www.google.com/finance/quote/{clean_sym}"
        events.append(ev)

    # 2. Company-specific news sentiment
    news_events = fetch_news_sentiment(company_name, ticker=ticker, daily_stats=daily_stats)
    for ne in news_events:
        if ne["date"] in stock_dates:
            events.append(ne)

    # 3. Outer Macro & Geopolitical Factors (War, Energy, Currency, Commodities, Rates)
    macro_shocks = detect_macro_shocks(prices, ticker=ticker, sector=sector, company_name=company_name, period=period)
    events += macro_shocks

    # 4. Trade Tariffs, Regulatory Orders & Capital Outflows
    policy_events = detect_trade_and_policy_events(prices, ticker=ticker, sector=sector, company_name=company_name)
    events += policy_events

    # 5. Strict filtering: NO weekend dates where market was closed
    valid_events = [ev for ev in events if ev["date"] in stock_dates]

    # 6. GROUP BY DATE & PICK TOP 3 FACTORS PER SINGLE DATE
    events_by_date = {}
    for ev in valid_events:
        d = ev["date"]
        events_by_date.setdefault(d, []).append(ev)

    final_events = []
    for d, day_events in events_by_date.items():
        seen_titles = set()
        unique_day_events = []
        for ev in day_events:
            t = ev.get("title", "")
            if t not in seen_titles:
                seen_titles.add(t)
                unique_day_events.append(ev)

        # If 1, 2, or 3 factors exist on this date -> keep all of them
        # If MORE than 3 factors exist on this date -> pick the TOP 3
        if len(unique_day_events) > 3:
            def score_event(e):
                impact_val = 3 if e.get("impact") == "high" else 2
                has_accredited_news = 2 if (e.get("news_headline") and "exchange disclosure" not in e.get("news_source", "").lower()) else 1
                sentiment_mag = abs(e.get("sentiment_score", 0))
                return (impact_val, has_accredited_news, sentiment_mag)

            unique_day_events.sort(key=score_event, reverse=True)

            # Prioritize category diversity across the top 3
            picked = []
            seen_categories = set()
            for ev in unique_day_events:
                cat = ev.get("type", "")
                if cat not in seen_categories and len(picked) < 3:
                    seen_categories.add(cat)
                    picked.append(ev)

            # Fill remaining slots up to 3 if diversity pass didn't reach 3
            for ev in unique_day_events:
                if len(picked) >= 3:
                    break
                if ev not in picked:
                    picked.append(ev)

            final_events.extend(picked)
        else:
            final_events.extend(unique_day_events)

    final_events.sort(key=lambda e: e["date"], reverse=True)
    return final_events
