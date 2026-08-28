import axios, { AxiosInstance } from 'axios';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';

export interface NewsArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

export interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsArticle[];
}

class NewsApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://newsapi.org/v2',
      headers: {
        'X-Api-Key': config.newsapi?.apiKey || process.env.NEWSAPI_KEY,
      },
    });
  }

  private async request<T>(method: string, url: string, params: Record<string, any> = {}): Promise<T> {
    try {
      const response = await this.client.request<T>({ method, url, params });
      return response.data;
    } catch (error: any) {
      logger.error({ err: error, url }, 'NewsAPI request failed');
      throw error;
    }
  }

  async getTopHeadlines(params: { country?: string; category?: string; q?: string; pageSize?: number }): Promise<NewsApiResponse> {
    return this.request<NewsApiResponse>('GET', '/top-headlines', params);
  }

  async searchEverything(params: { q: string; from?: string; to?: string; language?: string; sortBy?: string; pageSize?: number }): Promise<NewsApiResponse> {
    return this.request<NewsApiResponse>('GET', '/everything', params);
  }

  async getGeopoliticalNews(): Promise<NewsApiResponse> {
    return this.searchEverything({
      q: 'geopolitical OR tariff OR sanctions OR military OR war OR conflict OR election OR regulation OR trade war',
      language: 'en',
    });
  }

  async getFinancialNews(): Promise<NewsApiResponse> {
    return this.searchEverything({
      q: 'stock market OR earnings OR GDP OR inflation OR interest rate OR federal reserve OR central bank',
      language: 'en',
    });
  }
}

export const newsApiClient = new NewsApiClient();
