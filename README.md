# 📈 PulseAI — Stock Market Trend Analyzer & Event Quant Platform

> **"The world moves. Markets follow. We show you why."**

PulseAI is an institutional-grade, real-time stock market intelligence platform inspired by modern consumer fintech UI (Groww). It merges live global financial data with cutting-edge **Geopolitical Shock Forecasting** and **Quantitative Technical/Fundamental AI Predictions**.

---

## 🌟 Key Platform Highlights

### 1. 🎯 Dual-Mode AI Stock Predictor (Core USP)
* **Mode A: Geopolitical Shock "Sure-Shot" Predictor**:
  * Input any real-world shock (e.g. *War breaks out between Iran & Israel*, *US imposes 45% tariffs on semiconductors*, *OPEC+ announces 3.5M barrel voluntary cut*).
  * Generates quantitative forecasts: **▲ WILL GO UP** / **▼ WILL GO DOWN** with **Win Probability %** (e.g., 94% win probability), Algorithmic Target Prices, 1st & 2nd order effects, and causal transmission mechanics.
* **Mode B: Single-Stock Technical & Fundamental Confluence**:
  * Technical signal confluence (RSI 14D momentum, 20/50 EMA breakouts, Volume delta) + fundamental catalysts (Multiple expansion, gross margin expansion).

### 2. 🌍 Live External Factors & Macro Events Wire
* Live feed of breaking world events (Geopolitical, Military, Economic, Environmental).
* Explicit before/after price delta, impacted equity constituents, and causal transmission reasoning.

### 3. 📱 Groww-Inspired Clean UI & Native Currency Display
* **Light Theme Design**: Pure white surfaces (`#FFFFFF`), neutral slate text (`#44475B`), Groww mint green (`#00D09C`), and crimson loss indicator (`#EB5B3C`).
* **Universal Global Search**: Search any stock worldwide across **NSE, BSE, NASDAQ, NYSE, LSE, TSE, HKEX, Euronext**.
* **Native Stock Currencies**:
  * Indian Equities (Reliance, TCS, HDFC Bank, Tata Motors) ➔ **₹ INR**
  * US Equities (Nvidia, Apple, Microsoft, Tesla, Lockheed Martin) ➔ **$ USD**
  * UK Equities (Shell) ➔ **£ GBP**
  * Japanese Equities (Toyota) ➔ **¥ JPY**
  * European Equities ➔ **€ EUR**
* **Live Gliding Indices Marquee**: Real-time benchmarks for **NIFTY 50, SENSEX, BANK NIFTY, S&P 500, NASDAQ, FTSE 100**.
* **Interactive Candlestick & Area Charts**: Real live OHLCV candlestick/area charts with volume histograms across **1D, 1W, 1M, 3M, 1Y, 5Y**.

---

## 🏗️ Architecture & Tech Stack

```
Stock-Market-Trend-Analyser-/
├── frontend/             # Vite 6 + React 18 + Tailwind CSS 4 + Recharts
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx                    # Main Groww-style platform
│   │   │   └── components/
│   │   │       ├── GrowwStockModal.tsx    # Live stock detail & simulated order terminal
│   │   │       └── StockChart.tsx         # Real OHLCV interactive chart
│   │   ├── services/
│   │   │   ├── api.ts                     # Real-time Yahoo Finance & backend API client
│   │   │   └── prediction.service.ts      # Dual-mode quantitative AI prediction engine
│   │   └── styles/
│   ├── package.json
│   └── vite.config.ts                     # Dev server with reverse proxies (/v1, /yf, /ws)
│
├── backend/              # Node.js + Fastify + Prisma + PostgreSQL + Redis + BullMQ
│   ├── prisma/
│   │   ├── schema.prisma                  # 12 database models
│   │   └── seed.ts                        # Database seeder with 500+ stocks & events
│   ├── src/
│   │   ├── clients/                       # Polygon, Finnhub, FMP, NewsAPI, GDELT clients
│   │   ├── jobs/                          # 10 BullMQ background workers
│   │   ├── routes/                        # REST API endpoints (Auth, Stocks, Events, FX)
│   │   ├── services/                      # AI Analysis, Price Aggregation, Watchlists
│   │   └── ws/                            # Real-time WebSocket broadcaster
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml    # Complete orchestration for PostgreSQL, Redis, backend, frontend
└── README.md
```

---

## 🚀 Quick Start Guide

### Option 1: Running with Docker Compose
```bash
docker compose up -d
```
* **Frontend**: `http://localhost:5173`
* **Backend API**: `http://localhost:3000`
* **PostgreSQL**: `localhost:5432`
* **Redis**: `localhost:6379`

---

### Option 2: Running Locally

#### 1. Start the Backend
```bash
cd backend
npm install

# Setup environment
cp .env.example .env

# Push Prisma schema to PostgreSQL & Seed
npx prisma db push
npm run seed

# Run Fastify server in watch mode
npm run dev
```

#### 2. Start the Frontend
```bash
cd frontend
npm install

# Start Vite dev server
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 📄 License
MIT License © 2026 PulseAI Technologies Inc.
