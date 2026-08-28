import React, { useState, useEffect, useMemo } from 'react';
import {
  Area, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, ReferenceDot,
} from 'recharts';
import {
  fetchYFChart, ChartPoint, fetchMLPredictions, MLForecastResults,
  fetchDetectedFactors, DetectedFactorEvent,
} from '../../services/api.js';
import { TrendingUp, TrendingDown, Eye, EyeOff } from 'lucide-react';

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

function formatForecastDate(isoDate: string, range: string): string {
  const d = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`);
  if (range === '1d' || range === '5d') {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  if (range === '1mo' || range === '3mo' || range === '6mo') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export const StockChart: React.FC<StockChartProps> = ({
  symbol,
  currentPrice,
  changePct,
  height = 340,
  showMLOverlay = true,
  currencySymbol = '₹',
  onFactorClick,
}) => {
  const [range, setRange] = useState('1mo');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModel, setActiveModel] = useState<'xgboost' | 'arima' | 'prophet' | 'lstm'>('xgboost');
  const [mlPredictions, setMlPredictions] = useState<MLForecastResults | null>(null);
  const [factors, setFactors] = useState<DetectedFactorEvent[]>([]);
  const [isForecastVisible, setIsForecastVisible] = useState(true);
  const [baseChart, setBaseChart] = useState<ChartPoint[]>([]);

  // Fetch chart history + ML forecasts
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.allSettled([
      fetchYFChart(symbol, range),
      fetchMLPredictions(symbol, '1y', 15, currentPrice),
      fetchDetectedFactors(symbol, '1y'),
    ]).then(([chartRes, mlRes, factorsRes]) => {
      if (cancelled) return;

      let chart: ChartPoint[] = [];
      if (chartRes.status === 'fulfilled' && chartRes.value && chartRes.value.length > 0) {
        chart = chartRes.value;
      } else {
        chart = generateFallback(currentPrice || 100, range);
      }
      setBaseChart(chart);

      if (mlRes.status === 'fulfilled' && mlRes.value) {
        setMlPredictions(mlRes.value);
      }

      if (factorsRes.status === 'fulfilled' && factorsRes.value) {
        setFactors(factorsRes.value);
      }

      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [symbol, range, currentPrice]);

  // Merge history with ML forecast
  const mergedData = useMemo(() => {
    return mergeChartAndML(baseChart, mlPredictions, activeModel, range, isForecastVisible);
  }, [baseChart, mlPredictions, activeModel, range, isForecastVisible]);

  useEffect(() => {
    setData(mergedData);
  }, [mergedData]);

  const historyPoints = data.filter(d => !d.isForecast);
  const isPositive = historyPoints.length >= 2
    ? (historyPoints[historyPoints.length - 1].close ?? currentPrice) >= (historyPoints[0].close ?? currentPrice)
    : (changePct >= 0);
  const lineColor = isPositive ? '#00D09C' : '#EB5B3C';

  // Dynamic tight Y-axis domain
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
    const pad = (mx - mn) * 0.05 || mx * 0.02;
    return [+(mn - pad).toFixed(2), +(mx + pad).toFixed(2)];
  }, [data]);

  return (
    <div className="space-y-3">
      {/* Header controls: Range + ML Model Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Timeframe buttons */}
        <div className="flex gap-1 bg-[#F4F4F7] p-1 rounded-xl">
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

        {/* ML Forecast Selector & Toggle */}
        {showMLOverlay && (
          <div className="flex items-center gap-1.5 bg-[#EBFCF7] p-1 rounded-xl border border-[#00D09C]/20 text-xs font-semibold">
            <button
              onClick={() => setIsForecastVisible(!isForecastVisible)}
              className="px-2 py-1 rounded-lg text-[11px] font-bold text-[#00D09C] flex items-center gap-1 hover:bg-[#00D09C]/10 transition-colors"
              title="Toggle Forecast Overlay"
            >
              {isForecastVisible ? <Eye size={12} /> : <EyeOff size={12} />}
              <span className="font-mono uppercase">AI Forecast:</span>
            </button>

            {(['xgboost', 'arima', 'prophet', 'lstm'] as const).map(m => (
              <button
                key={m}
                onClick={() => {
                  setActiveModel(m);
                  setIsForecastVisible(true);
                }}
                className="px-2.5 py-1 rounded-lg transition-all font-mono uppercase text-[11px]"
                style={{
                  background: activeModel === m && isForecastVisible ? '#00D09C' : 'transparent',
                  color: activeModel === m && isForecastVisible ? '#FFFFFF' : '#00D09C',
                  fontWeight: activeModel === m && isForecastVisible ? 700 : 500,
                }}
              >
                {m === 'xgboost' ? '⭐ XGBoost' : m}
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
              {mlPredictions.direction.direction === 'up' ? '▲ BULLISH' : '▼ BEARISH'} ({(mlPredictions.direction.confidence * 100).toFixed(0)}% Probability)
            </span>
          </div>

          {mlPredictions.direction.backtest_accuracy != null && mlPredictions.direction.backtest_accuracy > 0 && (
            <span className="text-[#7C7E8C] font-mono text-[11px]">
              Backtest Accuracy: <b className="text-[#44475B]">{(mlPredictions.direction.backtest_accuracy * 100).toFixed(1)}%</b>
            </span>
          )}
        </div>
      )}

      {/* Main Chart Canvas */}
      <div style={{ height, position: 'relative' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded-2xl">
            <div className="text-sm font-semibold text-[#7C7E8C] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00D09C] animate-pulse" />
              Loading real market data & ML models...
            </div>
          </div>
        )}

        {data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id={`grad-${symbol}-${range}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0.01} />
                </linearGradient>
                <linearGradient id={`forecast-grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#F59E0B" stopOpacity={0.01} />
                </linearGradient>
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
                tickFormatter={(v: number) => `${currencySymbol}${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v.toFixed(0)}`}
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
                        {currencySymbol}{displayPrice?.toFixed(2)}
                      </div>
                      <div className="text-[#9B9EA7] font-mono">{p.date}</div>
                      {p.isForecast && (
                        <div className="text-[11px] font-semibold text-[#F59E0B] pt-1 border-t border-[#EAECEF]">
                          {activeModel.toUpperCase()} Forecast · Band: {currencySymbol}{p.lower?.toFixed(2)} – {currencySymbol}{p.upper?.toFixed(2)}
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

              {/* Historical Price Area */}
              <Area
                type="monotone"
                dataKey="close"
                stroke={lineColor}
                strokeWidth={2.2}
                fill={`url(#grad-${symbol}-${range})`}
                dot={false}
                name="Historical Price"
                activeDot={{ r: 4, stroke: lineColor, strokeWidth: 2, fill: '#fff' }}
              />

              {/* ML Forecast Forward Prediction Line */}
              {isForecastVisible && (
                <Line
                  type="monotone"
                  dataKey="predicted"
                  stroke="#F59E0B"
                  strokeWidth={2.4}
                  strokeDasharray="5 4"
                  dot={{ r: 2.5, fill: '#F59E0B', stroke: '#fff', strokeWidth: 1 }}
                  activeDot={{ r: 5, stroke: '#F59E0B', strokeWidth: 2, fill: '#fff' }}
                  name={`${activeModel.toUpperCase()} Forecast`}
                />
              )}

              {/* Factor event reference dots on chart */}
              {factors.map((factor, idx) => {
                const matchPoint = data.find(d => d.date === factor.date || d.date?.includes(factor.date?.slice(5)));
                if (!matchPoint || !matchPoint.close) return null;
                const dotColor = IMPACT_COLOR[factor.impact] || '#F59E0B';
                return (
                  <ReferenceDot
                    key={idx}
                    x={matchPoint.date}
                    y={matchPoint.close}
                    r={5}
                    fill={dotColor}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    onClick={() => onFactorClick && onFactorClick(factor)}
                    style={{ cursor: 'pointer' }}
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

/**
 * Merges historical chart points with forward ML forecast.
 * Accurately bounds the forward steps based on active chart timeframe.
 */
function mergeChartAndML(
  baseChart: ChartPoint[],
  mlResults: MLForecastResults | null,
  model: string,
  range: string,
  isForecastVisible: boolean,
): any[] {
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
  if (!anchorPrice || anchorPrice <= 0) return points;

  const rawFirst = forecastData[0].predicted;
  if (!rawFirst || rawFirst <= 0) return points;

  // Seamless anchor connection point
  lastPoint.predicted = anchorPrice;

  // Max forecast horizon steps based on timeframe
  const maxStepsMap: Record<string, number> = {
    '1d': 0,    // on 1D intraday, don't mix days with minutes
    '5d': 3,    // on 1W, show next 3 days
    '1mo': 7,   // on 1M, show next 7 days
    '3mo': 12,  // on 3M, show next 12 days
    '1y': 15,   // on 1Y, show full 15 days
    '5y': 15,
  };
  const maxSteps = maxStepsMap[range] ?? 7;
  if (maxSteps === 0) return points;

  forecastData.slice(0, maxSteps).forEach((f: any, idx: number) => {
    // Relative % return trajectory applied directly to chart anchor price
    const pctChange = (f.predicted - rawFirst) / rawFirst;
    const calibrated = +(anchorPrice * (1 + pctChange)).toFixed(2);

    const spread = calibrated * 0.012 * Math.sqrt(idx + 1);
    const bandLow = +(calibrated - spread).toFixed(2);
    const bandHigh = +(calibrated + spread).toFixed(2);

    points.push({
      date: formatForecastDate(f.date, range),
      close: null,
      predicted: calibrated,
      upper: bandHigh,
      lower: bandLow,
      volume: 0,
      isForecast: true,
    });
  });

  return points;
}

function generateFallback(basePrice: number, range: string): ChartPoint[] {
  const counts: Record<string, number> = {
    '1d': 78, '5d': 50, '1mo': 22, '3mo': 65, '1y': 52, '5y': 60,
  };
  const n = counts[range] || 30;
  const pts: ChartPoint[] = [];
  let p = basePrice * (0.98 + Math.random() * 0.02);
  const now = Date.now();

  for (let i = n; i >= 0; i--) {
    const delta = (Math.random() - 0.48) * p * 0.015;
    p = Math.max(1, p + delta);
    const t = now - i * (range === '1d' ? 300000 : range === '5d' ? 1800000 : 86400000);
    pts.push({
      time: t,
      date: range === '1d' || range === '5d'
        ? new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
        : new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      open: +(p - delta * 0.5).toFixed(2),
      high: +(p * 1.003).toFixed(2),
      low: +(p * 0.997).toFixed(2),
      close: +p.toFixed(2),
      volume: Math.floor(500000 + Math.random() * 3000000),
    });
  }
  return pts;
}
