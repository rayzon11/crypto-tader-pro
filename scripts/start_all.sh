#!/usr/bin/env bash
# scripts/start_all.sh — Launch all 20 agents + supervisor in tmux
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$BASE_DIR/logs"
mkdir -p "$LOG_DIR"

SESSION="crypto_bot"

AGENTS=(
  "supervisor/supervisor_agent"
  "agents/strategy/trend_agent"
  "agents/strategy/momentum_agent"
  "agents/strategy/mean_reversion_agent"
  "agents/strategy/arbitrage_agent"
  "agents/strategy/breakout_agent"
  "agents/data_risk/sentiment_agent"
  "agents/data_risk/onchain_agent"
  "agents/data_risk/risk_agent"
  "agents/data_risk/portfolio_agent"
  "agents/data_risk/orderbook_agent"
  "agents/execution/order_agent"
  "agents/execution/slippage_agent"
  "agents/execution/stoploss_agent"
  "agents/execution/fee_agent"
  "agents/execution/defi_agent"
  "agents/intelligence/ml_agent"
  "agents/intelligence/backtest_agent"
  "agents/intelligence/alert_agent"
  "agents/intelligence/audit_agent"
  "agents/intelligence/rebalance_agent"
  "agents/security/npm_security_agent"
  "agents/security/db_security_agent"
  "agents/security/code_security_agent"
)

echo "Verifying Redis..."
redis-cli ping | grep -q PONG || { echo "Redis not running"; exit 1; }
echo "Redis OK"

tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -x 240 -y 50

for i in "${!AGENTS[@]}"; do
  mod="${AGENTS[$i]}"
  name=$(basename "$mod")
  log="$LOG_DIR/${name}.log"

  if [ $i -eq 0 ]; then
    tmux rename-window -t "$SESSION:0" "supervisor" 2>/dev/null || true
  else
    tmux new-window -t "$SESSION" -n "$name" 2>/dev/null || true
  fi

  tmux send-keys -t "$SESSION:$i" "cd '$BASE_DIR' && python3 -m ${mod//\//.} 2>&1 | tee '$log'" Enter
  echo "  Started: $name"
  sleep 0.25
done

echo ""
echo "All 23 agents started."
echo "Attach: tmux attach -t $SESSION"
echo "Dashboard: http://localhost:3000"
