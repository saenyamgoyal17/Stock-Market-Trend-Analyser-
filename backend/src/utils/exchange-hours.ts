import { DateTime } from 'luxon';
import { EXCHANGES } from '../config/exchanges.js';
import { MarketStatus } from '../types/index.js';

export function isExchangeOpen(exchangeCode: string): boolean {
  const exchange = EXCHANGES.get(exchangeCode);
  if (!exchange) return false;

  const now = DateTime.now().setZone(exchange.timezone);
  if (!exchange.tradingDays.includes(now.weekday % 7)) return false;

  const openTime = DateTime.fromFormat(exchange.openTime, 'HH:mm', { zone: exchange.timezone }).set({ year: now.year, month: now.month, day: now.day });
  const closeTime = DateTime.fromFormat(exchange.closeTime, 'HH:mm', { zone: exchange.timezone }).set({ year: now.year, month: now.month, day: now.day });

  return now >= openTime && now <= closeTime;
}

export function getNextOpen(exchangeCode: string): DateTime {
  const exchange = EXCHANGES.get(exchangeCode);
  if (!exchange) throw new Error('Exchange not found');

  let dt = DateTime.now().setZone(exchange.timezone);
  const openTimeStr = exchange.openTime;

  while (true) {
    const openTime = DateTime.fromFormat(openTimeStr, 'HH:mm', { zone: exchange.timezone }).set({ year: dt.year, month: dt.month, day: dt.day });
    if (exchange.tradingDays.includes(dt.weekday % 7) && dt < openTime) {
      return openTime;
    }
    dt = dt.plus({ days: 1 }).startOf('day');
  }
}

export function getNextClose(exchangeCode: string): DateTime {
  const exchange = EXCHANGES.get(exchangeCode);
  if (!exchange) throw new Error('Exchange not found');

  let dt = DateTime.now().setZone(exchange.timezone);
  const closeTimeStr = exchange.closeTime;

  const closeTime = DateTime.fromFormat(closeTimeStr, 'HH:mm', { zone: exchange.timezone }).set({ year: dt.year, month: dt.month, day: dt.day });
  if (exchange.tradingDays.includes(dt.weekday % 7) && dt <= closeTime) {
      return closeTime;
  }
  
  while (true) {
      dt = dt.plus({ days: 1 }).startOf('day');
      const nextClose = DateTime.fromFormat(closeTimeStr, 'HH:mm', { zone: exchange.timezone }).set({ year: dt.year, month: dt.month, day: dt.day });
      if (exchange.tradingDays.includes(dt.weekday % 7)) {
          return nextClose;
      }
  }
}

export function getMarketStatus(exchangeCode: string): MarketStatus {
  const exchange = EXCHANGES.get(exchangeCode);
  if (!exchange) {
    throw new Error('Exchange not found');
  }

  const isOpen = isExchangeOpen(exchangeCode);
  
  return {
    isOpen,
    nextOpen: getNextOpen(exchangeCode).toISO() || '',
    nextClose: getNextClose(exchangeCode).toISO() || '',
    timezone: exchange.timezone,
  };
}
