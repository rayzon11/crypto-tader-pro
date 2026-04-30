const claude = require('./claudeOrchestrator');
const gemini = require('./geminiOrchestrator');

class AIBrain {
  constructor() {
    this.primary = process.env.PRIMARY_AI || 'CLAUDE'; // CLAUDE, GEMINI, or CONSENSUS
    console.log(`[AI-BRAIN] AGI System initialized. Primary: ${this.primary}`);
  }

  async makeDecision(marketData, portfolio, type = 'SIGNAL') {
    if (this.primary === 'CONSENSUS') {
      return this.runConsensus(marketData, portfolio, type);
    }

    if (this.primary === 'GEMINI' && gemini.apiKeyPresent) {
      return gemini.makeDecision(marketData, portfolio, type);
    }

    // Default to Claude
    return claude.makeDecision(marketData, portfolio, type);
  }

  /**
   * Consensus Mode: Both AI models debate and reach a final decision
   */
  async runConsensus(marketData, portfolio, type) {
    const [claudeResult, geminiResult] = await Promise.all([
      claude.makeDecision(marketData, portfolio, type),
      gemini.makeDecision(marketData, portfolio, type)
    ]);

    // If both agree on action
    if (claudeResult.decision_type === geminiResult.decision_type && claudeResult.decision_type !== 'HOLD') {
      return {
        ...claudeResult,
        reasoning: `CONSENSUS REACHED: Claude and Gemini both recommend ${claudeResult.decision_type}. \nClaude: ${claudeResult.reasoning} \nGemini: ${geminiResult.reasoning}`,
        confidence: (claudeResult.confidence + geminiResult.confidence) / 2
      };
    }

    // Conflict resolution: pick the one with higher confidence
    if (claudeResult.confidence > geminiResult.confidence) {
      return {
        ...claudeResult,
        reasoning: `CONFLICT RESOLVED: Claude (${claudeResult.confidence}%) out-confidenced Gemini (${geminiResult.confidence}%). \nDecision: ${claudeResult.decision_type} \nReasoning: ${claudeResult.reasoning}`
      };
    } else {
      return {
        ...geminiResult,
        reasoning: `CONFLICT RESOLVED: Gemini (${geminiResult.confidence}%) out-confidenced Claude (${claudeResult.confidence}%). \nDecision: ${geminiResult.decision_type} \nReasoning: ${geminiResult.reasoning}`
      };
    }
  }
}

module.exports = new AIBrain();
