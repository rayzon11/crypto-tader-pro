// STRATEGY CONFIGURATION MANAGER
// Customize and optimize strategy parameters

const fs = require('fs');
const path = require('path');

class StrategyConfig {
  constructor() {
    this.strategies = this.loadStrategies();
    this.activeStrategy = null;
  }

  /**
   * Load strategy configurations
   */
  loadStrategies() {
    return {
      // CRYPTO STRATEGIES
      TREND_FOLLOWING: {
        name: 'Trend Following',
        type: 'crypto',
        agent: 'TRADER',
        params: {
          sma_short: { value: 50, min: 20, max: 100, step: 5, description: 'Short MA period' },
          sma_long: { value: 200, min: 100, max: 400, step: 10, description: 'Long MA period' },
          entry_buffer: { value: 0.001, min: 0.0005, max: 0.005, step: 0.0005, description: 'Entry buffer %' },
          stop_loss_pct: { value: 0.02, min: 0.01, max: 0.05, step: 0.005, description: 'Stop loss %' },
          take_profit_pct: { value: 0.03, min: 0.01, max: 0.10, step: 0.01, description: 'Take profit %' }
        },
        enabled: true
      },

      MEAN_REVERSION: {
        name: 'Mean Reversion',
        type: 'crypto',
        agent: 'MARKET_ANALYST',
        params: {
          rsi_period: { value: 14, min: 7, max: 21, step: 1, description: 'RSI period' },
          rsi_oversold: { value: 30, min: 20, max: 40, step: 2, description: 'RSI oversold threshold' },
          rsi_overbought: { value: 70, min: 60, max: 80, step: 2, description: 'RSI overbought threshold' },
          sma_period: { value: 20, min: 10, max: 50, step: 5, description: 'SMA period for center line' },
          stop_loss_pct: { value: 0.025, min: 0.01, max: 0.05, step: 0.005, description: 'Stop loss %' },
          take_profit_pct: { value: 0.035, min: 0.01, max: 0.10, step: 0.01, description: 'Take profit %' }
        },
        enabled: true
      },

      ARBITRAGE: {
        name: 'Arbitrage (Range Trading)',
        type: 'crypto',
        agent: 'ARBITRAGE_SCOUT',
        params: {
          lookback_period: { value: 20, min: 10, max: 50, step: 5, description: 'Lookback candles for support/resistance' },
          support_buffer: { value: 0.01, min: 0.005, max: 0.02, step: 0.005, description: 'Buffer % from support' },
          resistance_buffer: { value: 0.01, min: 0.005, max: 0.02, step: 0.005, description: 'Buffer % from resistance' },
          stop_loss_pct: { value: 0.015, min: 0.005, max: 0.03, step: 0.005, description: 'Stop loss %' },
          take_profit_pct: { value: 0.02, min: 0.01, max: 0.05, step: 0.005, description: 'Take profit %' }
        },
        enabled: true
      },

      // FOREX STRATEGIES
      FOREX_1M_SCALP: {
        name: 'Forex 1m Scalping',
        type: 'forex',
        agent: 'FOREX_1M',
        params: {
          bb_period: { value: 20, min: 10, max: 30, step: 2, description: 'Bollinger Band period' },
          bb_std_dev: { value: 2, min: 1, max: 3, step: 0.5, description: 'BB standard deviations' },
          rsi_period: { value: 14, min: 7, max: 21, step: 1, description: 'RSI period' },
          stop_loss_pips: { value: 3, min: 2, max: 5, step: 1, description: 'Stop loss in pips' },
          take_profit_pips: { value: 5, min: 3, max: 10, step: 1, description: 'Take profit in pips' }
        },
        enabled: true
      },

      FOREX_5M_CROSSOVER: {
        name: 'Forex 5m EMA Crossover',
        type: 'forex',
        agent: 'FOREX_5M',
        params: {
          ema_short: { value: 9, min: 5, max: 15, step: 1, description: 'Short EMA' },
          ema_long: { value: 21, min: 15, max: 35, step: 2, description: 'Long EMA' },
          volume_multiplier: { value: 1.2, min: 1, max: 2, step: 0.1, description: 'Volume confirmation multiplier' },
          stop_loss_atr: { value: 1, min: 0.5, max: 2, step: 0.25, description: 'Stop loss ATR multiplier' },
          take_profit_atr: { value: 2, min: 1, max: 3, step: 0.5, description: 'Take profit ATR multiplier' }
        },
        enabled: true
      },

      FOREX_15M_SWING: {
        name: 'Forex 15m Swing',
        type: 'forex',
        agent: 'FOREX_15M',
        params: {
          sma_short: { value: 50, min: 30, max: 80, step: 10, description: 'Short SMA' },
          sma_long: { value: 200, min: 150, max: 300, step: 25, description: 'Long SMA' },
          lookback_period: { value: 14, min: 10, max: 30, step: 2, description: 'Support/resistance lookback' },
          stop_loss_pct: { value: 0.01, min: 0.005, max: 0.02, step: 0.005, description: 'Stop loss %' },
          take_profit_pct: { value: 0.02, min: 0.01, max: 0.05, step: 0.005, description: 'Take profit %' }
        },
        enabled: true
      }
    };
  }

  /**
   * Get strategy config
   */
  getStrategy(strategyName) {
    return this.strategies[strategyName] || null;
  }

  /**
   * List all strategies
   */
  listStrategies() {
    return Object.keys(this.strategies).map(key => ({
      name: key,
      display: this.strategies[key].name,
      type: this.strategies[key].type,
      enabled: this.strategies[key].enabled,
      paramCount: Object.keys(this.strategies[key].params).length
    }));
  }

  /**
   * Update parameter value
   */
  updateParameter(strategyName, paramName, newValue) {
    const strategy = this.strategies[strategyName];
    if (!strategy) return { error: 'Strategy not found' };

    const param = strategy.params[paramName];
    if (!param) return { error: 'Parameter not found' };

    // Validate range
    if (newValue < param.min || newValue > param.max) {
      return {
        error: `Value out of range: ${newValue} (min: ${param.min}, max: ${param.max})`
      };
    }

    param.value = newValue;

    return {
      status: 'OK',
      strategy: strategyName,
      parameter: paramName,
      newValue,
      message: `Updated ${paramName} to ${newValue}`
    };
  }

  /**
   * Get all parameters for a strategy
   */
  getParameters(strategyName) {
    const strategy = this.strategies[strategyName];
    if (!strategy) return null;

    return Object.keys(strategy.params).map(key => ({
      name: key,
      ...strategy.params[key]
    }));
  }

  /**
   * Reset strategy to defaults
   */
  resetStrategy(strategyName) {
    const strategy = this.getStrategy(strategyName);
    if (!strategy) return { error: 'Strategy not found' };

    // Reload to get defaults
    const defaults = this.loadStrategies()[strategyName];
    this.strategies[strategyName] = JSON.parse(JSON.stringify(defaults));

    return {
      status: 'OK',
      message: `${strategyName} reset to defaults`
    };
  }

  /**
   * Enable/disable strategy
   */
  toggleStrategy(strategyName, enabled) {
    const strategy = this.strategies[strategyName];
    if (!strategy) return { error: 'Strategy not found' };

    strategy.enabled = enabled;

    return {
      status: 'OK',
      strategy: strategyName,
      enabled,
      message: `${strategyName} ${enabled ? 'enabled' : 'disabled'}`
    };
  }

  /**
   * Get recommended parameters based on market regime
   */
  getRecommendedParams(strategyName, regime) {
    const strategy = this.getStrategy(strategyName);
    if (!strategy) return null;

    // Adjust parameters based on market regime
    const recommendations = JSON.parse(JSON.stringify(strategy.params));

    switch (regime) {
      case 'TRENDING':
        // More aggressive in trending market
        if (recommendations.stop_loss_pct) {
          recommendations.stop_loss_pct.value *= 0.9; // Tighter stop
        }
        if (recommendations.take_profit_pct) {
          recommendations.take_profit_pct.value *= 1.2; // Bigger target
        }
        break;

      case 'RANGING':
        // More conservative in ranging market
        if (recommendations.stop_loss_pct) {
          recommendations.stop_loss_pct.value *= 1.1; // Wider stop
        }
        if (recommendations.take_profit_pct) {
          recommendations.take_profit_pct.value *= 0.8; // Smaller target
        }
        break;

      case 'VOLATILE':
        // Much more conservative in volatile market
        if (recommendations.stop_loss_pct) {
          recommendations.stop_loss_pct.value *= 1.3; // Much wider stop
        }
        if (recommendations.take_profit_pct) {
          recommendations.take_profit_pct.value *= 0.6; // Much smaller target
        }
        break;
    }

    return recommendations;
  }

  /**
   * Save configuration to file
   */
  saveConfig(filename = 'strategy_config.json') {
    const filepath = path.join(__dirname, '../../', filename);
    fs.writeFileSync(filepath, JSON.stringify(this.strategies, null, 2));
    return { status: 'OK', file: filepath };
  }

  /**
   * Load configuration from file
   */
  loadConfig(filename = 'strategy_config.json') {
    const filepath = path.join(__dirname, '../../', filename);
    if (fs.existsSync(filepath)) {
      this.strategies = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      return { status: 'OK', loaded: true };
    }
    return { status: 'OK', loaded: false };
  }

  /**
   * Generate optimization suggestions
   */
  getSuggestions(strategyName, backtestResults) {
    const strategy = this.getStrategy(strategyName);
    if (!strategy) return null;

    const suggestions = [];

    // If win rate < 55%, suggest adjusting parameters
    if (backtestResults.winRate < 55) {
      suggestions.push({
        issue: 'Low win rate',
        suggestion: 'Consider adjusting entry/exit parameters',
        action: 'Try increasing SMA/EMA periods or adjusting RSI thresholds'
      });
    }

    // If max drawdown > 10%, suggest tighter stops
    if (backtestResults.maxDrawdown > 10) {
      suggestions.push({
        issue: 'High drawdown',
        suggestion: 'Reduce stop loss percentage',
        action: 'Decrease stop_loss_pct by 20-30%'
      });
    }

    // If profit factor < 1.5, suggest improving entries
    if (backtestResults.profitFactor < 1.5) {
      suggestions.push({
        issue: 'Poor profit factor',
        suggestion: 'Improve entry quality',
        action: 'Add more confirmation indicators or increase minimum confidence'
      });
    }

    return suggestions;
  }
}

module.exports = new StrategyConfig();
