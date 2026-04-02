# CryptoBot - 25-Agent Autonomous Crypto Trading System

> **DISCLAIMER:** This is for educational purposes only. Not financial advice. Always paper trade first. Never invest money you cannot afford to lose.

> **PRIVATE REPO** - This repository contains sensitive trading infrastructure. Do NOT make it public.

---

## What Is This?

CryptoBot is a **25-agent autonomous crypto trading system** where every agent is self-learning and gets smarter with every trade. Agents work together through Redis pub/sub messaging, sharing data and signals to make collective trading decisions through weighted consensus voting.

The system has a **kill switch** that automatically halts all trading if losses exceed 5%, and runs in **paper trading mode** by default so you can test safely.

---

## Architecture

```
                         ┌─────────────────────┐
                         │     SUPERVISOR       │
                         │  Weighted Consensus  │
                         │  Kill Switch (5%)    │
                         │  Dynamic Weights     │
                         └────────┬────────────┘
                                  │ Redis Pub/Sub
              ┌───────────────────┼───────────────────┐
              │                   │                   │
    ┌─────────┴──────┐  ┌────────┴────────┐  ┌───────┴────────┐
    │  STRATEGY (6)  │  │  DATA+RISK (5)  │  │ EXECUTION (5)  │
    │                │  │                 │  │                │
    │ Trend          │  │ Sentiment       │  │ Order          │
    │ Momentum       │  │ OnChain         │  │ Slippage       │
    │ Mean Reversion │  │ Risk            │  │ Stop-Loss      │
    │ Arbitrage      │  │ Portfolio       │  │ Fee            │
    │ Breakout       │  │ Orderbook       │  │ DeFi           │
    │ Indicator Master│  │                │  │                │
    └────────────────┘  └─────────────────┘  └────────────────┘
              │                   │                   │
    ┌─────────┴──────┐  ┌────────┴────────┐
    │ INTELLIGENCE(6)│  │  SECURITY (3)   │
    │                │  │                 │
    │ ML (LSTM)      │  │ NPM Security    │
    │ Backtest       │  │ DB Security     │
    │ Alert          │  │ Code Security   │
    │ Audit          │  │                 │
    │ Rebalance      │  │  Self-Learning  │
    │ News           │  │  via Redis      │
    └────────────────┘  └─────────────────┘
```

---

## All 25 Agents

### Strategy Layer (6 agents) - Generate trading signals

| Agent | What It Does | Indicators | Libraries |
|-------|-------------|-----------|-----------|
| **Trend** | EMA(9)/EMA(21) crossover + MACD signal detection | EMA, MACD | ccxt, pandas_ta |
| **Momentum** | RSI + Stochastic RSI momentum signals | RSI, StochRSI | ccxt, pandas_ta |
| **Mean Reversion** | Bollinger Bands + Z-score mean reversion | BB, Z-score | ccxt, pandas, numpy |
| **Arbitrage** | Cross-exchange spread detection (Binance vs Kraken) | Price spread | ccxt |
| **Breakout** | Volume-confirmed breakouts with support/resistance | S/R levels, Volume | ccxt, pandas |
| **Indicator Master** | Combines ALL 10 indicators with self-learning weights | RSI, MACD, EMA, BB, Stoch, ADX, OBV, VWAP, Ichimoku, Fibonacci | ccxt, pandas_ta, numpy |

### Data & Risk Layer (5 agents) - Feed intelligence and enforce limits

| Agent | What It Does | Data Source |
|-------|-------------|------------|
| **Sentiment** | Fear & Greed index + market sentiment | alternative.me API |
| **OnChain** | Exchange netflow + whale tracking | Glassnode API |
| **Risk** | VaR(99%) + maximum drawdown calculation | Portfolio returns |
| **Portfolio** | Kelly criterion half-Kelly position sizing | Trade history |
| **Orderbook** | Bid-ask depth imbalance analysis | Exchange orderbooks |

### Execution Layer (5 agents) - Place and manage trades

| Agent | What It Does | Mode |
|-------|-------------|------|
| **Order** | Limit/market/TWAP order placement | Paper/Live |
| **Slippage** | Smart order routing across exchanges | Multi-exchange |
| **Stop-Loss** | Trailing stop-loss + take-profit management | 2% trail, 5% TP |
| **Fee** | Gas estimation + maker/taker fee optimization | Infura + exchanges |
| **DeFi** | DeFi pool yield monitoring from DefiLlama | yields.llama.fi |

### Intelligence Layer (6 agents) - Learn, evaluate, and improve

| Agent | What It Does | Learning |
|-------|-------------|---------|
| **ML** | LSTM model retraining per-agent every 20 trades | PyTorch, Sharpe ratio |
| **Backtest** | Weekly Sharpe ratio, max drawdown, win rate evaluation | Historical trades |
| **Alert** | Telegram + Discord real-time notifications | aiohttp |
| **Audit** | PostgreSQL trade logging + z-score anomaly detection | asyncpg |
| **Rebalance** | Portfolio drift correction with target allocations | Kelly criterion |
| **News** | Live crypto news fetching + AI sentiment analysis | CoinGecko, CryptoPanic |

### Security Layer (3 agents) - Self-learning protection

| Agent | What It Does | Learning Mechanism |
|-------|-------------|-------------------|
| **NPM Security** | npm audit + lockfile integrity + typosquatting detection | Learns threat patterns, stores in Redis |
| **DB Security** | SQL injection monitoring + query anomaly baselines | EMA baselines, learns false positives |
| **Code Security** | Secret scanning + OWASP checks + file integrity | SHA-256 hashes, severity trends |

---

## How Self-Learning Works

Every agent inherits from `BaseAgent` which provides automatic self-learning:

```
Trade happens → record_trade(won, pnl)
     │
     ├── Appends to rolling 200-trade history
     ├── Computes rolling Sharpe ratio (annualized)
     ├── Computes performance trend (recent vs older trades)
     ├── Saves learning state to Redis every 5 trades
     └── Publishes to ML agent for model retraining
            │
            ├── ML agent retrains LSTM every 20 trades
            ├── Backtest agent runs weekly optimization
            └── Supervisor adjusts agent weights:
                 • win_rate > 65% → weight * 1.05 (reward)
                 • win_rate < 40% → weight * 0.90 (penalize)
                 • improving trend → weight * 1.02 (bonus)
```

**Indicator Master** has its own self-learning: after each trade result, it adjusts the weights of its 10 indicators. Indicators that agreed with winning trades get boosted; those that agreed with losing trades get reduced.

**News Agent** learns which sentiment keywords correlate with profitable trades and adjusts keyword weights over time.

**Security Agents** build learning databases in Redis, tracking threat patterns, false positives, and severity trends.

---

## How Agents Communicate

All communication is through Redis pub/sub channels:

```
REPORT CHANNELS (agent → supervisor):
  agent:report:{name}          # Status, signal, PnL, win rate, learning data
  agent:trade_result            # Trade closures (ML agent listens)

COMMAND CHANNELS (supervisor → agents):
  agent:command:{name}          # HALT, REDUCE_SIZE
  supervisor:broadcast          # Master reports, kill switch

SHARED DATA CHANNELS (agent ↔ agent):
  agent:shared:news_sentiment   # News agent → all agents
  agent:shared:indicators       # Indicator master → all agents

LEARNING PERSISTENCE (Redis keys):
  agent:learning:{name}         # Self-learning state (survives restarts)
  security:npm:learning_db      # NPM security knowledge base
  security:db:learning_db       # DB security knowledge base
  security:code:learning_db     # Code security knowledge base
  news:latest                   # Latest news for dashboard
```

---

## Consensus Voting

The Supervisor uses **weighted consensus voting** among the 6 strategy agents:

1. Each strategy agent reports a signal (BUY/SELL/HOLD/STRONG_BUY/STRONG_SELL)
2. Signals are multiplied by the agent's weight (0.1 to 2.0)
3. STRONG signals get 1.5x multiplier
4. News sentiment adds +/- 0.5 to the tally
5. BUY wins if buy_weight > sell_weight * 1.5 (and vice versa)
6. Otherwise: HOLD

The Indicator Master starts with weight 1.5 (higher than other strategy agents at 1.0) because it aggregates all indicators.

---

## Dashboard (Next.js on Vercel)

The dashboard is a full-featured Next.js 14 website with 6 pages:

| Page | What It Shows |
|------|--------------|
| **/** | 25 Agent Command Center - all agents in 5 tiers with live scores |
| **/trading** | Price charts (recharts), trade history, pair selector |
| **/portfolio** | Pie chart allocation, equity curve, drawdown, holdings |
| **/agents** | Full agent registry table with scores, signals, win rates |
| **/security** | 3 security agent details, scan logs, security score |
| **/news** | Live news feed with sentiment gauge and AI scoring |

The dashboard works in **standalone demo mode** on Vercel (no backend needed) using simulated data that refreshes every few seconds. When connected to the real backend via WebSocket, it shows live data.

---

## Quick Start

### Option 1: Docker (recommended)

```bash
# 1. Clone and configure
cp .env.example .env
# Edit .env with your API keys

# 2. Start everything (Redis, PostgreSQL, 25 agents, dashboard)
cd docker
docker compose up -d

# 3. Open dashboard
open http://localhost:3000
```

### Option 2: Manual

```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Start Redis
redis-server

# 3. Launch all 25 agents
bash scripts/start_all.sh

# 4. Run dashboard
cd frontend
npm install
npm run dev
```

### Option 3: Vercel (dashboard only)

1. Push repo to GitHub
2. Import in Vercel: set **Root Directory** to `frontend`
3. Framework auto-detected as **Next.js**
4. Deploy - dashboard works in demo mode automatically

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BINANCE_API_KEY` | For live trading | Binance API key |
| `BINANCE_SECRET` | For live trading | Binance API secret |
| `KRAKEN_API_KEY` | For arbitrage | Kraken API key |
| `GLASSNODE_API_KEY` | For on-chain data | Glassnode API key |
| `INFURA_URL` | For gas estimation | Infura project URL |
| `TELEGRAM_BOT_TOKEN` | For alerts | Telegram bot token |
| `TELEGRAM_CHAT_ID` | For alerts | Telegram chat ID |
| `DISCORD_WEBHOOK_URL` | For alerts | Discord webhook URL |
| `POSTGRES_PASSWORD` | For Docker | PostgreSQL password |
| `CRYPTOPANIC_API_KEY` | For news | CryptoPanic API key (free) |
| `PAPER_TRADING` | Default: true | Enable paper trading mode |
| `MAX_DRAWDOWN_PCT` | Default: 0.05 | Kill switch threshold |
| `MAX_POSITION_PCT` | Default: 0.20 | Max position size |

---

## Risk Management

- **Kill Switch**: Automatically halts ALL 25 agents if cumulative loss exceeds 5%
- **Position Limits**: Max 20% of portfolio in any single asset
- **Daily Loss Limit**: Configurable ($500 default)
- **Paper Trading**: Enabled by default - no real funds at risk
- **Trailing Stops**: 2% trailing stop on all positions
- **Take Profit**: 5% take profit targets
- **VaR Monitoring**: Real-time Value at Risk at 99% confidence
- **Consensus Required**: Minimum 60% strategy agent agreement for trades

---

## Trading Pairs

| Pair | Target Allocation |
|------|------------------|
| BTC/USDT | 40% |
| ETH/USDT | 30% |
| SOL/USDT | 15% |
| BNB/USDT | 10% |
| AVAX/USDT | 5% |

---

## Tech Stack

- **Backend**: Python 3.10+ with asyncio
- **Agent Framework**: Custom BaseAgent ABC with self-learning
- **Communication**: Redis 7 pub/sub
- **Database**: PostgreSQL 15 (trade logs, audit)
- **ML**: PyTorch LSTM, scikit-learn
- **Exchanges**: ccxt (Binance, Kraken)
- **Dashboard**: Next.js 14, TypeScript, Tailwind CSS, recharts
- **Deployment**: Docker Compose (backend), Vercel (frontend)
- **Security**: 3 self-learning security agents

---

## Project Structure

```
crypto-trading-bot/
├── agents/
│   ├── base_agent.py              # ABC base with self-learning
│   ├── strategy/                  # 6 strategy agents
│   │   ├── trend_agent.py
│   │   ├── momentum_agent.py
│   │   ├── mean_reversion_agent.py
│   │   ├── arbitrage_agent.py
│   │   ├── breakout_agent.py
│   │   └── indicator_master_agent.py  # NEW: 10-indicator master
│   ├── data_risk/                 # 5 data & risk agents
│   ├── execution/                 # 5 execution agents
│   ├── intelligence/              # 6 intelligence agents
│   │   ├── ml_agent.py
│   │   ├── backtest_agent.py
│   │   ├── alert_agent.py
│   │   ├── audit_agent.py
│   │   ├── rebalance_agent.py
│   │   └── news_agent.py         # NEW: live news + sentiment
│   └── security/                  # 3 self-learning security agents
├── supervisor/
│   └── supervisor_agent.py        # Master orchestrator
├── frontend/                      # Next.js dashboard (Vercel)
│   └── src/
│       ├── app/                   # 6 pages
│       ├── components/            # UI components
│       └── lib/mockData.ts        # Demo data generator
├── docker/
│   └── docker-compose.yml         # 28 services
├── scripts/
│   ├── start_all.sh               # tmux launcher
│   └── health_check.sh            # Redis heartbeat checker
├── config/
│   └── trading_pairs.json
├── .env.example
├── requirements.txt
└── README.md
```

---

**Built with 25 autonomous agents. Every agent learns. Every trade makes the system smarter.**
