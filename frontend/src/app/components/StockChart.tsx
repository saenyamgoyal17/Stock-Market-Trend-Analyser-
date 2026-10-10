import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, ReferenceDot, ReferenceLine,
} from 'recharts';
import {
  fetchYFChart, ChartPoint, fetchMLPredictions, MLForecastResults,
  fetchDetectedFactors, DetectedFactorEvent, formatChartDate,
} from '../../services/api.js';
import { TrendingUp, TrendingDown, Eye, EyeOff, X, AlertCircle, ExternalLink, Newspaper } from 'lucide-react';

interface StockChartProps {
  symbol: string;
  currentPrice: number;
  changePct: number;
  height?: number;
  showMLOverlay?: boolean;
  currencySymbol?: string;
  onFactorClick?: (factor: DetectedFactorEvent) => void;
}

const RANGES = [
  { label: '1D', value: '1d' },
  { label: '1W', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
];

const IMPACT_COLOR: Record<string, string> = {
  high: '#EB5B3C',
  medium: '#F59E0B',
  low: '#5367FF',
};

export const getFactorTypeBadge = (type: string, impact: string = 'medium') => {
  switch (type) {
    case 'macro_geopolitical':
      return { label: '🌍 Geopolitical & Conflict', color: '#DC2626', bg: '#FEF2F2' };
    case 'macro_trade':
      return { label: '🚢 Tariffs & Trade Policy', color: '#B45309', bg: '#FFFBEB' };
    case 'macro_regulatory':
      return { label: '⚖️ Govt & Regulatory Action', color: '#7C3AED', bg: '#F5F3FF' };
    case 'macro_capital':
      return { label: '💸 FII Capital & Currency FX', color: '#0369A1', bg: '#F0F9FF' };
    case 'macro_energy':
      return { label: '⚡ Energy & Fuel Supply', color: '#D97706', bg: '#FFFBEB' };
    case 'macro_commodity':
      return { label: '📦 Commodities & Raw Materials', color: '#4F46E5', bg: '#EEF2FF' };
    case 'macro_monetary':
      return { label: '🏦 Rates & Monetary Policy', color: '#2563EB', bg: '#EFF6FF' };
    case 'volume_spike':
      return { label: '📈 Volume Surge Outlier', color: '#059669', bg: '#ECFDF5' };
    case 'index_divergence':
      return { label: '🎯 Market Benchmark Decoupling', color: '#0D9488', bg: '#F0FDFA' };
    case 'price_shock':
      return { label: '💥 Price Breakout Shock', color: '#E11D48', bg: '#FFF1F2' };
    default:
      return { label: `📰 ${type.replace(/_/g, ' ')}`, color: '#4B5563', bg: '#F3F4F6' };
  }
};

export const StockChart: React.FC<StockChartProps> = ({
  symbol,
  currentPrice,
  changePct,
  height = 340,
  showMLOverlay = true,
  currencySymbol,
  onFactorClick,
}) => {
  const [range, setRange] = useState('1mo');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModel, setActiveModel] = useState<'xgboost' | 'lightgbm' | 'catboost' | 'arima' | 'prophet' | 'lstm'>('xgboost');
  const [mlPredictions, setMlPredictions] = useState<MLForecastResults | null>(null);
  const [factors, setFactors] = useState<DetectedFactorEvent[]>([]);
  const [hoveredFactor, setHoveredFactor] = useState<{
    factor: DetectedFactorEvent;
    x: number;
    y: number;
    price: number;
  } | null>(null);
  const [pinnedFactor, setPinnedFactor] = useState<DetectedFactorEvent | null>(null);
  const chartContainerRef = React.useRef<HTMLDivElement>(null);
  const [isForecastVisible, setIsForecastVisible] = useState(true);
  const [baseChart, setBaseChart] = useState<ChartPoint[]>([]);

  // Automatically determine currency symbol if not explicitly provided
  const effectiveCurrency = currencySymbol || (
    symbol.endsWith('.NS') || symbol.endsWith('.BO') ? '₹' :
    symbol.endsWith('.L') ? '£' : '$'
  );

  // 1. Fetch ML predictions when symbol changes
  useEffect(() => {
    let cancelled = false;
    fetchMLPredictions(symbol, '1y', 15, currentPrice).then(mlRes => {
      if (cancelled) return;
      setMlPredictions(mlRes);
    });
    return () => { cancelled = true; };
  }, [symbol]);

  // 2. Fetch detected factors whenever symbol OR timeframe range changes
  useEffect(() => {
    let cancelled = false;
    const factorPeriod = range === '5y' ? '5y' : range === '1y' ? '1y' : range === '3mo' ? '3mo' : range === '1mo' ? '1mo' : range === '5d' ? '5d' : '1d';

    fetchDetectedFactors(symbol, factorPeriod, baseChart).then(factorsRes => {
      if (cancelled) return;
      setFactors(factorsRes || []);
    });

    return () => { cancelled = true; };
  }, [symbol, range, baseChart]);

  // 2. Fetch chart data whenever symbol OR range changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchYFChart(symbol, range).then(chart => {
      if (cancelled) return;
      setBaseChart(chart || []);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setBaseChart([]);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [symbol, range]);

  // Merge chart + predictions whenever base data, predictions, model selection, or visibility changes
  const mergedData = useMemo(() => {
    return mergeChartAndML(baseChart, mlPredictions, activeModel, range, isForecastVisible);
  }, [baseChart, mlPredictions, activeModel, range, isForecastVisible]);

  useEffect(() => {
    setData(mergedData);
  }, [mergedData]);

  const historyPoints = data.filter(d => !d.isForecast);
  const isPositive = historyPoints.length >= 2
    ? historyPoints[historyPoints.length - 1].close >= historyPoints[0].close
    : changePct >= 0;
  const lineColor = isPositive ? '#00D09C' : '#EB5B3C';

  // Tight Y-axis domain — only from values actually present
  const yDomain = useMemo(() => {
    const vals: number[] = [];
    for (const d of data) {
      if (typeof d.close === 'number' && d.close > 0) vals.push(d.close);
      if (typeof d.predicted === 'number' && d.predicted > 0) vals.push(d.predicted);
      if (typeof d.upper === 'number' && d.upper > 0) vals.push(d.upper);
      if (typeof d.lower === 'number' && d.lower > 0) vals.push(d.lower);
    }
    if (vals.length === 0) return [0, 100];
    const mn = Math.min(...vals);
    const mx = Math.max(...vals);
    const pad = (mx - mn) * 0.06 || mx * 0.02;
    return [+(mn - pad).toFixed(2), +(mx + pad).toFixed(2)];
  }, [data]);

  // Find the index of the last historical point (transition point)
  const transitionIdx = data.findIndex(d => d.isForecast) - 1;

  // Match factors that fall within the current chart's historical date range
  const visibleFactors = useMemo(() => {
    if (!data || data.length === 0 || factors.length === 0) return [];
    const hist = data.filter(d => !d.isForecast && (d.date || d.time));
    if (hist.length === 0) return [];

    const minTime = Math.min(...hist.map(d => d.time || new Date(d.date).getTime()).filter(t => !isNaN(t)));
    const maxTime = Math.max(...hist.map(d => d.time || new Date(d.date).getTime()).filter(t => !isNaN(t)));

    return factors.filter(f => {
      const fTime = new Date(f.date + 'T12:00:00Z').getTime();
      if (isNaN(fTime)) return true;
      // Allow 1 day buffer
      return fTime >= (minTime - 86400000) && fTime <= (maxTime + 86400000);
    });
  }, [data, factors]);

  return (
    <div className="space-y-3">
      {/* Header controls: Range + ML Model Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Range Selector */}
        <div className="flex items-center gap-1 bg-[#F4F4F7] p-1 rounded-xl">
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: range === r.value ? '#FFFFFF' : 'transparent',
                color: range === r.value ? '#44475B' : '#7C7E8C',
                boxShadow: range === r.value ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* ML Forecast Selector */}
        {showMLOverlay && (
          <div className="flex items-center gap-1 bg-[#F4F4F7] p-1 rounded-xl">
            <button
              onClick={() => setIsForecastVisible(!isForecastVisible)}
              className="p-1.5 rounded-lg transition-colors text-[#7C7E8C] hover:text-[#44475B]"
              title={isForecastVisible ? 'Hide AI Forecast' : 'Show AI Forecast'}
            >
              {isForecastVisible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            {[
              { id: 'xgboost', label: 'XGB' },
              { id: 'lightgbm', label: 'LGBM' },
              { id: 'catboost', label: 'CAT' },
              { id: 'arima', label: 'ARIMA' },
              { id: 'prophet', label: 'PROPHET' },
              { id: 'lstm', label: 'LSTM' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => {
                  setActiveModel(m.id as any);
                  setIsForecastVisible(true);
                }}
                className="px-2.5 py-1 rounded-lg transition-all font-mono uppercase text-[11px]"
                style={{
                  background: activeModel === m.id && isForecastVisible ? '#00D09C' : 'transparent',
                  color: activeModel === m.id && isForecastVisible ? '#FFFFFF' : '#00D09C',
                  fontWeight: activeModel === m.id && isForecastVisible ? 700 : 500,
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Direction & Backtest Accuracy Pill */}
      {mlPredictions?.direction && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-[#F9FAFB] border border-[#EAECEF] text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#7C7E8C] font-semibold font-mono text-[11px]">AI SIGNAL:</span>
            <span
              className="px-2.5 py-0.5 rounded-full font-bold uppercase flex items-center gap-1 text-[11px]"
              style={{
                background: mlPredictions.direction.direction === 'up' ? '#EBFCF7' : '#FEF2F2',
                color: mlPredictions.direction.direction === 'up' ? '#00D09C' : '#EB5B3C',
              }}
            >
              {mlPredictions.direction.direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {mlPredictions.direction.direction === 'up' ? '▲ BULLISH' : '▼ BEARISH'} ({(mlPredictions.direction.confidence * 100).toFixed(0)}%)
            </span>
          </div>

          {mlPredictions.direction.backtest_accuracy != null && mlPredictions.direction.backtest_accuracy > 0 && (
            <span className="text-[#7C7E8C] font-mono text-[11px]">
              Backtest: <b className="text-[#44475B]">{(mlPredictions.direction.backtest_accuracy * 100).toFixed(1)}%</b>
            </span>
          )}
        </div>
      )}

      {/* External Shocks Highlight Banner */}
      {visibleFactors.length > 0 && (() => {
        const macroCount = visibleFactors.filter(f => f.type.startsWith('macro_')).length;
        const compCount = visibleFactors.length - macroCount;
        return (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-[#FFFBEB] border border-[#FDE68A] text-xs shadow-2xs">
            <div className="flex items-center gap-2 text-[#92400E]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] animate-ping" />
              <span className="font-bold">{visibleFactors.length} Real External Market & Macro Shocks</span>
              <span className="text-[#B45309]">({macroCount > 0 ? `${macroCount} Geopolitical/Energy, ` : ''}{compCount} Company Moves)</span>
            </div>
            <span className="text-[11px] font-semibold text-[#D97706] bg-amber-100/80 px-2 py-0.5 rounded-md">
              Hover cursor over dots on graph to view news & shock details
            </span>
          </div>
        );
      })()}

      {/* Chart Canvas */}
      <div ref={chartContainerRef} style={{ height, position: 'relative' }}>
        {/* In-Graph Shock Factor Popover (Pops up directly at the dot!) */}
        {(pinnedFactor || hoveredFactor?.factor) && (() => {
          const factor = pinnedFactor || hoveredFactor!.factor;
          const dotColor = IMPACT_COLOR[factor.impact] || '#F59E0B';
          const containerWidth = chartContainerRef.current?.clientWidth || 400;

          // Calculate popover coordinates near the hovered dot or pinned card
          let popoverStyle: React.CSSProperties = { top: 12, left: 12 };
          if (hoveredFactor) {
            const left = Math.min(Math.max(hoveredFactor.x - 140, 10), Math.max(containerWidth - 330, 10));
            const top = hoveredFactor.y > 180
              ? Math.max(hoveredFactor.y - 185, 8)
              : hoveredFactor.y + 20;
            popoverStyle = { left: `${left}px`, top: `${top}px` };
          }

          return (
            <div
              className={`absolute z-40 p-4 rounded-2xl bg-white/95 backdrop-blur-md shadow-2xl border border-[#EAECEF] space-y-2.5 animate-fade-in text-xs max-w-sm transition-all ${
                pinnedFactor ? 'pointer-events-auto' : 'pointer-events-none select-none'
              }`}
              style={popoverStyle}
            >
              <div className="flex items-center justify-between gap-2">
                {(() => {
                  const badge = getFactorTypeBadge(factor.type, factor.impact);
                  return (
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1"
                      style={{
                        background: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.color}30`,
                      }}
                    >
                      {badge.label} · {factor.impact} impact
                    </span>
                  );
                })()}
                <div className="flex items-center gap-1.5">
                  <span className="text-[#9B9EA7] font-mono text-[11px]">{factor.date}</span>
                  {pinnedFactor && (
                    <button
                      onClick={() => setPinnedFactor(null)}
                      className="p-1 rounded-lg hover:bg-[#F4F4F7] text-[#7C7E8C] transition-colors"
                      title="Close"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              <h4 className="text-sm font-bold text-[#111827] leading-snug">{factor.title}</h4>
              <p className="text-xs text-[#6B7280] leading-relaxed">{factor.description}</p>

              {/* Exact News Catalyst Box */}
              {(factor.news_headline || factor.url || factor.news_url) && (
                <div className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1.5">
                  <div className="flex items-center justify-between gap-1 text-[10px] text-[#64748B] font-semibold">
                    <span className="flex items-center gap-1">
                      <Newspaper size={12} className="text-[#3B82F6]" />
                      <span>NEWS AT THIS TIME</span>
                    </span>
                    {factor.news_source && (
                      <span className="font-mono text-[10px] text-[#475569] bg-white px-1.5 py-0.5 rounded border border-[#E2E8F0]">
                        {factor.news_source}
                      </span>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[#0F172A] leading-snug">
                    {factor.news_headline || factor.description}
                  </p>
                  {(factor.news_url || factor.url) && (
                    <a
                      href={factor.news_url || factor.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2563EB] hover:underline pt-0.5"
                    >
                      Read full story <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              )}

              {/* Other concurrent top factors on the same date */}
              {(() => {
                const dayOthers = visibleFactors.filter(f => f.date === factor.date && f.title !== factor.title);
                if (dayOthers.length === 0) return null;
                return (
                  <div className="pt-2 border-t border-[#F0F0F2] space-y-1.5">
                    <span className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider block">
                      Other Factors on This Date ({dayOthers.length + 1} total):
                    </span>
                    <div className="space-y-1">
                      {dayOthers.map((o, idx) => {
                        const b = getFactorTypeBadge(o.type, o.impact);
                        return (
                          <div
                            key={idx}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPinnedFactor(o);
                            }}
                            className="p-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#F1F5F9] border border-[#E2E8F0] cursor-pointer transition-colors flex items-center justify-between gap-1 text-[11px]"
                          >
                            <span className="font-semibold text-[#1E293B] truncate">{o.title}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0" style={{ background: b.bg, color: b.color }}>
                              {b.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div className="pt-2 border-t border-[#F0F0F2] flex items-center justify-between text-[11px]">
                {hoveredFactor?.price != null && (
                  <span className="font-mono text-[#7C7E8C]">
                    Price: <b className="text-[#111827]">{effectiveCurrency}{hoveredFactor.price.toFixed(2)}</b>
                  </span>
                )}
                {factor.sentiment_score != null && (
                  <span
                    className="font-bold font-mono px-2 py-0.5 rounded-md text-[10px]"
                    style={{
                      background: factor.sentiment_score >= 0 ? '#EBFCF7' : '#FEF2F2',
                      color: factor.sentiment_score >= 0 ? '#00D09C' : '#EB5B3C',
                    }}
                  >
                    {factor.sentiment_score >= 0 ? '▲ Bullish Impulse' : '▼ Bearish Shock'} ({(Math.abs(factor.sentiment_score) * 100).toFixed(0)}%)
                  </span>
                )}
              </div>
            </div>
          );
        })()}

        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-2xl">
            <div className="text-sm font-semibold text-[#7C7E8C] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00D09C] animate-pulse" />
              Loading chart & ML models...
            </div>
          </div>
        )}

        {data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id={`grad-${symbol}-${range}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={`forecast-band-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.03} />
                </linearGradient>
                {/* Modern Apple Stocks / Fintech Neon Glow Filters */}
                <filter id="neon-glow-high" x="-60%" y="-60%" width="220%" height="220%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#EB5B3C" floodOpacity="0.75" />
                </filter>
                <filter id="neon-glow-medium" x="-60%" y="-60%" width="220%" height="220%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#F59E0B" floodOpacity="0.75" />
                </filter>
                <filter id="neon-glow-low" x="-60%" y="-60%" width="220%" height="220%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#5367FF" floodOpacity="0.75" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F2" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: '#9B9EA7', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#F0F0F2' }}
                minTickGap={35}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: '#9B9EA7', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${effectiveCurrency}${v >= 10000 ? `${(v/1000).toFixed(1)}k` : v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}`}
                width={65}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const p = payload[0].payload;
                  const displayPrice = p.close ?? p.predicted;
                  return (
                    <div className="px-3.5 py-2.5 rounded-xl shadow-xl text-xs bg-white border border-[#EAECEF] space-y-1">
                      <div className="font-bold text-sm text-[#44475B]">
                        {effectiveCurrency}{displayPrice?.toFixed(2)}
                      </div>
                      <div className="text-[#9B9EA7] font-mono">{p.date}</div>
                      {p.isForecast && (
                        <div className="text-[11px] font-semibold text-[#F59E0B] pt-1 border-t border-[#EAECEF]">
                          {activeModel.toUpperCase()} Forecast · Band: {effectiveCurrency}{p.lower?.toFixed(2)} – {effectiveCurrency}{p.upper?.toFixed(2)}
                        </div>
                      )}
                      {p.volume > 0 && (
                        <div className="text-[#7C7E8C]">
                          Vol: {(p.volume / 1e6).toFixed(2)}M
                        </div>
                      )}
                    </div>
                  );
                }}
              />

              {/* Forecast confidence band (render below the lines) */}
              {isForecastVisible && (
                <>
                  <Area type="monotone" dataKey="upper" stroke="none" fill={`url(#forecast-band-${symbol})`} fillOpacity={1} name="Upper Band" />
                  <Area type="monotone" dataKey="lower" stroke="none" fill="#FFFFFF" fillOpacity={1} name="Lower Band" />
                </>
              )}

              {/* Historical price area */}
              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                strokeWidth={2}
                fill={`url(#grad-${symbol}-${range})`}
                dot={false}
                name="Price"
                connectNulls={false}
                activeDot={{ r: 4, stroke: lineColor, strokeWidth: 2, fill: '#fff' }}
              />

              {/* ML Predicted line — dashed, connects from last close seamlessly */}
              {isForecastVisible && (
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#F59E0B"
                  strokeWidth={2.2}
                  strokeDasharray="6 3"
                  dot={false}
                  connectNulls={false}
                  name={`${activeModel.toUpperCase()} Forecast`}
                />
              )}

              {/* Vertical reference line at forecast start */}
              {isForecastVisible && transitionIdx >= 0 && data[transitionIdx] && (
                <ReferenceLine
                  x={data[transitionIdx].date}
                  stroke="#F59E0B"
                  strokeDasharray="3 3"
                  strokeOpacity={0.4}
                />
              )}

              {/* Highlighted Factor Event Dots on Chart */}
              {visibleFactors.map((factor, idx) => {
                const factorTs = new Date(factor.date + 'T12:00:00Z').getTime();
                // Match by exact isoDate, formatted date string, or nearest historical trading point
                const matchPoint =
                  data.find(d => !d.isForecast && (
                    d.isoDate === factor.date ||
                    d.date === factor.date ||
                    (d.time && new Date(d.time).toISOString().slice(0, 10) === factor.date)
                  )) ||
                  data
                    .filter(d => !d.isForecast && d.time && Math.abs(d.time - factorTs) <= 86400000 * 3)
                    .sort((a, b) => Math.abs(a.time - factorTs) - Math.abs(b.time - factorTs))[0];

                if (!matchPoint || matchPoint.close == null || matchPoint.close <= 0) return null;
                const dotColor = IMPACT_COLOR[factor.impact] || '#F59E0B';
                const isHovered = hoveredFactor?.factor.title === factor.title;
                const isPinned = pinnedFactor?.title === factor.title;
                const isSelected = isHovered || isPinned;

                return (
                  <ReferenceDot
                    key={`${factor.date}-${idx}`}
                    x={matchPoint.date}
                    y={matchPoint.close}
                    r={isSelected ? 5.5 : 4}
                    fill={dotColor}
                    stroke="#FFFFFF"
                    strokeWidth={1.5}
                    shape={(props: any) => {
                      const { cx, cy } = props;
                      if (cx == null || cy == null) return null;
                      const neonFilter = `url(#neon-glow-${factor.impact || 'medium'})`;

                      return (
                        <g
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredFactor({ factor, x: cx, y: cy, price: matchPoint.close })}
                          onMouseLeave={() => setHoveredFactor(null)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPinnedFactor(prev => prev?.title === factor.title ? null : factor);
                          }}
                        >
                          {/* Invisible expanded hit target to prevent any cursor flutter or jitter */}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={16}
                            fill="transparent"
                            style={{ pointerEvents: 'all' }}
                          />

                          {/* Soft Ambient Neon Bloom Halo */}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isSelected ? 11 : 7.5}
                            fill={dotColor}
                            fillOpacity={isSelected ? 0.32 : 0.16}
                            style={{ pointerEvents: 'none', transition: 'all 0.15s ease' }}
                          />

                          {/* Crisp Flat Solid Neon Micro-Dot */}
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isSelected ? 5.5 : 4}
                            fill={dotColor}
                            stroke="#FFFFFF"
                            strokeWidth={1.5}
                            filter={neonFilter}
                            style={{ pointerEvents: 'none', transition: 'all 0.15s ease' }}
                          />
                        </g>
                      );
                    }}
                  />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Volume Histogram */}
      {data.length > 0 && data.some(d => d.volume > 0 && !d.isForecast) && (
        <div style={{ height: 42 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.filter(d => !d.isForecast)} margin={{ top: 0, right: 10, left: 5, bottom: 0 }}>
              <Bar dataKey="volume" fill="#EAECEF" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════
// MERGE LOGIC — the heart of the chart-to-prediction connection
// ════════════════════════════════════════════════════════════════════

/**
 * Merges historical chart points with forward ML forecast.
 *
 * Anchors the forecast trajectory directly to the live anchorPrice (last candle close)
 * with 0% gap or cliff, tailoring step counts and intervals cleanly for 1D, 1W, 1M, 3M, 1Y, 5Y.
 * Every historical and forecast point has a 100% unique date string for Recharts.
 */
function mergeChartAndML(
  baseChart: ChartPoint[],
  mlResults: MLForecastResults | null,
  model: string,
  range: string,
  isForecastVisible: boolean,
): any[] {
  // Convert historical points, with null prediction fields
  const points: any[] = baseChart.map(p => ({
    ...p,
    predicted: null,
    upper: null,
    lower: null,
    isForecast: false,
  }));

  if (!isForecastVisible || points.length === 0 || !mlResults) return points;

  const forecastData = (mlResults as any)?.[model]?.forecast as any[] | undefined;
  if (!forecastData || forecastData.length === 0) return points;

  const lastPoint = points[points.length - 1];
  const anchorPrice = lastPoint.close;
  const lastTime = lastPoint.time || Date.now();
  if (!anchorPrice || anchorPrice <= 0) return points;

  // Set predicted on the last historical point = anchorPrice (seamless connection)
  lastPoint.predicted = anchorPrice;

  // Step configuration for each range
  let count = 15;
  let stepMs = 86400000;

  if (range === '1d') {
    count = 5; // 5 intraday forward steps (~1-2 hours)
    stepMs = 15 * 60 * 1000; // 15 mins each
  } else if (range === '5d') {
    count = 6; // 6 intervals spanning next 1-2 trading days
    stepMs = 2 * 3600 * 1000; // 2 hrs each
  } else if (range === '1mo') {
    count = 5; // next 5 business days
    stepMs = 86400000;
  } else if (range === '3mo') {
    count = 10; // next 10 business days
    stepMs = 86400000;
  } else if (range === '1y') {
    count = 15; // next 15 business days
    stepMs = 86400000;
  } else if (range === '5y') {
    count = 10; // next 10 weeks
    stepMs = 7 * 86400000; // 1 week each
  }

  const firstPred = forecastData[0]?.predicted || anchorPrice;
  const lastPred = forecastData[Math.min(count, forecastData.length) - 1]?.predicted || firstPred;
  const totalDrift = firstPred > 0 ? (lastPred - firstPred) : 0;

  for (let idx = 0; idx < count; idx++) {
    const stepTime = lastTime + (idx + 1) * stepMs;
    const dateStr = formatChartDate(stepTime, range);

    let predicted: number;
    let lower: number;
    let upper: number;

    if (range === '1d') {
      const intradayFactor = (idx + 1) / count;
      const intradayDrift = totalDrift * 0.25 * intradayFactor;
      predicted = +(anchorPrice + intradayDrift).toFixed(2);
      const band = predicted * 0.003 * Math.sqrt(idx + 1);
      lower = +(predicted - band).toFixed(2);
      upper = +(predicted + band).toFixed(2);
    } else if (range === '5d') {
      const factor = (idx + 1) / count;
      const multiDayDrift = totalDrift * 0.6 * factor;
      predicted = +(anchorPrice + multiDayDrift).toFixed(2);
      const band = predicted * 0.006 * Math.sqrt(idx + 1);
      lower = +(predicted - band).toFixed(2);
      upper = +(predicted + band).toFixed(2);
    } else if (range === '5y') {
      const factor = (idx + 1) / count;
      const weeklyDrift = totalDrift * 2.0 * factor;
      predicted = +(anchorPrice + weeklyDrift).toFixed(2);
      const band = predicted * 0.018 * Math.sqrt(idx + 1);
      lower = +(predicted - band).toFixed(2);
      upper = +(predicted + band).toFixed(2);
    } else {
      // 1mo, 3mo, 1y: anchored directly to current price + model predicted drift
      const f = forecastData[idx] || forecastData[forecastData.length - 1];
      const drift = f.predicted - firstPred;
      predicted = +(anchorPrice + drift).toFixed(2);

      if (f.lower != null && f.upper != null && f.lower > 0 && f.upper > 0) {
        const spreadLower = firstPred - f.lower;
        const spreadUpper = f.upper - firstPred;
        lower = +(predicted - spreadLower).toFixed(2);
        upper = +(predicted + spreadUpper).toFixed(2);
      } else {
        const spread = predicted * 0.012 * Math.sqrt(idx + 1);
        lower = +(predicted - spread).toFixed(2);
        upper = +(predicted + spread).toFixed(2);
      }
    }

    points.push({
      time: stepTime,
      date: dateStr,
      isoDate: new Date(stepTime).toISOString().slice(0, 10),
      close: null,
      predicted,
      upper,
      lower,
      volume: 0,
      isForecast: true,
    });
  }

  return points;
}
