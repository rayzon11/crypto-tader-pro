# Live Terminal Dashboard Specification
## Bloomberg-Style Crypto Trading Interface

### Overview
Professional, real-time dashboard displaying:
- Live portfolio equity curve
- Agent decision logs with conviction scores
- Open positions with P&L tracking
- Market data feeds (top 20 cryptos)
- Risk metrics dashboard
- Strategy performance breakdown

### Dashboard Tabs
1. **Portfolio** (Default) — Equity, allocation, daily P&L, Sharpe, drawdown, 30-day curve, positions
2. **Agents** — Last 50 decisions, expandable reasoning, confidence filters
3. **Strategies** — Performance by strategy (Arbitrage/Grid/Trend/MarketMaking/MeanReversion)
4. **Alerts** — Critical/Warning/Info notifications with real-time risk monitoring
5. **Settings** — Mode toggle (Demo/Live), risk parameters, strategy toggles, exchange connections

### Real-Time Data
- WebSocket updates every 5 seconds
- Events: PORTFOLIO_UPDATE, POSITION_UPDATE, AGENT_DECISION, ALERT, MARKET_DATA

### Color Scheme (Bloomberg-Style)
- Positive: Green (#00C853)
- Negative: Red (#FF1744)
- Neutral: Gray (#9E9E9E)
- Info: Blue (#2196F3)
- Warning: Orange (#FF9800)
- Critical: Dark Red (#C62828)
- Background: Dark (#121212)
- Text: Light (#E0E0E0)

### Risk Dashboard Metrics
| Rule | Limit | Status |
|------|-------|--------|
| Max Drawdown | 15% | Monitor |
| Per-Trade Risk | 2% | Monitor |
| Max Leverage | 3x | Monitor |
| Correlation | < 0.65 | Monitor |
| Position Count | 25 max | Monitor |
| Recovery Mode | 50% size | Auto |
