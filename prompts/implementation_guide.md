# QUICK IMPLEMENTATION GUIDE
## Getting the 25-Agent Trading Bot Live

---

## File Checklist

1. `prompts/master_orchestrator.md` - Core orchestrator logic
2. `prompts/specialized_roles.md` - 7 individual agent role prompts
3. `prompts/dashboard.md` - Bloomberg-style dashboard spec
4. `prompts/competitive_intelligence.md` - Market advantages & strategies
5. `prompts/implementation_guide.md` - This file

---

## Integration Steps

### Step 1: Prompt Loader (`src/utils/promptLoader.js`)
Loads all prompt files from `./prompts/` directory into memory.
Provides `getSystemPrompt()` for Claude API calls.

### Step 2: Claude Orchestrator (`src/services/claudeOrchestrator.js`)
Uses `@anthropic-ai/sdk` to make decisions.
Model: `claude-sonnet-4-20250514` (fastest for real-time).
Maintains conversation history for context.

### Step 3: Market Data Fetcher (`src/services/marketDataFetcher.js`)
Fetches from Binance REST API (`/api/v3`).
Top 20 assets: BTC, ETH, SOL, XRP, DOGE, LINK, AAVE, UNI, MATIC, AVAX.
Supports klines (4h candles) and order book depth.

### Step 4: Trade Executor (`src/services/tradeExecutor.js`)
Uses `binance-api-node` SDK.
Supports testnet and live mode.
Limit orders only (never market orders).

### Step 5: Main Server (`src/index.js`)
Express server on port 3001 with CORS.
Trading loop runs every 30 seconds.
API endpoints: `/api/portfolio`, `/api/agents/decisions`, `/api/mode`, `/api/execution-log`.

---

## Environment Variables (.env)

```bash
CLAUDE_API_KEY=sk-ant-your-key-here
BINANCE_API_KEY=your_binance_key
BINANCE_SECRET=your_binance_secret
BINANCE_TESTNET=true
MODE=DEMO
INITIAL_EQUITY=10000
MAX_DRAWDOWN=0.15
MAX_PER_TRADE_RISK=0.02
API_PORT=3002
FRONTEND_PORT=3001
```

---

## Safety Checklist (Before Going Live)

- [ ] DEMO mode works 10+ days without errors
- [ ] Sharpe Ratio > 1.5 (demo)
- [ ] Max drawdown < 12%
- [ ] Zero constraint violations
- [ ] Trade execution quality (slippage < 0.20%)
- [ ] Database logging (all trades recorded)
- [ ] Error handling (API failures don't crash)
- [ ] No hardcoded keys
- [ ] Testnet only initially

---

## Phased Rollout

Phase 1 (Demo): $10k virtual, 25 agents, all strategies, 1-2 weeks
Phase 2 (Testnet): Binance testnet, real strategies, 1 week
Phase 3 (Live Small): $500 real, 1.0x leverage, 30 days, target +5-8%
Phase 4 (Scale): $5,000+, 2-3x leverage, $1,000+/month target

---

## Success Metrics (30-Day Milestone)

| Metric | Target |
|--------|--------|
| Total Return | +5-8% |
| Sharpe Ratio | > 1.2 |
| Max Drawdown | < 12% |
| Win Rate | > 55% |
| Trades/Day | 5-15 |
| Correlation | < 0.65 |
