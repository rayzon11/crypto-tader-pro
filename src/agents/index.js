// Agent Registry — all 7 specialized agents
const trader = require('./trader');
const riskManager = require('./riskManager');
const marketAnalyst = require('./marketAnalyst');
const arbitrageScout = require('./arbitrageScout');
const gridMaster = require('./gridMaster');
const portfolioManager = require('./portfolioManager');
const orderExecutor = require('./orderExecutor');

const agents = {
  TRADER: trader,
  RISK_MANAGER: riskManager,
  MARKET_ANALYST: marketAnalyst,
  ARBITRAGE_SCOUT: arbitrageScout,
  GRID_MASTER: gridMaster,
  PORTFOLIO_MANAGER: portfolioManager,
  ORDER_EXECUTOR: orderExecutor,
};

function getAllStatus() {
  return Object.values(agents).map(a => a.getStatus());
}

function getAgent(type) {
  return agents[type] || null;
}

function getAllDecisions(limit = 50) {
  const all = [];
  for (const agent of Object.values(agents)) {
    all.push(...agent.decisions.slice(-limit));
  }
  return all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, limit);
}

module.exports = { agents, getAllStatus, getAgent, getAllDecisions };
