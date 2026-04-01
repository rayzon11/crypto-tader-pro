# CryptoBot — 23-Agent Autonomous Trading System

> **DISCLAIMER:** This is for educational purposes only. Not financial advice. Always paper trade first. Never invest money you cannot afford to lose.

> **PRIVATE REPO** — This repository contains sensitive trading infrastructure. Do NOT make it public.

## Architecture

```
                    ┌─────────────┐
                    │  SUPERVISOR  │
                    │   Agent      │
                    └──────┬──────┘
                           │ Redis Pub/Sub
     ┌──────────────┬──────┼──────┬───────────────┐
     │              │      │      │               │
┌────┴────┐  ┌─────┴───┐ ┌┴─────┐ ┌─────┴─────┐ ┌┴──────────┐
│STRATEGY │  │DATA+RISK│ │EXEC  │ │  INTEL    │ │ SECURITY  │
│5 agents │  │5 agents │ │5 agts│ │ 5 agents  │ │ 3 agents  │
└─────────┘  └─────────┘ └──────┘ └───────────┘ └───────────┘
```

**23 AI Agents | 5 Layers | 1 Supervisor | Smart Learning Dashboard**

## Agents

| Layer | Agents | Responsibility |
|-------|--------|---------------|
| Strategy | trend, momentum, mean_reversion, arbitrage, breakout | Generate BUY/SELL/HOLD signals |
| Data+Risk | sentiment, onchain, risk, portfolio, orderbook | Feed intelligence & enforce limits |
| Execution | order, slippage, stoploss, fee, defi | Place & manage trades |
| Intelligence | ml, backtest, alert, audit, rebalance | Learn, evaluate, notify & self-improve |
| **Security** | **npm_security, db_security, code_security** | **Self-learning protection for deps, DB & code** |

## Security Agents (Self-Learning)

All 3 security agents get **smarter with every scan cycle** by persisting learned knowledge to Redis:

### NPM Security Agent
- Scans `npm audit` for vulnerabilities
- Verifies `package-lock.json` integrity (detects supply chain tampering)
- Detects typosquatting packages using learned string similarity
- Learns threat patterns from past findings; reduces false positives over time

### Database Security Agent
- Monitors for SQL injection attempts in all data flowing through Redis
- Learns baseline query/connection patterns — detects anomalies via EMA
- Scans code for raw SQL usage (f-strings in execute, .format() injection)
- Checks PostgreSQL permissions, SSL config, credential strength
- Builds learned injection patterns from real attack data

### Code Security Agent
- Scans entire codebase for hardcoded secrets (API keys, tokens, passwords)
- Detects OWASP vulnerabilities (eval, exec, pickle, insecure YAML, etc.)
- Verifies `.env` is in `.gitignore` — **alerts before you push to public**
- Tracks file integrity hashes — detects unauthorized changes
- Learns false positives to reduce noise; tracks security trend over time

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Redis
- PostgreSQL
- Docker (optional)

### Setup

```bash
# 1. Clone and enter
cd crypto-trading-bot

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Install dashboard dependencies
cd frontend && npm install && cd ..

# 5. Start Redis and PostgreSQL
# (use Docker or install locally)

# 6. Start all agents
bash scripts/start_all.sh

# 7. Start dashboard
cd frontend && npm run dev
```

### Docker Deployment

```bash
# Copy and configure environment
cp .env.example .env

# Start everything
docker compose -f docker/docker-compose.yml --env-file .env up -d

# Check status
docker compose -f docker/docker-compose.yml ps

# View logs
docker compose -f docker/docker-compose.yml logs -f
```

### Vercel Dashboard Deployment

```bash
cd frontend
npx vercel
# Set NEXT_PUBLIC_WS_URL to your backend WebSocket URL
```

### Push to GitHub (PRIVATE)

```bash
git add -A
git commit -m "Initial commit: 23-agent crypto trading system"
gh repo create crypto-trading-bot --private --source=. --push
```

## Risk Management

- **Kill Switch**: 5% drawdown halts ALL agents
- **Position Limits**: Max 20% per asset
- **Daily Loss Limit**: $500 USDT
- **Leverage**: 1x only (no margin)
- **Signal Consensus**: 3/5 strategy agents must agree
- **Paper Trading**: Enabled by default — run 3+ months before live
- **Security Agents**: Continuous scanning for secrets, vulnerabilities, and injection attempts

## Tech Stack

- **Backend**: Python 3.11, asyncio, Redis pub/sub
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Data**: ccxt, pandas, numpy, aiohttp
- **ML**: PyTorch LSTM, scikit-learn
- **Security**: Self-learning pattern detection, integrity monitoring
- **Infrastructure**: Docker, PostgreSQL, Redis
- **Notifications**: Telegram, Discord

## Trading Pairs

BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT, AVAX/USDT
