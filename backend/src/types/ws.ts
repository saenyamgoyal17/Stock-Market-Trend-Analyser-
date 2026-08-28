// Client -> Server
export interface AuthMessage {
  type: 'auth';
  token: string;
}

export interface SubscribePriceMessage {
  type: 'subscribe_price';
  symbols: string[];
}

export interface UnsubscribePriceMessage {
  type: 'unsubscribe_price';
  symbols: string[];
}

export interface SubscribeEventsMessage {
  type: 'subscribe_events';
}

export interface SubscribeIndexMessage {
  type: 'subscribe_index';
  symbols: string[];
}

export type ClientMessage =
  | AuthMessage
  | SubscribePriceMessage
  | UnsubscribePriceMessage
  | SubscribeEventsMessage
  | SubscribeIndexMessage;

// Server -> Client
export interface PriceUpdateMessage {
  type: 'price_update';
  data: {
    symbol: string;
    price: number;
    change: number;
    changePct: number;
    timestamp: string;
  };
}

export interface EventNewMessage {
  type: 'event_new';
  data: {
    id: string;
    title: string;
    severity: string;
    impactedSymbols: string[];
  };
}

export interface AlertFiredMessage {
  type: 'alert_fired';
  data: {
    id: string;
    message: string;
    symbol?: string;
  };
}

export interface IndexUpdateMessage {
  type: 'index_update';
  data: {
    symbol: string;
    value: number;
    change: number;
    changePct: number;
  };
}

export interface MarketStatusMessage {
  type: 'market_status';
  data: {
    exchange: string;
    isOpen: boolean;
    nextOpen?: string;
    nextClose?: string;
  };
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage =
  | PriceUpdateMessage
  | EventNewMessage
  | AlertFiredMessage
  | IndexUpdateMessage
  | MarketStatusMessage
  | ErrorMessage;
