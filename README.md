# CryptoTrader Pro - 25-Agent AI-Powered Trading System

> **DISCLAIMER:** This is for educational purposes only. Not financial advice. Always paper trade first. Never invest money you cannot afford to lose.

> **PRIVATE REPO** - This repository contains sensitive trading infrastructure. Do NOT make it public.

---

## What Is This?

A **distributed AI trading system** with 25 specialized agents that:

- **25 Autonomous Agents** - Each with specialized role (Trader, Risk Manager, Market Analyst, etc.)
- **Multi-Strategy Trading** - Arbitrage, Grid Trading, Trend Following, Market Making, Mean Reversion
- **Live Dashboard** - Real-time portfolio monitoring (Bloomberg-style) on Next.js
- **Demo Mode** - Test strategies with $10k virtual capital before going live
- **Multi-Exchange** - Binance (CEX), Uniswap (DEX), dYdX (Perps), Coinbase
- **Risk Management** - Hard stops (15% max drawdown, 2% per-trade risk, correlation limits)
- **Whale Tracking** - Real-time institutional wallet monitoring via Mempool.space
- **Exchange Connection** - Connect Binance & Coinbase APIs with client-side HMAC signing
- **Agent Coordination** - Visible inter-agent communication across all pages
- **Hedge Fund Analytics** - BlackRock Aladdin-style risk, consensus voting, alpha signals

---

## Architecture

```
+-------------------------------------------------------------+
|                    Claude AI Orchestrator                     |
|              (Master Decision-Making System)                  |
+-----------------------------+-------------------------------+
                              |
          +-------------------+-------------------+
          |                   |                   |
    +-----+------+     +-----+------+     +------+-----+
    | AGENT POOL |     | AGENT POOL |     | AGENT POOL |
    |   (1-8)    |     |   (9-16)   |     |  (17-25)   |
    +-----+------+     +-----+------+     +------+-----+
          |                   |                   |
          +-------------------+-------------------+
                              |
          +-------------------+--------------------+
          |   Node.js Backend (Port 3002)          |
          |  - Claude Orchestrator                  |
          |  - Market Data Fetcher (Binance API)    |
          |  - Trade Executor                       |
          |  - Emergency Stop                       |
          +-------------------+--------------------+
                              |
          +-------------------+-------------------+
          |                   |                   |
    +-----+---+       +------+-----+     +-------+----+
    | Binance  |       |   dYdX     |     | Coinbase   |
    | (Spot)   |       | (Perps)    |     | (Advanced) |
    +----------+       +------------+     +------------+
```

---

## 7 Agent Types

| Agent Type | Responsibility | Max Authority | Trigger |
|-----------|----------------|---------------|---------|
| **TRADER** | Execute swing/position trades | $5k per trade | Market + fundamental signals |
| **RISK_MANAGER** | Approve/reject position sizing | Veto any trade | Position equity > 5% |
| **MARKET_ANALYST** | Identify trends, volatility, macro | Advisory only | 4H+ timeframes |
| **ARBITRAGE_SCOUT** | Spot CEX/DEX price gaps | $500-$2k trades | Spread > 0.3% after fees |
| **GRID_MASTER** | Deploy range-bound strategies | $1-3k per grid | Sideways markets (RSI 40-60) |
| **PORTFOLIO_MANAGER** | Rebalance, correlation checks | Rebalance authority | Monthly or correlation > 0.65 |
| **ORDER_EXECUTOR** | Place orders, monitor fills | Trade execution | Upon TRADER approval |

---

## 5 Trading Strategies

### 1. Arbitrage (Spread Capture)
- Exploit price differences between CEX and DEX
- Trigger: Spread > 0.3% after fees | Position: $500-2,000 | Win Rate: ~75%

### 2. Grid Trading (Range-Bound)
- Profit from volatility without directional bias
- Trigger: RSI 40-60 | Capital: $1,000-3,000 | Dynamic layer spacing

### 3. Trend Following (Momentum)
- Ride directional moves on 4H+ timeframes
- Multi-timeframe confirmation (1H + 4H + 1D must align) | Win Rate: ~60%

### 4. Market Making (Liquidity Provision)
- Capture bid-ask spread | Continuous operation | Dynamic spread adjustment

### 5. Mean Reversion (Volatility Play)
- Profit from extreme moves returning to average
- Trigger: Price > 2-sigma from 20-MA + volume spike > 200%

---

## Risk Management (Non-Negotiable Hard Stops)

| Rule | Limit | Action |
|------|-------|--------|
| Max Portfolio Drawdown | 15% | HALT ALL TRADING |
| Max Per-Trade Risk | 2% of equity | REDUCE position size |
| Max Leverage | 3x | REJECT trade unless AGGRESSIVE mode |
| Portfolio Correlation | > 0.65 | REBALANCE (liquidate correlated pairs) |
| Position Concentration | > 10% | REDUCE to 8% |
| Recovery Mode | After 10% drawdown | 50% position size for next 5 trades |
| Slippage Buffer | 0.15% | Added to all trade cost projections |

---

## Dashboard (Next.js on Port 3001)

13 pages with full Bloomberg-style dark UI:

| Page | Features |
|------|----------|
| **/** | 25 Agent Command Center - all agents with live scores |
| **/demo** | Demo Trading - $10k virtual capital simulation |
| **/swap** | Swap & Trade interface |
| **/trading** | Price charts, trade history, pair selector |
| **/portfolio** | Pie chart allocation, equity curve, drawdown |
| **/agents** | Full agent registry with scores, signals, win rates |
| **/chat** | Agent Chat - talk to agents, 3-column layout with coordination sidebar |
| **/reports** | Performance reports and analytics |
| **/security** | Security dashboard |
| **/connect** | Exchange Connection - Binance & Coinbase API, real portfolio, orders, bot controls |
| **/whales** | Whale Tracker - institutional wallets, live trades, exchange flows, smart money |
| **/news** | Live news with CoinGecko images, Fear & Greed, trending coins |
| **/admin** | Admin - 7 tabs: Agents, Aladdin Risk, Goals, API Keys (167 APIs), Coordination, Hedge Fund, Tools |

---

## Exchange Connection

Client-side HMAC-SHA256 signing - keys never leave browser:
- **Binance**: REST API with X-MBX-APIKEY header + signature
- **Coinbase**: Advanced Trade API with CB-ACCESS-KEY + CB-ACCESS-SIGN
- Credentials stored in `sessionStorage` (cleared on tab close)
- Safety: Emergency stop, max order limits, allowed pairs whitelist

---

## Quick Start

### Frontend Only (Demo Mode)
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

### Full System (Backend + Frontend)
```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with API keys

# 2. Install and start backend
npm install
npm start
# Backend runs on port 3002

# 3. Start frontend (separate terminal)
cd frontend
npm install
npm run dev
# Dashboard on port 3000
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLAUDE_API_KEY` | For AI orchestrator | Anthropic API key |
| `BINANCE_API_KEY` | For live trading | Binance API key |
| `BINANCE_SECRET` | For live trading | Binance API secret |
| `BINANCE_TESTNET` | Default: true | Use testnet |
| `MODE` | Default: DEMO | DEMO, LIVE_SMALL, or LIVE |
| `INITIAL_EQUITY` | Default: 10000 | Starting capital |
| `MAX_DRAWDOWN` | Default: 0.15 | 15% max drawdown |
| `MAX_PER_TRADE_RISK` | Default: 0.02 | 2% per trade |
| `API_PORT` | Default: 3001 | Backend port |
| `CRYPTOPANIC_API_KEY` | For news | CryptoPanic API key (free) |

---

## API Endpoints (Port 3002)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/portfolio` | GET | Current portfolio state |
| `/api/agents/decisions` | GET | Agent decision log |
| `/api/execution-log` | GET | Trade execution history |
| `/api/market` | GET | Live market data |
| `/api/mode` | POST | Switch DEMO/LIVE mode |
| `/api/emergency-stop` | POST | Halt all trading |
| `/api/resume` | POST | Resume trading |
| `/api/status` | GET | System status |

---

## Project Structure

```
crypto-trading-bot/
├── src/
│   ├── index.js                    # Express server + trading loop
│   ├── services/
│   │   ├── claudeOrchestrator.js   # Claude API integration
│   │   ├── marketDataFetcher.js    # Binance REST API
│   │   └── tradeExecutor.js        # Order execution
│   ├── utils/
│   │   └── promptLoader.js         # Load prompt files
│   └── agents/                     # Agent modules
├── prompts/
│   ├── master_orchestrator.md      # Master orchestrator logic
│   ├── specialized_roles.md        # 7 agent role prompts
│   ├── dashboard.md                # Dashboard spec
│   ├── competitive_intelligence.md # Market strategy
│   ├── implementation_guide.md     # Setup guide
│   └── strategies/
│       ├── arbitrage.md
│       ├── grid_trading.md
│       ├── trend_following.md
│       ├── market_making.md
│       └── mean_reversion.md
├── frontend/
│   └── src/
│       ├── app/                    # 13 pages
│       ├── components/             # Sidebar, NewsFeed, etc.
│       └── lib/
│           ├── agentBrain.ts       # Hedge fund analytics engine
│           ├── apiRegistry.ts      # 167 API registry
│           ├── exchangeConnector.ts # Binance/Coinbase connector
│           ├── whaleTracker.ts     # Whale wallet tracking
│           ├── aladdin.ts          # BlackRock Aladdin risk
│           ├── agentMemory.ts      # Agent learning memory
│           ├── bloomberg.ts        # Bloomberg-style data
│           ├── api.ts              # CoinGecko/CryptoPanic APIs
│           ├── agents.ts           # Agent definitions
│           ├── wallet.ts           # Wallet utilities
│           └── mockData.ts         # Demo data generator
├── config/                         # Trading configuration
├── docker/                         # Docker setup
├── scripts/                        # Launch scripts
├── logs/                           # Trade & agent logs
├── package.json                    # Backend dependencies
└── README.md
```

---

## Success Metrics (30-Day Target)

| Metric | Target |
|--------|--------|
| Total Return | +5-8% |
| Sharpe Ratio | > 1.2 |
| Max Drawdown | < 12% |
| Win Rate | > 55% |
| Profit Factor | > 1.5 |
| Trade Frequency | 5-15/day |
| Demo-Live Correlation | > 0.80 |

---

## Tech Stack

- **Backend**: Node.js 18+, Express, Claude API (`@anthropic-ai/sdk`)
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Exchanges**: Binance REST API, Coinbase Advanced Trade API
- **Data**: CoinGecko, CryptoPanic, Mempool.space, Fear & Greed Index
- **Security**: Client-side HMAC-SHA256, sessionStorage credentials
- **Deployment**: Docker Compose (backend), Vercel (frontend)

---

**Built with 25 autonomous agents. Every decision auditable. Every trade with reasoning.**
