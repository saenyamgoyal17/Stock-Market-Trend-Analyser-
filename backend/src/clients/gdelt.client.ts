import axios, { AxiosInstance } from 'axios';
import { logger } from '../lib/logger.js';

export interface GdeltArticle {
  url: string;
  url_mobile: string;
  title: string;
  seendate: string;
  socialimage: string;
  domain: string;
  language: string;
  sourcecountry: string;
}

export interface GdeltResponse {
  articles: GdeltArticle[];
}

class GdeltClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.gdeltproject.org/api/v2',
    });
  }

  private async request(method: string, url: string, params: Record<string, any> = {}): Promise<any> {
    try {
      const response = await this.client.request({ method, url, params });
      return response.data;
    } catch (error: any) {
      logger.error({ err: error, url }, 'GDELT API request failed');
      throw error;
    }
  }

  async searchArticles(params: { query: string; mode?: string; maxrecords?: number; format?: string; sort?: string }): Promise<GdeltResponse> {
    const finalParams = {
      mode: 'ArtList',
      format: 'json',
      maxrecords: 50,
      sort: 'DateDesc',
      ...params,
    };
    return this.request('GET', '/doc/doc', finalParams);
  }

  async getGeoEvents(params: { query?: string; maxrecords?: number }): Promise<any> {
    return this.request('GET', '/doc/doc', { mode: 'PointData', format: 'json', ...params });
  }

  async getTimeline(params: { query: string; mode?: string }): Promise<any> {
    return this.request('GET', '/doc/doc', { mode: 'TimelineVol', format: 'json', ...params });
  }

  async getConflictEvents(): Promise<GdeltResponse> {
    return this.searchArticles({ query: 'conflict OR war OR military OR terrorism OR sanctions' });
  }

  async getPoliticalEvents(): Promise<GdeltResponse> {
    return this.searchArticles({ query: 'election OR government OR policy OR regulation OR legislation OR political' });
  }

  async getEconomicEvents(): Promise<GdeltResponse> {
    return this.searchArticles({ query: 'economy OR trade OR tariff OR GDP OR inflation OR recession' });
  }
}

export const gdeltClient = new GdeltClient();
