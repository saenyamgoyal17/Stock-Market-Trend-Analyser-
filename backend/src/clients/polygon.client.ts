import axios, { AxiosInstance } from 'axios';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

class PolygonClient {
  private client: AxiosInstance;
  private readonly maxRetries = 3;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.polygon.io',
      params: {
        apiKey: config.polygon?.apiKey || process.env.POLYGON_API_KEY,
      },
    });
  }

  private async request<T>(method: string, url: string, params: Record<string, any> = {}): Promise<T> {
    let attempts = 0;
    while (attempts < this.maxRetries) {
      try {
        const response = await this.client.request<T>({ method, url, params });
        return response.data;
      } catch (error: any) {
        attempts++;
        logger.error({ err: error, attempts, url }, 'Polygon API request failed');
        if (error.response?.status === 429 && attempts < this.maxRetries) {
          // Rate limit hit, wait for 60 seconds (5 req/min on free tier)
          const waitTime = 60000;
          logger.warn(`Rate limit reached for Polygon API. Retrying in ${waitTime}ms`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else {
          throw error;
        }
      }
    }
    throw new Error('Polygon API max retries reached');
  }

  async getTickerDetails(symbol: string): Promise<any> {
    return this.request('GET', `/v3/reference/tickers/${symbol}`);
  }

  async getLatestPrice(symbol: string): Promise<any> {
    return this.request('GET', `/v2/last/trade/${symbol}`);
  }

  async getAggregates(symbol: string, multiplier: number, timespan: string, from: string, to: string): Promise<any> {
    return this.request('GET', `/v2/aggs/ticker/${symbol}/range/${multiplier}/${timespan}/${from}/${to}`);
  }

  async searchTickers(query: string, limit: number = 20): Promise<any> {
    return this.request('GET', '/v3/reference/tickers', { search: query, active: true, limit });
  }

  async getAllTickers(type?: string, market?: string, limit: number = 1000, cursor?: string): Promise<any> {
    return this.request('GET', '/v3/reference/tickers', { type, market, limit, cursor });
  }

  async getSnapshotAllTickers(): Promise<any> {
    return this.request('GET', '/v2/snapshot/locale/us/markets/stocks/tickers');
  }

  async getSnapshotGainersLosers(direction: 'gainers' | 'losers'): Promise<any> {
    return this.request('GET', `/v2/snapshot/locale/us/markets/stocks/${direction}`);
  }

  async getGroupedDaily(date: string): Promise<any> {
    return this.request('GET', `/v2/aggs/grouped/locale/us/market/stocks/${date}`);
  }
}

export const polygonClient = new PolygonClient();
