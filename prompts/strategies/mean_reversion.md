# MEAN REVERSION STRATEGY

## Goal
Profit from extreme moves returning to average (volatility play).

## Trigger (ALL required)
- Price > 2-sigma from 20-MA (oversold/overbought)
- Volume spike > 200% of 20-day average

## Parameters
- Position Size: $1,000-$3,000 (smaller due to high volatility)
- Time Horizon: 4 hours - 2 days
- Stop Loss: 3-sigma band
- Agent: MARKET_ANALYST (signal), TRADER (execution)

## Edge
Volume + volatility confirmation (not just price).
Most competitors only use price-based signals.

## Example
BTC drops 8% in 2 hours on news -> Mean reversion play, expect +3-5% bounce.

## Risk
- Can continue moving against you (momentum)
- Use 3-sigma stop (wide, but protects against extreme continuation)
- Smaller position sizes to account for higher volatility

## Expected Performance
- Win Rate: ~55%
- High standard deviation
- Requires patience and discipline
