import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { AlertType } from '@prisma/client';

class AlertService {
  async getUserAlerts(userId: string) {
    try {
      const alerts = await prisma.alert.findMany({ where: { userId } });
      return { success: true, data: alerts };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in getUserAlerts');
      return { success: false, error: { code: 'FETCH_FAILED', message: error.message } };
    }
  }

  async create(userId: string, data: { symbol: string; alertType: AlertType; threshold?: number; eventCategory?: any }) {
    try {
      const alert = await prisma.alert.create({
        data: { userId, ...data }
      });
      return { success: true, data: alert };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in create alert');
      return { success: false, error: { code: 'CREATE_FAILED', message: error.message } };
    }
  }

  async update(userId: string, alertId: string, data: any) {
    try {
      const existing = await prisma.alert.findUnique({ where: { id: alertId } });
      if (!existing || existing.userId !== userId) throw new Error('Not found or unauthorized');

      const alert = await prisma.alert.update({
        where: { id: alertId },
        data
      });
      return { success: true, data: alert };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in update alert');
      return { success: false, error: { code: 'UPDATE_FAILED', message: error.message } };
    }
  }

  async delete(userId: string, alertId: string) {
    try {
      const existing = await prisma.alert.findUnique({ where: { id: alertId } });
      if (!existing || existing.userId !== userId) throw new Error('Not found or unauthorized');

      await prisma.alert.delete({ where: { id: alertId } });
      return { success: true, data: null };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in delete alert');
      return { success: false, error: { code: 'DELETE_FAILED', message: error.message } };
    }
  }

  async checkAndFireAlerts(symbol: string, currentPrice: number, previousPrice: number) {
    try {
      const changePct = ((currentPrice - previousPrice) / previousPrice) * 100;
      
      const alerts = await prisma.alert.findMany({
        where: { symbol, isActive: true }
      });

      const triggered = [];
      for (const alert of alerts) {
        if (!alert.threshold) continue;

        let shouldFire = false;
        if (alert.alertType === 'PRICE_CHANGE_UP' && changePct >= alert.threshold) {
          shouldFire = true;
        } else if (alert.alertType === 'PRICE_CHANGE_DOWN' && changePct <= -alert.threshold) {
          shouldFire = true;
        }

        if (shouldFire) {
          await prisma.alert.update({
            where: { id: alert.id },
            data: { lastTriggered: new Date() }
          });
          triggered.push(alert);
          // broadcast via websocket omitted for brevity
        }
      }

      return { success: true, data: triggered };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in checkAndFireAlerts');
      return { success: false, error: { code: 'CHECK_FAILED', message: error.message } };
    }
  }

  async checkEventAlerts(event: any) {
    try {
      const alerts = await prisma.alert.findMany({
        where: { alertType: 'EVENT_DETECTED', eventCategory: event.category, isActive: true }
      });

      for (const alert of alerts) {
        await prisma.alert.update({
          where: { id: alert.id },
          data: { lastTriggered: new Date() }
        });
        // broadcast via websocket omitted
      }

      return { success: true, data: alerts };
    } catch (error: any) {
      logger.error({ err: error }, 'Error in checkEventAlerts');
      return { success: false, error: { code: 'CHECK_FAILED', message: error.message } };
    }
  }
}

export const alertService = new AlertService();
