import axios, { AxiosInstance } from 'axios';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

export interface ExchangeRateResponse {
  result: string;
  base_code: string;
  conversion_rates: Record<string, number>;
}

class ExchangeRateClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor() {
    this.apiKey = config.exchangeRate?.apiKey || process.env.EXCHANGE_RATE_API_KEY || '';
    this.client = axios.create({
      baseURL: 'https://v6.exchangerate-api.com/v6',
    });
  }

  private async request<T>(method: string, url: string, params: Record<string, any> = {}): Promise<T> {
    try {
      const response = await this.client.request<T>({ method, url, params });
      return response.data;
    } catch (error: any) {
      logger.error({ err: error, url }, 'ExchangeRate API request failed');
      throw error;
    }
  }

  async getLatestRates(baseCurrency: string = 'USD'): Promise<ExchangeRateResponse> {
    return this.request<ExchangeRateResponse>('GET', `/${this.apiKey}/latest/${baseCurrency}`);
  }

  async convertCurrency(from: string, to: string, amount: number): Promise<any> {
    return this.request('GET', `/${this.apiKey}/pair/${from}/${to}/${amount}`);
  }

  async getSupportedCurrencies(): Promise<any> {
    return this.request('GET', `/${this.apiKey}/codes`);
  }
}

export const exchangeRateClient = new ExchangeRateClient();
