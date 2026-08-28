import { prisma } from '../src/lib/prisma.js';
import { logger } from '../src/lib/logger.js';

async function seed() {
  try {
    logger.info('Starting seed process...');

    // 1. Create Users
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@pulseai.com' },
      update: {},
      create: {
        email: 'admin@pulseai.com',
        name: 'Admin User',
        role: 'ENTERPRISE',
        currency: 'USD',
        country: 'US',
      },
    });

    const proUser = await prisma.user.upsert({
      where: { email: 'pro@pulseai.com' },
      update: {},
      create: {
        email: 'pro@pulseai.com',
        name: 'Pro User',
        role: 'PRO',
        currency: 'USD',
        country: 'US',
      },
    });

    const freeUser = await prisma.user.upsert({
      where: { email: 'free@pulseai.com' },
      update: {},
      create: {
        email: 'free@pulseai.com',
        name: 'Free User',
        role: 'FREE',
        currency: 'USD',
        country: 'US',
      },
    });

    // 2. Comprehensive Global Stock Catalog (US, India, UK, Japan, Europe)
    const stocksData = [
      // US Tech & Megacap
      { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', country: 'US', currency: 'USD', sector: 'Technology', industry: 'Consumer Electronics', lastPrice: 228.50, lastChange: 3.20, lastChangePct: 1.42, marketCap: BigInt(3450000000000) },
      { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', country: 'US', currency: 'USD', sector: 'Technology', industry: 'Software—Infrastructure', lastPrice: 448.20, lastChange: 4.80, lastChangePct: 1.08, marketCap: BigInt(3320000000000) },
      { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', country: 'US', currency: 'USD', sector: 'Technology', industry: 'Semiconductors', lastPrice: 128.90, lastChange: 6.40, lastChangePct: 5.22, marketCap: BigInt(3180000000000) },
      { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', country: 'US', currency: 'USD', sector: 'Communication Services', industry: 'Internet Content & Information', lastPrice: 182.40, lastChange: -1.20, lastChangePct: -0.65, marketCap: BigInt(2260000000000) },
      { symbol: 'AMZN', name: 'Amazon.com Inc.', exchange: 'NASDAQ', country: 'US', currency: 'USD', sector: 'Consumer Cyclical', industry: 'Internet Retail', lastPrice: 188.60, lastChange: 2.10, lastChangePct: 1.13, marketCap: BigInt(1960000000000) },
      { symbol: 'META', name: 'Meta Platforms Inc.', exchange: 'NASDAQ', country: 'US', currency: 'USD', sector: 'Communication Services', industry: 'Internet Content & Information', lastPrice: 512.30, lastChange: 8.50, lastChangePct: 1.69, marketCap: BigInt(1300000000000) },
      { symbol: 'TSLA', name: 'Tesla Inc.', exchange: 'NASDAQ', country: 'US', currency: 'USD', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', lastPrice: 218.40, lastChange: -4.50, lastChangePct: -2.02, marketCap: BigInt(695000000000) },
      { symbol: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE', country: 'US', currency: 'USD', sector: 'Financial Services', industry: 'Banks—Diversified', lastPrice: 215.10, lastChange: 1.80, lastChangePct: 0.84, marketCap: BigInt(614000000000) },
      { symbol: 'LLY', name: 'Eli Lilly and Company', exchange: 'NYSE', country: 'US', currency: 'USD', sector: 'Healthcare', industry: 'Drug Manufacturers—General', lastPrice: 945.80, lastChange: 12.40, lastChangePct: 1.33, marketCap: BigInt(898000000000) },
      { symbol: 'AVGO', name: 'Broadcom Inc.', exchange: 'NASDAQ', country: 'US', currency: 'USD', sector: 'Technology', industry: 'Semiconductors', lastPrice: 162.30, lastChange: 5.10, lastChangePct: 3.24, marketCap: BigInt(760000000000) },

      // India / NSE / BSE
      { symbol: 'RELIANCE.NS', name: 'Reliance Industries Ltd', exchange: 'NSE', country: 'IN', currency: 'INR', sector: 'Energy', industry: 'Oil & Gas Refining & Marketing', lastPrice: 2980.50, lastChange: 35.40, lastChangePct: 1.20, marketCap: BigInt(20100000000000) },
      { symbol: 'TCS.NS', name: 'Tata Consultancy Services Ltd', exchange: 'NSE', country: 'IN', currency: 'INR', sector: 'Technology', industry: 'Information Technology Services', lastPrice: 4250.00, lastChange: -15.20, lastChangePct: -0.36, marketCap: BigInt(15400000000000) },
      { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Ltd', exchange: 'NSE', country: 'IN', currency: 'INR', sector: 'Financial Services', industry: 'Banks—Private', lastPrice: 1640.80, lastChange: 12.00, lastChangePct: 0.74, marketCap: BigInt(12500000000000) },
      { symbol: 'INFY.NS', name: 'Infosys Ltd', exchange: 'NSE', country: 'IN', currency: 'INR', sector: 'Technology', industry: 'Information Technology Services', lastPrice: 1870.30, lastChange: 22.10, lastChangePct: 1.20, marketCap: BigInt(7800000000000) },
      { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Ltd', exchange: 'NSE', country: 'IN', currency: 'INR', sector: 'Financial Services', industry: 'Banks—Private', lastPrice: 1195.40, lastChange: 8.60, lastChangePct: 0.72, marketCap: BigInt(8400000000000) },

      // UK / London Stock Exchange
      { symbol: 'SHEL.L', name: 'Shell plc', exchange: 'LSE', country: 'GB', currency: 'GBP', sector: 'Energy', industry: 'Oil & Gas Integrated', lastPrice: 2780.00, lastChange: 18.00, lastChangePct: 0.65, marketCap: BigInt(180000000000) },
      { symbol: 'AZN.L', name: 'AstraZeneca PLC', exchange: 'LSE', country: 'GB', currency: 'GBP', sector: 'Healthcare', industry: 'Pharmaceuticals', lastPrice: 12450.00, lastChange: 140.00, lastChangePct: 1.14, marketCap: BigInt(192000000000) },

      // Japan / Tokyo Stock Exchange
      { symbol: '7203.T', name: 'Toyota Motor Corporation', exchange: 'TSE', country: 'JP', currency: 'JPY', sector: 'Consumer Cyclical', industry: 'Auto Manufacturers', lastPrice: 2890.00, lastChange: 45.00, lastChangePct: 1.58, marketCap: BigInt(38000000000000) },
      { symbol: '6758.T', name: 'Sony Group Corporation', exchange: 'TSE', country: 'JP', currency: 'JPY', sector: 'Technology', industry: 'Consumer Electronics', lastPrice: 13950.00, lastChange: -80.00, lastChangePct: -0.57, marketCap: BigInt(17200000000000) },
    ];

    for (const stock of stocksData) {
      await prisma.stock.upsert({
        where: { symbol: stock.symbol },
        update: { ...stock, lastUpdated: new Date(), isActive: true },
        create: { ...stock, lastUpdated: new Date(), isActive: true },
      });
    }

    // 3. Sample Real Geopolitical & Economic Events
    const eventsData = [
      {
        title: 'US Federal Reserve holds interest rate benchmark steady, signals potential rate cut in Q4',
        body: 'The Federal Open Market Committee announced it will keep the benchmark federal funds rate in the 5.25%-5.50% range, citing stabilizing inflation indicators and resilient labor markets.',
        sourceUrl: 'https://pulseai.com/news/fed-rate-decision-2026',
        sourceName: 'Federal Reserve Press Release',
        category: 'ECONOMIC' as const,
        severity: 'HIGH' as const,
        sentiment: 0.45,
        publishedAt: new Date(Date.now() - 3600000 * 2),
        isProcessed: true,
        aiSummary: 'Holding interest rates steady and signaling rate cuts provides liquidity support for high-valuation tech equities like Apple and Microsoft, while stabilizing bank margins.',
      },
      {
        title: 'Semiconductor Trade Accord signed between US, Japan and European Union to boost domestic fabs',
        body: 'Major trade delegates reached a tripartite multilateral agreement providing subsidies and tariff exemptions for advanced microchip manufacturing and critical rare-earth supply chains.',
        sourceUrl: 'https://pulseai.com/news/tripartite-semiconductor-accord',
        sourceName: 'Reuters Global Trade',
        category: 'GEOPOLITICAL' as const,
        severity: 'CRITICAL' as const,
        sentiment: 0.78,
        publishedAt: new Date(Date.now() - 3600000 * 6),
        isProcessed: true,
        aiSummary: 'Extremely bullish for semiconductor designers and fab equipment manufacturers (NVIDIA, Broadcom). Reduces geopolitical supply chain vulnerability.',
      },
      {
        title: 'OPEC+ unexpectedly extends voluntary crude output cuts of 2.2 million bpd through year-end',
        body: 'The Organization of the Petroleum Exporting Countries along with allies decided to roll over output reductions to balance global crude inventories amid fluctuating demand forecasts.',
        sourceUrl: 'https://pulseai.com/news/opec-production-cuts-extension',
        sourceName: 'Bloomberg Energy',
        category: 'ECONOMIC' as const,
        severity: 'HIGH' as const,
        sentiment: 0.35,
        publishedAt: new Date(Date.now() - 3600000 * 12),
        isProcessed: true,
        aiSummary: 'Direct tailwind for upstream energy and oil refining giants (Reliance Industries, Shell), supporting crude pricing power and gross refining margins.',
      },
    ];

    for (const ev of eventsData) {
      const existing = await prisma.worldEvent.findFirst({ where: { sourceUrl: ev.sourceUrl } });
      let eventId = existing?.id;

      if (!existing) {
        const created = await prisma.worldEvent.create({ data: ev });
        eventId = created.id;
      }

      // Link StockEvent impact
      if (eventId && ev.category === 'GEOPOLITICAL') {
        const nvda = await prisma.stock.findUnique({ where: { symbol: 'NVDA' } });
        if (nvda) {
          const hasImpact = await prisma.stockEvent.findFirst({
            where: { stockId: nvda.id, eventId },
          });
          if (!hasImpact) {
            await prisma.stockEvent.create({
              data: {
                stockId: nvda.id,
                eventId,
                priceAtEvent: nvda.lastPrice || 128.90,
                aiConfidence: 0.92,
                aiImpactReason: 'Multilateral semiconductor subsidies directly accelerate enterprise GPU demand and fabrication security.',
              },
            });
          }
        }
      }
    }

    // 4. Default Watchlist & Alerts
    const existingWatchlist = await prisma.watchlist.findFirst({ where: { userId: adminUser.id } });
    if (!existingWatchlist) {
      await prisma.watchlist.create({
        data: {
          userId: adminUser.id,
          name: 'Core Tech & AI Leaders',
          symbols: ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'RELIANCE.NS'],
        },
      });
    }

    const existingAlert = await prisma.alert.findFirst({ where: { userId: proUser.id } });
    if (!existingAlert) {
      await prisma.alert.create({
        data: {
          userId: proUser.id,
          symbol: 'NVDA',
          alertType: 'PRICE_CHANGE_UP',
          threshold: 3.0,
          isActive: true,
        },
      });
    }

    logger.info('✅ Database seeded successfully with users, global stocks, events & alerts!');
  } catch (error) {
    logger.error({ err: error }, 'Failed to seed database');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
