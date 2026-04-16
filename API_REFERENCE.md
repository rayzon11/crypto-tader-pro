# 📡 Complete API Reference

**Backend Base URL:** `http://localhost:3002`  
**Default Port:** 3002 (configured to avoid CQPAY port 3000)  

---

## 🎯 Demo Trading API

### Get Account Stats
**Endpoint:** `GET /api/demo/account`

Returns current demo account status.

**Response:**
```json
{
  "accountBalance": 10000,
  "equity": 10000,
  "cash": 10000,
  "totalPnL": 0,
  "openTrades": 0,
  "closedTrades": 0,
  "winCount": 0,
  "lossCount": 0,
  "winRate": 0,
  "avgWinSize": 0,
  "avgLossSize": 0,
  "maxDrawdown": 0,
  "profitFactor": 0,
  "totalTradesExecuted": 0
}
```

**Usage:**
```bash
curl http://localhost:3002/api/demo/account
```

---

### Get Open Trades
**Endpoint:** `GET /api/demo/open-trades`

Returns currently open positions.

**Response:**
```json
{
  "openTrades": [
    {
      "id": "TRADE_001",
      "symbol": "BTC/USDT",
      "side": "BUY",
      "entryPrice": 45200,
      "currentPrice": 45350,
      "quantity": 0.5,
      "entryTime": "2026-04-16T10:30:00Z",
      "pnl": 75,
      "pnlPercent": 0.33,
      "stopLoss": 44700,
      "takeProfit": 46500
    }
  ],
  "totalOpenPnL": 75,
  "timestamp": "2026-04-16T10:35:00Z"
}
```

---

### Get Closed Trades
**Endpoint:** `GET /api/demo/closed-trades`

Returns completed trades with results.

**Response:**
```json
{
  "closedTrades": [
    {
      "id": "TRADE_001",
      "symbol": "ETH/USDT",
      "side": "BUY",
      "entryPrice": 2450,
      "exitPrice": 2480,
      "quantity": 1,
      "entryTime": "2026-04-16T09:00:00Z",
      "exitTime": "2026-04-16T09:45:00Z",
      "pnl": 30,
      "pnlPercent": 1.22,
      "exitReason": "TAKE_PROFIT"
    }
  ],
  "totalClosedTrades": 5,
  "totalClosedPnL": 125
}
```

---

### Reset Account
**Endpoint:** `POST /api/demo/reset`

Reset demo account to initial $10,000 and clear all trades.

**Response:**
```json
{
  "status": "OK",
  "message": "Demo account reset to $10,000",
  "accountBalance": 10000
}
```

**Usage:**
```bash
curl -X POST http://localhost:3002/api/demo/reset
```

---

## 🔄 Trade Execution Pipeline API

### Get Execution Stats
**Endpoint:** `GET /api/execution/stats`

View trade execution pipeline performance.

**Response:**
```json
{
  "totalSignalsReceived": 245,
  "tradesApproved": 178,
  "tradesRejected": 67,
  "approvalRate": 72.65,
  "avgProcessingTime": 150,
  "forceTradeMode": false,
  "minimumDailyTargetTrades": 3,
  "todaysTrades": 8,
  "timestamp": "2026-04-16T10:35:00Z"
}
```

---

### Get Blocked Trades
**Endpoint:** `GET /api/execution/blocked-trades`

View trades that were rejected and why.

**Response:**
```json
{
  "blockedTrades": [
    {
      "agent": "ARBITRAGE_SCOUT",
      "symbol": "BTC/USDT",
      "side": "BUY",
      "reason": "Risk exceeds 2% of account",
      "confidence": 0.64,
      "timestamp": "2026-04-16T10:25:00Z"
    },
    {
      "agent": "TREND_FOLLOWING",
      "symbol": "ETH/USDT",
      "side": "SELL",
      "reason": "Position limit exceeded (max 5 open)",
      "confidence": 0.78,
      "timestamp": "2026-04-16T10:20:00Z"
    }
  ],
  "totalBlocked": 67,
  "blockedReasons": {
    "Risk exceeds 2% of account": 23,
    "Position limit exceeded": 15,
    "Low confidence threshold": 12,
    "Insufficient liquidity": 10,
    "Other": 7
  }
}
```

---

### Force Trade Mode
**Endpoint:** `POST /api/execution/force-trades`

Enable/disable force trade mode for testing.

**Request Body:**
```json
{
  "enabled": true,
  "minTrades": 5
}
```

**Response:**
```json
{
  "status": "OK",
  "forceTradeMode": true,
  "message": "Force trade mode enabled - will force 5+ trades daily"
}
```

---

## 🧪 Backtesting API

### Run Backtest
**Endpoint:** `POST /api/backtest/run`

Execute a backtest on historical data.

**Request Body:**
```json
{
  "strategy": "TREND_FOLLOWING",
  "historicalData": [
    {"timestamp": "2026-01-01T00:00:00Z", "close": 45000, "high": 45500, "low": 44800, "volume": 1000},
    {"timestamp": "2026-01-01T01:00:00Z", "close": 45100, "high": 45600, "low": 44900, "volume": 1200}
  ],
  "initialEquity": 10000
}
```

**Response:**
```json
{
  "strategy": "TREND_FOLLOWING",
  "agent": "TRADER",
  "totalTrades": 145,
  "wins": 98,
  "losses": 45,
  "breakeven": 2,
  "winRate": 67.59,
  "avgWin": 45.32,
  "avgLoss": -28.15,
  "profitFactor": 2.45,
  "totalPnL": 2847.50,
  "returnPercent": 28.48,
  "maxDrawdown": 12.50,
  "sharpeRatio": 1.82,
  "initialEquity": 10000,
  "finalEquity": 12847.50,
  "backtestDuration": "2.5s",
  "dataPoints": 5040,
  "timestamp": "2026-04-16T10:35:00Z"
}
```

**Usage:**
```bash
curl -X POST http://localhost:3002/api/backtest/run \
  -H "Content-Type: application/json" \
  -d '{"strategy": "TREND_FOLLOWING", "historicalData": [], "initialEquity": 10000}'
```

---

### Get Backtest Results
**Endpoint:** `GET /api/backtest/results`

Retrieve all backtest results (sorted by win rate).

**Response:**
```json
{
  "results": [
    {
      "strategy": "MEAN_REVERSION",
      "agent": "MARKET_ANALYST",
      "totalTrades": 156,
      "wins": 104,
      "winRate": 66.67,
      "profitFactor": 2.34,
      "returnPercent": 32.45,
      "maxDrawdown": 14.20,
      "sharpeRatio": 1.75
    },
    {
      "strategy": "TREND_FOLLOWING",
      "agent": "TRADER",
      "totalTrades": 145,
      "wins": 98,
      "winRate": 67.59,
      "profitFactor": 2.45,
      "returnPercent": 28.48,
      "maxDrawdown": 12.50,
      "sharpeRatio": 1.82
    }
  ],
  "totalBacktestsRun": 2
}
```

---

### Compare Agents
**Endpoint:** `GET /api/backtest/comparison`

Compare all backtest agents side-by-side.

**Response:**
```json
{
  "comparison": [
    {
      "agent": "MARKET_ANALYST",
      "winRate": 66.67,
      "profitFactor": 2.34,
      "returnPercent": 32.45,
      "maxDrawdown": 14.20
    },
    {
      "agent": "TRADER",
      "winRate": 67.59,
      "profitFactor": 2.45,
      "returnPercent": 28.48,
      "maxDrawdown": 12.50
    },
    {
      "agent": "ARBITRAGE_SCOUT",
      "winRate": 58.90,
      "profitFactor": 1.89,
      "returnPercent": 18.75,
      "maxDrawdown": 16.30
    }
  ]
}
```

---

## 📊 Performance Analysis API

### Analyze Trades
**Endpoint:** `POST /api/analysis/trades`

Analyze a set of trades to compute performance metrics.

**Request Body:**
```json
{
  "trades": [
    {"pnl": 150, "won": true},
    {"pnl": -45, "won": false},
    {"pnl": 220, "won": true},
    {"pnl": -30, "won": false},
    {"pnl": 175, "won": true}
  ]
}
```

**Response:**
```json
{
  "totalTrades": 5,
  "wins": 3,
  "losses": 2,
  "breakeven": 0,
  "totalPnL": 470,
  "avgTrade": 94,
  "avgWin": 181.67,
  "avgLoss": -37.5,
  "winRate": 60,
  "expectancy": 68.2,
  "volatility": 103.45,
  "volatilityPercent": 110.05,
  "sharpeRatio": 0.91,
  "sortinoRatio": 1.22,
  "calmarRatio": 0.85,
  "profitFactor": 2.03,
  "riskRewardRatio": 4.84,
  "grossProfit": 545,
  "grossLoss": -75,
  "maxDrawdown": 45,
  "avgDrawdown": 15.2,
  "timestamp": "2026-04-16T10:35:00Z"
}
```

---

### Analyze Demo Account
**Endpoint:** `GET /api/analysis/demo`

Analyze current demo account performance.

**Response:**
```json
{
  "accountAnalysis": {
    "totalTrades": 42,
    "wins": 28,
    "losses": 12,
    "breakeven": 2,
    "totalPnL": 1850,
    "winRate": 66.67,
    "sharpeRatio": 1.45,
    "sortinoRatio": 1.78,
    "calmarRatio": 0.92,
    "profitFactor": 2.15,
    "maxDrawdown": 8.5
  }
}
```

---

### Compare Strategies
**Endpoint:** `POST /api/analysis/compare`

Compare two strategies.

**Request Body:**
```json
{
  "metrics1": {
    "sharpeRatio": 1.82,
    "sortinoRatio": 1.95,
    "winRate": 67.59,
    "profitFactor": 2.45,
    "maxDrawdown": 12.5
  },
  "metrics2": {
    "sharpeRatio": 1.65,
    "sortinoRatio": 1.72,
    "winRate": 62.30,
    "profitFactor": 2.10,
    "maxDrawdown": 15.2
  }
}
```

**Response:**
```json
{
  "comparison": {
    "metric": ["Sharpe Ratio", "Sortino Ratio", "Win Rate", "Profit Factor", "Max Drawdown"],
    "strategy1": [1.82, 1.95, 67.59, 2.45, 12.5],
    "strategy2": [1.65, 1.72, 62.30, 2.10, 15.2],
    "winner": "Strategy 1"
  }
}
```

---

## ⚙️ Strategy Configuration API

### List All Strategies
**Endpoint:** `GET /api/strategies`

Get list of all available strategies.

**Response:**
```json
{
  "strategies": [
    {
      "name": "TREND_FOLLOWING",
      "display": "Trend Following",
      "type": "crypto",
      "enabled": true,
      "paramCount": 5
    },
    {
      "name": "MEAN_REVERSION",
      "display": "Mean Reversion",
      "type": "crypto",
      "enabled": true,
      "paramCount": 6
    },
    {
      "name": "FOREX_1M_SCALP",
      "display": "Forex 1m Scalping",
      "type": "forex",
      "enabled": true,
      "paramCount": 5
    }
  ]
}
```

---

### Get Strategy Details
**Endpoint:** `GET /api/strategies/{name}`

Get full details for a specific strategy.

**Example:** `GET /api/strategies/TREND_FOLLOWING`

**Response:**
```json
{
  "name": "TREND_FOLLOWING",
  "display": "Trend Following",
  "type": "crypto",
  "agent": "TRADER",
  "enabled": true,
  "params": {
    "sma_short": {
      "value": 50,
      "min": 20,
      "max": 100,
      "step": 5,
      "description": "Short MA period"
    },
    "sma_long": {
      "value": 200,
      "min": 100,
      "max": 400,
      "step": 10,
      "description": "Long MA period"
    },
    "entry_buffer": {
      "value": 0.001,
      "min": 0.0005,
      "max": 0.005,
      "step": 0.0005,
      "description": "Entry buffer %"
    },
    "stop_loss_pct": {
      "value": 0.02,
      "min": 0.01,
      "max": 0.05,
      "step": 0.005,
      "description": "Stop loss %"
    },
    "take_profit_pct": {
      "value": 0.03,
      "min": 0.01,
      "max": 0.10,
      "step": 0.01,
      "description": "Take profit %"
    }
  }
}
```

---

### Update Parameter
**Endpoint:** `PATCH /api/strategies/{name}/parameter`

Update a single parameter value.

**Query Parameters:**
- `param` - Parameter name (required)
- `value` - New value (required)

**Example:** `PATCH /api/strategies/TREND_FOLLOWING/parameter?param=sma_short&value=60`

**Response:**
```json
{
  "status": "OK",
  "strategy": "TREND_FOLLOWING",
  "parameter": "sma_short",
  "newValue": 60,
  "message": "Updated sma_short to 60"
}
```

---

### Get All Parameters
**Endpoint:** `GET /api/strategies/{name}/parameters`

Get all parameters for a strategy.

**Example:** `GET /api/strategies/TREND_FOLLOWING/parameters`

**Response:**
```json
[
  {
    "name": "sma_short",
    "value": 50,
    "min": 20,
    "max": 100,
    "step": 5,
    "description": "Short MA period"
  },
  {
    "name": "sma_long",
    "value": 200,
    "min": 100,
    "max": 400,
    "step": 10,
    "description": "Long MA period"
  }
]
```

---

### Reset Strategy
**Endpoint:** `POST /api/strategies/{name}/reset`

Reset strategy to default parameters.

**Example:** `POST /api/strategies/TREND_FOLLOWING/reset`

**Response:**
```json
{
  "status": "OK",
  "message": "TREND_FOLLOWING reset to defaults"
}
```

---

### Toggle Strategy
**Endpoint:** `PATCH /api/strategies/{name}/toggle`

Enable or disable a strategy.

**Query Parameters:**
- `enabled` - true/false (required)

**Example:** `PATCH /api/strategies/TREND_FOLLOWING/toggle?enabled=false`

**Response:**
```json
{
  "status": "OK",
  "strategy": "TREND_FOLLOWING",
  "enabled": false,
  "message": "TREND_FOLLOWING disabled"
}
```

---

### Get Recommended Parameters
**Endpoint:** `GET /api/strategies/{name}/recommended`

Get parameters recommended for specific market regime.

**Query Parameters:**
- `regime` - TRENDING, RANGING, or VOLATILE (required)

**Example:** `GET /api/strategies/TREND_FOLLOWING/recommended?regime=TRENDING`

**Response:**
```json
{
  "regime": "TRENDING",
  "recommendations": {
    "sma_short": {
      "value": 45,
      "reason": "Tighter short MA for quick trend detection"
    },
    "sma_long": {
      "value": 200,
      "reason": "Keep long MA stable"
    },
    "stop_loss_pct": {
      "value": 0.018,
      "reason": "Tighter stop in trending market (90% of normal)"
    },
    "take_profit_pct": {
      "value": 0.036,
      "reason": "Bigger target in trending market (120% of normal)"
    }
  }
}
```

---

### Get Optimization Suggestions
**Endpoint:** `GET /api/strategies/{name}/suggestions`

Get AI-generated optimization suggestions based on backtest results.

**Query Parameters:**
- `strategy` - Strategy name (required)

**Example:** `GET /api/strategies/TREND_FOLLOWING/suggestions?strategy=TREND_FOLLOWING`

**Response:**
```json
{
  "strategy": "TREND_FOLLOWING",
  "suggestions": [
    {
      "issue": "Low win rate",
      "suggestion": "Consider adjusting entry/exit parameters",
      "action": "Try increasing SMA/EMA periods or adjusting RSI thresholds"
    },
    {
      "issue": "High drawdown",
      "suggestion": "Reduce stop loss percentage",
      "action": "Decrease stop_loss_pct by 20-30%"
    }
  ]
}
```

---

## 📝 Additional Endpoints

### Meta Orchestrator Status
**Endpoint:** `GET /api/meta/status`

View meta-orchestrator performance and agent coordination.

---

### Reset Daily Metrics
**Endpoint:** `POST /api/meta/reset-daily`

Reset daily trade counters.

---

### View Trade Logs
**Endpoint:** `GET /api/logs/trades`

View all executed trades.

---

### View Daily Report
**Endpoint:** `GET /api/logs/report`

Get daily performance report.

---

### View Blocked Reasons
**Endpoint:** `GET /api/logs/blocked-reasons`

Analyze why trades were rejected.

---

## 🔐 Authentication

Currently, all endpoints are open (for development). In production, implement:
- API Key validation
- Rate limiting per key
- Request signing
- IP whitelisting

---

## ⚡ Response Format

All responses follow this format:

**Success (200):**
```json
{
  "status": "OK",
  "data": {...}
}
```

**Error (400/500):**
```json
{
  "status": "ERROR",
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

---

## 📊 Examples

### Example 1: Run Backtest and Analyze
```bash
# Run backtest
curl -X POST http://localhost:3002/api/backtest/run \
  -H "Content-Type: application/json" \
  -d '{"strategy": "TREND_FOLLOWING", "historicalData": [...], "initialEquity": 10000}'

# Get results
curl http://localhost:3002/api/backtest/results

# Get suggestions
curl http://localhost:3002/api/strategies/TREND_FOLLOWING/suggestions
```

### Example 2: Parameter Optimization
```bash
# Get recommended parameters for trending market
curl http://localhost:3002/api/strategies/TREND_FOLLOWING/recommended?regime=TRENDING

# Update parameters
curl -X PATCH "http://localhost:3002/api/strategies/TREND_FOLLOWING/parameter?param=sma_short&value=45"

# Run backtest with new parameters
curl -X POST http://localhost:3002/api/backtest/run \
  -H "Content-Type: application/json" \
  -d '{"strategy": "TREND_FOLLOWING", "historicalData": [...], "initialEquity": 10000}'
```

### Example 3: Strategy Comparison
```bash
# Run backtest for strategy 1
curl -X POST http://localhost:3002/api/backtest/run -d '{"strategy": "TREND_FOLLOWING", ...}'

# Run backtest for strategy 2
curl -X POST http://localhost:3002/api/backtest/run -d '{"strategy": "MEAN_REVERSION", ...}'

# Compare results
curl -X POST http://localhost:3002/api/analysis/compare \
  -H "Content-Type: application/json" \
  -d '{"metrics1": {...}, "metrics2": {...}}'
```

---

## 🚀 Getting Started

1. Start backend: `npm run dev`
2. Test health: `curl http://localhost:3002/api/demo/account`
3. Execute trades: `POST /api/backtest/run`
4. Analyze results: `GET /api/analysis/demo`
5. Optimize: `GET /api/strategies/TREND_FOLLOWING/suggestions`

All endpoints are ready for integration with the Next.js frontend!
