import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { priceService } from './price.service.js';
import { fxService } from './fx.service.js';

class PortfolioService {
  async getUserPortfolio(userId: string) {
    try {
      let portfolio = await prisma.portfolio.findFirst({ where: { userId } });
      if (!portfolio) {
        portfolio = await prisma.portfolio.create({
          data: { userId, name: 'Default Portfolio', holdings: [] }
        });
      }
      return { success: true, data: portfolio };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getUserPortfolio');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async createPortfolio(userId: string, name: string) {
    try {
      const portfolio = await prisma.portfolio.create({
        data: { userId, name, holdings: [] }
      });
      return { success: true, data: portfolio };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in createPortfolio');
      return { success: false, error: { code: 'CREATE_FAILED', message: error.message } };
    }
  }

  async addHolding(userId: string, holding: { symbol: string; quantity: number; avgBuyPrice: number; currency: string }) {
    try {
      const pfRes = await this.getUserPortfolio(userId);
      if (!pfRes.success || !pfRes.data) throw new Error('Portfolio not found');

      const portfolio = pfRes.data;
      let holdings: any[] = Array.isArray(portfolio.holdings) ? portfolio.holdings : [];
      
      const existingIdx = holdings.findIndex(h => h.symbol === holding.symbol);
      if (existingIdx >= 0) {
        holdings[existingIdx] = holding;
      } else {
        holdings.push(holding);
      }

      const updated = await prisma.portfolio.update({
        where: { id: portfolio.id },
        data: { holdings }
      });

      return { success: true, data: updated };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in addHolding');
      return { success: false, error: { code: 'UPDATE_FAILED', message: error.message } };
    }
  }

  async removeHolding(userId: string, symbol: string) {
    try {
      const pfRes = await this.getUserPortfolio(userId);
      if (!pfRes.success || !pfRes.data) throw new Error('Portfolio not found');

      const portfolio = pfRes.data;
      let holdings: any[] = Array.isArray(portfolio.holdings) ? portfolio.holdings : [];
      holdings = holdings.filter(h => h.symbol !== symbol);

      const updated = await prisma.portfolio.update({
        where: { id: portfolio.id },
        data: { holdings }
      });

      return { success: true, data: updated };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in removeHolding');
      return { success: false, error: { code: 'UPDATE_FAILED', message: error.message } };
    }
  }

  async getPerformance(userId: string, userCurrency: string) {
    try {
      const pfRes = await this.getUserPortfolio(userId);
      if (!pfRes.success || !pfRes.data) throw new Error('Portfolio not found');

      const holdings: any[] = Array.isArray(pfRes.data.holdings) ? pfRes.data.holdings : [];
      let totalValue = 0;
      let totalCost = 0;

      const performance = await Promise.all(holdings.map(async (h) => {
        const priceRes = await priceService.getCurrentPrice(h.symbol, userCurrency);
        const currentPrice = priceRes.data?.price || 0;
        
        let costPrice = h.avgBuyPrice;
        if (h.currency !== userCurrency) {
          const conv = await fxService.convert(h.avgBuyPrice, h.currency, userCurrency);
          costPrice = conv.data?.result || h.avgBuyPrice;
        }

        const currentValue = currentPrice * h.quantity;
        const totalItemCost = costPrice * h.quantity;
        const pnl = currentValue - totalItemCost;
        const pnlPct = totalItemCost > 0 ? (pnl / totalItemCost) * 100 : 0;

        totalValue += currentValue;
        totalCost += totalItemCost;

        return { ...h, currentPrice, currentValue, pnl, pnlPct };
      }));

      const totalPnl = totalValue - totalCost;
      const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

      return { success: true, data: { holdings: performance, totalValue, totalCost, totalPnl, totalPnlPct, currency: userCurrency } };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getPerformance');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }
}

export const portfolioService = new PortfolioService();
