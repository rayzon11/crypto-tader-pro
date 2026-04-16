# TREND FOLLOWING STRATEGY

## Goal
Ride directional moves on 4H-1D timeframes.

## Trigger (ALL must align)
- Price > 50-MA AND 50-MA > 200-MA (bullish)
- MACD histogram positive crossover
- Volume > 150% of 20-day average

## Multi-Timeframe Confirmation
Only trade when ALL 3 aligned:
1. 1H: Bullish (price > 50-MA, MACD positive)
2. 4H: Bullish (price > 50-MA)
3. 1D: Bullish (price > 200-MA)

If misaligned -> SKIP trade.

## Parameters
- Position Size: $2,000-$5,000
- Time Horizon: 1-7 days
- Agent: TRADER (primary), MARKET_ANALYST (confirmation)
- Trail stop: 5% below entry

## Active Profit Management
- +3% profit: Trail stop to breakeven + 0.5%
- +5% profit: Move stop to entry + 1%
- +10% profit: Move stop to entry + 3%

## Risk-Free After Entry
- At +2-3%: Close 50% position at profit
- Move stop to breakeven on remaining 50%
- Let remaining run to target

## Expected Performance
- Win Rate: ~60%
- Avg Win > Avg Loss (larger wins)
