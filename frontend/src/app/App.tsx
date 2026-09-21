import { useState, useEffect, useMemo } from 'react';
import {
  Activity, ArrowUpRight, ArrowDownRight, ChevronRight, Globe,
  Search, User as UserIcon, LogOut, Sparkles, ChevronDown,
  TrendingUp, TrendingDown, RefreshCw, Radio, Layers,
  Bookmark, ArrowRight, BarChart2, X, CheckCircle2,
  Shield, Zap, Cpu, Award, Play, Eye, Compass, PieChart,
  Lock, Check, ExternalLink, HelpCircle, AlertCircle,
  Filter, SlidersHorizontal, ArrowUp, ArrowDown, ChevronLeft,
} from 'lucide-react';
import {
  loginUser, registerUser, getCurrentUserProfile, logoutUser,
  fetchStockSearch, fetchLatestEvents,
  fetchYFQuote, fetchYFQuotes, fetchYFIndices, startPricePolling, stopPricePolling,
  UserProfile, StockData, WorldEventItem, IndexData,
  fetchRealtimeMacro, MacroIndicator,
  fetchMLPredictions, MLForecastResults,
  registerRealAccount, loginRealAccount, saveLocalUser, loginWithGoogleAccount,
  signInWithGoogleReal,
} from '../services/api.js';
import { StockChart } from './components/StockChart.js';
import { GrowwStockModal } from './components/GrowwStockModal.js';
import {
  calculateStockPrediction, predictGeopoliticalShock,
  GeopoliticalScenarioPrediction,
} from '../services/prediction.service.js';

/* ── Groww Exact Palette ──────────────────────────────────────── */
const GREEN  = '#00D09C';
const RED    = '#EB5B3C';
const TEXT1  = '#44475B';
const TEXT2  = '#7C7E8C';
const TEXT3  = '#9B9EA7';
const BG     = '#FFFFFF';
const BG2    = '#F9FAFB';
const BG3    = '#F4F4F7';
const BORDER = '#EAECEF';
const BLUE   = '#5367FF';

const f2 = (n: number) =>
  n?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00';
const pct = (n: number) => `${(n ?? 0) >= 0 ? '+' : ''}${f2(n ?? 0)}%`;

function getCurr(currency?: string, symbol?: string) {
  if (currency === 'INR' || symbol?.includes('.NS') || symbol?.includes('.BO')) return '₹';
  if (currency === 'GBP' || symbol?.includes('.L')) return '£';
  if (currency === 'JPY' || symbol?.includes('.T')) return '¥';
  if (currency === 'EUR') return '€';
  if (currency === 'CAD') return 'C$';
  if (currency === 'AUD') return 'A$';
  if (currency === 'HKD' || symbol?.includes('.HK')) return 'HK$';
  return '$';
}

/* ── Initial Global Stock Watchlist ───────────────────────────── */
const INITIAL_STOCKS: StockData[] = [
  // Top Indian Large-Caps (prices as of Sep 2026)
  { symbol:'RELIANCE.NS', name:'Reliance Industries', exchange:'NSE', country:'IN', currency:'INR', price:1235.30, pct:0, sector:'Energy', marketCap:'17.9L Cr' },
  { symbol:'TCS.NS', name:'Tata Consultancy Services', exchange:'NSE', country:'IN', currency:'INR', price:2251.00, pct:0, sector:'IT', marketCap:'15.4L Cr' },
  { symbol:'HDFCBANK.NS', name:'HDFC Bank', exchange:'NSE', country:'IN', currency:'INR', price:716.55, pct:0, sector:'Banking', marketCap:'12.5L Cr' },
  { symbol:'INFY.NS', name:'Infosys', exchange:'NSE', country:'IN', currency:'INR', price:1077.00, pct:0, sector:'IT', marketCap:'7.8L Cr' },
  { symbol:'ICICIBANK.NS', name:'ICICI Bank', exchange:'NSE', country:'IN', currency:'INR', price:1350.40, pct:0, sector:'Banking', marketCap:'8.4L Cr' },
  { symbol:'TMPV.NS', name:'Tata Motors (TMPV)', exchange:'NSE', country:'IN', currency:'INR', price:303.60, pct:0, sector:'Auto', marketCap:'3.6L Cr' },
  { symbol:'TATASTEEL.NS', name:'Tata Steel', exchange:'NSE', country:'IN', currency:'INR', price:183.65, pct:0, sector:'Metals', marketCap:'1.9L Cr' },
  { symbol:'SBIN.NS', name:'State Bank of India', exchange:'NSE', country:'IN', currency:'INR', price:968.00, pct:0, sector:'Banking', marketCap:'7.3L Cr' },
  { symbol:'BHARTIARTL.NS', name:'Bharti Airtel', exchange:'NSE', country:'IN', currency:'INR', price:1830.40, pct:0, sector:'Telecom', marketCap:'9.4L Cr' },
  { symbol:'ITC.NS', name:'ITC Limited', exchange:'NSE', country:'IN', currency:'INR', price:258.00, pct:0, sector:'Consumer', marketCap:'6.2L Cr' },
  { symbol:'LT.NS', name:'Larsen & Toubro', exchange:'NSE', country:'IN', currency:'INR', price:3850.70, pct:0, sector:'Infrastructure', marketCap:'5.0L Cr' },
  { symbol:'ETERNAL.NS', name:'Eternal (Zomato / Blinkit)', exchange:'NSE', country:'IN', currency:'INR', price:315.25, pct:0, sector:'Tech / Delivery', marketCap:'2.8L Cr' },
  { symbol:'BAJFINANCE.NS', name:'Bajaj Finance', exchange:'NSE', country:'IN', currency:'INR', price:1009.20, pct:0, sector:'Finance', marketCap:'4.5L Cr' },
  { symbol:'WIPRO.NS', name:'Wipro Limited', exchange:'NSE', country:'IN', currency:'INR', price:170.00, pct:0, sector:'IT', marketCap:'2.8L Cr' },
  { symbol:'MARUTI.NS', name:'Maruti Suzuki India', exchange:'NSE', country:'IN', currency:'INR', price:12231.00, pct:0, sector:'Auto', marketCap:'3.9L Cr' },
  { symbol:'SUNPHARMA.NS', name:'Sun Pharmaceutical', exchange:'NSE', country:'IN', currency:'INR', price:1835.00, pct:0, sector:'Pharma', marketCap:'4.3L Cr' },
  { symbol:'ADANIENT.NS', name:'Adani Enterprises', exchange:'NSE', country:'IN', currency:'INR', price:2928.60, pct:0, sector:'Energy', marketCap:'3.4L Cr' },
  // Top Global Large-Caps (prices as of Sep 2026)
  { symbol:'NVDA', name:'NVIDIA Corporation', exchange:'NASDAQ', country:'US', currency:'USD', price:211.65, pct:0, sector:'Semiconductors', marketCap:'$5.2T' },
  { symbol:'AAPL', name:'Apple Inc.', exchange:'NASDAQ', country:'US', currency:'USD', price:330.33, pct:0, sector:'Technology', marketCap:'$5.0T' },
  { symbol:'MSFT', name:'Microsoft Corporation', exchange:'NASDAQ', country:'US', currency:'USD', price:499.28, pct:0, sector:'Technology', marketCap:'$3.7T' },
  { symbol:'GOOGL', name:'Alphabet Inc.', exchange:'NASDAQ', country:'US', currency:'USD', price:343.11, pct:0, sector:'Technology', marketCap:'$4.2T' },
  { symbol:'AMZN', name:'Amazon.com Inc.', exchange:'NASDAQ', country:'US', currency:'USD', price:248.46, pct:0, sector:'Consumer', marketCap:'$2.6T' },
  { symbol:'META', name:'Meta Platforms', exchange:'NASDAQ', country:'US', currency:'USD', price:666.78, pct:0, sector:'Technology', marketCap:'$1.7T' },
  { symbol:'TSLA', name:'Tesla Inc.', exchange:'NASDAQ', country:'US', currency:'USD', price:357.14, pct:0, sector:'Auto', marketCap:'$1.1T' },
  { symbol:'AMD', name:'Advanced Micro Devices', exchange:'NASDAQ', country:'US', currency:'USD', price:503.27, pct:0, sector:'Semiconductors', marketCap:'$815B' },
  { symbol:'NFLX', name:'Netflix Inc.', exchange:'NASDAQ', country:'US', currency:'USD', price:78.32, pct:0, sector:'Media', marketCap:'$340B' },
  { symbol:'LMT', name:'Lockheed Martin', exchange:'NYSE', country:'US', currency:'USD', price:533.67, pct:0, sector:'Defense', marketCap:'$128B' },
  { symbol:'SHEL.L', name:'Shell plc', exchange:'LSE', country:'GB', currency:'GBP', price:3652.50, pct:0, sector:'Energy', marketCap:'£180B' },
  { symbol:'JPM', name:'JPMorgan Chase', exchange:'NYSE', country:'US', currency:'USD', price:345.24, pct:0, sector:'Banking', marketCap:'$960B' },
  { symbol:'PLTR', name:'Palantir Technologies', exchange:'NYSE', country:'US', currency:'USD', price:176.13, pct:0, sector:'Technology', marketCap:'$411B' },
  { symbol:'COIN', name:'Coinbase Global', exchange:'NASDAQ', country:'US', currency:'USD', price:179.08, pct:0, sector:'Finance', marketCap:'$44B' },
];

const INITIAL_INDICES: IndexData[] = [
  { name:'NIFTY 50', value:24820.80, change:185.30, changePct:0.75, currency:'₹' },
  { name:'SENSEX', value:81340.20, change:612.40, changePct:0.76, currency:'₹' },
  { name:'BANK NIFTY', value:51290.40, change:340.10, changePct:0.67, currency:'₹' },
  { name:'S&P 500', value:5864.20, change:48.60, changePct:0.84, currency:'$' },
  { name:'NASDAQ', value:20420.50, change:242.10, changePct:1.20, currency:'$' },
  { name:'FTSE 100', value:8345.90, change:32.10, changePct:0.39, currency:'£' },
];

const EVENTS: WorldEventItem[] = [
  {
    id:'1', ago:'18 min ago', cat:'Geopolitical',
    headline:'Tripartite Semiconductor Accord signed between US, Japan & EU',
    body:'Major trade delegates established a multilateral agreement providing $45B in emergency subsidies and tariff exemptions for critical microchip fabrication.',
    signal:'bullish', sentimentScore:0.72, sourceName:'Bloomberg',
    stocks:[
      { sym:'NVDA', name:'NVIDIA', chg:5.24, price:211.65, before:201.10, confidence:0.94, reason:'Direct beneficiary of hardware subsidies and priority foundry wafer allocation.' },
      { sym:'AAPL', name:'Apple', chg:1.65, price:330.33, before:324.97, confidence:0.81, reason:'Secured stable silicon component pricing for future devices.' },
    ],
    sectors:[{ sec:'Semiconductors', chg:5.1 }, { sec:'Technology', chg:3.4 }],
  },
  {
    id:'2', ago:'1.2 hrs ago', cat:'Military',
    headline:'Middle East escalation near key maritime corridor; War-risk insurance surges',
    body:'Naval friction near critical transit routes triggered a 35% surge in vessel war-risk premiums, restricting hydrocarbon exports.',
    signal:'bearish', sentimentScore:-0.68, sourceName:'Reuters',
    stocks:[
      { sym:'LMT', name:'Lockheed Martin', chg:4.45, price:533.67, before:510.93, confidence:0.94, reason:'Emergency foreign military sales authorizations for tactical air defense.' },
      { sym:'RELIANCE.NS', name:'Reliance Industries', chg:3.12, price:1235.30, before:1197.80, confidence:0.91, reason:'Jamnagar mega-refinery captures massive gross refining margins as Asian crack spreads expand.' },
    ],
    sectors:[{ sec:'Defense', chg:5.4 }, { sec:'Energy', chg:4.2 }, { sec:'Airlines', chg:-5.1 }],
  },
  {
    id:'3', ago:'2.8 hrs ago', cat:'Economic',
    headline:'Federal Reserve holds benchmark rate steady; Signals potential Q4 easing',
    body:'The Federal Reserve maintained the target rate at 5.25%-5.50%. Chair noted disinflation trends remain intact.',
    signal:'bullish', sentimentScore:0.58, sourceName:'Federal Reserve',
    stocks:[
      { sym:'MSFT', name:'Microsoft', chg:2.14, price:499.28, before:488.79, confidence:0.88, reason:'Multiple expansion across cloud software on lower long-term discount rates.' },
      { sym:'TCS.NS', name:'TCS', chg:1.85, price:2251.00, before:2210.10, confidence:0.84, reason:'Discretionary digital transformation budgets unlock.' },
    ],
    sectors:[{ sec:'Software', chg:2.8 }, { sec:'Banking', chg:1.4 }, { sec:'Real Estate', chg:3.2 }],
  },
];

export default function App() {
  const [page, setPage] = useState<string>('explore');
  const [user, setUser] = useState<UserProfile|null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [stocks, setStocks] = useState<StockData[]>(INITIAL_STOCKS);
  const [indices, setIndices] = useState<IndexData[]>(INITIAL_INDICES);
  const [events, setEvents] = useState<WorldEventItem[]>(EVENTS);
  const [macroIndicators, setMacroIndicators] = useState<MacroIndicator[]>([]);
  const [selectedStock, setSelectedStock] = useState<StockData|null>(null);

  /* Live Search */
  const [sq, setSq] = useState('');
  const [sResults, setSResults] = useState<StockData[]>([]);
  const [sOpen, setSOpen] = useState(false);
  const [sLoading, setSLoading] = useState(false);

  // Poll real market data every 4s
  useEffect(() => {
    getCurrentUserProfile().then(p => { if (p) setUser(p); });
    fetchLatestEvents().then(d => { if (d?.length) setEvents(d); });

    const refreshMacro = () => {
      fetchRealtimeMacro().then(m => {
        if (m && m.length > 0) setMacroIndicators(m);
      });
    };
    refreshMacro();
    const macroTimer = setInterval(refreshMacro, 8000);

    const refreshIndices = () => {
      fetchYFIndices().then(liveIdxs => {
        if (liveIdxs.length > 0) setIndices(liveIdxs);
      });
    };
    refreshIndices();
    const idxTimer = setInterval(refreshIndices, 4000);

    const symbols = INITIAL_STOCKS.map(s => s.symbol);
    startPricePolling(symbols, (freshQuotes) => {
      setStocks(prev => prev.map(s => {
        const match = freshQuotes.find(f => f.symbol === s.symbol);
        if (match && match.price > 0) {
          return {
            ...s,
            price: match.price,
            pct: match.pct,
            change: match.change,
            currency: match.currency || s.currency,
            high52: match.high52,
            low52: match.low52,
            volume: match.volume,
          };
        }
        return s;
      }));
    }, 4000);

    return () => {
      clearInterval(idxTimer);
      clearInterval(macroTimer);
      stopPricePolling();
    };
  }, []);

  // Universal Search
  useEffect(() => {
    if (!sq.trim()) {
      setSResults([]);
      setSLoading(false);
      return;
    }
    setSLoading(true);
    const t = setTimeout(() => {
      fetchStockSearch(sq).then(async (results) => {
        if (results.length > 0) {
          const topSyms = results.slice(0, 5).map(r => r.symbol);
          const quotes = await fetchYFQuotes(topSyms);
          const populated = results.map(r => {
            const q = quotes.find(item => item.symbol === r.symbol);
            return q ? { ...r, ...q } : r;
          });
          setSResults(populated);
        } else {
          setSResults(INITIAL_STOCKS.filter(s =>
            s.symbol.toLowerCase().includes(sq.toLowerCase()) || s.name.toLowerCase().includes(sq.toLowerCase())
          ));
        }
        setSLoading(false);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [sq]);

  const handleSelectStock = async (stk: StockData) => {
    if (!stk.price || stk.price === 0) {
      const live = await fetchYFQuote(stk.symbol);
      if (live) {
        setSelectedStock({ ...stk, ...live });
        return;
      }
    }
    setSelectedStock(stk);
  };

  const gainers = stocks.filter(s => (s.pct??0) > 0).sort((a,b) => (b.pct??0) - (a.pct??0));
  const losers  = stocks.filter(s => (s.pct??0) < 0).sort((a,b) => (a.pct??0) - (b.pct??0));
  const mostBought = [...stocks].slice(0, 6);

  return (
    <div className="w-full min-h-screen flex flex-col selection:bg-[#00D09C]/20" style={{ background: BG, color: TEXT1 }}>

      {/* ═══ 1. GROWW-STYLE STICKY NAVBAR ═════════════════════════ */}
      <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-[70px] flex items-center justify-between gap-6">

          {/* Logo */}
          <div onClick={() => setPage('explore')} className="flex items-center gap-3 cursor-pointer flex-shrink-0 group">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-md transition-transform group-hover:scale-105" style={{ background: GREEN }}>
              <Activity size={20} color="#fff" strokeWidth={2.6} />
            </div>
            <div className="flex flex-col">
              <span className="text-[21px] font-extrabold tracking-tight leading-none" style={{ color: TEXT1 }}>PulseAI</span>
              <span className="text-[10px] font-bold text-[#00D09C] uppercase tracking-wider mt-0.5">Event Quant</span>
            </div>
          </div>

          {/* Universal Search Bar */}
          <div className="flex-1 max-w-xl relative hidden md:block">
            <Search size={17} className="absolute left-4 top-3.5 text-[#9B9EA7]" />
            <input
              type="text" value={sq}
              onFocus={() => setSOpen(true)}
              onChange={e => { setSq(e.target.value); setSOpen(true); }}
              placeholder="What are you looking for today? (e.g. Reliance, Zomato, Nvidia, Apple)"
              className="w-full pl-11 pr-4 py-2.5 rounded-full text-sm outline-none transition-all focus:border-[#00D09C] focus:bg-white"
              style={{ background: BG3, border: `1px solid ${BORDER}`, color: TEXT1 }}
              onBlur={() => setTimeout(() => setSOpen(false), 250)}
            />
            {sOpen && sq.trim() && (
              <div className="absolute top-full left-0 w-full mt-2 rounded-2xl bg-white shadow-2xl border border-[#EAECEF] p-2 z-50 max-h-[380px] overflow-y-auto">
                <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#9B9EA7] flex items-center justify-between">
                  <span>Global Real-Time Matches</span>
                  {sLoading && <span className="text-[#00D09C] lowercase font-normal flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> live quotes</span>}
                </div>
                {(sResults.length ? sResults : INITIAL_STOCKS).slice(0, 8).map(stk => {
                  const c = getCurr(stk.currency, stk.symbol);
                  const pos = (stk.pct??0) >= 0;
                  return (
                    <div key={stk.symbol}
                      onMouseDown={() => { handleSelectStock(stk); setSOpen(false); setSq(''); }}
                      className="p-3 rounded-xl flex items-center justify-between hover:bg-[#F9FAFB] cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: GREEN }}>
                          {stk.symbol.slice(0,2).replace(/[^A-Za-z0-9]/g, '') || 'ST'}
                        </div>
                        <div>
                          <div className="font-bold text-sm" style={{ color: TEXT1 }}>{stk.name}</div>
                          <div className="text-xs text-[#9B9EA7]">{stk.symbol} · {stk.exchange || 'GLOBAL'}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        {stk.price && stk.price > 0 ? (
                          <>
                            <div className="font-bold text-sm" style={{ color: TEXT1, fontVariantNumeric:'tabular-nums' }}>{c}{f2(stk.price)}</div>
                            <div className="text-xs font-bold" style={{ color: pos ? GREEN : RED }}>{pct(stk.pct??0)}</div>
                          </>
                        ) : (
                          <span className="text-xs text-[#00D09C] font-semibold bg-[#EBFCF7] px-2.5 py-1 rounded-full">
                            View Live →
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-[14px] font-semibold">
            {[
              { id:'explore', label:'Explore' },
              { id:'predictor', label:'AI Predictor (USP)' },
              { id:'events', label:'Macro Factors' },
              { id:'screener', label:'Screener' },
            ].map(n => (
              <button key={n.id} onClick={() => setPage(n.id)}
                className="px-4 py-2 rounded-xl transition-all"
                style={{
                  color: page === n.id ? GREEN : TEXT2,
                  background: page === n.id ? '#EBFCF7' : 'transparent',
                }}>
                {n.label}
              </button>
            ))}
          </nav>

          {/* Auth CTA */}
          {user ? (
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F4F4F7] border border-[#EAECEF]">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.name || user.email} className="w-6 h-6 rounded-full object-cover border border-[#00D09C]/40" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-[#00D09C] text-white text-xs font-bold flex items-center justify-center">
                    {(user.name || user.email)[0].toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold leading-none" style={{ color: TEXT1 }}>{user.name || user.email.split('@')[0]}</span>
                  <span className="text-[10px] text-[#7C7E8C] leading-none mt-0.5 max-w-[120px] truncate">{user.email}</span>
                </div>
              </div>
              <button
                onClick={() => { logoutUser(); setUser(null); }}
                title="Sign Out"
                className="p-2 rounded-xl hover:bg-[#F4F4F7] text-[#7C7E8C] hover:text-[#EB5B3C] transition-colors"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => setAuthOpen(true)}
              className="px-6 py-2.5 rounded-full text-sm font-bold text-white transition-transform hover:scale-105 shadow-md"
              style={{ background: GREEN }}>
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* ═══ 2. INFINITE GLIDING INDICES TICKER (Groww Style) ═════ */}
      <div className="w-full overflow-hidden border-b bg-[#F9FAFB] marquee-container select-none cursor-pointer" style={{ borderColor: BORDER }}>
        <div className="animate-marquee py-2.5 flex items-center gap-8 text-xs font-semibold whitespace-nowrap">
          {[...indices, ...indices].map((idx, i) => {
            const pos = idx.changePct >= 0;
            return (
              <div
                key={i}
                onClick={() => {
                  const symbolMap: Record<string, string> = {
                    'NIFTY 50': '^NSEI',
                    'SENSEX': '^BSESN',
                    'BANK NIFTY': '^NSEBANK',
                    'S&P 500': '^GSPC',
                    'NASDAQ': '^IXIC',
                    'FTSE 100': '^FTSE',
                  };
                  const sym = symbolMap[idx.name] || idx.name;
                  handleSelectStock({
                    symbol: sym,
                    name: idx.name,
                    exchange: idx.name.includes('NIFTY') || idx.name.includes('SENSEX') ? 'NSE' : 'GLOBAL',
                    country: idx.currency === '₹' ? 'IN' : 'US',
                    currency: idx.currency === '₹' ? 'INR' : 'USD',
                    price: idx.value,
                    pct: idx.changePct,
                  });
                }}
                className="flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-[#EAECEF] shadow-2xs hover:border-[#00D09C] hover:shadow-md transition-all hover:scale-105 cursor-pointer active:scale-95"
                title={`Click to view live chart for ${idx.name}`}
              >
                <span className="text-[#7C7E8C]">{idx.name}</span>
                <span className="font-bold text-[#44475B]">{idx.currency}{f2(idx.value)}</span>
                <span className="font-bold flex items-center" style={{ color: pos ? GREEN : RED }}>
                  {pos ? <ArrowUpRight size={12}/> : <ArrowDownRight size={12}/>} {pct(idx.changePct)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ 3. DYNAMIC PAGE CONTENT ══════════════════════════════ */}
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── 3A. HOME / EXPLORE PAGE (GROWW PREMIUM LOOK & FEEL) ── */}
        {page === 'explore' && (
          <div className="space-y-16 animate-fade-in">

            {/* 🌟 HERO SECTION WITH FLOATING VISUAL CARDS */}
            <div className="relative pt-6 pb-12 overflow-hidden">
              <div className="grid lg:grid-cols-12 gap-10 items-center">
                
                {/* Left Hero Text */}
                <div className="lg:col-span-7 space-y-6 text-left">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#EBFCF7] text-[#00D09C] border border-[#00D09C]/25">
                    <Sparkles size={14} /> Next-Gen Quantitative Intelligence
                  </div>

                  <h1 className="text-[44px] sm:text-[60px] font-extrabold leading-[1.08] tracking-tight" style={{ color: TEXT1 }}>
                    The world moves.<br/>
                    <span style={{ color: GREEN }}>Markets follow.</span><br/>
                    <span style={{ color: TEXT3 }}>We show you why.</span>
                  </h1>

                  <p className="text-[17px] text-[#7C7E8C] leading-relaxed max-w-xl">
                    Discover how breaking geopolitical events, Fed rate decisions, and trade agreements impact stock prices in real-time — with AI direction forecasts and win probability scores.
                  </p>

                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <button
                      onClick={() => setPage('predictor')}
                      className="px-8 py-3.5 rounded-full font-bold text-[15px] text-white shadow-xl hover:opacity-95 transition-all hover:scale-105 flex items-center gap-2"
                      style={{ background: GREEN }}
                    >
                      <Sparkles size={18} /> Open AI Predictor (USP)
                    </button>
                    <button
                      onClick={() => setPage('events')}
                      className="px-7 py-3.5 rounded-full font-semibold text-[15px] border border-[#EAECEF] hover:bg-[#F9FAFB] transition-all flex items-center gap-2 text-[#44475B]"
                    >
                      <Radio size={18} className="text-[#00D09C]" /> Live Macro Feed
                    </button>
                  </div>
                </div>

                {/* Right Hero Visuals (Floating Interactive Bento Box) */}
                <div className="lg:col-span-5 relative">
                  
                  {/* Floating Card 1 (AI Predictor Highlight) */}
                  <div className="p-5 rounded-2xl bg-white border border-[#EAECEF] shadow-xl space-y-3 animate-float-slow hover:shadow-2xl transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-[#EBFCF7] text-[#00D09C] flex items-center justify-center font-bold text-xs">
                          AI
                        </div>
                        <span className="font-bold text-sm text-[#44475B]">Geopolitical Scenario Engine</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-[#EBFCF7] text-[#00D09C]">
                        94% WIN PROBABILITY
                      </span>
                    </div>
                    <p className="text-xs text-[#7C7E8C] leading-snug">
                      "Middle East maritime conflict expands Asian crude crack spreads."
                    </p>
                    <div className="p-3 rounded-xl bg-[#F9FAFB] flex items-center justify-between text-xs font-semibold">
                      <span className="text-[#44475B]">Lockheed Martin (LMT)</span>
                      <span className="text-[#00D09C] font-bold">▲ Target $512.40 (+4.85%)</span>
                    </div>
                  </div>

                  {/* Floating Card 2 (Live Real-Time Ticks) */}
                  <div className="mt-4 p-4 rounded-2xl bg-white border border-[#EAECEF] shadow-lg flex items-center justify-between animate-float-fast">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#00D09C] text-white flex items-center justify-center font-bold text-xs">
                        NV
                      </div>
                      <div>
                        <div className="font-bold text-sm text-[#44475B]">NVIDIA Corp</div>
                        <div className="text-xs text-[#9B9EA7]">NASDAQ · Real Time</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-base text-[#44475B]">$128.90</div>
                      <div className="text-xs font-bold text-[#00D09C] flex items-center justify-end">
                        <ArrowUpRight size={13} /> +5.24%
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </div>

            {/* 🏆 TRUST & PLATFORM STATS BAR */}
            <div className="p-6 rounded-2xl bg-[#F9FAFB] border border-[#EAECEF] grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <div className="text-2xl font-extrabold text-[#44475B]">₹12,400+ Cr</div>
                <div className="text-xs font-semibold text-[#7C7E8C] mt-1">Daily Volume Tracked</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-[#00D09C]">94.2%</div>
                <div className="text-xs font-semibold text-[#7C7E8C] mt-1">Scenario Prediction Accuracy</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-[#44475B]">500k+</div>
                <div className="text-xs font-semibold text-[#7C7E8C] mt-1">Geopolitical Events Analyzed</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-[#5367FF]">50+</div>
                <div className="text-xs font-semibold text-[#7C7E8C] mt-1">Global Stock Exchanges</div>
              </div>
            </div>

            {/* 📦 4 INTERACTIVE PRODUCT SHOWCASE CARDS (Groww Bento Grid) */}
            <div className="space-y-6">
              <div>
                <h2 className="text-[26px] font-extrabold text-[#44475B] tracking-tight">
                  Everything you need for market intelligence
                </h2>
                <p className="text-sm text-[#7C7E8C]">Powerful quantitative tools simplified for modern investors.</p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Product 1: Stocks Exploration */}
                <div
                  onClick={() => setPage('explore')}
                  className="p-6 rounded-2xl bg-white border border-[#EAECEF] hover:border-[#00D09C] hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#EBFCF7] text-[#00D09C] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <BarChart2 size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-[#44475B]">Global Stocks</h3>
                    <p className="text-xs text-[#7C7E8C] leading-relaxed">
                      Track live quotes across NSE, BSE, NASDAQ, NYSE, LSE in native currencies (₹, $, £, ¥).
                    </p>
                  </div>
                  <div className="mt-6 flex items-center text-xs font-bold text-[#00D09C] group-hover:translate-x-1 transition-transform">
                    Explore Stocks <ArrowRight size={14} className="ml-1" />
                  </div>
                </div>

                {/* Product 2: AI Predictor (USP) */}
                <div
                  onClick={() => setPage('predictor')}
                  className="p-6 rounded-2xl bg-white border border-[#00D09C]/40 bg-gradient-to-b from-[#EBFCF7]/30 to-white hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#00D09C] text-white flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                      <Sparkles size={24} />
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-[#44475B]">AI Predictor</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00D09C] text-white">USP</span>
                    </div>
                    <p className="text-xs text-[#7C7E8C] leading-relaxed">
                      Forecast UP/DOWN trajectory with quantitative win probabilities and causal reasons.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center text-xs font-bold text-[#00D09C] group-hover:translate-x-1 transition-transform">
                    Run AI Simulation <ArrowRight size={14} className="ml-1" />
                  </div>
                </div>

                {/* Product 3: Macro Events Wire */}
                <div
                  onClick={() => setPage('events')}
                  className="p-6 rounded-2xl bg-white border border-[#EAECEF] hover:border-[#5367FF] hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#5367FF] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Radio size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-[#44475B]">Macro Event Wire</h3>
                    <p className="text-xs text-[#7C7E8C] leading-relaxed">
                      Live geopolitical stream decoding how wars, tariffs, and Fed decisions move prices.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center text-xs font-bold text-[#5367FF] group-hover:translate-x-1 transition-transform">
                    View Live Feed <ArrowRight size={14} className="ml-1" />
                  </div>
                </div>

                {/* Product 4: Technical Terminal */}
                <div
                  onClick={() => setPage('screener')}
                  className="p-6 rounded-2xl bg-white border border-[#EAECEF] hover:border-[#00D09C] hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#F4F4F7] text-[#44475B] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Layers size={24} />
                    </div>
                    <h3 className="text-lg font-bold text-[#44475B]">Stock Screener</h3>
                    <p className="text-xs text-[#7C7E8C] leading-relaxed">
                      Interactive candlestick/area charts, volume histograms, and technical indicators.
                    </p>
                  </div>
                  <div className="mt-6 flex items-center text-xs font-bold text-[#44475B] group-hover:translate-x-1 transition-transform">
                    Open Screener <ArrowRight size={14} className="ml-1" />
                  </div>
                </div>

              </div>
            </div>

            {/* 📊 LIVE MARKET SECTIONS (Horizontal Carousels) */}
            <StockSection title="Most Active Global Stocks" stocks={mostBought} onSelect={handleSelectStock} />
            <StockSection title="Top Gainers Today" stocks={gainers.slice(0,6)} onSelect={handleSelectStock} />
            <StockSection title="Top Losers Today" stocks={losers.slice(0,6)} onSelect={handleSelectStock} />

            {/* 📋 LIVE EQUITIES TABLE */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold" style={{ color: TEXT1 }}>All Tracked Equities</h2>
                  <p className="text-xs text-[#7C7E8C]">Real-time quotes refreshed automatically every 4 seconds.</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-[#EBFCF7] text-[#00D09C] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#00D09C] animate-pulse" /> Live Streaming
                </span>
              </div>

              <div className="rounded-2xl border overflow-hidden bg-white shadow-sm" style={{ borderColor: BORDER }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: BG2 }}>
                      <th className="text-left px-5 py-3.5 font-bold" style={{ color: TEXT2 }}>Company</th>
                      <th className="text-right px-5 py-3.5 font-bold" style={{ color: TEXT2 }}>Live Price</th>
                      <th className="text-right px-5 py-3.5 font-bold" style={{ color: TEXT2 }}>1D Change (%)</th>
                      <th className="text-right px-5 py-3.5 font-bold hidden sm:table-cell" style={{ color: TEXT2 }}>Market Cap</th>
                      <th className="text-right px-5 py-3.5 font-bold hidden md:table-cell" style={{ color: TEXT2 }}>Sector</th>
                      <th className="text-right px-5 py-3.5 font-bold" style={{ color: TEXT2 }}>AI Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stocks.map((stk) => {
                      const c = getCurr(stk.currency, stk.symbol);
                      const pos = (stk.pct??0) >= 0;
                      const pred = calculateStockPrediction({ symbol: stk.symbol, name: stk.name, price: stk.price||100, pct: stk.pct||0, currency: c });
                      return (
                        <tr key={stk.symbol}
                          onClick={() => handleSelectStock(stk)}
                          className="cursor-pointer transition-colors hover:bg-[#F9FAFB]"
                          style={{ borderTop: `1px solid ${BORDER}` }}>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0"
                                style={{ background: GREEN }}>{stk.symbol.slice(0,2).replace(/[^A-Za-z0-9]/g, '') || 'ST'}</div>
                              <div>
                                <div className="font-bold" style={{ color: TEXT1 }}>{stk.name}</div>
                                <div className="text-xs text-[#9B9EA7]">{stk.symbol} · {stk.exchange}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-[15px]" style={{ color: TEXT1, fontVariantNumeric:'tabular-nums' }}>
                            {c}{f2(stk.price??100)}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className="font-bold text-sm inline-flex items-center gap-0.5"
                              style={{ color: pos ? GREEN : RED }}>
                              {pos ? <ArrowUpRight size={14}/> : <ArrowDownRight size={14}/>}
                              {pct(stk.pct??0)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right font-semibold hidden sm:table-cell" style={{ color: TEXT2 }}>
                            {stk.marketCap || '—'}
                          </td>
                          <td className="px-5 py-4 text-right hidden md:table-cell">
                            <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: BG3, color: TEXT2 }}>
                              {stk.sector || 'Large Cap'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                              style={{ background: pred.direction === 'UP' ? '#EBFCF7' : '#FEF2F2', color: pred.direction === 'UP' ? GREEN : RED }}>
                              {pred.direction === 'UP' ? '▲ BUY' : '▼ SELL'} ({pred.probability}%)
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 🚀 ZERO ROADBLOCKS BOTTOM CTA BANNER (Groww Style) */}
            <div className="rounded-3xl p-10 bg-gradient-to-r from-[#EBFCF7] via-white to-[#EEF2FF] border border-[#EAECEF] text-center space-y-4 shadow-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-[#00D09C]">Zero Roadblocks to Start</span>
              <h2 className="text-[32px] font-extrabold text-[#44475B]">
                Start analyzing real market trends today.
              </h2>
              <p className="text-sm text-[#7C7E8C] max-w-lg mx-auto">
                Join thousands of investors using real-time geopolitical intelligence and AI forecasting.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => setAuthOpen(true)}
                  className="px-8 py-3.5 rounded-full font-bold text-[15px] text-white shadow-lg hover:opacity-95 transition-all hover:scale-105"
                  style={{ background: GREEN }}
                >
                  Create Free Account
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ── 3B. AI PREDICTOR PAGE (USP) ─────────────────────── */}
        {page === 'predictor' && <PredictorPage stocks={stocks} onSelect={handleSelectStock} macroIndicators={macroIndicators} />}

        {/* ── 3C. EXTERNAL FACTORS PAGE ───────────────────────── */}
        {page === 'events' && <EventsPage events={events} onSelect={handleSelectStock} macroIndicators={macroIndicators} />}

        {/* ── 3D. SCREENER PAGE ───────────────────────────────── */}
        {page === 'screener' && <ScreenerPage stocks={stocks} onSelect={handleSelectStock} />}

      </main>

      {/* ═══ 4. STOCK DETAIL MODAL ════════════════════════════════ */}
      {selectedStock && <GrowwStockModal stock={selectedStock} events={events} onClose={() => setSelectedStock(null)} />}

      {/* ═══ 5. AUTH MODAL ════════════════════════════════════════ */}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={u => { setUser(u); setAuthOpen(false); }} />}

      {/* ═══ 6. COOL & VIBY MODERN FINTECH FOOTER ═══════════════════ */}
      <footer className="w-full mt-auto relative overflow-hidden bg-[#070913] text-white border-t border-white/10">
        {/* Ambient Top Glow Accent */}
        <div className="absolute top-0 left-1/4 w-96 h-32 bg-[#00D09C]/15 blur-3xl pointer-events-none rounded-full" />
        <div className="absolute top-0 right-1/4 w-96 h-32 bg-[#5367FF]/15 blur-3xl pointer-events-none rounded-full" />

        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          {/* Top Live Telemetry Badge Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-8 mb-10 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#00D09C]/10 border border-[#00D09C]/30 text-[#00D09C] text-xs font-bold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-[#00D09C] animate-ping" />
                <span>ALL ML MODELS & EXCHANGES LIVE</span>
              </div>
              <span className="hidden sm:inline text-xs text-white/50 font-mono">
                FastAPI Port 8000 · 14ms latency
              </span>
            </div>

            {/* Live Indices Mini Ticker */}
            <div className="flex items-center gap-4 text-xs font-mono overflow-x-auto">
              {indices.slice(0, 4).map((idx) => {
                const pos = idx.changePct >= 0;
                return (
                  <div key={idx.symbol} className="flex items-center gap-1.5 whitespace-nowrap">
                    <span className="text-white/60">{idx.name}:</span>
                    <span className="font-bold text-white">{f2(idx.price)}</span>
                    <span className={`text-[11px] font-bold ${pos ? 'text-[#00D09C]' : 'text-[#EB5B3C]'}`}>
                      {pos ? '▲' : '▼'}{Math.abs(idx.changePct).toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4-Column Modern Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12 text-sm">
            {/* Col 1 & 2: Brand & Mission */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-lg shadow-[#00D09C]/20" style={{ background: GREEN }}>
                  P
                </div>
                <span className="font-extrabold text-xl tracking-tight text-white">PulseAI</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-white/10 text-[#00D09C] border border-[#00D09C]/30">
                  v2.4 Quant
                </span>
              </div>
              <p className="text-sm text-white/70 leading-relaxed max-w-sm">
                The world moves. Markets follow. PulseAI streams real exchange feeds and decodes geopolitical shocks with multi-model predictive intelligence.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/80">
                  Python 3.13.15
                </span>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/80">
                  XGBoost 3.4.1
                </span>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/80">
                  PyTorch GRU
                </span>
                <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/80">
                  Prophet 1.4.0
                </span>
              </div>
            </div>

            {/* Col 3: Products */}
            <div>
              <h4 className="font-bold mb-4 text-xs uppercase tracking-wider text-[#00D09C]">Quantitative Tools</h4>
              <ul className="space-y-2.5 text-white/70 text-sm">
                <li className="hover:text-white hover:translate-x-0.5 transition-all cursor-pointer flex items-center gap-1.5" onClick={() => setPage('predictor')}>
                  <Sparkles size={13} className="text-[#00D09C]" /> AI Predictor (USP)
                </li>
                <li className="hover:text-white hover:translate-x-0.5 transition-all cursor-pointer flex items-center gap-1.5" onClick={() => setPage('events')}>
                  <Radio size={13} className="text-[#5367FF]" /> Macro Shocks Radar
                </li>
                <li className="hover:text-white hover:translate-x-0.5 transition-all cursor-pointer flex items-center gap-1.5" onClick={() => setPage('screener')}>
                  <Layers size={13} className="text-amber-400" /> Stock Screener
                </li>
                <li className="hover:text-white hover:translate-x-0.5 transition-all cursor-pointer flex items-center gap-1.5" onClick={() => setPage('explore')}>
                  <Globe size={13} className="text-emerald-400" /> Global Equities
                </li>
              </ul>
            </div>

            {/* Col 4: Global Markets */}
            <div>
              <h4 className="font-bold mb-4 text-xs uppercase tracking-wider text-[#5367FF]">Global Liquidity</h4>
              <ul className="space-y-2.5 text-white/70 text-sm">
                <li className="flex items-center justify-between">
                  <span>NSE & BSE (India)</span>
                  <span className="font-mono text-xs text-[#00D09C]">₹ INR</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>NYSE & NASDAQ (US)</span>
                  <span className="font-mono text-xs text-white/80">$ USD</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>LSE (London)</span>
                  <span className="font-mono text-xs text-white/80">£ GBP</span>
                </li>
                <li className="flex items-center justify-between">
                  <span>TSE (Tokyo)</span>
                  <span className="font-mono text-xs text-white/80">¥ JPY</span>
                </li>
              </ul>
            </div>

            {/* Col 5: Newsletter Capsule */}
            <div>
              <h4 className="font-bold mb-3 text-xs uppercase tracking-wider text-amber-400">Macro Shock Radar</h4>
              <p className="text-xs text-white/60 leading-relaxed mb-3">
                Get high-impact geopolitical event transmissions & win probability forecasts delivered before the bell.
              </p>
              <FooterNewsletter />
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-white/50">
            <div className="flex flex-wrap items-center gap-4">
              <span>© 2026 PulseAI Technologies Inc. All rights reserved.</span>
              <span className="hidden sm:inline">·</span>
              <span>Real-Time Market Data via Global Feeds</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[#00D09C] font-mono text-[11px]">
                <Shield size={12} /> 256-Bit Encrypted Session
              </span>
              <span className="text-white/30">|</span>
              <a href="https://github.com/saenyamgoyal17/Stock-Market-Trend-Analyser-" target="_blank" rel="noreferrer"
                className="hover:text-[#00D09C] transition-colors flex items-center gap-1">
                GitHub <ExternalLink size={11} />
              </a>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   FOOTER NEWSLETTER CAPSULE
   ───────────────────────────────────────────────────────────────── */
function FooterNewsletter() {
  const [subEmail, setSubEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subEmail || !subEmail.includes('@')) return;
    setSubscribed(true);
  };

  if (subscribed) {
    return (
      <div className="p-3 rounded-xl bg-[#00D09C]/10 border border-[#00D09C]/30 text-xs text-[#00D09C] flex items-center gap-2 animate-fade-in font-medium">
        <CheckCircle2 size={14} className="flex-shrink-0" />
        <span>Subscribed! You'll receive real-time shock alerts.</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="relative">
        <input
          type="email"
          required
          placeholder="your.email@firm.com"
          value={subEmail}
          onChange={(e) => setSubEmail(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl text-xs bg-white/5 border border-white/10 text-white placeholder-white/40 outline-none focus:border-[#00D09C] transition-colors"
        />
      </div>
      <button
        type="submit"
        className="w-full py-2 rounded-xl text-xs font-bold text-white bg-[#00D09C] hover:bg-[#00b084] transition-all hover:scale-[1.02] shadow-md shadow-[#00D09C]/20"
      >
        Subscribe to Radar
      </button>
    </form>
  );
}

/* ─────────────────────────────────────────────────────────────────
   STOCK SECTION (horizontal scroll cards like Groww)
   ───────────────────────────────────────────────────────────────── */
function StockSection({ title, stocks, onSelect }: { title: string; stocks: StockData[]; onSelect: (s: StockData) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: TEXT1 }}>{title}</h2>
        <button className="text-xs font-bold flex items-center gap-1 hover:underline" style={{ color: GREEN }}>
          See All <ChevronRight size={14} />
        </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {stocks.map(stk => {
          const c = getCurr(stk.currency, stk.symbol);
          const pos = (stk.pct??0) >= 0;
          return (
            <div key={stk.symbol} onClick={() => onSelect(stk)}
              className="min-w-[210px] p-4 rounded-2xl bg-white border cursor-pointer transition-all hover:shadow-md hover:border-[#00D09C] flex-shrink-0"
              style={{ borderColor: BORDER }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-xs" style={{ background: GREEN }}>
                  {stk.symbol.slice(0,2).replace(/[^A-Za-z0-9]/g, '') || 'ST'}
                </div>
                <div className="overflow-hidden">
                  <div className="font-bold text-sm truncate" style={{ color: TEXT1 }}>{stk.name}</div>
                  <div className="text-xs text-[#9B9EA7]">{stk.symbol}</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm" style={{ color: TEXT1, fontVariantNumeric:'tabular-nums' }}>
                  {c}{f2(stk.price??100)}
                </span>
                <span className="text-xs font-bold flex items-center gap-0.5"
                  style={{ color: pos ? GREEN : RED }}>
                  {pos ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>} {pct(stk.pct??0)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   AI PREDICTOR PAGE (USP) - REAL-TIME & LIVE DATA
   ───────────────────────────────────────────────────────────────── */
function PredictorPage({ stocks, onSelect, macroIndicators }: { stocks: StockData[]; onSelect: (s: StockData) => void; macroIndicators?: MacroIndicator[] }) {
  const [mode, setMode] = useState<'geo'|'single'>('geo');
  const [scenario, setScenario] = useState('');
  const [activePred, setActivePred] = useState<GeopoliticalScenarioPrediction>(
    predictGeopoliticalShock('War escalation between Iran and Israel threatening crude transit corridors')
  );
  const [loading, setLoading] = useState(false);
  const [selSym, setSelSym] = useState(stocks[0]?.symbol || 'NVDA');
  const current = stocks.find(s => s.symbol === selSym) || stocks[0] || INITIAL_STOCKS[0];
  const [mlData, setMlData] = useState<MLForecastResults | null>(null);
  const [mlLoading, setMlLoading] = useState(false);

  // Automatically hydrate geopolitical picks with real live market prices
  useEffect(() => {
    let cancelled = false;
    const syms = activePred.highProbabilityPicks.map(p => p.symbol);
    fetchYFQuotes(syms).then(quotes => {
      if (cancelled || !quotes || quotes.length === 0) return;
      const quoteMap: Record<string, { price: number; pct?: number }> = {};
      quotes.forEach(q => { quoteMap[q.symbol] = { price: q.price || 0, pct: q.pct || 0 }; });
      setActivePred(prev => predictGeopoliticalShock(scenario || prev.scenarioHeadline, quoteMap));
    });
    return () => { cancelled = true; };
  }, [scenario]);

  // Fetch real ML predictions when single stock is selected
  useEffect(() => {
    if (mode !== 'single') return;
    let cancelled = false;
    setMlLoading(true);
    fetchMLPredictions(selSym, '1y', 15, current.price).then(res => {
      if (!cancelled && res) setMlData(res);
      setMlLoading(false);
    });
    return () => { cancelled = true; };
  }, [selSym, mode, current.price]);

  const runScenario = async (text: string) => {
    setLoading(true);
    const chosenText = text || scenario || 'War escalation between Iran and Israel';
    const draft = predictGeopoliticalShock(chosenText);
    try {
      const syms = draft.highProbabilityPicks.map(p => p.symbol);
      const quotes = await fetchYFQuotes(syms);
      const quoteMap: Record<string, { price: number; pct?: number }> = {};
      quotes.forEach(q => { quoteMap[q.symbol] = { price: q.price || 0, pct: q.pct || 0 }; });
      setActivePred(predictGeopoliticalShock(chosenText, quoteMap));
    } catch {
      setActivePred(draft);
    } finally {
      setLoading(false);
    }
  };

  const singlePred = calculateStockPrediction({
    symbol: current.symbol,
    name: current.name,
    price: current.price || 150,
    pct: current.pct || 0,
    currency: getCurr(current.currency, current.symbol),
    sector: current.sector,
  });

  const mlDir = mlData?.direction;
  const isUp = mlDir ? mlDir.direction === 'up' : singlePred.direction === 'UP';
  const winProb = mlDir ? Math.round(mlDir.confidence * 100) : singlePred.probability;
  const mlTarget = mlData?.xgboost?.forecast?.[14]?.predicted ?? singlePred.targetPrice;
  const expectedMove = current.price > 0 ? +(((mlTarget - current.price) / current.price) * 100).toFixed(2) : singlePred.expectedMovePct;

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#EBFCF7', color: GREEN }}>
            PulseAI USP · Real-Time Market Intelligence
          </span>
          <h1 className="text-2xl font-extrabold mt-2" style={{ color: TEXT1 }}>
            AI Stock Direction & Geopolitical Shock Predictor
          </h1>
          <p className="text-sm mt-1" style={{ color: TEXT2 }}>
            Predict stock price trajectories with explicit win probability percentages and causal transmission reasoning.
          </p>
        </div>

        {/* Live Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#EAECEF] text-xs font-mono shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-[#00D09C] animate-ping" />
          <span className="text-[#44475B] font-bold">LIVE ML ENGINE ACTIVE</span>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-0 rounded-xl overflow-hidden border w-fit shadow-2xs" style={{ borderColor: BORDER }}>
        <button onClick={() => setMode('geo')}
          className="px-6 py-3 text-sm font-bold transition-all"
          style={{ background: mode==='geo' ? GREEN : BG, color: mode==='geo' ? '#fff' : TEXT2 }}>
          Geopolitical Shock Predictor (USP)
        </button>
        <button onClick={() => setMode('single')}
          className="px-6 py-3 text-sm font-bold transition-all"
          style={{ background: mode==='single' ? GREEN : BG, color: mode==='single' ? '#fff' : TEXT2 }}>
          Single Stock ML Forecast
        </button>
      </div>

      {mode === 'geo' && (
        <div className="space-y-6">
          {/* Scenario Input */}
          <div className="p-6 rounded-2xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
            <label className="text-xs font-bold uppercase mb-2 block text-[#00D09C]">
              Enter Any Geopolitical Event / War / Tariff Scenario (Real-Time Causal Engine)
            </label>
            <div className="flex gap-3">
              <input type="text" value={scenario} onChange={e => setScenario(e.target.value)}
                placeholder="e.g. War breaks out between Iran and Israel threatening crude oil transit corridors..."
                className="flex-1 px-4 py-3 rounded-xl text-sm outline-none focus:border-[#00D09C]"
                style={{ background: BG3, border: `1px solid ${BORDER}`, color: TEXT1 }} />
              <button onClick={() => runScenario(scenario)} disabled={loading}
                className="px-7 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 hover:opacity-95 shadow-md transition-transform active:scale-95"
                style={{ background: GREEN }}>
                {loading ? 'Analyzing...' : 'Predict Impact'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {['War between Iran and Israel', 'US 45% tariff on semiconductors', 'OPEC+ cuts 3.5M barrels', 'Fed emergency 50bps rate cut'].map(t => (
                <button key={t} onClick={() => { setScenario(t); runScenario(t); }}
                  className="text-xs font-semibold px-3.5 py-1.5 rounded-lg border hover:border-[#00D09C] transition-colors"
                  style={{ borderColor: BORDER, color: TEXT2 }}>{t}</button>
              ))}
            </div>
          </div>

          {/* Results */}
          <div className="p-6 rounded-2xl border bg-white shadow-sm space-y-6" style={{ borderColor: BORDER }}>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold"
                  style={{ background: activePred.macroImpactSentiment >= 0 ? '#EBFCF7' : '#FEF2F2', color: activePred.macroImpactSentiment >= 0 ? GREEN : RED }}>
                  {activePred.macroImpactSentiment >= 0 ? '▲ Net Bullish Shock' : '▼ Net Bearish Shock'}
                </span>
                <span className="text-xs text-[#9B9EA7] font-mono">Real-Time LTP Calibrated</span>
              </div>
              <h2 className="text-xl font-bold" style={{ color: TEXT1 }}>{activePred.scenarioHeadline}</h2>
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: TEXT2 }}>{activePred.summary}</p>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase mb-3 text-[#00D09C]">Highest Probability Stock Forecasts</h3>
              <div className="space-y-3">
                {activePred.highProbabilityPicks.map(pick => {
                  const up = pick.direction === 'UP';
                  const cs = pick.currency === 'INR' ? '₹' : pick.currency === 'GBP' ? '£' : '$';
                  return (
                    <div key={pick.symbol}
                      onClick={() => onSelect({ symbol: pick.symbol, name: pick.name, price: pick.currentPrice, pct: pick.expectedMovePct, currency: pick.currency, exchange:'GLOBAL', country:'GLOBAL' })}
                      className="p-4 rounded-xl border cursor-pointer hover:shadow-md hover:border-[#00D09C] transition-all bg-white"
                      style={{ borderColor: BORDER }}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <span className="font-bold text-base" style={{ color: TEXT1 }}>{pick.symbol}</span>
                          <span className="text-xs ml-2 text-[#9B9EA7]">{pick.name}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs px-3 py-1 rounded-full font-bold"
                            style={{ background: up ? '#EBFCF7' : '#FEF2F2', color: up ? GREEN : RED }}>
                            {up ? '▲ WILL GO UP' : '▼ WILL GO DOWN'} ({pick.winProbability}% PROBABILITY)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span style={{ color: TEXT2 }}>
                          Current Price: <b style={{ color: TEXT1 }}>{cs}{f2(pick.currentPrice)}</b> · Target: <b style={{ color: up ? GREEN : RED }}>{cs}{f2(pick.predictedPrice)}</b>
                        </span>
                        <span className="font-bold font-mono" style={{ color: up ? GREEN : RED }}>{pct(pick.expectedMovePct)}</span>
                      </div>
                      <p className="text-xs leading-relaxed" style={{ color: TEXT2 }}>
                        <b style={{ color: GREEN }}>Causal Mechanism:</b> {pick.causalMechanism}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {mode === 'single' && (
        <div className="space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {stocks.slice(0, 10).map(s => (
              <button key={s.symbol} onClick={() => setSelSym(s.symbol)}
                className="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all"
                style={{ background: selSym === s.symbol ? GREEN : BG, color: selSym === s.symbol ? '#fff' : TEXT2, border: `1px solid ${selSym === s.symbol ? GREEN : BORDER}` }}>
                {s.symbol}
              </button>
            ))}
          </div>

          <div className="p-6 rounded-2xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
            <div className="flex flex-wrap items-center justify-between mb-4 pb-4 gap-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold" style={{ background: isUp ? '#EBFCF7' : '#FEF2F2', color: isUp ? GREEN : RED }}>
                    {winProb}% Win Probability
                  </span>
                  {mlDir?.backtest_accuracy && (
                    <span className="text-[11px] font-mono text-[#7C7E8C]">
                      Backtest Accuracy: <b className="text-[#44475B]">{(mlDir.backtest_accuracy * 100).toFixed(1)}%</b>
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold mt-1" style={{ color: TEXT1 }}>{current.symbol} — {current.name}</h2>
                <p className="text-xs mt-0.5" style={{ color: TEXT2 }}>
                  Live Price: <b className="text-[#44475B]">{getCurr(current.currency, current.symbol)}{f2(current.price)}</b> · 15-Day ML Horizon
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold" style={{ color: isUp ? GREEN : RED }}>
                  {isUp ? '▲ Going Up' : '▼ Going Down'}
                </div>
                <div className="text-sm font-semibold" style={{ color: TEXT2 }}>
                  Target: {getCurr(current.currency, current.symbol)}{f2(mlTarget)} ({pct(expectedMove)})
                </div>
              </div>
            </div>

            {/* Embedded Stock Chart with Live ML Predictions */}
            <div className="mb-6">
              <StockChart symbol={current.symbol} currentPrice={current.price} changePct={current.pct} height={260} currencySymbol={getCurr(current.currency, current.symbol)} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border" style={{ borderColor: BORDER }}>
                <h5 className="text-xs font-bold uppercase mb-3 text-[#00D09C]">XGBoost Feature Importance</h5>
                {mlDir?.feature_importance ? (
                  Object.entries(mlDir.feature_importance).map(([feat, imp]) => (
                    <div key={feat} className="flex justify-between items-center py-2 border-b last:border-0 text-xs font-mono" style={{ borderColor: '#F0F0F2' }}>
                      <span className="text-[#44475B] font-medium">{feat.toUpperCase()}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-[#F0F0F2] overflow-hidden">
                          <div className="h-full bg-[#00D09C]" style={{ width: `${Math.min(100, Math.round(Number(imp) * 100 * 3))}%` }} />
                        </div>
                        <span className="font-bold text-[#00D09C] w-10 text-right">{(Number(imp) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))
                ) : (
                  singlePred.technicalFactors.map((tf, i) => (
                    <div key={i} className="flex justify-between py-2 border-b last:border-0 text-sm" style={{ borderColor: '#F0F0F2' }}>
                      <span style={{ color: TEXT2 }}>{tf.factor}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#EBFCF7', color: GREEN }}>{tf.signal}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="p-4 rounded-xl border" style={{ borderColor: BORDER }}>
                <h5 className="text-xs font-bold uppercase mb-3 text-[#5367FF]">Fundamental & Macro Drivers</h5>
                {singlePred.fundamentalFactors.map((ff, i) => (
                  <div key={i} className="flex justify-between py-2 border-b last:border-0 text-sm" style={{ borderColor: '#F0F0F2' }}>
                    <span style={{ color: TEXT2 }}>{ff.factor}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#EEF2FF', color: BLUE }}>{ff.signal}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   EXTERNAL FACTORS PAGE - REAL-TIME MACRO TELEMETRY
   ───────────────────────────────────────────────────────────────── */
function EventsPage({ events, onSelect, macroIndicators }: { events: WorldEventItem[]; onSelect: (s: StockData) => void; macroIndicators?: MacroIndicator[] }) {
  const [sel, setSel] = useState(events[0] || EVENTS[0]);

  const catColor = (c: string) => {
    if (c?.toLowerCase().includes('military')) return { bg: '#FEF2F2', fg: RED };
    if (c?.toLowerCase().includes('geo')) return { bg: '#F3E8FF', fg: '#A855F7' };
    if (c?.toLowerCase().includes('eco')) return { bg: '#EEF2FF', fg: BLUE };
    return { bg: '#EBFCF7', fg: GREEN };
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#EBFCF7', color: GREEN }}>
          PulseAI USP · Real-Time Macro Feeds
        </span>
        <h1 className="text-2xl font-extrabold mt-2" style={{ color: TEXT1 }}>External Factors & Event Impact Feed</h1>
        <p className="text-sm mt-1" style={{ color: TEXT2 }}>
          Live macroeconomic indicators and breaking geopolitical events with quantitative causal transmission analysis.
        </p>
      </div>

      {/* Real-time Macro Factors Live Telemetry */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00D09C] animate-ping" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#44475B]">
              Real-Time Global Macroeconomic Indicators
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[#00D09C] bg-[#EBFCF7] px-2.5 py-0.5 rounded-full font-bold">
            Live Stream Active
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {(macroIndicators && macroIndicators.length > 0 ? macroIndicators : [
            { symbol: 'CL=F', name: 'WTI Crude Oil', value: 91.48, change_pct: 0.20, unit: '$/bbl', signal: 'bullish', implication: 'Elevated input costs for airlines & transports.' },
            { symbol: 'GC=F', name: 'Gold Spot', value: 4476.60, change_pct: -0.34, unit: '$/oz', signal: 'bearish', implication: 'Capital rotation towards risk assets.' },
            { symbol: '^TNX', name: 'US 10Y Yield', value: 4.78, change_pct: 0.42, unit: '%', signal: 'bullish', implication: 'Discount rate pressure on growth valuations.' },
            { symbol: '^VIX', name: 'CBOE VIX', value: 14.53, change_pct: 1.47, unit: 'pts', signal: 'bullish', implication: 'Moderate hedging demand in options market.' },
            { symbol: 'DX-Y.NYB', name: 'US Dollar Index', value: 99.16, change_pct: 0.16, unit: 'pts', signal: 'bullish', implication: 'Relative USD strength vs major currencies.' },
          ]).map((ind: any) => {
            const up = (ind.change_pct ?? 0) >= 0;
            return (
              <div key={ind.symbol} className="p-3.5 rounded-xl border bg-white shadow-2xs space-y-1.5 hover:border-[#00D09C] transition-colors" style={{ borderColor: BORDER }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#44475B] truncate">{ind.name}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${up ? 'bg-[#EBFCF7] text-[#00D09C]' : 'bg-[#FEF2F2] text-[#EB5B3C]'}`}>
                    {up ? '▲' : '▼'}{Math.abs(ind.change_pct).toFixed(2)}%
                  </span>
                </div>
                <div className="text-base font-extrabold text-[#111827]">
                  {Number(ind.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-[10px] font-normal text-[#9B9EA7] ml-1">{ind.unit}</span>
                </div>
                <p className="text-[10px] text-[#7C7E8C] line-clamp-2 leading-tight">
                  {ind.implication}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 space-y-3 max-h-[700px] overflow-y-auto">
          {events.map(ev => {
            const active = ev.id === sel.id;
            const cc = catColor(ev.cat);
            return (
              <div key={ev.id} onClick={() => setSel(ev)}
                className="p-4 rounded-xl border cursor-pointer transition-all hover:border-[#00D09C]"
                style={{ borderColor: active ? GREEN : BORDER, background: active ? '#F0FDF9' : BG }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase" style={{ background: cc.bg, color: cc.fg }}>{ev.cat}</span>
                  <span className="text-[11px] text-[#9B9EA7]">{ev.ago}</span>
                </div>
                <h3 className="text-sm font-bold leading-snug" style={{ color: TEXT1 }}>{ev.headline}</h3>
                <div className="mt-2.5 flex items-center justify-between text-xs pt-2.5" style={{ borderTop: `1px solid ${BORDER}` }}>
                  <span className="text-[#9B9EA7]">{ev.stocks?.length || 0} stocks affected</span>
                  <span className="font-bold text-[#00D09C]">View details →</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-7 p-6 rounded-2xl border bg-white shadow-sm space-y-5" style={{ borderColor: BORDER }}>
          <div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase" style={{ background: catColor(sel.cat).bg, color: catColor(sel.cat).fg }}>
              {sel.cat}
            </span>
            <h2 className="text-lg font-bold mt-2 leading-snug" style={{ color: TEXT1 }}>{sel.headline}</h2>
            <p className="text-sm mt-2 leading-relaxed" style={{ color: TEXT2 }}>{sel.body}</p>
          </div>

          {sel.stocks?.[0] && (
            <div>
              <StockChart symbol={sel.stocks[0].sym} currentPrice={sel.stocks[0].price} changePct={sel.stocks[0].chg} height={200} currencySymbol={getCurr(undefined, sel.stocks[0].sym)} />
            </div>
          )}

          <div>
            <h4 className="text-xs font-bold uppercase mb-3 text-[#00D09C]">Affected Stocks & Causal Reasoning</h4>
            <div className="space-y-3">
              {sel.stocks?.map(stk => (
                <div key={stk.sym}
                  onClick={() => onSelect({ symbol: stk.sym, name: stk.name, price: stk.price, pct: stk.chg, currency: stk.sym.includes('.NS') ? 'INR' : 'USD', exchange:'GLOBAL', country:'GLOBAL' })}
                  className="p-4 rounded-xl border cursor-pointer hover:shadow-md hover:border-[#00D09C] transition-all"
                  style={{ borderColor: BORDER }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-sm" style={{ color: TEXT1 }}>{stk.sym} · {stk.name}</span>
                    <span className="font-bold text-sm" style={{ color: (stk.chg??0) >= 0 ? GREEN : RED }}>{pct(stk.chg??0)}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: TEXT2 }}>{stk.reason}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   AUTH MODAL — OFFICIAL GOOGLE OAUTH POPUP
   Clicking "Sign in with Google" directly and only triggers the
   official Google popup (accounts.google.com) to choose accounts.
   ───────────────────────────────────────────────────────────────── */
function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (u: UserProfile) => void }) {
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string|null>(null);

  /** Direct Official Google Popup */
  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      let cId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || localStorage.getItem('pulseai_google_client_id');
      if (!cId || cId.includes('dummy') || cId.includes('1047648192837')) {
        const inputId = window.prompt(
          "Enter your Google Cloud OAuth Client ID (from console.cloud.google.com) to open the official Google popup:",
          localStorage.getItem('pulseai_google_client_id') || ""
        );
        if (!inputId || !inputId.trim()) {
          setGoogleLoading(false);
          return;
        }
        cId = inputId.trim();
        localStorage.setItem('pulseai_google_client_id', cId);
      }

      // Automatically triggers official popup window to accounts.google.com
      const user = await signInWithGoogleReal(cId);
      onSuccess(user);
    } catch (err: any) {
      console.error('Google Sign-In error:', err);
      if (err?.message === 'NO_CLIENT_ID') {
        setError('Please enter a valid Google Cloud Client ID.');
      } else {
        setError(err?.message || 'Google Sign-In was cancelled or failed.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  /** Email/Password Auth */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        const u = loginRealAccount(email, password);
        onSuccess(u);
      } else {
        const u = registerRealAccount(email, password, name);
        onSuccess(u);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md p-7 rounded-2xl bg-white shadow-2xl relative animate-fade-in" onClick={e => e.stopPropagation()}>

        {/* Close Button */}
        <button onClick={onClose} className="absolute right-4 top-4 p-1.5 rounded-lg hover:bg-[#F4F4F7] transition-colors">
          <X size={18} className="text-[#7C7E8C]" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: GREEN }}>P</div>
          <span className="font-bold text-lg" style={{ color: TEXT1 }}>PulseAI</span>
        </div>

        <h3 className="text-xl font-bold mb-1" style={{ color: TEXT1 }}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h3>
        <p className="text-sm mb-5 text-[#7C7E8C]">
          Access real-time market intelligence, live macro telemetry, and AI predictions.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-[#EB5B3C] flex items-center gap-2">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── OFFICIAL GOOGLE SIGN-IN BUTTON ── */}
        <button
          type="button"
          disabled={googleLoading}
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border text-sm font-semibold mb-4 hover:bg-[#F9FAFB] transition-all shadow-2xs hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 cursor-pointer"
          style={{ borderColor: BORDER, color: TEXT1 }}
        >
          {googleLoading ? (
            <RefreshCw size={16} className="animate-spin text-[#4285F4]" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"/>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
              <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2s.7 5.5 1.9 7.9l3.7-2.9z"/>
              <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16.5C3.7 20.4 7.5 23.5 12 23.5z"/>
            </svg>
          )}
          <span>{googleLoading ? 'Opening accounts.google.com...' : 'Sign in with Google'}</span>
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px" style={{ background: BORDER }} />
          <span className="text-xs uppercase text-[#9B9EA7]">or continue with email</span>
          <div className="flex-1 h-px" style={{ background: BORDER }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <input type="text" required placeholder="Full Name" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:border-[#00D09C]"
              style={{ border: `1px solid ${BORDER}`, color: TEXT1 }} />
          )}
          <input type="email" required placeholder="name@domain.com" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:border-[#00D09C]"
            style={{ border: `1px solid ${BORDER}`, color: TEXT1 }} />
          <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:border-[#00D09C]"
            style={{ border: `1px solid ${BORDER}`, color: TEXT1 }} />
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm text-white mt-1 hover:opacity-95 shadow-md transition-all hover:scale-[1.01] cursor-pointer"
            style={{ background: GREEN }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="text-center mt-4 text-sm text-[#7C7E8C]">
          {mode === 'login' ? (
            <>Don't have an account? <button onClick={() => setMode('register')} className="font-bold text-[#00D09C] cursor-pointer">Sign up</button></>
          ) : (
            <>Already registered? <button onClick={() => setMode('login')} className="font-bold text-[#00D09C] cursor-pointer">Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SCREENER PAGE — LIVE GLOBAL STOCK SCREENER
   Supports instant catalog filtering + live Yahoo Finance global
   search for ANY stock in the world with real LTP, change %, and volume.
   ───────────────────────────────────────────────────────────────── */
function ScreenerPage({ stocks, onSelect }: { stocks: StockData[]; onSelect: (s: StockData) => void }) {
  const [search, setSearch] = useState('');
  const [liveSearchResults, setLiveSearchResults] = useState<StockData[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<string>('All');
  const [exchangeFilter, setExchangeFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name'|'price'|'pct'|'volume'|'marketCap'>('pct');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // Debounced Live Search for ANY stock in the world via Yahoo Finance
  useEffect(() => {
    if (!search.trim() || search.trim().length < 2) {
      setLiveSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await fetchStockSearch(search.trim());
        if (results && results.length > 0) {
          const topSyms = results.slice(0, 10).map(r => r.symbol);
          const quotes = await fetchYFQuotes(topSyms);
          const populated = results.slice(0, 10).map(r => {
            const q = quotes.find(item => item.symbol === r.symbol);
            return q ? { ...r, ...q } : r;
          });
          setLiveSearchResults(populated);
        } else {
          setLiveSearchResults([]);
        }
      } catch (err) {
        console.warn('Screener live search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  // Combine base stocks + live search results (deduplicated by symbol)
  const combinedStocks = useMemo(() => {
    const map = new Map<string, StockData>();
    stocks.forEach(s => map.set(s.symbol, s));
    liveSearchResults.forEach(s => {
      if (!map.has(s.symbol)) {
        map.set(s.symbol, s);
      }
    });
    return Array.from(map.values());
  }, [stocks, liveSearchResults]);

  // Extract unique sectors and exchanges from the combined data
  const sectors = useMemo(() => {
    const s = new Set(combinedStocks.map(st => st.sector).filter(Boolean));
    return ['All', ...Array.from(s).sort()];
  }, [combinedStocks]);

  const exchanges = useMemo(() => {
    const e = new Set(combinedStocks.map(st => st.exchange).filter(Boolean));
    return ['All', ...Array.from(e).sort()];
  }, [combinedStocks]);

  // Filter & Sort
  const filtered = useMemo(() => {
    let result = [...combinedStocks];

    // Text search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(s =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.sector || '').toLowerCase().includes(q) ||
        (s.exchange || '').toLowerCase().includes(q)
      );
    }

    // Sector filter
    if (sectorFilter !== 'All') {
      result = result.filter(s => s.sector === sectorFilter);
    }

    // Exchange filter
    if (exchangeFilter !== 'All') {
      result = result.filter(s => s.exchange === exchangeFilter);
    }

    // Sort
    result.sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0;
      switch (sortBy) {
        case 'name': va = a.name.toLowerCase(); vb = b.name.toLowerCase(); break;
        case 'price': va = a.price ?? 0; vb = b.price ?? 0; break;
        case 'pct': va = a.pct ?? 0; vb = b.pct ?? 0; break;
        case 'volume': va = a.volume ?? 0; vb = b.volume ?? 0; break;
        case 'marketCap':
          va = parseMarketCap(a.marketCap);
          vb = parseMarketCap(b.marketCap);
          break;
      }
      if (typeof va === 'string' && typeof vb === 'string') {
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    return result;
  }, [combinedStocks, search, sectorFilter, exchangeFilter, sortBy, sortDir]);

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => {
    if (sortBy !== col) return <ArrowUp size={12} className="opacity-20" />;
    return sortDir === 'asc'
      ? <ArrowUp size={12} className="text-[#00D09C]" />
      : <ArrowDown size={12} className="text-[#00D09C]" />;
  };

  const gainers = filtered.filter(s => (s.pct ?? 0) > 0).length;
  const losers = filtered.filter(s => (s.pct ?? 0) < 0).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold" style={{ color: TEXT1 }}>Stock Screener</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">
              Live Feed Active
            </span>
          </div>
          <p className="text-sm text-[#7C7E8C] mt-0.5">
            Filter, search, and screen global and Indian stocks with live real-time market data
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
            ▲ {gainers} Gainers
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-600 font-semibold border border-red-200">
            ▼ {losers} Losers
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 font-semibold border border-gray-200">
            {filtered.length} Stocks Listed
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9B9EA7]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search any stock, ticker, or sector (e.g. Tata, Zomato, Google, TSLA, NVDA)..."
            className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm border border-[#EAECEF] focus:outline-none focus:border-[#00D09C] bg-white transition-all shadow-2xs"
            style={{ color: TEXT1 }}
          />
          {isSearching && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-[#00D09C]">
              <RefreshCw size={13} className="animate-spin" />
              <span className="hidden sm:inline">Searching...</span>
            </div>
          )}
          {search && !isSearching && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Toggle Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all hover:bg-gray-50 shadow-2xs"
          style={{
            borderColor: showFilters ? GREEN : BORDER,
            color: showFilters ? GREEN : TEXT2,
            background: showFilters ? '#EBFCF7' : 'white',
          }}
        >
          <SlidersHorizontal size={15} />
          <span>Filters</span>
          {(sectorFilter !== 'All' || exchangeFilter !== 'All') && (
            <span className="w-5 h-5 rounded-full bg-[#00D09C] text-white text-[10px] flex items-center justify-center font-bold">
              {(sectorFilter !== 'All' ? 1 : 0) + (exchangeFilter !== 'All' ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Filter Chips (collapsible) */}
      {showFilters && (
        <div className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-[#F9FAFB] border border-[#EAECEF] animate-fade-in">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-bold text-[#44475B] uppercase tracking-wide">Sector</label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {sectors.map(s => (
                <button key={s} onClick={() => setSectorFilter(s)}
                  className="px-3 py-1 text-xs rounded-full font-semibold transition-all"
                  style={{
                    background: sectorFilter === s ? GREEN : '#EAECEF',
                    color: sectorFilter === s ? 'white' : TEXT2,
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-bold text-[#44475B] uppercase tracking-wide">Exchange</label>
            <div className="flex flex-wrap gap-1.5">
              {exchanges.map(ex => (
                <button key={ex} onClick={() => setExchangeFilter(ex)}
                  className="px-3 py-1 text-xs rounded-full font-semibold transition-all"
                  style={{
                    background: exchangeFilter === ex ? BLUE : '#EAECEF',
                    color: exchangeFilter === ex ? 'white' : TEXT2,
                  }}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setSectorFilter('All'); setExchangeFilter('All'); }}
              className="text-xs font-semibold text-[#EB5B3C] hover:underline whitespace-nowrap px-2 py-1"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#EAECEF] overflow-hidden shadow-2xs">
        {/* Table Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-5 py-3.5 bg-[#F9FAFB] border-b border-[#EAECEF] text-xs font-bold uppercase tracking-wide text-[#7C7E8C]">
          <button className="flex items-center gap-1 text-left hover:text-[#111827]" onClick={() => toggleSort('name')}>
            Stock <SortIcon col="name" />
          </button>
          <button className="flex items-center gap-1 justify-end hover:text-[#111827]" onClick={() => toggleSort('price')}>
            Price <SortIcon col="price" />
          </button>
          <button className="flex items-center gap-1 justify-end hover:text-[#111827]" onClick={() => toggleSort('pct')}>
            Change <SortIcon col="pct" />
          </button>
          <button className="flex items-center gap-1 justify-end hover:text-[#111827]" onClick={() => toggleSort('volume')}>
            Volume <SortIcon col="volume" />
          </button>
          <div className="text-right">Sector</div>
          <div className="text-right">Exchange</div>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            {isSearching ? (
              <div className="space-y-2">
                <RefreshCw size={28} className="mx-auto text-[#00D09C] animate-spin" />
                <p className="text-sm font-semibold text-[#44475B]">Searching global markets for "{search}"...</p>
                <p className="text-xs text-[#9B9EA7]">Fetching real-time quotes across NSE, BSE, NASDAQ, and NYSE</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Search size={32} className="mx-auto text-[#EAECEF] mb-1" />
                <p className="text-sm font-semibold text-[#7C7E8C]">No stocks match "{search}"</p>
                <p className="text-xs text-[#9B9EA7]">Try searching by company name (e.g. Tata, Zomato, Google) or ticker symbol (e.g. TSLA, INFY)</p>
              </div>
            )}
          </div>
        ) : (
          filtered.map((stock) => {
            const pos = (stock.pct ?? 0) >= 0;
            const curr = getCurr(stock.currency, stock.symbol);
            return (
              <div
                key={stock.symbol}
                onClick={() => onSelect(stock)}
                className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-5 py-3.5 border-b border-[#F4F4F7] hover:bg-[#F9FAFB] cursor-pointer transition-colors group items-center"
              >
                {/* Stock Name & Symbol */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform"
                    style={{ background: pos ? GREEN : RED }}>
                    {stock.symbol.replace(/\.NS|\.BO|\.L|\.T|\.HK/g,'').slice(0,2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate group-hover:text-[#00D09C] transition-colors" style={{ color: TEXT1 }}>
                      {stock.name}
                    </div>
                    <div className="text-xs text-[#9B9EA7] font-mono">{stock.symbol}</div>
                  </div>
                </div>

                {/* Price */}
                <div className="text-right flex items-center justify-end">
                  <span className="text-sm font-bold tabular-nums" style={{ color: TEXT1 }}>
                    {curr}{f2(stock.price ?? 0)}
                  </span>
                </div>

                {/* Change % */}
                <div className="text-right flex items-center justify-end gap-1">
                  {pos ? <ArrowUpRight size={13} className="text-[#00D09C]" /> : <ArrowDownRight size={13} className="text-[#EB5B3C]" />}
                  <span className="text-sm font-bold tabular-nums" style={{ color: pos ? GREEN : RED }}>
                    {pct(stock.pct ?? 0)}
                  </span>
                </div>

                {/* Volume */}
                <div className="text-right flex items-center justify-end">
                  <span className="text-xs text-[#7C7E8C] tabular-nums">
                    {stock.volume ? formatVolume(stock.volume) : '—'}
                  </span>
                </div>

                {/* Sector */}
                <div className="text-right flex items-center justify-end">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#F4F4F7] text-[#44475B] font-medium truncate max-w-[120px]">
                    {stock.sector || 'Equities'}
                  </span>
                </div>

                {/* Exchange */}
                <div className="text-right flex items-center justify-end">
                  <span className="text-xs text-[#9B9EA7] font-semibold">
                    {stock.exchange || 'Global'}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Parse market cap string to number for sorting */
function parseMarketCap(mc?: string | number): number {
  if (!mc) return 0;
  if (typeof mc === 'number') return mc;
  const s = mc.replace(/[₹$£€¥,\s]/g, '').toUpperCase();
  const multipliers: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12, 'L CR': 1e12, CR: 1e7 };
  for (const [suffix, mult] of Object.entries(multipliers)) {
    if (s.includes(suffix)) {
      return parseFloat(s.replace(suffix, '')) * mult || 0;
    }
  }
  return parseFloat(s) || 0;
}

/** Format volume to human-readable */
function formatVolume(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toString();
}


