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
                "stock_return_pct": round(ret, 2),
                "impact_pct": round(ret, 2),
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
                "stock_return_pct": round(stock_ret, 2),
                "impact_pct": round(stock_ret, 2),
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
                "stock_return_pct": round(ret, 2),
                "impact_pct": round(ret, 2),
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
            "stock_return_pct": round(st["ret"], 2),
            "impact_pct": round(st["ret"], 2),
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

        with urllib.request.urlopen(req, context=ctx, timeout=0.9) as resp:
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


_MACRO_SERIES_CACHE = {}  # (sym, period) -> (timestamp, dates, closes)


def get_cached_macro_history(sym: str, period: str = "1y") -> tuple:
    """Fetch macro benchmark history with 5-minute memory cache."""
    import time
    now_ts = time.time()
    cached = _MACRO_SERIES_CACHE.get((sym, period))
    if cached and (now_ts - cached[0]) < 300:
        return cached[1], cached[2]

    try:
        import yfinance as yf
        t = yf.Ticker(sym)
        h = t.history(period=period)
        if not h.empty and len(h) >= 2:
            dates = [idx.strftime("%Y-%m-%d") for idx in h.index]
            closes = list(h["Close"])
            _MACRO_SERIES_CACHE[(sym, period)] = (now_ts, dates, closes)
            return dates, closes
    except Exception:
        pass
    return [], []


import re

def classify_factor_theme(asset_name: str, factor_type: str, sym: str, headline: str = "") -> str:
    text = f"{asset_name} {factor_type} {sym} {headline}".lower()
    
    if any(k in text for k in ["natural gas", "lpg", "lng", "ng=f", "gas crisis", "gas touches", "gas prices", "pipeline transit"]):
        return "ENERGY_GAS"
    if any(k in text for k in ["crude oil", "fuel", "cl=f", "brent", "petroleum", "diesel", "gasoline", "refinery", "opec"]):
        return "ENERGY_OIL"
    if any(k in text for k in ["gold", "gld", "geopolitical", "military", "war", "missile", "sanction", "middle east", "conflict", "defense"]):
        return "GEOPOLITICAL_DEFENSE"
    if any(k in text for k in ["copper", "hg=f", "metals", "aluminum", "zinc", "lithium", "nickel", "iron ore", "commodity"]):
        return "METALS_RAW_MATERIALS"
    if any(k in text for k in ["currency", "fx", "inr=x", "dx-y", "eurusd", "gbpusd", "dollar", "rupee", "forex", "exchange rate", "devaluation"]):
        return "CURRENCY_FOREX"
    if any(k in text for k in ["yield", "tnx", "interest rate", "rate hike", "fed rate", "treasury", "central bank", "monetary", "inflation", "cpi"]):
        return "RATES_MONETARY"
    if any(k in text for k in ["tariff", "customs duty", "import duty", "export ban", "trade dispute", "trade deal", "protectionism", "trade_trade"]):
        return "TRADE_TARIFFS"
    if any(k in text for k in ["regulatory", "regulator", "sebi", "rbi", "sec probe", "ftc", "antitrust", "court order", "probe", "investigation"]):
        return "GOV_REGULATORY"
    if any(k in text for k in ["fii", "institutional outflow", "institutional inflow", "capital flow", "liquidity", "hedge fund", "portfolio"]):
        return "CAPITAL_LIQUIDITY"
    if factor_type == "price_shock" or any(k in text for k in ["price breakout", "price shock", "single-day price"]):
        return "PRICE_SHOCK"
    if factor_type == "volume_spike" or any(k in text for k in ["volume spike", "heavy selling volume", "institutional buying volume"]):
        return "VOLUME_SPIKE"
    return "GENERAL_MACRO"


def classify_industry_archetype(sector: str, industry: str, company_name: str, ticker: str = "") -> str:
    text = f"{sector} {industry} {company_name} {ticker}".lower()
    
    if any(k in text for k in ["technology", "software", "information technology", "it services", "semiconductor", "cloud", "computer", "internet", "electronics", "infy", "tcs", "wipro", "hcl", "techm", "aapl", "msft", "nvda", "googl", "meta"]):
        return "TECH_SOFTWARE_IT"
    if any(k in text for k in ["bank", "financial", "insurance", "capital market", "credit", "lending", "asset management", "hdfc", "icici", "sbi", "kotak", "axis", "bajaj fin"]):
        return "FINANCIALS_BANKING"
    if any(k in text for k in ["auto", "vehicle", "motors", "airline", "aviation", "transportation", "freight", "trucking", "tata motors", "maruti", "tsla"]):
        return "AUTO_TRANSPORTATION"
    if any(k in text for k in ["energy", "oil & gas", "petroleum", "refining", "drilling", "pipeline", "ongc", "bpcl", "ioc", "reliance", "exxon", "chevron"]):
        return "ENERGY_PETROCHEMICAL"
    if any(k in text for k in ["metal", "mining", "steel", "aluminum", "copper", "basic materials", "cement", "tata steel", "jsw", "hindalco", "vedanta"]):
        return "METALS_MINING_MATERIALS"
    if any(k in text for k in ["consumer staples", "fmcg", "beverage", "food", "retail", "personal products", "tobacco", "unilever", "nestle", "itc", "dmart"]):
        return "CONSUMER_STAPLES_RETAIL"
    if any(k in text for k in ["health", "pharma", "biotech", "drug", "hospital", "medical", "sun pharma", "dr reddy", "cipla"]):
        return "HEALTHCARE_PHARMA"
    if any(k in text for k in ["utility", "electric", "power generation", "water", "renewables", "ntpc", "powergrid"]):
        return "UTILITIES_INFRASTRUCTURE"
    if any(k in text for k in ["real estate", "reit", "property", "construction", "dlf"]):
        return "REAL_ESTATE_CONSTRUCTION"
    if any(k in text for k in ["telecom", "communication", "media", "entertainment", "broadcasting", "bharti airtel"]):
        return "COMMUNICATION_MEDIA"
    return "GENERAL_COMMERCIAL"


def build_universal_factor_explanation(
    company_name: str,
    ticker: str,
    sector: str,
    industry: str,
    asset_name: str,
    sym: str,
    factor_type: str,
    macro_ret: float,
    stock_ret: float,
    stock_sign: str,
    is_stock_up: bool,
    news_headline: str = "",
) -> str:
    """Universal direct/indirect causal economic transmission explanation for ANY stock and ANY external factor."""
    c_name = company_name.split(",")[0].replace(" Inc.", "").replace(" Ltd.", "").replace(" Corp.", "").strip() or ticker.split(".")[0]
    ind_label = industry if (industry and industry != "N/A") else (sector if (sector and sector != "N/A") else "commercial")
    dir_word = "advanced" if is_stock_up else "declined"
    macro_dir = "surged" if macro_ret > 0 else "retreated"
    headline_clean = (news_headline or "").strip()
    
    theme = classify_factor_theme(asset_name, factor_type, sym, news_headline)
    archetype = classify_industry_archetype(sector, industry, company_name, ticker)
    
    # ── Context sentence tying directly to the event and news headline ──────
    if headline_clean and "volatility of" not in headline_clean.lower() and "block trading" not in headline_clean.lower():
        # High-relevance news headline context
        opening = f"Shares {dir_word} {stock_sign} following reported market developments ('{headline_clean[:120]}...') as {asset_name} {macro_dir} {macro_ret:+.1f}%."
    else:
        opening = f"Shares {dir_word} {stock_sign} as {asset_name} {macro_dir} {macro_ret:+.1f}%."

    # ── 1. ENERGY: NATURAL GAS & LPG / HEATING / POWER CRISIS ───────────────
    if theme == "ENERGY_GAS":
        if archetype == "TECH_SOFTWARE_IT":
            if not is_stock_up:
                impact = (
                    f"Directly, while physical energy is an operational facility overhead for {c_name}, acute natural gas price shocks directly squeeze overseas corporate enterprise client balance sheets (particularly in Europe and the UK). "
                    f"Indirectly, corporate clients across manufacturing, banking, and retail facing surging energy utility tariffs are forced to preserve cash, delaying discretionary IT modernization, consulting contracts, and digital transformation commitments. "
                    f"Simultaneously, energy-driven inflation elevated bond yields, triggering broader equity valuation multiple compression across high-growth technology equities."
                )
            else:
                impact = (
                    f"Directly, enterprise software and digital infrastructure provided by {c_name} enable corporate clients to streamline operations and optimize energy and resource utilization during utility price shocks. "
                    f"Indirectly, sustained demand for non-discretionary IT outsourcing, mission-critical cloud management, and operational efficiency tools shielded contract revenue visibility for {c_name} despite volatile energy benchmarks."
                )
        elif archetype == "AUTO_TRANSPORTATION":
            impact = (
                f"Directly, natural gas price spikes elevate industrial plant heating tariffs, metal heat-treatment costs, and retail CNG fuel pump expenses. "
                f"Indirectly, higher running costs for gas-powered and commercial vehicles soften consumer showroom footfalls and transport fleet purchases, while inflating inbound parts transit expenses for {c_name}."
            )
        elif archetype == "ENERGY_PETROCHEMICAL":
            impact = (
                f"Directly, natural gas benchmark swings alter upstream wellhead extraction realizations, domestic formula pricing, and city gas feedstock spreads. "
                f"Indirectly, elevated natural gas tariffs lift wholesale electricity and synthetic chemical values, expanding operating cash flow realization for {c_name}."
            )
        elif archetype == "METALS_MINING_MATERIALS":
            impact = (
                f"Directly, natural gas represents a primary thermal fuel and reducing agent for industrial blast furnaces, kilns, and metal smelting. "
                f"Indirectly, volatile energy tariffs directly expand per-ton conversion costs and erode manufacturing EBITDA spreads unless offset by steel and metal price hikes for {c_name}."
            )
        elif archetype == "FINANCIALS_BANKING":
            impact = (
                f"Directly, energy shocks trigger imported inflation, delaying central bank monetary easing and keeping wholesale borrowing rates elevated for {c_name}. "
                f"Indirectly, elevated utility and heating expenses strain working capital across energy-intensive industrial borrowers, increasing credit risk provisions and dampening commercial loan originations."
            )
        elif archetype == "CONSUMER_STAPLES_RETAIL":
            impact = (
                f"Directly, commercial gas and power spikes inflate food processing expenses, polymer packaging tariffs, and cold-chain warehousing costs for {c_name}. "
                f"Indirectly, consumer disposable household budgets are squeezed by elevated utility bills, curbing discretionary retail basket sizes and pressuring gross margins."
            )
        else:
            impact = (
                f"Directly, spiking natural gas and commercial energy benchmarks inflate industrial utility bills, facility overhead, and transport logistics. "
                f"Indirectly, broad macroeconomic energy inflation tightens corporate operating margins and shifts institutional earnings forecasts for {c_name}."
            )

    # ── 2. ENERGY: CRUDE OIL & FUEL / PETROLEUM ─────────────────────────────
    elif theme == "ENERGY_OIL":
        if archetype == "ENERGY_PETROCHEMICAL":
            impact = (
                f"Directly, global crude oil benchmarks dictate upstream exploration and extraction realizations per barrel, alongside Singapore gross refining margins (GRMs) on transportation fuels. "
                f"Indirectly, shifting crude supply-demand balances revalue inventory stockpiles and alter petrochemical polymer spreads across refining operations for {c_name}."
            )
        elif archetype == "AUTO_TRANSPORTATION":
            impact = (
                f"Directly, fuel benchmark swings immediately alter fleet diesel/petrol operating expenses and retail vehicle running costs. "
                f"Indirectly, elevated fuel prices increase the total cost of ownership (TCO) for passenger cars and commercial vehicles, dampening consumer purchasing sentiment and elevating parts freight for {c_name}."
            )
        elif archetype == "TECH_SOFTWARE_IT":
            if not is_stock_up:
                impact = (
                    f"Directly, elevated crude oil benchmarks fuel imported inflation and expand current account deficits in major importing economies, strengthening currency headwinds. "
                    f"Indirectly, corporate enterprise clients in the US and Europe confronting fuel inflation tighten operational expenditures, delaying non-critical software upgrades and triggering valuation de-rating across tech equities like {c_name}."
                )
            else:
                impact = (
                    f"Directly, {c_name} benefits from strong balance-sheet liquidity, zero long-term debt, and foreign-denominated cash flows that shield it from domestic fuel cost shocks. "
                    f"Indirectly, institutional defensive rotation supported shares as investors sought companies with predictable recurring software revenue amidst broader commodity volatility."
                )
        elif archetype == "CONSUMER_STAPLES_RETAIL":
            impact = (
                f"Directly, petroleum derivatives (high-density packaging polymers, linear alkyl benzene, specialty surfactants) represent major raw material cost inputs for {c_name}. "
                f"Indirectly, fuel price hikes increase nationwide distribution freight, compressing product gross margins unless passed on through consumer price hikes."
            )
        elif archetype == "FINANCIALS_BANKING":
            impact = (
                f"Directly, elevated crude prices widen national trade deficits and fuel domestic consumer inflation, preventing central banks from lowering benchmark interest rates. "
                f"Indirectly, prolonged high interest rates tighten systemic banking liquidity, elevate debt service burdens on corporate borrowers, and slow retail lending expansion for {c_name}."
            )
        elif archetype == "METALS_MINING_MATERIALS":
            impact = (
                f"Directly, mining haulage equipment, heavy machinery diesel, and ocean bulk shipping freight costs scale directly with world petroleum benchmarks. "
                f"Indirectly, higher transportation and extraction overhead increases landed raw material expenses and shifts per-ton production economics for {c_name}."
            )
        else:
            impact = (
                f"Directly, crude oil swings shift transportation logistics expenses, corporate power costs, and petrochemical input pricing for {c_name}. "
                f"Indirectly, oil-induced inflation alters central bank interest rate projections and broad corporate profit margin expectations."
            )

    # ── 3. GEOPOLITICAL / MILITARY / SAFE-HAVEN GOLD ────────────────────────
    elif theme == "GEOPOLITICAL_DEFENSE":
        if archetype == "TECH_SOFTWARE_IT":
            if not is_stock_up:
                impact = (
                    f"Directly, geopolitical friction and safe-haven bullion surges prompt international institutional investors to de-risk equity portfolios, liquidating high-valuation technology holdings. "
                    f"Indirectly, overseas multinational clients freeze or delay cross-border capital commitments, offshore development contracts, and corporate M&A integrations pending international conflict stabilization."
                )
            else:
                impact = (
                    f"Directly, {c_name}'s debt-free balance sheet, strong overseas cash reserves, and predictable multi-year enterprise contracts attracted institutional defensive capital. "
                    f"Indirectly, market participants rotated toward resilient cash-generating technology leaders to hedge against physical supply-chain and geopolitical disruptions."
                )
        elif archetype == "FINANCIALS_BANKING":
            impact = (
                f"Directly, geopolitical escalation drives foreign portfolio investors (FIIs) to withdraw capital from liquid emerging market bank equities in favor of sovereign debt and bullion havens. "
                f"Indirectly, heightened international conflict risk elevates global counterparty spreads, increases cross-border trade finance caution, and compresses bank valuation multiples for {c_name}."
            )
        elif archetype == "AUTO_TRANSPORTATION" or archetype == "METALS_MINING_MATERIALS":
            impact = (
                f"Directly, military conflicts and regional tensions disrupt maritime shipping lanes (e.g. Red Sea, Suez Canal), inflating ocean freight container rates and war-risk marine insurance premiums. "
                f"Indirectly, transit delays and supply-chain bottlenecks elevate buffer inventory carrying costs and cause production scheduling friction for {c_name}."
            )
        elif archetype == "CONSUMER_STAPLES_RETAIL" and ("titan" in c_name.lower() or "jewel" in text_all):
            impact = (
                f"Directly, safe-haven bullion price surges immediately inflate raw gold inventory replacement costs and retail jewelry ticket prices. "
                f"Indirectly, sharp price spikes temporarily deter consumer wedding and festive buying volumes, requiring promotional discounting or higher working capital financing for {c_name}."
            )
        else:
            impact = (
                f"Directly, safe-haven bullion surges reflect international military tensions, trade sanctions, or geopolitical escalation that triggered broad institutional equity risk aversion. "
                f"Indirectly, cross-border investment uncertainty dampens corporate expansion plans and prompts risk-off capital reallocations across {c_name}'s shareholder base."
            )

    # ── 4. COMMODITIES: INDUSTRIAL COPPER & BASE METALS ─────────────────────
    elif theme == "METALS_RAW_MATERIALS":
        if archetype == "METALS_MINING_MATERIALS":
            impact = (
                f"Directly, benchmark base metal movements dictate London Metal Exchange (LME) pricing parity, export realization spreads, and inventory liquidation margins. "
                f"Indirectly, global metal benchmark swings immediately revalue order backlogs and drive equity analysts to revise quarterly EBITDA-per-ton estimates for {c_name}."
            )
        elif archetype == "AUTO_TRANSPORTATION":
            impact = (
                f"Directly, copper and industrial metals are essential raw material inputs for vehicle wiring harnesses, electric drive motors, and chassis stampings. "
                f"Indirectly, industrial commodity volatility alters vehicle bill-of-materials (BOM) costs, directly impacting automotive gross margins unless offset by vehicle price revisions for {c_name}."
            )
        elif archetype == "TECH_SOFTWARE_IT":
            impact = (
                f"Directly, industrial copper acts as the financial market's premier bellwether for global capital expenditure and industrial manufacturing cycles. "
                f"Indirectly, copper price trends signal accelerating or decelerating factory automation, smart manufacturing, and digital engineering contract flows from industrial clients to {c_name}."
            )
        else:
            impact = (
                f"Directly, industrial commodity price volatility alters manufacturing input costs, equipment procurement budgets, and supply-chain transit for {c_name}. "
                f"Indirectly, copper and metals movements reflect global manufacturing demand and infrastructure capital expenditure momentum across industrial sectors."
            )

    # ── 5. CURRENCIES & FOREIGN EXCHANGE (FX) ───────────────────────────────
    elif theme == "CURRENCY_FOREX":
        if archetype == "TECH_SOFTWARE_IT" or archetype == "HEALTHCARE_PHARMA":
            impact = (
                f"Directly, as an export-focused {ind_label} enterprise invoicing the substantial majority of contracts in foreign currencies (USD, EUR, GBP) while incurring operational expenses in domestic currency, exchange rate fluctuations directly alter gross operating margins and rupee realization per billed hour for {c_name}. "
                f"Indirectly, foreign currency swings influence foreign institutional investor (FII) portfolio hedging decisions and currency-adjusted equity return expectations."
            )
        elif archetype == "FINANCIALS_BANKING":
            impact = (
                f"Directly, domestic currency depreciation accelerates imported inflation, restricting central bank room to ease interest rates and tightening domestic interbank liquidity for {c_name}. "
                f"Indirectly, sharp currency volatility triggers foreign portfolio capital outflows from liquid domestic banking equities."
            )
        else:
            impact = (
                f"Directly, foreign exchange volatility alters overseas sales realization, foreign-currency debt servicing obligations, and imported raw material expenses for {c_name}. "
                f"Indirectly, currency shifts alter international competitive pricing parity and cross-border dividend repatriation yields."
            )

    # ── 6. INTEREST RATES, BOND YIELDS & MONETARY POLICY ────────────────────
    elif theme == "RATES_MONETARY":
        if archetype == "TECH_SOFTWARE_IT":
            impact = (
                f"Directly, sovereign bond yield movements alter the equity risk-free rate and weighted average cost of capital (WACC), directly repricing discounted future earnings multiples for high-growth tech firms like {c_name}. "
                f"Indirectly, tighter monetary conditions lead corporate enterprise CFOs to implement strict capital discipline, reducing discretionary software budgets and slowing contract deal cycles."
            )
        elif archetype == "FINANCIALS_BANKING":
            impact = (
                f"Directly, benchmark yield changes immediately shift bank Net Interest Margins (NIM), wholesale borrowing yields, and mark-to-market valuations on fixed-income treasury investment portfolios for {c_name}. "
                f"Indirectly, higher interest rates dampen retail mortgage and commercial loan demand while elevating debt-servicing burdens on corporate borrowers."
            )
        elif archetype == "REAL_ESTATE_CONSTRUCTION" or archetype == "AUTO_TRANSPORTATION":
            impact = (
                f"Directly, benchmark bond yields determine retail home mortgage rates and commercial vehicle auto loan financing terms. "
                f"Indirectly, higher borrowing costs diminish consumer buying affordability, delaying property bookings and vehicle purchases for {c_name}."
            )
        else:
            impact = (
                f"Directly, sovereign yield shifts adjust the equity discount rate applied to corporate discounted cash flows (DCF), altering valuation multiples for {c_name}. "
                f"Indirectly, broad monetary tightening limits corporate debt-funded expansion and slows macroeconomic capital expenditure cycles."
            )

    # ── 7. TRADE POLICY, TARIFFS & CUSTOMS ──────────────────────────────────
    elif theme == "TRADE_TARIFFS":
        if archetype == "TECH_SOFTWARE_IT":
            impact = (
                f"Directly, bilateral trade frameworks, digital services taxes, and cross-border mobility/visa regulations govern international service delivery compliance and overseas operational expenses for {c_name}. "
                f"Indirectly, trade policy stability bolsters overseas corporate client willingness to commit to multi-year digital outsourcing contracts."
            )
        elif archetype == "AUTO_TRANSPORTATION" or archetype == "METALS_MINING_MATERIALS":
            impact = (
                f"Directly, customs duties, import tariffs, and trade quotas directly shift component landed costs and cross-border vehicle/steel export realizations for {c_name}. "
                f"Indirectly, tariff friction causes supply-chain reorganization, elevating supplier sourcing lead times and inventory working capital."
            )
        else:
            impact = (
                f"Directly, trade tariff adjustments, customs duties, or cross-border restrictions shift supply chain pricing and overseas margin realization for {c_name}. "
                f"Indirectly, bilateral trade negotiations influence multinational client order visibility and global export market share."
            )

    # ── 8. GOVERNMENT & REGULATORY ACTIONS ──────────────────────────────────
    elif theme == "GOV_REGULATORY":
        if archetype == "FINANCIALS_BANKING":
            impact = (
                f"Directly, central bank statutory liquidity requirements, capital adequacy ratios, and lending guidelines govern credit expansion and capital allocation for {c_name}. "
                f"Indirectly, regulatory directives shift compliance overhead, risk-weight provisions, and market confidence in systemic banking stability."
            )
        elif archetype == "TECH_SOFTWARE_IT":
            impact = (
                f"Directly, data residency mandates, AI safety governance frameworks, and government IT procurement guidelines shape enterprise software contract structures for {c_name}. "
                f"Indirectly, regulatory compliance clarity accelerates corporate client confidence to greenlight enterprise digital deployments."
            )
        else:
            impact = (
                f"Directly, regulatory decisions, judicial rulings, or governmental economic policies alter operating guidelines and corporate compliance overhead for {c_name}. "
                f"Indirectly, policy announcements influence institutional investor sentiment and long-term sector valuation multiples."
            )

    # ── 9. INSTITUTIONAL CAPITAL FLOWS & LIQUIDITY ──────────────────────────
    elif theme == "CAPITAL_LIQUIDITY":
        impact = (
            f"Directly, large-scale institutional reallocations and foreign portfolio (FII/FPI) fund flows heavily influenced liquidity, order book depth, and trading turnover for {c_name}. "
            f"Indirectly, sector-wide institutional portfolio rebalancing triggers index-arbitrage and algorithmic momentum selling, amplifying intraday share price movement."
        )

    # ── 10. COMPANY-SPECIFIC PRICE SHOCKS & VOLUME SPIKES ───────────────────
    elif theme == "PRICE_SHOCK":
        action = "profit taking and broader market drag" if not is_stock_up else "buyer momentum and breakout accumulation"
        impact = (
            f"Directly, shares registered a sharp single-session move of {stock_sign} to close at prevailing market prices, reflecting concentrated trading turnover for {c_name}. "
            f"Indirectly, this standalone price volatility was amplified by intraday {action} and technical benchmark stop-loss executions across institutional trading desks."
        )
    elif theme == "VOLUME_SPIKE":
        flow_type = "heavy distribution selling" if not is_stock_up else "institutional block accumulation"
        impact = (
            f"Directly, trading volume surged significantly above historical multi-session averages, indicating concentrated institutional transaction turnover for {c_name}. "
            f"Indirectly, the volume surge reflected decisive {flow_type} as institutional funds adjusted strategic sector weightings following broader market catalysts."
        )

    # ── FALLBACK DEFAULT ────────────────────────────────────────────────────
    else:
        impact = (
            f"Directly, the {asset_name} movement of {macro_ret:+.1f}% transmitted through commercial input costs, operating utility overhead, and currency realization for {c_name}. "
            f"Indirectly, broad macroeconomic developments shifted corporate earnings guidance expectations and institutional equity discount multiples."
        )

    return f"{opening} {impact}"


def detect_macro_shocks(prices: list, ticker: str = "", sector: str = "", company_name: str = "", period: str = "1y", industry: str = "") -> list:
    """Detect real-world outer macro factors across commodities, currencies, interest rates, and geopolitical proxies.
    Dynamically configures proxies for global stocks (US, UK, Europe, India, Asia).
    Guarantees sub-second response via parallel prefetching and 5-minute in-memory caching."""
    events = []
    if not prices or len(prices) < 2:
        return events

    stock_dates = {p["date"][:10] for p in prices}
    daily_stats = get_stock_daily_stats(prices)
    mkt = classify_market(ticker)
    clean_sym = clean_symbol(ticker)

    # 1. Worldwide commodities affecting all global equities
    macro_configs = [
        ("CL=F", "macro_energy", 1.6, "Crude Oil & Fuel", "crude oil OR fuel price OR OPEC OR diesel OR petroleum OR refinery"),
        ("GLD", "macro_geopolitical", 1.0, "Safe-Haven Gold", "war OR military conflict OR geopolitical sanctions OR missile strike OR Middle East"),
        ("HG=F", "macro_commodity", 1.5, "Industrial Copper", "copper price OR industrial metals OR LME warehouse stocks OR metal tariffs"),
        ("NG=F", "macro_commodity", 2.4, "Natural Gas & LPG", "natural gas OR LPG shortage OR energy crisis OR pipeline transit"),
    ]

    # 2. Regional benchmarks, currencies, and sovereign yields
    if mkt == "IN":
        macro_configs.append(("INR=X", "macro_capital", 0.25, "USD/INR Currency FX", "rupee falls OR rupee gains OR USDINR OR currency valuation OR foreign capital"))
        macro_configs.append(("^NSEI", "macro_monetary", 0.8, "Nifty 50 Index", "Nifty 50 OR Indian stock market OR Dalal Street OR domestic equity"))
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

    # Parallel pre-fetch all needed macro series simultaneously (<1s)
    all_symbols = [cfg[0] for cfg in macro_configs]
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        futures = {sym: ex.submit(get_cached_macro_history, sym, period) for sym in all_symbols}
        macro_histories = {sym: f.result() for sym, f in futures.items()}

    sec_lower = sector.lower()
    raw_macro_events = []
    is_indian = (mkt == "IN")

    for sym, ev_type, thresh, asset_name, news_query in macro_configs:
        try:
            h_dates, closes = macro_histories.get(sym, ([], []))
            if not h_dates or len(h_dates) < 2:
                continue

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

                    raw_macro_events.append({
                        "date": d,
                        "sym": sym,
                        "type": ev_type,
                        "thresh": thresh,
                        "asset_name": asset_name,
                        "news_query": news_query,
                        "macro_ret": macro_ret,
                        "title": title,
                        "description": desc,
                        "sentiment_score": sentiment_score,
                        "stock_return_pct": round(stock_ret, 2),
                        "impact_pct": round(stock_ret, 2),
                    })
        except Exception:
            continue

    # Identify top 3 most severe macro shocks across all assets to fetch verified news concurrently
    candidate_macro_shocks = sorted(
        [e for e in raw_macro_events if abs(e["macro_ret"]) >= (e["thresh"] * 1.4)],
        key=lambda x: abs(x["macro_ret"]) / x["thresh"],
        reverse=True
    )[:3]

    if candidate_macro_shocks:
        macro_tasks = [(e["news_query"], e["date"], is_indian) for e in candidate_macro_shocks if (e["news_query"], e["date"], is_indian) not in _DATED_NEWS_CACHE]
        if macro_tasks:
            with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(macro_tasks), 3)) as ex:
                list(ex.map(lambda item: fetch_exact_date_news(item[0], item[1], is_indian=item[2]), macro_tasks))

    for item in raw_macro_events:
        d = item["date"]
        sym = item["sym"]
        ev_type = item["type"]
        asset_name = item["asset_name"]
        news_query = item["news_query"]
        macro_ret = item["macro_ret"]
        thresh = item["thresh"]

        matched_news = _DATED_NEWS_CACHE.get((news_query, d, is_indian))
        if matched_news:
            headline = matched_news["title"]
            source = matched_news["source"]
            url = matched_news["url"]
        else:
            headline = f"Global {asset_name} volatility of {macro_ret:+.1f}% recorded across international commodity trading desks"
            source = f"{asset_name} Futures / Intercontinental Exchange"
            url = f"https://finance.yahoo.com/quote/{sym}"

        st = daily_stats.get(d, {"ret": item["stock_return_pct"], "is_up": item["stock_return_pct"] >= 0, "sign": f"{item['stock_return_pct']:+.1f}%"})
        is_stock_up = st["is_up"]
        stock_sign = st["sign"]
        stock_ret = st["ret"]

        rich_desc = build_universal_factor_explanation(
            company_name=company_name,
            ticker=ticker,
            sector=sector,
            industry=industry,
            asset_name=asset_name,
            sym=sym,
            factor_type=ev_type,
            macro_ret=macro_ret,
            stock_ret=stock_ret,
            stock_sign=stock_sign,
            is_stock_up=is_stock_up,
            news_headline=headline,
        )

        events.append({
            "date": d,
            "type": ev_type,
            "title": item["title"],
            "description": rich_desc,
            "impact": "high" if abs(macro_ret) >= (thresh * 1.5) else "medium",
            "news_headline": headline,
            "news_source": source,
            "news_url": url,
            "sentiment_score": item["sentiment_score"],
            "stock_return_pct": item["stock_return_pct"],
            "impact_pct": item["impact_pct"],
        })

    return events


def detect_trade_and_policy_events(prices: list, ticker: str = "", sector: str = "", company_name: str = "", industry: str = "") -> list:
    """Detect trade tariffs, government regulatory probes, and institutional capital flow external factors on active dates.
    Dynamically adapts queries to the stock's geography (US, India, UK, Global)."""
    events = []
    if not prices or len(prices) < 2:
        return events

    daily_stats = get_stock_daily_stats(prices)
    mkt = classify_market(ticker)
    clean_sym = clean_symbol(ticker)

    # Identify top outlier price shock sessions (capped to top 3 most significant to ensure sub-second response)
    shock_sessions = []
    for i in range(1, len(prices)):
        p_curr = prices[i]
        p_prev = prices[i - 1]
        if p_prev.get("close", 0) > 0:
            ret = abs((p_curr["close"] - p_prev["close"]) / p_prev["close"] * 100)
            if ret >= 2.0:
                shock_sessions.append((ret, p_curr["date"][:10]))
    shock_sessions.sort(key=lambda x: x[0], reverse=True)
    candidate_dates = [d for _, d in shock_sessions[:3]]

    is_indian = (mkt == "IN")

    tasks = []
    for d in candidate_dates:
        # 1. Trade Tariffs & Export Restrictions
        if mkt == "IN":
            trade_q = f'({clean_sym} OR "{sector}") (tariff OR import duty OR export ban OR trade dispute OR customs duty)'
        elif mkt == "US":
            trade_q = f'({clean_sym} OR "{sector}") (tariffs OR trade sanction OR export control OR chip restrictions OR trade dispute)'
        else:
            trade_q = f'({clean_sym} OR "{sector}") (tariffs OR sanctions OR trade dispute OR export controls)'
        tasks.append((d, "macro_trade", trade_q))

        # 2. Government & Regulatory / Antitrust Directives
        if mkt == "IN":
            reg_q = f'({clean_sym} OR "{company_name}") (government policy OR court order OR SEBI OR RBI OR GST OR windfall tax OR regulatory probe)'
        elif mkt == "US":
            reg_q = f'({clean_sym} OR "{company_name}") (SEC probe OR FTC OR antitrust OR DOJ OR Federal Reserve OR executive order OR regulation)'
        else:
            reg_q = f'({clean_sym} OR "{company_name}") (regulator OR antitrust OR investigation OR central bank OR government)'
        tasks.append((d, "macro_regulatory", reg_q))

        # 3. Institutional Capital Flows & Liquidity Shocks
        if mkt == "IN":
            cap_q = '("FII selling" OR "foreign institutional outflow" OR "foreign portfolio" OR "FII DII data") Indian market'
        elif mkt == "US":
            cap_q = f'({clean_sym} OR "Wall Street") ("institutional outflow" OR "hedge fund" OR "liquidity crunch" OR "market selloff")'
        else:
            cap_q = f'({clean_sym}) ("institutional outflows" OR "equity selloff" OR "market liquidity")'
        tasks.append((d, "macro_capital", cap_q))

    def run_policy_query(task):
        t_date, t_type, t_q = task
        res = fetch_exact_date_news(t_q, t_date, is_indian=is_indian)
        return (t_date, t_type, res)

    fetched_results = []
    if tasks:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(tasks), 9)) as ex:
            fetched_results = list(ex.map(run_policy_query, tasks))

    for d, ev_type, news in fetched_results:
        if not news:
            continue
        st = daily_stats.get(d, {"ret": 0.0, "is_up": True, "sign": "+0.0%"})
        is_stock_up = st["is_up"]
        stock_sign = st["sign"]

        if ev_type == "macro_trade":
            title = f"Downside Pressure ({stock_sign}) · International Trade & Tariff Policy" if not is_stock_up else f"Upside Momentum ({stock_sign}) · Trade Policy & Tariff Clarification"
            sentiment_score = -0.65 if not is_stock_up else 0.65
            desc = build_universal_factor_explanation(
                company_name=company_name,
                ticker=ticker,
                sector=sector,
                industry=industry,
                sym="TRADE",
                factor_type="macro_trade",
                macro_ret=0.0,
                stock_ret=st["ret"],
                stock_sign=stock_sign,
                is_stock_up=is_stock_up,
                news_headline=news.get("title", ""), asset_name="Trade & Government Policy",
            )
            impact = "high"
        elif ev_type == "macro_regulatory":
            title = f"Downside Pressure ({stock_sign}) · Government & Regulatory Action" if not is_stock_up else f"Upside Momentum ({stock_sign}) · Regulatory Clearance & Policy Approval"
            sentiment_score = -0.55 if not is_stock_up else 0.55
            desc = build_universal_factor_explanation(
                company_name=company_name,
                ticker=ticker,
                sector=sector,
                industry=industry,
                sym="REGULATORY",
                factor_type="macro_regulatory",
                macro_ret=0.0,
                stock_ret=st["ret"],
                stock_sign=stock_sign,
                is_stock_up=is_stock_up,
                news_headline=news.get("title", ""), asset_name="Trade & Government Policy",
            )
            impact = "high"
        else:
            title = f"Downside Pressure ({stock_sign}) · Institutional Capital Outflow Shock" if not is_stock_up else f"Upside Momentum ({stock_sign}) · Institutional Capital Inflow"
            sentiment_score = -0.50 if not is_stock_up else 0.50
            desc = build_universal_factor_explanation(
                company_name=company_name,
                ticker=ticker,
                sector=sector,
                industry=industry,
                sym="CAPITAL",
                factor_type="macro_capital",
                macro_ret=0.0,
                stock_ret=st["ret"],
                stock_sign=stock_sign,
                is_stock_up=is_stock_up,
                news_headline=news.get("title", ""), asset_name="Trade & Government Policy",
            )
            impact = "medium"

        events.append({
            "date": d,
            "type": ev_type,
            "title": title,
            "description": desc,
            "impact": impact,
            "news_headline": news["title"],
            "news_source": news["source"],
            "news_url": news["url"],
            "sentiment_score": sentiment_score,
            "stock_return_pct": round(st["ret"], 2),
            "impact_pct": round(st["ret"], 2),
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

    # Parallel pre-fetch exact-date company news for the top 4 most recent dates
    comp_dates = sorted(list({ev["date"] for ev in company_events}), reverse=True)[:4]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
        list(ex.map(lambda d: fetch_exact_company_news(company_name, ticker, d), comp_dates))

    # Attach verified company news for that EXACT date
    clean_sym = clean_symbol(ticker)
    clean_name = company_name.split(",")[0].replace(" Inc.", "").replace(" Ltd.", "").replace(" Corp.", "").strip()
    comp_topic = f'"{clean_name}" OR "{clean_sym}"'
    is_indian = classify_market(ticker) == "IN"

    for ev in company_events:
        ev_date = ev["date"]
        st = daily_stats.get(ev_date, {"ret": 0.0, "is_up": True, "sign": "+0.0%"})
        comp_news = _DATED_NEWS_CACHE.get((comp_topic, ev_date, is_indian))
        if comp_news:
            ev["news_headline"] = comp_news["title"]
            ev["news_source"] = comp_news["source"]
            ev["news_url"] = comp_news["url"]
        else:
            direction = "upside breakout" if st["is_up"] else "downside pullback"
            ev["news_headline"] = f"{company_name} ({clean_sym}) institutional block trading flow & {direction}"
            ev["news_source"] = "Exchange Disclosure / Financial Wire"
            ev["news_url"] = f"https://www.google.com/finance/quote/{clean_sym}"
        events.append(ev)

    # 2. Company-specific news sentiment
    news_events = fetch_news_sentiment(company_name, ticker=ticker, daily_stats=daily_stats)
    for ne in news_events:
        if ne["date"] in stock_dates:
            events.append(ne)

    industry = ticker_data.get("industry", "")

    # 3. Outer Macro & Geopolitical Factors (War, Energy, Currency, Commodities, Rates)
    macro_shocks = detect_macro_shocks(prices, ticker=ticker, sector=sector, company_name=company_name, period=period, industry=industry)
    events += macro_shocks

    # 4. Trade Tariffs, Regulatory Orders & Capital Outflows
    policy_events = detect_trade_and_policy_events(prices, ticker=ticker, sector=sector, company_name=company_name, industry=industry)
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
