export function convertCurrency(amount: number, from: string, to: string, rates: Map<string, number>): number {
  if (from === to) return amount;
  
  const fromRate = from === 'USD' ? 1 : rates.get(from) || 1;
  const toRate = to === 'USD' ? 1 : rates.get(to) || 1;
  
  const amountInUSD = amount / fromRate;
  return amountInUSD * toRate;
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}

export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    INR: '₹',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'CHF',
    CNY: '¥',
    HKD: 'HK$',
    SGD: 'S$',
  };
  return symbols[currency.toUpperCase()] || currency;
}
