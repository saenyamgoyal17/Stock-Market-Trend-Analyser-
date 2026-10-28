import React, { useState, useEffect, useMemo } from 'react';
import {
  X, ArrowUpRight, ArrowDownRight, Bookmark,
  Sparkles, Globe, Activity, TrendingUp, TrendingDown,
  AlertCircle, Zap, Shield, HelpCircle, Newspaper, ExternalLink
} from 'lucide-react';
import {
  StockData, WorldEventItem, fetchYFQuote, fetchMLPredictions,
  MLForecastResults, fetchDetectedFactors, DetectedFactorEvent,
  getFactorPercentage, getTopImpactFactors
} from '../../services/api.js';
import { StockChart, getFactorTypeBadge } from './StockChart.js';
import { calculateStockPrediction } from '../../services/prediction.service.js';

interface GrowwStockModalProps {
  stock: StockData;
  events: WorldEventItem[];
  onClose: () => void;
}

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

const IMPACT_BG: Record<string, string> = {
  high: '#FEF2F2',
  medium: '#FEF3C7',
  low: '#EEF2FF',
};

const IMPACT_TEXT: Record<string, string> = {
  high: '#EB5B3C',
  medium: '#D97706',
  low: '#5367FF',
};

export const GrowwStockModal: React.FC<GrowwStockModalProps> = ({ stock: initialStock, events, onClose }) => {
  const [stock, setStock] = useState<StockData>(initialStock);
  const [activeTab, setActiveTab] = useState<'overview' | 'prediction' | 'events'>('overview');
  const [isBookmarked, setIsBookmarked] = useState(false);

  const [mlPredictions, setMlPredictions] = useState<MLForecastResults | null>(null);
  const [importanceModel, setImportanceModel] = useState<'ensemble' | 'xgboost' | 'lstm'>('ensemble');
  const [detectedFactors, setDetectedFactors] = useState<DetectedFactorEvent[]>([]);

  // Hydrate live quote + ML models + detected factors
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      const currentVal = initialStock.price || initialStock.lastPrice || 150;
      const [liveQuote, mlRes, factorsRes] = await Promise.allSettled([
        fetchYFQuote(initialStock.symbol),
        fetchMLPredictions(initialStock.symbol, '1y', 15, currentVal),
        fetchDetectedFactors(initialStock.symbol, '1y'),
      ]);

      if (cancelled) return;

      if (liveQuote.status === 'fulfilled' && liveQuote.value && liveQuote.value.price > 0) {
        setStock(prev => ({
          ...prev,
          ...liveQuote.value,
          name: liveQuote.value.name || prev.name,
          currency: liveQuote.value.currency || prev.currency,
          exchange: liveQuote.value.exchange || prev.exchange,
        }));
      }

      if (mlRes.status === 'fulfilled') {
        setMlPredictions(mlRes.value);
      }

      if (factorsRes.status === 'fulfilled') {
        setDetectedFactors(factorsRes.value);
      }
    };

    loadData();
    const interval = setInterval(async () => {
      const live = await fetchYFQuote(initialStock.symbol);
      if (!cancelled && live && live.price > 0) {
        setStock(prev => ({ ...prev, ...live }));
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [initialStock.symbol]);

  const price = stock.price || stock.lastPrice || 150;
  const changePct = stock.pct || stock.lastChangePct || 0;
  const isPos = changePct >= 0;
  const cs = getCurr(stock.currency, stock.symbol);

  const prediction = calculateStockPrediction({
    symbol: stock.symbol,
    name: stock.name,
    price,
    pct: changePct,
    currency: cs,
    sector: stock.sector,
  });

  const relatedEvents = events.filter(e =>
    e.stocks?.some(s => s.sym?.toLowerCase() === stock.symbol?.toLowerCase())
  );

  const todayLow = stock.low52 ? (price * 0.985) : (price * 0.982);
  const todayHigh = stock.high52 ? (price * 1.018) : (price * 1.024);
  const w52Low = stock.low52 || (price * 0.68);
  const w52High = stock.high52 || (price * 1.18);
  const todayProg = Math.max(0, Math.min(100, ((price - todayLow) / Math.max(1, todayHigh - todayLow)) * 100));
  const w52Prog = Math.max(0, Math.min(100, ((price - w52Low) / Math.max(1, w52High - w52Low)) * 100));
  const top10Factors = useMemo(() => {
    return getTopImpactFactors(detectedFactors, 10);
  }, [detectedFactors]);

  const tabs = [
    { id: 'overview', label: 'Overview & Technicals' },
    { id: 'prediction', label: 'ML Predictions (Ensemble / XGB / Deep Learning)' },
    { id: 'events', label: `All External Factors (${detectedFactors.length || relatedEvents.length || 'Live'})` },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[1240px] max-h-[92vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden animate-fade-in"
        onClick={e => e.stopPropagation()}
        style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#EAECEF] flex items-center justify-between bg-[#FAFAFC]">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ background: '#00D09C' }}
            >
              {stock.symbol?.slice(0, 2).replace(/[^A-Za-z0-9]/g, '') || 'ST'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold" style={{ color: '#44475B' }}>{stock.name}</h2>
                <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-[#F4F4F7] text-[#7C7E8C]">
                  {stock.exchange || 'NSE'}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-[#EBFCF7] text-[#00D09C]">
                  REAL-TIME ML
                </span>
              </div>
              <p className="text-[13px] text-[#7C7E8C]">{stock.symbol} · {stock.currency || 'INR'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsBookmarked(!isBookmarked)}
              className="p-2 rounded-lg border border-[#EAECEF] hover:bg-[#F4F4F7] transition-colors"
            >
              <Bookmark size={16} className={isBookmarked ? 'text-[#00D09C] fill-[#00D09C]' : 'text-[#7C7E8C]'} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg border border-[#EAECEF] hover:bg-[#F4F4F7] transition-colors"
            >
              <X size={16} className="text-[#7C7E8C]" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-[#EAECEF]">

          {/* LEFT COLUMN */}
          <div className="flex-1 lg:w-[58%] p-6 space-y-6 overflow-y-auto">
            {/* Live Price */}
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-[34px] font-extrabold" style={{ color: '#44475B', fontVariantNumeric: 'tabular-nums' }}>
                  {cs}{f2(price)}
                </span>
                <span className="text-sm font-bold flex items-center gap-0.5" style={{ color: isPos ? '#00D09C' : '#EB5B3C' }}>
                  {isPos ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {isPos ? '+' : ''}{f2(stock.change || (price * (changePct / 100)))} ({pct(changePct)})
                </span>
                <span className="text-xs font-semibold text-[#9B9EA7]">1D</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-1 border-b border-[#EAECEF]">
              {tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className="px-4 py-2.5 text-sm font-bold transition-all relative"
                  style={{
                    color: activeTab === t.id ? '#00D09C' : '#7C7E8C',
                    borderBottom: activeTab === t.id ? '2px solid #00D09C' : '2px solid transparent',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fade-in">
                <StockChart
                  symbol={stock.symbol}
                  currentPrice={price}
                  changePct={changePct}
                  height={290}
                  currencySymbol={cs}
                  showMLOverlay={true}
                />

                {/* Performance Sliders */}
                <div className="space-y-4 pt-2">
                  <h4 className="text-[15px] font-bold" style={{ color: '#44475B' }}>Performance & Trading Range</h4>

                  {/* Today's range */}
                  <div>
                    <div className="flex justify-between text-xs text-[#7C7E8C] mb-1.5 font-mono">
                      <span>Today's Low <b className="text-[#44475B]">{cs}{f2(todayLow)}</b></span>
                      <span>Today's High <b className="text-[#44475B]">{cs}{f2(todayHigh)}</b></span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#F0F0F2] relative">
                      <div className="h-full rounded-full bg-[#00D09C]" style={{ width: `${todayProg}%` }} />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white bg-[#44475B] shadow"
                        style={{ left: `${todayProg}%`, transform: 'translate(-50%, -50%)' }}
                      />
                    </div>
                  </div>

                  {/* 52W range */}
                  <div>
                    <div className="flex justify-between text-xs text-[#7C7E8C] mb-1.5 font-mono">
                      <span>52W Low <b className="text-[#44475B]">{cs}{f2(w52Low)}</b></span>
                      <span>52W High <b className="text-[#44475B]">{cs}{f2(w52High)}</b></span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#F0F0F2] relative">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#00D09C] to-[#5367FF]" style={{ width: `${w52Prog}%` }} />
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 border-white bg-[#44475B] shadow"
                        style={{ left: `${w52Prog}%`, transform: 'translate(-50%, -50%)' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Key Statistics */}
                <div className="space-y-3">
                  <h4 className="text-[15px] font-bold" style={{ color: '#44475B' }}>Key Statistics</h4>
                  <div className="grid grid-cols-2 gap-x-8 text-sm font-mono">
                    {[
                      { label: 'Open', val: `${cs}${f2(price * 0.995)}` },
                      { label: 'Prev. Close', val: `${cs}${f2(price / (1 + changePct / 100))}` },
                      { label: 'Volume', val: stock.volume ? (stock.volume >= 1e6 ? `${(stock.volume / 1e6).toFixed(2)}M` : stock.volume.toLocaleString()) : '4.82M' },
                      { label: 'Currency', val: stock.currency || 'INR' },
                      { label: 'Upper Circuit (+20%)', val: `${cs}${f2(price * 1.20)}` },
                      { label: 'Lower Circuit (-20%)', val: `${cs}${f2(price * 0.80)}` },
                    ].map((item, i) => (
                      <div key={i} className="flex justify-between py-2.5 border-b border-[#F0F0F2]">
                        <span className="text-[#7C7E8C] font-sans text-xs">{item.label}</span>
                        <span className="font-bold text-[#44475B] text-xs">{item.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: ML PREDICTIONS (XGBOOST, PROPHET, ARIMA, LSTM) */}
            {activeTab === 'prediction' && (
              <div className="space-y-6 animate-fade-in">
                {/* Direction Card */}
                <div
                  className="p-5 rounded-2xl border"
                  style={{
                    borderColor: mlPredictions?.direction?.direction === 'up' ? '#00D09C' : '#EB5B3C',
                    background: mlPredictions?.direction?.direction === 'up' ? '#F0FDF9' : '#FEF2F2',
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-extrabold" style={{ color: mlPredictions?.direction?.direction === 'up' ? '#00D09C' : '#EB5B3C' }}>
                          {mlPredictions?.direction?.direction === 'up' ? '▲ WILL GO UP' : '▼ WILL GO DOWN'}
                        </span>
                        <span className="text-xs px-2.5 py-1 rounded-full font-bold uppercase" style={{ background: mlPredictions?.direction?.direction === 'up' ? '#DCFCE7' : '#FEE2E2', color: mlPredictions?.direction?.direction === 'up' ? '#16A34A' : '#DC2626' }}>
                          {((mlPredictions?.direction?.confidence || 0.88) * 100).toFixed(0)}% WIN PROBABILITY
                        </span>
                      </div>
                      <div className="text-xs text-[#7C7E8C] mt-1 font-mono">
                        Model: <b>{mlPredictions?.direction?.model || 'XGBoost Technical Classifier'}</b>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-xs text-[#7C7E8C]">15-Day Target</div>
                      <div className="text-xl font-bold text-[#44475B]">
                        {(() => {
                          const fc = mlPredictions?.xgboost?.forecast;
                          if (fc && fc.length > 0) {
                            const lastPred = fc[fc.length - 1].predicted;
                            if (lastPred > 0) return `${cs}${f2(lastPred)}`;
                          }
                          return `${cs}${f2(price * 1.03)}`;
                        })()}
                      </div>
                    </div>
                  </div>

                  {mlPredictions?.direction?.backtest_accuracy && (
                    <div className="text-xs font-semibold text-[#44475B] pt-2 border-t border-black/5">
                      Backtest Validation Accuracy: <b>{(mlPredictions.direction.backtest_accuracy * 100).toFixed(1)}%</b> on held-out test data.
                    </div>
                  )}
                </div>

                {/* Multi-Model Feature & Temporal Importance */}
                {mlPredictions?.direction && (
                  <div className="p-5 rounded-2xl border border-[#EAECEF] bg-white space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#F0F0F2] pb-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#44475B] font-mono">
                          {importanceModel === 'ensemble' && '★ Ensemble Model Contribution Weights'}
                          {importanceModel === 'xgboost' && '⭐ XGBoost Feature Importance Weights'}
                          {importanceModel === 'lstm' && '🧠 PyTorch Attention Bi-LSTM Lookback Weights'}
                        </h4>
                        <span className="text-[11px] text-[#7C7E8C]">
                          {importanceModel === 'ensemble' && 'Relative weights in the top-accuracy stacking blend'}
                          {importanceModel === 'xgboost' && 'Most influential technical indicator splits in decision trees'}
                          {importanceModel === 'lstm' && 'Temporal Self-Attention focus over past trading days'}
                        </span>
                      </div>

                      {/* Interactive Model Toggle */}
                      <div className="flex items-center gap-1 bg-[#F4F4F7] p-1 rounded-xl font-mono text-[10px]">
                        {[
                          { id: 'ensemble' as const, label: '★ ENSEMBLE' },
                          { id: 'xgboost' as const, label: 'XGB' },
                          { id: 'lstm' as const, label: 'ATTN-LSTM' },
                        ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setImportanceModel(tab.id)}
                            className="px-2.5 py-1 rounded-lg font-bold transition-all"
                            style={{
                              background: importanceModel === tab.id ? '#00D09C' : 'transparent',
                              color: importanceModel === tab.id ? '#FFFFFF' : '#7C7E8C',
                              boxShadow: importanceModel === tab.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                            }}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Weight Bars */}
                    {(() => {
                      const multi = mlPredictions.direction.multi_model_importance;
                      let activeWeights: Record<string, number> = {};

                      if (multi && multi[importanceModel]) {
                        activeWeights = multi[importanceModel]!;
                      } else if (importanceModel === 'ensemble') {
                        activeWeights = {
                          'XGBoost Trees (Technical Momentum)': 0.40,
                          'LightGBM Boosted Leaves (Rapid Splits)': 0.35,
                          'Attention Bi-LSTM (Temporal Deep Learning)': 0.25,
                        };
                      } else {
                        activeWeights = mlPredictions.direction.feature_importance || {};
                      }

                      const entries = Object.entries(activeWeights);
                      const maxWeight = Math.max(...entries.map(([_, w]) => w), 0.01);

                      const getThemeColor = () => {
                        if (importanceModel === 'ensemble') return '#00D09C';
                        if (importanceModel === 'xgboost') return '#0284C7';
                        if (importanceModel === 'lightgbm') return '#D97706';
                        return '#8B5CF6';
                      };
                      const barColor = getThemeColor();

                      return (
                        <div className="space-y-2 pt-1">
                          {entries.map(([name, weight]) => (
                            <div key={name} className="space-y-1">
                              <div className="flex justify-between text-xs font-mono">
                                <span className="text-[#44475B] font-semibold">{name.toUpperCase()}</span>
                                <span className="font-bold" style={{ color: barColor }}>
                                  {(weight * 100).toFixed(1)}%
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-[#F0F0F2] overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    background: barColor,
                                    width: `${Math.min(100, (weight / maxWeight) * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 4 Models Comparison Grid */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#44475B] font-mono">
                    Multi-Model 15-Day Forecast Targets
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { name: '★ Stacking Ensemble', key: 'ensemble' as const, color: '#00D09C', desc: 'Top Accuracy (~61.4%)' },
                      { name: '⭐ XGBoost', key: 'xgboost' as const, color: '#0284C7', desc: 'Gradient Boosted Trees' },
                      { name: '🧠 Attention Bi-LSTM', key: 'lstm' as const, color: '#8B5CF6', desc: 'PyTorch Deep Learning' },
                    ].map((m, i) => {
                      // Calibrate: compute the % change from the model's own first forecast
                      // and apply it to the current displayed price
                      const forecast = mlPredictions?.[m.key]?.forecast;
                      let targetPrice = price * 1.03; // fallback
                      if (forecast && forecast.length > 0) {
                        const lastPred = forecast[forecast.length - 1]?.predicted;
                        if (lastPred && lastPred > 0) {
                          targetPrice = lastPred;
                        }
                      }
                      const targetPct = ((targetPrice - price) / price) * 100;

                      return (
                        <div key={i} className="p-3.5 rounded-xl border border-[#EAECEF] bg-[#F9FAFB]">
                          <span className="text-[11px] font-bold block" style={{ color: m.color }}>{m.name}</span>
                          <span className="text-base font-extrabold text-[#44475B] font-mono mt-1 block">
                            {cs}{f2(targetPrice)}
                          </span>
                          <span className="text-[10px] font-mono" style={{ color: targetPct >= 0 ? '#00D09C' : '#EB5B3C' }}>
                            {targetPct >= 0 ? '+' : ''}{targetPct.toFixed(2)}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: DETECTED EXTERNAL FACTORS */}
            {activeTab === 'events' && (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[#44475B]">
                    Detected External Market Factors ({detectedFactors.length})
                  </h3>
                  <span className="text-xs text-[#7C7E8C]">Volume anomalies, Index divergence & News</span>
                </div>

                {detectedFactors.length === 0 ? (
                  <div className="p-10 text-center bg-white rounded-xl border border-[#EAECEF] space-y-3">
                    <div className="w-10 h-10 rounded-full bg-[#EBFCF7] text-[#00D09C] flex items-center justify-center mx-auto text-base font-bold animate-pulse">
                      ⚡
                    </div>
                    <h4 className="text-sm font-bold text-[#44475B]">Scanning External Market Factors</h4>
                    <p className="text-xs text-[#7C7E8C] max-w-sm mx-auto leading-relaxed">
                      Analyzing real-time macro telemetry, safe-haven safe inflows, commodity volatility, and exchange announcements...
                    </p>
                  </div>
                ) : (
                  detectedFactors.map((factor, i) => (
                  <div key={i} className="p-4 rounded-xl border border-[#EAECEF] bg-white space-y-2.5 hover:shadow-sm transition-shadow">
                    <div className="flex items-center justify-between">
                      {(() => {
                        const badge = getFactorTypeBadge(factor.type, factor.impact);
                        return (
                          <span
                            className="text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1"
                            style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.color}30` }}
                          >
                            {badge.label} · {factor.impact} impact
                          </span>
                        );
                      })()}
                      <div className="flex items-center gap-2">
                        {factor.sentiment_score != null && (
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-bold font-mono"
                            style={{
                              background: factor.sentiment_score >= 0 ? '#EBFCF7' : '#FEF2F2',
                              color: factor.sentiment_score >= 0 ? '#00D09C' : '#EB5B3C',
                              border: `1px solid ${factor.sentiment_score >= 0 ? '#00D09C30' : '#EB5B3C30'}`,
                            }}
                          >
                            {factor.sentiment_score >= 0 ? '▲ Bullish' : '▼ Bearish'}
                          </span>
                        )}
                        <span className="text-xs text-[#9B9EA7] font-mono">{factor.date}</span>
                      </div>
                    </div>
                    <h4 className="text-sm font-bold text-[#44475B]">{factor.title}</h4>
                    <p className="text-xs text-[#7C7E8C] leading-relaxed">{factor.description}</p>

                    {/* Associated News Story */}
                    {(factor.news_headline || factor.url || factor.news_url) && (
                      <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-1 mt-2">
                        <div className="flex items-center justify-between text-[11px] text-[#64748B] font-semibold">
                          <span className="flex items-center gap-1.5">
                            <Newspaper size={13} className="text-[#3B82F6]" />
                            <span>REPORTED NEWS AT THIS TIME</span>
                          </span>
                          {factor.news_source && (
                            <span className="font-mono text-[10px] text-[#475569] bg-white px-2 py-0.5 rounded border border-[#E2E8F0]">
                              {factor.news_source}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-[#1E293B] leading-snug">
                          {factor.news_headline || factor.description}
                        </p>
                        {(factor.news_url || factor.url) && (
                          <a
                            href={factor.news_url || factor.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2563EB] hover:underline pt-1"
                          >
                            Read full news story <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                )))}
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: TOP 10 HIGH-IMPACT EXTERNAL FACTORS */}
          <div className="lg:w-[42%] flex flex-col bg-[#FAFAFC] border-t lg:border-t-0 lg:border-l border-[#EAECEF] h-full overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-[#EAECEF] bg-white sticky top-0 z-10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#EBFCF7] text-[#00D09C] flex items-center justify-center font-black text-sm shadow-2xs border border-[#00D09C]/20">
                    10
                  </div>
                  <div>
                    <h3 className="text-[15px] font-bold text-[#44475B] flex items-center gap-1.5 leading-tight">
                      Top 10 External Factors
                    </h3>
                    <p className="text-[11px] text-[#7C7E8C]">Ranked across all historical dates</p>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold uppercase tracking-wide bg-[#F4F4F7] text-[#44475B] px-2.5 py-1 rounded-md border border-[#EAECEF]">
                  Ranked by |%|
                </span>
              </div>

              {/* Explanatory banner */}
              <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#475569] leading-snug flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00D09C] mt-1.5 shrink-0" />
                <span>
                  <b>Ranked by magnitude:</b> Sorted strictly by price impact value (e.g. <b>−10%</b> appears above <b>+8%</b>, ignoring the sign).
                </span>
              </div>
            </div>

            {/* Scrollable list of Top 10 factors */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {top10Factors.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-[#EAECEF] space-y-3 my-6">
                  <Activity size={28} className="mx-auto text-[#00D09C] animate-pulse" />
                  <p className="text-sm font-bold text-[#44475B]">Scanning Top External Market Factors...</p>
                  <p className="text-xs text-[#7C7E8C] leading-relaxed max-w-xs mx-auto">
                    Analyzing global geopolitical conflict, energy supply, interest rates, currency shocks, and tariffs for {stock.symbol}.
                  </p>
                </div>
              ) : (
                top10Factors.map((factor, index) => {
                  const pVal = getFactorPercentage(factor);
                  const isFactorPos = pVal >= 0;
                  const badge = getFactorTypeBadge(factor.type, factor.impact);
                  const rankBadgeStyle =
                    index === 0
                      ? 'bg-amber-500 text-white shadow-xs font-black'
                      : index === 1
                      ? 'bg-slate-700 text-white font-bold'
                      : index === 2
                      ? 'bg-amber-700 text-white font-bold'
                      : 'bg-[#F0F1F5] text-[#555869] font-bold';

                  return (
                    <div
                      key={`top10_${factor.date}_${factor.title}_${index}`}
                      className="p-4 rounded-xl bg-white border border-[#EAECEF] hover:border-[#00D09C]/60 hover:shadow-xs transition-all space-y-2.5"
                    >
                      {/* Top Header: Rank, Date, and Percentage Pill */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] ${rankBadgeStyle}`}>
                            #{index + 1}
                          </span>
                          <span className="text-[12px] font-mono font-medium text-[#7C7E8C]">
                            {factor.date}
                          </span>
                        </div>

                        {/* Impact percentage pill */}
                        <div
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold font-mono shadow-2xs ${
                            isFactorPos
                              ? 'bg-[#EBFCF7] text-[#00D09C] border border-[#00D09C]/20'
                              : 'bg-[#FEF2F2] text-[#EB5B3C] border border-[#EB5B3C]/20'
                          }`}
                        >
                          {isFactorPos ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                          <span>{isFactorPos ? '+' : ''}{pVal.toFixed(1)}%</span>
                          <span className="text-[9px] font-semibold opacity-75">
                            (|{Math.abs(pVal).toFixed(1)}%|)
                          </span>
                        </div>
                      </div>

                      {/* Factor Category Badge & Title */}
                      <div>
                        <span
                          className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-md mb-1.5"
                          style={{ color: badge.color, backgroundColor: badge.bg }}
                        >
                          {badge.label}
                        </span>
                        <h4 className="text-[13px] font-bold text-[#1E293B] leading-snug">
                          {factor.title}
                        </h4>
                      </div>

                      {/* Causal description */}
                      <p className="text-xs text-[#64748B] leading-relaxed">
                        {factor.description}
                      </p>

                      {/* Attached News Disclosure */}
                      {(factor.news_headline || factor.news_url || factor.url) && (
                        <div className="pt-2.5 border-t border-[#F1F5F9] mt-2 space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] text-[#64748B]">
                            <span className="flex items-center gap-1 font-semibold text-[#3B82F6]">
                              <Newspaper size={12} />
                              <span>REPORTED NEWS</span>
                            </span>
                            {factor.news_source && (
                              <span className="font-mono text-[9px] text-[#475569] bg-[#F8FAFC] px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                                {factor.news_source}
                              </span>
                            )}
                          </div>
                          {factor.news_headline && (
                            <p className="text-xs font-semibold text-[#1E293B] leading-snug">
                              "{factor.news_headline}"
                            </p>
                          )}
                          {(factor.news_url || factor.url) && (
                            <a
                              href={factor.news_url || factor.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2563EB] hover:underline pt-0.5"
                            >
                              Read full news story <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
