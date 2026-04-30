#!/usr/bin/env bash
# scripts/health_check.sh — Check all 25 agent heartbeats in Redis
set -euo pipefail

AGENTS=(
  trend momentum mean_reversion arbitrage breakout indicator_master
  sentiment onchain risk portfolio orderbook
  order slippage stoploss fee defi
  ml backtest alert audit rebalance news
  npm_security db_security code_security
)

DEAD=0
echo "=== HEALTH CHECK $(date -u) ==="

for agent in "${AGENTS[@]}"; do
  hb=$(redis-cli GET "agent:heartbeat:${agent}" 2>/dev/null || echo "")
  if [[ -z "$hb" ]]; then
    echo "  DEAD  : $agent"
    ((DEAD++))
  else
    age=$(( $(date +%s) - hb ))
    if (( age > 120 )); then
      echo "  STALE : $agent (${age}s ago)"
      ((DEAD++))
    else
      echo "  OK    : $agent (${age}s)"
    fi
  fi
done

echo "Dead/Stale: $DEAD/${#AGENTS[@]}"

if (( DEAD > 0 )) && [[ -n "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -d "chat_id=${TELEGRAM_CHAT_ID}" \
    -d "text=CryptoBot: $DEAD agents dead/stale!" > /dev/null
fi

(( DEAD > 0 )) && exit 1 || exit 0
