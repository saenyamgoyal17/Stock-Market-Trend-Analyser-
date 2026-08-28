import { connectedClients, AuthenticatedSocket } from './server.js';

function sendToClient(socket: AuthenticatedSocket, message: any) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

export function broadcastPriceUpdate(symbol: string, price: number, change: number, changePct: number, currency: string) {
  const message = { type: 'price:update', data: { symbol, price, change, changePct, currency } };
  for (const socket of connectedClients.values()) {
    if (socket.subscriptions.prices.has(symbol)) {
      sendToClient(socket, message);
    }
  }
}

export function broadcastNewEvent(event: { id: string, title: string, category: string, severity: string, sentiment: number | null, stocks: any[], sectors: any[] }) {
  const message = { type: 'event:new', data: event };
  for (const socket of connectedClients.values()) {
    if (socket.subscriptions.events) {
      sendToClient(socket, message);
    }
  }
}

export function broadcastAlertFired(userId: string, alert: { alertId: string, symbol: string, type: string, currentValue: number }) {
  const message = { type: 'alert:fired', data: alert };
  for (const socket of connectedClients.values()) {
    if (socket.userId === userId) {
      sendToClient(socket, message);
    }
  }
}

export function broadcastIndexUpdate(index: string, value: number, change: number) {
  const message = { type: 'index:update', data: { index, value, change } };
  for (const socket of connectedClients.values()) {
    if (socket.subscriptions.indices) {
      sendToClient(socket, message);
    }
  }
}

export function broadcastMarketStatus(exchange: string, isOpen: boolean) {
  const message = { type: 'market:status', data: { exchange, isOpen } };
  for (const socket of connectedClients.values()) {
    if (socket.subscriptions.indices) {
      sendToClient(socket, message);
    }
  }
}
