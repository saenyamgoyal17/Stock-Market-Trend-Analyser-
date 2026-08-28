import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { exchangeRateClient } from '../clients/exchangerate.client.js';

class FXService {
  async getRates(base: string, targets: string[]) {
    try {
      const cacheKey = `fx:${base}`;
      const cached = await redis.get(cacheKey);
      
      let allRates: Record<string, number>;
      if (cached) {
        allRates = JSON.parse(cached);
      } else {
        const data = await exchangeRateClient.getLatestRates(base);
        allRates = data.conversion_rates;
        await redis.setex(cacheKey, 300, JSON.stringify(allRates));
      }

      const rates: Record<string, number> = {};
      for (const t of targets) {
        if (allRates[t]) rates[t] = allRates[t];
      }

      return { success: true, data: { base, rates, updatedAt: new Date() } };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getRates');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async convert(amount: number, from: string, to: string) {
    try {
      if (from === to) return { success: true, data: { amount, from, to, result: amount, rate: 1 } };
      
      const ratesRes = await this.getRates(from, [to]);
      if (!ratesRes.success || !ratesRes.data?.rates[to]) {
        throw new Error('Rate not found');
      }

      const rate = ratesRes.data.rates[to];
      return { success: true, data: { amount, from, to, result: amount * rate, rate } };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in convert');
      return { success: false, error: { code: 'CONVERT_FAILED', message: error.message } };
    }
  }

  async getSupportedCurrencies() {
    try {
      const cacheKey = 'fx:supported_currencies';
      const cached = await redis.get(cacheKey);
      if (cached) return { success: true, data: JSON.parse(cached) };

      const currencies = await exchangeRateClient.getSupportedCurrencies();
      await redis.setex(cacheKey, 86400, JSON.stringify(currencies));
      
      return { success: true, data: currencies };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getSupportedCurrencies');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async refreshAllRates() {
    try {
      const data = await exchangeRateClient.getLatestRates('USD');
      
      const ops = Object.entries(data.conversion_rates).map(([target, rate]) => {
        return prisma.fXRate.upsert({
          where: { baseCurrency_targetCurrency: { baseCurrency: 'USD', targetCurrency: target } },
          update: { rate: rate as number, updatedAt: new Date() },
          create: { baseCurrency: 'USD', targetCurrency: target, rate: rate as number }
        });
      });

      await prisma.$transaction(ops);
      await redis.setex('fx:USD', 300, JSON.stringify(data.conversion_rates));

      return { success: true, data: null };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in refreshAllRates');
      return { success: false, error: { code: 'REFRESH_FAILED', message: error.message } };
    }
  }

  async getRate(from: string, to: string) {
    try {
      const res = await this.convert(1, from, to);
      if (!res.success || !res.data) throw new Error('Rate fetch failed');
      return { success: true, data: res.data.rate };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getRate');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }
}

export const fxService = new FXService();
