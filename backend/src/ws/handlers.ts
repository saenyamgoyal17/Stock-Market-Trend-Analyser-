import { AuthenticatedSocket } from './server.js';
import { logger } from '../lib/logger.js';

export function handleMessage(socket: AuthenticatedSocket, message: string) {
  try {
    const parsed = JSON.parse(message);

    switch (parsed.type) {
      case 'subscribe:price':
        if (Array.isArray(parsed.symbols)) {
          parsed.symbols.forEach((s: string) => socket.subscriptions.prices.add(s));
        }
        break;
      case 'unsubscribe:price':
        if (Array.isArray(parsed.symbols)) {
          parsed.symbols.forEach((s: string) => socket.subscriptions.prices.delete(s));
        }
        break;
      case 'subscribe:events':
        socket.subscriptions.events = true;
        break;
      case 'subscribe:index':
        socket.subscriptions.indices = true;
        break;
      default:
        socket.send(JSON.stringify({ type: 'error', message: 'Unknown type' }));
    }
  } catch (error) {
    logger.error({ err: error, message }, 'Failed to parse message');
    socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON message' }));
  }
}
