const Anthropic = require('@anthropic-ai/sdk');
const promptLoader = require('../utils/promptLoader');

class ClaudeOrchestrator {
  constructor() {
    const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('[CLAUDE] WARNING: CLAUDE_API_KEY / ANTHROPIC_API_KEY env var not set. Orchestrator will run in mock mode.');
    }
    this.apiKeyPresent = Boolean(apiKey);
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    // Default to Claude Opus 4.5 — master orchestrator for the 27-agent system
    this.model = process.env.CLAUDE_MODEL || 'claude-opus-4-5-20250929';
    this.conversationHistory = [];
    console.log(`[CLAUDE] Orchestrator initialized — model=${this.model} apiKeyPresent=${this.apiKeyPresent}`);
  }

  async makeDecision(marketData, currentPortfolio, decisionType = 'SIGNAL') {
    // Mock decision when no API key configured — keeps the system running locally
    if (!this.client) {
      return { approval_status: 'HOLD', reasoning: 'No CLAUDE_API_KEY configured — running in mock orchestrator mode.' };
    }
    try {
      const userMessage = this.formatDecisionRequest(marketData, currentPortfolio, decisionType);

      this.conversationHistory.push({ role: 'user', content: userMessage });

      // Trim history to last 20 exchanges to stay within context
      if (this.conversationHistory.length > 40) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1500,
        system: promptLoader.getSystemPrompt(),
        messages: this.conversationHistory,
      });

      const decision = response.content[0].text;
      this.conversationHistory.push({ role: 'assistant', content: decision });

      return this.parseDecision(decision);
    } catch (error) {
      console.error('Claude API error:', error.message);
      return { approval_status: 'REJECTED', reasoning: `API error: ${error.message}` };
    }
  }

  formatDecisionRequest(marketData, portfolio, decisionType) {
    return `MARKET DATA:\n${JSON.stringify(marketData, null, 2)}\n\nPORTFOLIO STATE:\n${JSON.stringify(portfolio, null, 2)}\n\nDECISION TYPE: ${decisionType}\n\nAnalyze this market data and portfolio state. Output your decision as JSON with:\n- decision_type (BUY, SELL, HOLD, ARBITRAGE, GRID_SETUP, REBALANCE)\n- agent_responsible\n- signal (entry, stop, target, position_size, confidence)\n- constraints_check (drawdown, correlation, leverage, approval_status)\n- reasoning (explain your reasoning)\n- approval_status (APPROVED, REJECTED, PENDING_REVIEW)`;
  }

  parseDecision(rawDecision) {
    try {
      const jsonMatch = rawDecision.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('No JSON found in Claude response');
        return { approval_status: 'REJECTED', reasoning: 'Invalid response format' };
      }
      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Failed to parse decision:', error.message);
      return { approval_status: 'REJECTED', reasoning: 'Parse error' };
    }
  }

  resetHistory() {
    this.conversationHistory = [];
  }

  getHistory() {
    return this.conversationHistory;
  }
}

module.exports = new ClaudeOrchestrator();
