const { GoogleGenerativeAI } = require("@google/generative-ai");
const promptLoader = require('../utils/promptLoader');

class GeminiOrchestrator {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.warn('[GEMINI] WARNING: GEMINI_API_KEY not set. Orchestrator will run in mock mode.');
    }
    this.apiKeyPresent = Boolean(apiKey);
    this.genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;
    this.modelName = process.env.GEMINI_MODEL || "gemini-1.5-pro";
    this.model = this.genAI ? this.genAI.getGenerativeModel({ model: this.modelName }) : null;
    console.log(`[GEMINI] Orchestrator initialized — model=${this.modelName} apiKeyPresent=${this.apiKeyPresent}`);
  }

  async makeDecision(marketData, currentPortfolio, decisionType = 'SIGNAL') {
    if (!this.model) {
      return { approval_status: 'HOLD', reasoning: 'No GEMINI_API_KEY configured — running in mock mode.' };
    }
    try {
      const prompt = this.formatDecisionRequest(marketData, currentPortfolio, decisionType);
      
      const result = await this.model.generateContent([
        { text: promptLoader.getSystemPrompt() },
        { text: prompt }
      ]);
      
      const response = await result.response;
      const text = response.text();
      
      return this.parseDecision(text);
    } catch (error) {
      console.error('Gemini API error:', error.message);
      return { approval_status: 'REJECTED', reasoning: `Gemini error: ${error.message}` };
    }
  }

  formatDecisionRequest(marketData, portfolio, decisionType) {
    return `MARKET DATA:\n${JSON.stringify(marketData, null, 2)}\n\nPORTFOLIO STATE:\n${JSON.stringify(portfolio, null, 2)}\n\nDECISION TYPE: ${decisionType}\n\nAnalyze this market data and portfolio state. Output your decision as JSON with:\n- decision_type (BUY, SELL, HOLD, ARBITRAGE, GRID_SETUP, REBALANCE)\n- agent_responsible\n- signal (entry, stop, target, position_size, confidence)\n- constraints_check (drawdown, correlation, leverage, approval_status)\n- reasoning (explain your reasoning)\n- approval_status (APPROVED, REJECTED, PENDING_REVIEW)`;
  }

  parseDecision(rawDecision) {
    try {
      const jsonMatch = rawDecision.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { approval_status: 'REJECTED', reasoning: 'Invalid response format' };
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Failed to parse Gemini decision:', error.message);
      return { approval_status: 'REJECTED', reasoning: 'Parse error' };
    }
  }
}

module.exports = new GeminiOrchestrator();
