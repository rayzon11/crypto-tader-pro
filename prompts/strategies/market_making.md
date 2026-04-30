# MARKET MAKING STRATEGY

## Goal
Capture bid-ask spread by providing liquidity on supported pairs.

## Platforms
Binance USDT pairs (high liquidity only)

## Setup
- Buy orders 0.1% below mid-price
- Sell orders 0.1% above mid-price
- Adjust spreads dynamically based on realized volatility

## Parameters
- Position Size: $1,000-$3,000 per pair
- Time Horizon: Continuous (until filled)
- Max hold time: 8 hours (inventory risk)
- Agent: GRID_MASTER (modified mode)

## Dynamic Spread Adjustment
- Low volatility: Tighter spreads (0.05% each side)
- High volatility: Wider spreads (0.15% each side)
- Monitor every 5 minutes

## Risk
- Inventory risk if market moves sharply
- Adverse selection by informed traders
- Mitigation: Max hold time, position limits

## Expected Performance
- Return: 0.05-0.15% per cycle
- High frequency, small per-trade profit
- Win Rate: ~60%
