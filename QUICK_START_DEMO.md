# QUICK START — DEMO TRADING IN 5 MINUTES

---

## ✅ STEP 1: Start Both Servers

**Terminal 1** (Frontend):
```bash
cd /c/Users/admin/Downloads/crypto-trading-bot/frontend
npm run dev
# Wait for: "Ready in 2.5s"
# Runs on: http://localhost:3001
```

**Terminal 2** (Backend):
```bash
cd /c/Users/admin/Downloads/crypto-trading-bot
node src/index.js
# Wait for: "CryptoTrader Pro — 25-Agent System"
# Runs on: http://localhost:3002
```

---

## ✅ STEP 2: Check System Status

**Test 1: Are agents running?**
```bash
curl http://localhost:3002/api/agents | jq '.[] | .name'
# Should show: TRADER, RISK_MANAGER, MARKET_ANALYST, etc.
```

**Test 2: Is demo account created?**
```bash
curl http://localhost:3002/api/demo/account
# Should show: { "equity": 10000, "openTrades": 0, ... }
```

**Test 3: Is market data flowing?**
```bash
curl http://localhost:3002/api/market | jq '.[0] | keys'
# Should show: BTC/USDT, ETH/USDT, SOL/USDT, etc. with prices
```

---

## ✅ STEP 3: Force Trades to Verify Execution Pipeline

The system requires real signals. To TEST the execution pipeline, enable **FORCE TRADE MODE** (will execute ALL signals):

```bash
curl -X POST http://localhost:3002/api/execution/force-trades \
  -H "Content-Type: application/json" \
  -d '{"enable": true}'
```

**Response:**
```json
{
  "status": "FORCE_TRADES_ENABLED",
  "message": "Will execute ALL signals"
}
```

---

## ✅ STEP 4: Monitor Trades Executing

**Watch real-time account updates** (run every 5 seconds):
```bash
watch -n 5 'curl -s http://localhost:3002/api/demo/account | jq ".account"'
```

**Output:**
```json
{
  "equity": 10042,      ← Changes as trades execute
  "pnl": 42,
  "openTrades": 2,      ← Should increase
  "winRate": 75,
  "totalTradesExecuted": 3
}
```

---

## ✅ STEP 5: Check Open Trades

```bash
curl http://localhost:3002/api/demo/open-trades
```

**Example Response:**
```json
{
  "count": 2,
  "trades": [
    {
      "id": "DEMO_1_a1b2c3",
      "symbol": "BTC/USDT",
      "side": "BUY",
      "entryPrice": 45230,
      "currentPrice": 45350,
      "pnl": 60,
      "pnlPercent": 0.13,
      "openTime": "2026-04-10T12:30:00Z",
      "agent": "TRADER"
    },
    {
      "id": "DEMO_2_d4e5f6",
      "symbol": "ETH/USDT",
      "side": "SELL",
      "entryPrice": 3450,
      "currentPrice": 3420,
      "pnl": 60,
      "pnlPercent": 0.87,
      "openTime": "2026-04-10T12:35:00Z",
      "agent": "ARBITRAGE_SCOUT"
    }
  ]
}
```

---

## ✅ STEP 6: Check Closed Trades & P&L

```bash
curl http://localhost:3002/api/demo/closed-trades?limit=5
```

**Example Response:**
```json
{
  "count": 3,
  "trades": [
    {
      "id": "DEMO_1_a1b2c3",
      "symbol": "BTC/USDT",
      "side": "BUY",
      "pnl": 150,
      "pnlPercent": 0.33,
      "closeTime": "2026-04-10T12:40:00Z",
      "reason": "TAKE_PROFIT"
    },
    {
      "id": "DEMO_2_d4e5f6",
      "symbol": "SOL/USDT",
      "side": "BUY",
      "pnl": -45,
      "pnlPercent": -0.22,
      "closeTime": "2026-04-10T12:45:00Z",
      "reason": "STOP_LOSS"
    },
    {
      "id": "DEMO_3_g7h8i9",
      "symbol": "ETH/USDT",
      "side": "SELL",
      "pnl": 87,
      "pnlPercent": 0.15,
      "closeTime": "2026-04-10T12:50:00Z",
      "reason": "TAKE_PROFIT"
    }
  ]
}
```

---

## ✅ STEP 7: Check Execution Statistics

```bash
curl http://localhost:3002/api/execution/stats
```

**Example Response:**
```json
{
  "totalAttempts": 42,
  "executed": 35,
  "rejected": 7,
  "executionRate": 83.33,
  "rejectionReasons": {
    "RISK_CHECK_FAILED": 3,
    "TECHNICAL_FAILED": 2,
    "INSUFFICIENT_CASH": 2
  },
  "recentRejections": [
    {
      "reason": "RISK_CHECK_FAILED",
      "details": "Risk too high: $500 > max $200"
    }
  ]
}
```

---

## ✅ STEP 8: View Daily Report

```bash
curl http://localhost:3002/api/logs/report
```

**Example Response:**
```json
{
  "date": "2026-04-10",
  "totalAttempts": 42,
  "executed": 35,
  "rejected": 7,
  "errors": 0,
  "executionRate": "83.33%",
  "trades": [ ... ]
}
```

---

## ✅ STEP 9: Access Frontend Dashboard

Open browser: **http://localhost:3001/trading**

You should see:
- ✅ Real-time BTC, ETH, SOL prices
- ✅ 25 agents active (green status)
- ✅ Open trades listed
- ✅ Profit/loss chart
- ✅ Win rate and Sharpe ratio

---

## ❓ TROUBLESHOOTING

### "No trades are executing"

**Check 1: Are signals being generated?**
```bash
curl http://localhost:3002/api/agents | grep -i "alive"
# Should show all agents "alive"
```

**Check 2: Are signals being blocked?**
```bash
curl http://localhost:3002/api/execution/blocked-trades
# If blocked, check the "reason" field
```

**Check 3: Enable force trades**
```bash
curl -X POST http://localhost:3002/api/execution/force-trades \
  -d '{"enable": true}' \
  -H "Content-Type: application/json"
```

**Check 4: Restart backend**
```bash
# Kill terminal 2 with Ctrl+C
# Run again: node src/index.js
```

---

### "Equity not changing"

**Check**: Open trades are being created?
```bash
curl http://localhost:3002/api/demo/open-trades | jq '.count'
# Should be > 0
```

**Fix**: Reset account and try again
```bash
curl -X POST http://localhost:3002/api/demo/reset \
  -d '{"initialBalance": 10000}' \
  -H "Content-Type: application/json"
```

---

### "Getting 'INSUFFICIENT CASH' errors"

**Reason**: Each trade takes capital. Multiple trades use up cash.

**Fix**: Check available cash
```bash
curl http://localhost:3002/api/demo/account | jq '.account.cash'
```

**Solution**: Either reset account or wait for trades to close
```bash
# Close oldest trade
curl http://localhost:3002/api/demo/close-trade -X POST \
  -d '{"tradeId": "DEMO_1_...", "closePrice": 45500}' \
  -H "Content-Type: application/json"
```

---

## 📊 SUCCESS CRITERIA

After 30 minutes of running, you should see:

| Metric | Target | Status |
|--------|--------|--------|
| Trades Executed | 10+ | ✅ |
| Win Rate | 50%+ | ✅ |
| Execution Rate | 70%+ | ✅ |
| Equity | > $10,000 | ✅ |
| Open Trades | 1-5 | ✅ |
| P&L | +$50 to +$500 | ✅ |

---

## 🎯 NEXT STEPS

1. **Run Demo for 1 Week**: See if it reaches 60%+ win rate and +1% daily return
2. **Backtest**: Test on historical data (optional, advanced)
3. **Paper Trade**: Run on live Binance testnet with $0 risk
4. **Go Live**: Start with $500 real money when confident

---

## 📋 CHEAT SHEET — Useful Commands

```bash
# Get everything
curl http://localhost:3002/api/meta/status | jq

# Monitor account in real-time
watch -n 5 'curl -s http://localhost:3002/api/demo/account | jq ".account"'

# Get blocked trades (why trades didn't execute)
curl http://localhost:3002/api/execution/blocked-trades | jq '.blockedTrades[].reason'

# View logs
tail -f logs/trades.log
tail -f logs/blocked_trades.log

# Enable/disable force trades
curl -X POST http://localhost:3002/api/execution/force-trades -d '{"enable":true}' -H "Content-Type: application/json"

# Reset daily counters
curl -X POST http://localhost:3002/api/meta/reset-daily

# Reset demo account
curl -X POST http://localhost:3002/api/demo/reset -d '{"initialBalance":10000}' -H "Content-Type: application/json"
```

---

## 🔧 SYSTEM HEALTH CHECK

Run this to verify everything is working:

```bash
echo "1. Checking agents..."
curl -s http://localhost:3002/api/agents | jq '.[] | .name' | wc -l
echo "agents found (should be 25)"

echo ""
echo "2. Checking demo account..."
curl -s http://localhost:3002/api/demo/account | jq '.account.equity'

echo ""
echo "3. Checking market data..."
curl -s http://localhost:3002/api/market | jq 'keys | length'
echo "assets available"

echo ""
echo "4. Checking execution rate..."
curl -s http://localhost:3002/api/execution/stats | jq '.executionRate'

echo ""
echo "5. Checking trades executed today..."
curl -s http://localhost:3002/api/logs/report | jq '.report.executed'
```

---

## ✅ YOU ARE NOW READY

The system will:
- ✅ Generate trading signals from 25 agents
- ✅ Validate signals through 6 stages
- ✅ Execute trades in demo mode
- ✅ Track P&L accurately
- ✅ Log every decision
- ✅ Close positions on SL/TP
- ✅ Prevent catastrophic losses

**Time to watch it trade!** 🚀
