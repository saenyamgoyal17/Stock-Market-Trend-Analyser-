import axios, { AxiosInstance } from 'axios';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

class FmpClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://financialmodelingprep.com/api/v3',
      params: {
        apikey: config.fmp?.apiKey || process.env.FMP_API_KEY,
      },
    });
  }

  private async request<T>(method: string, url: string, params: Record<string, any> = {}): Promise<T> {
    try {
      const response = await this.client.request<T>({ method, url, params });
      return response.data;
    } catch (error: any) {
      logger.error({ err: error, url }, 'FMP API request failed');
      throw error;
    }
  }

  async getQuote(symbol: string): Promise<any> {
    return this.request('GET', `/quote/${symbol}`);
  }

  async searchSymbol(query: string, limit: number = 20): Promise<any> {
    return this.request('GET', '/search', { query, limit });
  }

  async getCompanyProfile(symbol: string): Promise<any> {
    return this.request('GET', `/profile/${symbol}`);
  }

  async getFinancialStatements(symbol: string, period: string = 'annual'): Promise<any> {
    return this.request('GET', `/income-statement/${symbol}`, { period });
  }

  async getKeyMetrics(symbol: string): Promise<any> {
    return this.request('GET', `/key-metrics/${symbol}`);
  }

  async getEarningsCalendar(from?: string, to?: string): Promise<any> {
    return this.request('GET', '/earning_calendar', { from, to });
  }

  async getStockNews(tickers?: string, limit: number = 50): Promise<any> {
    return this.request('GET', '/stock_news', { tickers, limit });
  }

  async getSectorPerformance(): Promise<any> {
    return this.request('GET', '/sector-performance');
  }

  async getMarketMostActive(): Promise<any> {
    return this.request('GET', '/actives');
  }

  async getMarketGainers(): Promise<any> {
    return this.request('GET', '/gainers');
  }

  async getMarketLosers(): Promise<any> {
    return this.request('GET', '/losers');
  }

  async getHistoricalPrice(symbol: string, from?: string, to?: string): Promise<any> {
    return this.request('GET', `/historical-price-full/${symbol}`, { from, to });
  }
}

export const fmpClient = new FmpClient();
