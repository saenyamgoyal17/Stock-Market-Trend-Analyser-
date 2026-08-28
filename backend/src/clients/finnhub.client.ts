import axios, { AxiosInstance } from 'axios';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

class FinnhubClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://finnhub.io/api/v1',
      headers: {
        'X-Finnhub-Token': config.finnhub?.apiKey || process.env.FINNHUB_API_KEY,
      },
    });
  }

  private async request<T>(method: string, url: string, params: Record<string, any> = {}): Promise<T> {
    try {
      const response = await this.client.request<T>({ method, url, params });
      return response.data;
    } catch (error: any) {
      logger.error({ err: error, url }, 'Finnhub API request failed');
      throw error;
    }
  }

  async getQuote(symbol: string): Promise<any> {
    return this.request('GET', '/quote', { symbol });
  }

  async searchSymbols(query: string): Promise<any> {
    return this.request('GET', '/search', { q: query });
  }

  async getCompanyProfile(symbol: string): Promise<any> {
    return this.request('GET', '/stock/profile2', { symbol });
  }

  async getCandles(symbol: string, resolution: string, from: number, to: number): Promise<any> {
    return this.request('GET', '/stock/candle', { symbol, resolution, from, to });
  }

  async getMarketNews(category: string = 'general'): Promise<any> {
    return this.request('GET', '/news', { category });
  }

  async getCompanyNews(symbol: string, from: string, to: string): Promise<any> {
    return this.request('GET', '/company-news', { symbol, from, to });
  }

  async getBasicFinancials(symbol: string): Promise<any> {
    return this.request('GET', '/stock/metric', { symbol, metric: 'all' });
  }

  async getEarningsCalendar(from?: string, to?: string): Promise<any> {
    return this.request('GET', '/calendar/earnings', { from, to });
  }

  async getForexRates(exchange: string = 'oanda'): Promise<any> {
    return this.request('GET', '/forex/rates', { base: 'USD', exchange });
  }
}

export const finnhubClient = new FinnhubClient();
