import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { supabaseAdmin } from '../lib/supabase.js';
import { logger } from '../lib/logger.js';
import { handleMessage } from './handlers.js';

export interface AuthenticatedSocket extends WebSocket {
  userId?: string;
  subscriptions: {
    prices: Set<string>;
    events: boolean;
    indices: boolean;
  };
}

export const connectedClients = new Map<string, AuthenticatedSocket>();

export function startWebSocketServer(server: any) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const socket = ws as AuthenticatedSocket;
    socket.subscriptions = {
      prices: new Set<string>(),
      events: false,
      indices: false,
    };
    let isAuthenticated = false;

    socket.on('message', async (message: Buffer) => {
      try {
        const data = message.toString();
        const parsed = JSON.parse(data);

        if (!isAuthenticated) {
          if (parsed.type === 'auth' && parsed.token) {
            const { data: { user }, error } = await supabaseAdmin.auth.getUser(parsed.token);
            if (error || !user) {
              socket.send(JSON.stringify({ type: 'error', message: 'Authentication failed' }));
              socket.close();
              return;
            }
            isAuthenticated = true;
            socket.userId = user.id;
            
            const connectionId = `${user.id}-${Date.now()}-${Math.random()}`;
            connectedClients.set(connectionId, socket);
            
            socket.on('close', () => {
              connectedClients.delete(connectionId);
            });
            
            socket.send(JSON.stringify({ type: 'auth:success' }));
          } else {
            socket.send(JSON.stringify({ type: 'error', message: 'First message must be auth' }));
            socket.close();
          }
        } else {
          handleMessage(socket, data);
        }
      } catch (err) {
        logger.error({ err }, 'Error handling websocket message');
      }
    });

    socket.on('error', (error) => {
      logger.error({ err: error }, 'WebSocket error');
    });
  });

  return wss;
}
