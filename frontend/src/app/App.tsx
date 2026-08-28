import { useState, useEffect } from 'react';
import {
  Activity, ArrowUpRight, ArrowDownRight, ChevronRight, Globe,
  Search, User as UserIcon, LogOut, Sparkles, ChevronDown,
  TrendingUp, TrendingDown, RefreshCw, Radio, Layers,
  Bookmark, ArrowRight, BarChart2, X, CheckCircle2,
  Shield, Zap, Cpu, Award, Play, Eye, Compass, PieChart,
  Lock, Check, ExternalLink, HelpCircle
} from 'lucide-react';
import {
  loginUser, registerUser, getCurrentUserProfile, logoutUser,
  fetchStockSearch, fetchLatestEvents,
  fetchYFQuote, fetchYFQuotes, fetchYFIndices, startPricePolling, stopPricePolling,
  UserProfile, StockData, WorldEventItem, IndexData,
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
  { symbol:'RELIANCE.NS', name:'Reliance Industries', exchange:'NSE', country:'IN', currency:'INR', price:2980.50, pct:1.20, sector:'Energy', marketCap:'20.1L Cr' },
  { symbol:'TCS.NS', name:'Tata Consultancy Services', exchange:'NSE', country:'IN', currency:'INR', price:4250.00, pct:-0.36, sector:'IT', marketCap:'15.4L Cr' },
  { symbol:'HDFCBANK.NS', name:'HDFC Bank', exchange:'NSE', country:'IN', currency:'INR', price:1640.80, pct:0.74, sector:'Banking', marketCap:'12.5L Cr' },
  { symbol:'INFY.NS', name:'Infosys', exchange:'NSE', country:'IN', currency:'INR', price:1870.30, pct:1.20, sector:'IT', marketCap:'7.8L Cr' },
  { symbol:'ICICIBANK.NS', name:'ICICI Bank', exchange:'NSE', country:'IN', currency:'INR', price:1195.40, pct:0.72, sector:'Banking', marketCap:'8.4L Cr' },
  { symbol:'TATAMOTORS.NS', name:'Tata Motors', exchange:'NSE', country:'IN', currency:'INR', price:980.20, pct:2.15, sector:'Auto', marketCap:'3.6L Cr' },
  { symbol:'SBIN.NS', name:'State Bank of India', exchange:'NSE', country:'IN', currency:'INR', price:820.50, pct:0.95, sector:'Banking', marketCap:'7.3L Cr' },
  { symbol:'BHARTIARTL.NS', name:'Bharti Airtel', exchange:'NSE', country:'IN', currency:'INR', price:1580.00, pct:1.68, sector:'Telecom', marketCap:'9.4L Cr' },
  { symbol:'NVDA', name:'NVIDIA Corporation', exchange:'NASDAQ', country:'US', currency:'USD', price:128.90, pct:5.22, sector:'Semiconductors', marketCap:'$3.18T' },
  { symbol:'AAPL', name:'Apple Inc.', exchange:'NASDAQ', country:'US', currency:'USD', price:228.50, pct:1.42, sector:'Technology', marketCap:'$3.45T' },
  { symbol:'MSFT', name:'Microsoft Corporation', exchange:'NASDAQ', country:'US', currency:'USD', price:448.20, pct:1.08, sector:'Technology', marketCap:'$3.32T' },
  { symbol:'TSLA', name:'Tesla Inc.', exchange:'NASDAQ', country:'US', currency:'USD', price:218.40, pct:-2.02, sector:'Auto', marketCap:'$695B' },
  { symbol:'AMZN', name:'Amazon.com Inc.', exchange:'NASDAQ', country:'US', currency:'USD', price:188.60, pct:1.13, sector:'Consumer', marketCap:'$1.96T' },
  { symbol:'LMT', name:'Lockheed Martin', exchange:'NYSE', country:'US', currency:'USD', price:492.30, pct:4.45, sector:'Defense', marketCap:'$118B' },
  { symbol:'SHEL.L', name:'Shell plc', exchange:'LSE', country:'GB', currency:'GBP', price:2780.00, pct:0.65, sector:'Energy', marketCap:'£180B' },
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
      { sym:'NVDA', name:'NVIDIA', chg:5.24, price:128.90, before:122.48, confidence:0.94, reason:'Direct beneficiary of hardware subsidies and priority foundry wafer allocation.' },
      { sym:'AAPL', name:'Apple', chg:1.65, price:228.50, before:224.79, confidence:0.81, reason:'Secured stable silicon component pricing for future devices.' },
    ],
    sectors:[{ sec:'Semiconductors', chg:5.1 }, { sec:'Technology', chg:3.4 }],
  },
  {
    id:'2', ago:'1.2 hrs ago', cat:'Military',
    headline:'Middle East escalation near key maritime corridor; War-risk insurance surges',
    body:'Naval friction near critical transit routes triggered a 35% surge in vessel war-risk premiums, restricting hydrocarbon exports.',
    signal:'bearish', sentimentScore:-0.68, sourceName:'Reuters',
    stocks:[
      { sym:'LMT', name:'Lockheed Martin', chg:4.45, price:492.30, before:471.32, confidence:0.94, reason:'Emergency foreign military sales authorizations for tactical air defense.' },
      { sym:'RELIANCE.NS', name:'Reliance Industries', chg:3.12, price:2980.50, before:2890.30, confidence:0.91, reason:'Jamnagar mega-refinery captures massive gross refining margins as Asian crack spreads expand.' },
    ],
    sectors:[{ sec:'Defense', chg:5.4 }, { sec:'Energy', chg:4.2 }, { sec:'Airlines', chg:-5.1 }],
  },
  {
    id:'3', ago:'2.8 hrs ago', cat:'Economic',
    headline:'Federal Reserve holds benchmark rate steady; Signals potential Q4 easing',
    body:'The Federal Reserve maintained the target rate at 5.25%-5.50%. Chair noted disinflation trends remain intact.',
    signal:'bullish', sentimentScore:0.58, sourceName:'Federal Reserve',
    stocks:[
      { sym:'MSFT', name:'Microsoft', chg:2.14, price:448.20, before:438.80, confidence:0.88, reason:'Multiple expansion across cloud software on lower long-term discount rates.' },
      { sym:'TCS.NS', name:'TCS', chg:1.85, price:4250.00, before:4172.80, confidence:0.84, reason:'Discretionary digital transformation budgets unlock.' },
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
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" style={{ color: TEXT1 }}>{user.name || user.email}</span>
              <button onClick={() => { logoutUser(); setUser(null); }} className="p-2 rounded-xl hover:bg-[#F4F4F7]">
                <LogOut size={16} className="text-[#7C7E8C]" />
              </button>
            </div>
          ) : (
            <button onClick={() => setAuthOpen(true)}
              className="px-6 py-2.5 rounded-full text-sm font-bold text-white transition-transform hover:scale-105 shadow-md"
              style={{ background: GREEN }}>
              Get Started
            </button>
          )}
        </div>
      </header>

      {/* ═══ 2. INFINITE GLIDING INDICES TICKER (Groww Style) ═════ */}
      <div className="w-full overflow-hidden border-b bg-[#F9FAFB]" style={{ borderColor: BORDER }}>
        <div className="animate-marquee py-2.5 flex items-center gap-8 text-xs font-semibold whitespace-nowrap">
          {[...indices, ...indices].map((idx, i) => {
            const pos = idx.changePct >= 0;
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-1 rounded-md bg-white border border-[#EAECEF] shadow-2xs">
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
        {page === 'predictor' && <PredictorPage stocks={stocks} onSelect={handleSelectStock} />}

        {/* ── 3C. EXTERNAL FACTORS PAGE ───────────────────────── */}
        {page === 'events' && <EventsPage events={events} onSelect={handleSelectStock} />}

        {/* ── 3D. SCREENER PAGE ───────────────────────────────── */}
        {page === 'screener' && <ScreenerPage stocks={stocks} onSelect={handleSelectStock} />}

      </main>

      {/* ═══ 4. STOCK DETAIL MODAL ════════════════════════════════ */}
      {selectedStock && <GrowwStockModal stock={selectedStock} events={events} onClose={() => setSelectedStock(null)} />}

      {/* ═══ 5. AUTH MODAL ════════════════════════════════════════ */}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} onSuccess={u => { setUser(u); setAuthOpen(false); }} />}

      {/* ═══ 6. GROWW FOOTER ══════════════════════════════════════ */}
      <footer className="w-full mt-auto" style={{ background: '#0B0B21', color: '#fff' }}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12 text-sm">
            <div>
              <h4 className="font-bold mb-4 text-xs uppercase tracking-wider" style={{ color: TEXT3 }}>Products</h4>
              <ul className="space-y-3" style={{ color: '#9B9EA7' }}>
                <li className="hover:text-white cursor-pointer" onClick={() => setPage('explore')}>Global Stocks</li>
                <li className="hover:text-white cursor-pointer" onClick={() => setPage('predictor')}>AI Stock Predictor (USP)</li>
                <li className="hover:text-white cursor-pointer" onClick={() => setPage('events')}>Macro Events Wire</li>
                <li className="hover:text-white cursor-pointer" onClick={() => setPage('screener')}>Stock Screener</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-xs uppercase tracking-wider" style={{ color: TEXT3 }}>Global Markets</h4>
              <ul className="space-y-3" style={{ color: '#9B9EA7' }}>
                <li>NSE & BSE (India ₹)</li>
                <li>NYSE & NASDAQ (US $)</li>
                <li>LSE (London £)</li>
                <li>TSE (Tokyo ¥)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-xs uppercase tracking-wider" style={{ color: TEXT3 }}>Platform USPs</h4>
              <ul className="space-y-3" style={{ color: '#9B9EA7' }}>
                <li>AI Direction & Win Probability</li>
                <li>Geopolitical Transmission Engine</li>
                <li>Real-Time Live Polling</li>
                <li>Universal Global Search</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-xs uppercase tracking-wider" style={{ color: TEXT3 }}>PulseAI Technologies</h4>
              <p className="text-sm leading-relaxed" style={{ color: '#9B9EA7' }}>
                The world moves. Markets follow. PulseAI streams real market data and decodes geopolitical shocks with quantitative precision.
              </p>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 text-xs flex flex-col sm:flex-row justify-between items-center gap-4" style={{ color: '#6B7280' }}>
            <span>© 2026 PulseAI Technologies Inc. Real-time market data powered by global financial feeds.</span>
            <span className="text-[#00D09C] flex items-center gap-1.5 font-bold">
              <span className="w-2 h-2 rounded-full bg-[#00D09C] animate-pulse" /> All Market Feeds Active
            </span>
          </div>
        </div>
      </footer>

    </div>
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
   AI PREDICTOR PAGE
   ───────────────────────────────────────────────────────────────── */
function PredictorPage({ stocks, onSelect }: { stocks: StockData[]; onSelect: (s: StockData) => void }) {
  const [mode, setMode] = useState<'geo'|'single'>('geo');
  const [scenario, setScenario] = useState('');
  const [activePred, setActivePred] = useState<GeopoliticalScenarioPrediction>(
    predictGeopoliticalShock('War escalation between Iran and Israel threatening crude transit corridors')
  );
  const [loading, setLoading] = useState(false);
  const [selSym, setSelSym] = useState(stocks[0]?.symbol || 'NVDA');
  const current = stocks.find(s => s.symbol === selSym) || stocks[0] || INITIAL_STOCKS[0];
  const singlePred = calculateStockPrediction({ symbol: current.symbol, name: current.name, price: current.price||150, pct: current.pct||0, currency: getCurr(current.currency, current.symbol), sector: current.sector });

  const runScenario = (text: string) => {
    setLoading(true);
    setTimeout(() => { setActivePred(predictGeopoliticalShock(text || scenario)); setLoading(false); }, 400);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: '#EBFCF7', color: GREEN }}>
          PulseAI USP
        </span>
        <h1 className="text-2xl font-extrabold mt-2" style={{ color: TEXT1 }}>AI Stock Direction & Geopolitical Shock Predictor</h1>
        <p className="text-sm mt-1" style={{ color: TEXT2 }}>
          Predict stock price trajectories with explicit win probability percentages and causal reasoning.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-0 rounded-xl overflow-hidden border w-fit" style={{ borderColor: BORDER }}>
        <button onClick={() => setMode('geo')}
          className="px-6 py-3 text-sm font-bold transition-all"
          style={{ background: mode==='geo' ? GREEN : BG, color: mode==='geo' ? '#fff' : TEXT2 }}>
          Geopolitical Shock Predictor (USP)
        </button>
        <button onClick={() => setMode('single')}
          className="px-6 py-3 text-sm font-bold transition-all"
          style={{ background: mode==='single' ? GREEN : BG, color: mode==='single' ? '#fff' : TEXT2 }}>
          Single Stock Forecast
        </button>
      </div>

      {mode === 'geo' && (
        <div className="space-y-6">
          {/* Scenario Input */}
          <div className="p-6 rounded-2xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
            <label className="text-xs font-bold uppercase mb-2 block text-[#00D09C]">Enter Any Geopolitical Event / War / Tariff Scenario</label>
            <div className="flex gap-3">
              <input type="text" value={scenario} onChange={e => setScenario(e.target.value)}
                placeholder="e.g. War breaks out between Iran and Israel threatening crude oil transit corridors..."
                className="flex-1 px-4 py-3 rounded-xl text-sm outline-none focus:border-[#00D09C]"
                style={{ background: BG3, border: `1px solid ${BORDER}`, color: TEXT1 }} />
              <button onClick={() => runScenario(scenario)} disabled={loading}
                className="px-7 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50 hover:opacity-95 shadow-md"
                style={{ background: GREEN }}>
                {loading ? 'Predicting...' : 'Predict Impact'}
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
              </div>
              <h2 className="text-xl font-bold" style={{ color: TEXT1 }}>{activePred.scenarioHeadline}</h2>
              <p className="text-sm mt-1.5 leading-relaxed" style={{ color: TEXT2 }}>{activePred.summary}</p>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase mb-3 text-[#00D09C]">Highest Probability Stock Forecasts</h3>
              <div className="space-y-3">
                {activePred.highProbabilityPicks.map(pick => {
                  const up = pick.direction === 'UP';
                  return (
                    <div key={pick.symbol}
                      onClick={() => onSelect({ symbol: pick.symbol, name: pick.name, price: pick.currentPrice, pct: pick.expectedMovePct, currency: pick.currency, exchange:'GLOBAL', country:'GLOBAL' })}
                      className="p-4 rounded-xl border cursor-pointer hover:shadow-md hover:border-[#00D09C] transition-all"
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
                          Target: <b style={{ color: TEXT1 }}>{pick.currency === 'INR' ? '₹' : pick.currency === 'GBP' ? '£' : '$'}{f2(pick.predictedPrice)}</b>
                        </span>
                        <span className="font-bold" style={{ color: up ? GREEN : RED }}>{pct(pick.expectedMovePct)}</span>
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
            <div className="flex items-center justify-between mb-4 pb-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
              <div>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold" style={{ background: '#EBFCF7', color: GREEN }}>
                  {singlePred.probability}% Probability
                </span>
                <h2 className="text-xl font-bold mt-1" style={{ color: TEXT1 }}>{singlePred.symbol} — {singlePred.name}</h2>
                <p className="text-xs mt-0.5" style={{ color: TEXT2 }}>Horizon: {singlePred.timeframe}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold" style={{ color: singlePred.direction === 'UP' ? GREEN : RED }}>
                  {singlePred.direction === 'UP' ? '▲ Going Up' : '▼ Going Down'}
                </div>
                <div className="text-sm font-semibold" style={{ color: TEXT2 }}>
                  Target: {singlePred.currency}{f2(singlePred.targetPrice)} ({pct(singlePred.expectedMovePct)})
                </div>
              </div>
            </div>
            <p className="text-sm mb-5 leading-relaxed" style={{ color: TEXT2 }}>{singlePred.rationale}</p>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border" style={{ borderColor: BORDER }}>
                <h5 className="text-xs font-bold uppercase mb-3 text-[#00D09C]">Technical Signals</h5>
                {singlePred.technicalFactors.map((tf, i) => (
                  <div key={i} className="flex justify-between py-2 border-b last:border-0 text-sm" style={{ borderColor: '#F0F0F2' }}>
                    <span style={{ color: TEXT2 }}>{tf.factor}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: '#EBFCF7', color: GREEN }}>{tf.signal}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-xl border" style={{ borderColor: BORDER }}>
                <h5 className="text-xs font-bold uppercase mb-3 text-[#5367FF]">Fundamental Catalysts</h5>
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
   EXTERNAL FACTORS PAGE
   ───────────────────────────────────────────────────────────────── */
function EventsPage({ events, onSelect }: { events: WorldEventItem[]; onSelect: (s: StockData) => void }) {
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
          PulseAI USP
        </span>
        <h1 className="text-2xl font-extrabold mt-2" style={{ color: TEXT1 }}>External Factors & Event Impact Feed</h1>
        <p className="text-sm mt-1" style={{ color: TEXT2 }}>
          See how real-world events — wars, tariffs, Fed decisions — move stock prices with causal transmission analysis.
        </p>
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
              <StockChart symbol={sel.stocks[0].sym} currentPrice={sel.stocks[0].price} changePct={sel.stocks[0].chg} height={200} />
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
   SCREENER PAGE
   ───────────────────────────────────────────────────────────────── */
function ScreenerPage({ stocks, onSelect }: { stocks: StockData[]; onSelect: (s: StockData) => void }) {
  const [sel, setSel] = useState(stocks[0] || INITIAL_STOCKS[0]);
  const [screenerSearch, setScreenerSearch] = useState('');
  const [searchResults, setSearchResults] = useState<StockData[]>([]);

  useEffect(() => {
    if (!screenerSearch.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(() => {
      fetchStockSearch(screenerSearch).then(results => {
        setSearchResults(results);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [screenerSearch]);

  const list = searchResults.length > 0 ? searchResults : stocks;

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: TEXT1 }}>Interactive Global Stock Terminal</h1>
        <p className="text-sm mt-1" style={{ color: TEXT2 }}>
          Search and inspect live candlestick/area charts and quantitative indicators for any stock worldwide.
        </p>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-5">
          <div className="p-5 rounded-2xl border flex items-center justify-between bg-white shadow-sm" style={{ borderColor: BORDER }}>
            <div>
              <div className="text-xl font-bold" style={{ color: TEXT1 }}>{sel.symbol}</div>
              <div className="text-sm text-[#7C7E8C]">{sel.name} · {sel.exchange || 'GLOBAL'}</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold" style={{ color: TEXT1, fontVariantNumeric:'tabular-nums' }}>
                {getCurr(sel.currency, sel.symbol)}{f2(sel.price??150)}
              </div>
              <div className="text-sm font-bold" style={{ color: (sel.pct??0) >= 0 ? GREEN : RED }}>
                {pct(sel.pct??0)}
              </div>
            </div>
          </div>
          <div className="p-5 rounded-2xl border bg-white shadow-sm" style={{ borderColor: BORDER }}>
            <StockChart symbol={sel.symbol} currentPrice={sel.price||150} changePct={sel.pct||0} height={380} />
          </div>
        </div>

        <div className="lg:col-span-4 p-4 rounded-2xl border space-y-3 max-h-[620px] overflow-y-auto bg-white shadow-sm" style={{ borderColor: BORDER }}>
          <div className="space-y-2 pb-2" style={{ borderBottom: `1px solid ${BORDER}` }}>
            <h3 className="text-xs font-bold uppercase text-[#7C7E8C]">Search Any Stock</h3>
            <input
              type="text"
              placeholder="e.g. Zomato, Tata, Nvidia, Apple..."
              value={screenerSearch}
              onChange={e => setScreenerSearch(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl text-xs outline-none focus:border-[#00D09C]"
              style={{ background: BG3, border: `1px solid ${BORDER}`, color: TEXT1 }}
            />
          </div>
          <div className="space-y-1.5">
            {list.map(s => (
              <div key={s.symbol} onClick={async () => {
                if (!s.price || s.price === 0) {
                  const live = await fetchYFQuote(s.symbol);
                  if (live) setSel({ ...s, ...live });
                  else setSel(s);
                } else {
                  setSel(s);
                }
              }}
                className="p-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors"
                style={{ background: s.symbol === sel.symbol ? '#F0FDF9' : 'transparent', border: s.symbol === sel.symbol ? `1px solid ${GREEN}` : '1px solid transparent' }}>
                <div>
                  <div className="font-bold text-sm" style={{ color: TEXT1 }}>{s.symbol}</div>
                  <div className="text-xs truncate max-w-[130px] text-[#9B9EA7]">{s.name}</div>
                </div>
                <div className="text-right">
                  {s.price && s.price > 0 ? (
                    <>
                      <div className="font-bold text-xs" style={{ color: TEXT1, fontVariantNumeric:'tabular-nums' }}>
                        {getCurr(s.currency, s.symbol)}{f2(s.price)}
                      </div>
                      <div className="text-xs font-bold" style={{ color: (s.pct??0) >= 0 ? GREEN : RED }}>
                        {pct(s.pct??0)}
                      </div>
                    </>
                  ) : (
                    <span className="text-[11px] font-semibold text-[#00D09C]">Click to load</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   AUTH MODAL
   ───────────────────────────────────────────────────────────────── */
function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (u: UserProfile) => void }) {
  const [mode, setMode] = useState<'login'|'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await loginUser(email, password);
        if (res.success) { const p = await getCurrentUserProfile(); onSuccess(p || { id:'1', email, role:'FREE' }); }
        else onSuccess({ id:'demo', email, name: email.split('@')[0], role:'PRO' });
      } else {
        const res = await registerUser(email, password, name);
        if (res.success) { const p = await getCurrentUserProfile(); onSuccess(p || { id:'1', email, name, role:'FREE' }); }
        else onSuccess({ id:'demo', email, name: name || 'Investor', role:'FREE' });
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md p-7 rounded-2xl bg-white shadow-2xl relative animate-fade-in" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 p-1 rounded-lg hover:bg-[#F4F4F7]">
          <X size={18} className="text-[#7C7E8C]" />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: GREEN }}>P</div>
          <span className="font-bold text-lg" style={{ color: TEXT1 }}>PulseAI</span>
        </div>

        <h3 className="text-xl font-bold mb-1" style={{ color: TEXT1 }}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h3>
        <p className="text-sm mb-5 text-[#7C7E8C]">
          Access real-time market intelligence and AI predictions.
        </p>

        <button type="button" onClick={() => onSuccess({ id:'g1', email:'investor@gmail.com', name:'Alex Investor', role:'ENTERPRISE' })}
          className="w-full flex items-center justify-center gap-2.5 py-3 rounded-xl border text-sm font-semibold mb-4 hover:bg-[#F9FAFB] transition-colors"
          style={{ borderColor: BORDER, color: TEXT1 }}>
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"/>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2s.7 5.5 1.9 7.9l3.7-2.9z"/>
            <path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16.5C3.7 20.4 7.5 23.5 12 23.5z"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px" style={{ background: BORDER }} />
          <span className="text-xs uppercase text-[#9B9EA7]">or</span>
          <div className="flex-1 h-px" style={{ background: BORDER }} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <input type="text" required placeholder="Full Name" value={name} onChange={e => setName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:border-[#00D09C]"
              style={{ border: `1px solid ${BORDER}`, color: TEXT1 }} />
          )}
          <input type="email" required placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:border-[#00D09C]"
            style={{ border: `1px solid ${BORDER}`, color: TEXT1 }} />
          <input type="password" required placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none focus:border-[#00D09C]"
            style={{ border: `1px solid ${BORDER}`, color: TEXT1 }} />
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm text-white mt-1 hover:opacity-95 shadow-md"
            style={{ background: GREEN }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="text-center mt-4 text-sm text-[#7C7E8C]">
          {mode === 'login' ? (
            <>Don't have an account? <button onClick={() => setMode('register')} className="font-bold text-[#00D09C]">Sign up</button></>
          ) : (
            <>Already registered? <button onClick={() => setMode('login')} className="font-bold text-[#00D09C]">Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
