# ARBITRAGE STRATEGY

## Goal
Capture CEX/DEX price differences across exchanges.

## Platforms
- Binance (CEX), Uniswap (DEX), dYdX (perps), Magic Eden (Solana DEX)

## Trigger
Spread > 0.3% after all fees (for assets > $10M liquidity)

## Parameters
- Position Size: $500-$2,000
- Time Horizon: 5 minutes - 2 hours
- Agent: ARBITRAGE_SCOUT (primary), ORDER_EXECUTOR (execution)
- Slippage Buffer: 0.15%

## Monitoring (Every 30 Seconds)
```
Binance Spot (BTC/USDT) vs. dYdX Spot (BTC/USD)
Binance Futures (BTC Perps) vs. Binance Spot
Uniswap V4 (ETH/USDC) vs. Binance Spot (ETH/USDT)

For each pair:
- Spread = |Price_A - Price_B| / Price_A
- Execution cost = 0.15% slippage + 0.1% fee = 0.25%
- Net profit = Spread - Execution Cost
- Trigger: Net profit > 0.3%
```

## Risk
- Spreads compress fast (30s window typical)
- Account for withdrawal delays (DEX slower than CEX)
- If spread < 0.2%, don't execute

## Expected Performance
- Frequency: 3-5 opportunities/day
- Daily income: $12-20 on $5K capital
- Win rate: ~75%
