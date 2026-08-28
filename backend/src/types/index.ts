export interface StockSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  currency: string;
  nativeCurrency: string;
  price: number;
  priceInUserCurrency: number;
  change: number;
  changePct: number;
  marketCap: number;
  sector?: string;
}

export interface AffectedStock {
  symbol: string;
  direction: 'bullish' | 'bearish';
  confidence: number;
  magnitude: number;
  reason: string;
}

export interface AffectedSector {
  name: string;
  direction: 'bullish' | 'bearish';
  magnitude: number;
  reason: string;
}

export interface EventImpactAnalysis {
  overallSentiment: number;
  summary: string;
  affectedStocks: AffectedStock[];
  affectedSectors: AffectedSector[];
  keyRisks: string[];
  timeHorizon: string;
}

export interface ExchangeInfo {
  code: string;
  name: string;
  country: string;
  timezone: string;
  currency: string;
  openTime: string;
  closeTime: string;
  tradingDays: number[];
}

export interface MarketStatus {
  isOpen: boolean;
  nextOpen: string;
  nextClose: string;
  timezone: string;
}

export interface PortfolioHolding {
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  currency: string;
}

export interface HoldingPerformance {
  symbol: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPct: number;
  currency: string;
}

export interface PortfolioPerformance {
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPct: number;
  holdings: HoldingPerformance[];
}

export interface IndexData {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePct: number;
  exchange: string;
  country: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  role: string;
  country?: string;
  currency?: string;
  provider?: string;
  createdAt: Date;
}
