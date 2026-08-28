export const EXCHANGES = new Map([
  ['NYSE', { code: 'NYSE', name: 'New York Stock Exchange', country: 'US', timezone: 'America/New_York', currency: 'USD', openTime: '09:30', closeTime: '16:00', tradingDays: [1, 2, 3, 4, 5] }],
  ['NASDAQ', { code: 'NASDAQ', name: 'NASDAQ', country: 'US', timezone: 'America/New_York', currency: 'USD', openTime: '09:30', closeTime: '16:00', tradingDays: [1, 2, 3, 4, 5] }],
  ['AMEX', { code: 'AMEX', name: 'American Stock Exchange', country: 'US', timezone: 'America/New_York', currency: 'USD', openTime: '09:30', closeTime: '16:00', tradingDays: [1, 2, 3, 4, 5] }],
  ['TSX', { code: 'TSX', name: 'Toronto Stock Exchange', country: 'CA', timezone: 'America/Toronto', currency: 'CAD', openTime: '09:30', closeTime: '16:00', tradingDays: [1, 2, 3, 4, 5] }],
  ['LSE', { code: 'LSE', name: 'London Stock Exchange', country: 'GB', timezone: 'Europe/London', currency: 'GBP', openTime: '08:00', closeTime: '16:30', tradingDays: [1, 2, 3, 4, 5] }],
  ['EURONEXT', { code: 'EURONEXT', name: 'Euronext', country: 'EU', timezone: 'Europe/Paris', currency: 'EUR', openTime: '09:00', closeTime: '17:30', tradingDays: [1, 2, 3, 4, 5] }],
  ['BSE', { code: 'BSE', name: 'Bombay Stock Exchange', country: 'IN', timezone: 'Asia/Kolkata', currency: 'INR', openTime: '09:15', closeTime: '15:30', tradingDays: [1, 2, 3, 4, 5] }],
  ['NSE', { code: 'NSE', name: 'National Stock Exchange of India', country: 'IN', timezone: 'Asia/Kolkata', currency: 'INR', openTime: '09:15', closeTime: '15:30', tradingDays: [1, 2, 3, 4, 5] }],
  ['TSE', { code: 'TSE', name: 'Tokyo Stock Exchange', country: 'JP', timezone: 'Asia/Tokyo', currency: 'JPY', openTime: '09:00', closeTime: '15:00', tradingDays: [1, 2, 3, 4, 5] }],
  ['ASX', { code: 'ASX', name: 'Australian Securities Exchange', country: 'AU', timezone: 'Australia/Sydney', currency: 'AUD', openTime: '10:00', closeTime: '16:00', tradingDays: [1, 2, 3, 4, 5] }],
  ['HKEX', { code: 'HKEX', name: 'Hong Kong Stock Exchange', country: 'HK', timezone: 'Asia/Hong_Kong', currency: 'HKD', openTime: '09:30', closeTime: '16:00', tradingDays: [1, 2, 3, 4, 5] }],
  ['SGX', { code: 'SGX', name: 'Singapore Exchange', country: 'SG', timezone: 'Asia/Singapore', currency: 'SGD', openTime: '09:00', closeTime: '17:00', tradingDays: [1, 2, 3, 4, 5] }],
  ['TADAWUL', { code: 'TADAWUL', name: 'Saudi Stock Exchange', country: 'SA', timezone: 'Asia/Riyadh', currency: 'SAR', openTime: '10:00', closeTime: '15:00', tradingDays: [0, 1, 2, 3, 4] }], // Sun-Thu
  ['JSE', { code: 'JSE', name: 'Johannesburg Stock Exchange', country: 'ZA', timezone: 'Africa/Johannesburg', currency: 'ZAR', openTime: '09:00', closeTime: '17:00', tradingDays: [1, 2, 3, 4, 5] }],
  ['B3', { code: 'B3', name: 'B3 - Brasil Bolsa Balcão', country: 'BR', timezone: 'America/Sao_Paulo', currency: 'BRL', openTime: '10:00', closeTime: '17:00', tradingDays: [1, 2, 3, 4, 5] }],
]);

export const MAJOR_INDICES = new Map([
  ['SPX', { symbol: 'SPX', name: 'S&P 500', exchange: 'NYSE/NASDAQ', country: 'US' }],
  ['NDX', { symbol: 'NDX', name: 'NASDAQ 100', exchange: 'NASDAQ', country: 'US' }],
  ['DJI', { symbol: 'DJI', name: 'Dow Jones Industrial Average', exchange: 'NYSE', country: 'US' }],
  ['SENSEX', { symbol: 'SENSEX', name: 'BSE SENSEX', exchange: 'BSE', country: 'IN' }],
  ['NIFTY50', { symbol: 'NIFTY50', name: 'NIFTY 50', exchange: 'NSE', country: 'IN' }],
  ['FTSE100', { symbol: 'FTSE100', name: 'FTSE 100', exchange: 'LSE', country: 'GB' }],
  ['NIKKEI225', { symbol: 'NIKKEI225', name: 'Nikkei 225', exchange: 'TSE', country: 'JP' }],
  ['ASX200', { symbol: 'ASX200', name: 'S&P/ASX 200', exchange: 'ASX', country: 'AU' }],
  ['HANGSENG', { symbol: 'HANGSENG', name: 'Hang Seng Index', exchange: 'HKEX', country: 'HK' }],
]);
