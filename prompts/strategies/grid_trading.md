# GRID TRADING STRATEGY

## Goal
Profit from volatility within resistance/support bands without directional bias.

## Trigger
- RSI 40-60 (consolidation confirmed)
- Bollinger Band width < 3% of price (tight = consolidation)

## Grid Setup
1. Identify range: Support (7-day low), Resistance (7-day high)
2. Spacing: (Resistance - Support) / number_of_layers
3. Total capital: $1,000 - $3,000
4. Per-layer: Total / layers (5-15 layers)

## Volatility-Adaptive Enhancement
- Calculate 7-day realized volatility
- More volatility = more layers (capture more cycles)
- Less volatility = fewer layers (reduce capital tied up)
- Rebalance every 24H if volatility changed > 20%

## Example (ETH $2,400-$2,800)
- Range: $400, 10 layers, $40 spacing
- Buy orders at each layer when price falls
- Sell orders at each layer when price rises
- Expected profit: $150-300 per range cycle

## Exit Conditions
- Price closes outside range for 1 hour -> liquidate grid
- RSI < 20 or > 80 -> exit (trending market)

## Constraints
- Max 4 concurrent grids
- Agent: GRID_MASTER (primary), TRADER (confirmation)
