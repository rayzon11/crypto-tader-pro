// Claude Chat Controller — gives Claude Opus real tool-use control over the trading system.
// Used by POST /api/claude/chat. Claude can inspect state and actually start/stop/reset the trader.

'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const autonomousTrader = require('./autonomousTrader');
const predictionAgent = require('./predictionAgent');
const { getAllStatus } = require('../agents');

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-5-20250929';
const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
const client = apiKey ? new Anthropic({ apiKey }) : null;

const SYSTEM_PROMPT = `You are CLAUDE-OPUS, master trader and CEO of a 27-agent autonomous crypto trading system.

You have REAL control over the system via the tools below. The user ("admin") speaks to you directly.

Your capabilities:
- Read the live trader snapshot (P&L, positions, trades, feed)
- Start, stop, reset the autonomous trader
- Switch between DEMO and LIVE mode (be cautious with LIVE — confirm first)
- Query live prediction matrices (8 timeframes) for any crypto pair
- Inspect the status of all 27 agents

Behavior:
- Be concise and decisive. Speak like an institutional trader, not a chatbot.
- When the admin asks "start trading" or similar — CALL THE TOOL. Don't just describe what you would do.
- When asked for analysis, fetch the prediction matrix, then summarize: signal, confidence, R:R, key timeframes in agreement.
- After every action, report exactly what you did and the new state.
- If the admin requests LIVE mode, warn about real-money risk but execute if they confirm.
- Keep replies under 200 words unless the admin explicitly asks for deep analysis.

You are not simulating. These tools actually move money in the user's account.`;

const TOOLS = [
  {
    name: 'get_trader_status',
    description: 'Returns the autonomous trader snapshot: mode, balance, realized/unrealized P&L, win rate, open positions, recent trades, and the live feed.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'start_trader',
    description: 'Starts the autonomous trading agent. It will begin scanning BTC/ETH/SOL/XRP every 5 seconds and opening positions that meet ≥75% confidence and ≥2:1 R:R.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'stop_trader',
    description: 'Stops the autonomous trading agent. Existing open positions are left untouched — they continue to hit SL/TP.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'reset_trader',
    description: 'Stops the trader and resets the account to $1000 starting balance, clearing all trades and positions. DESTRUCTIVE — confirm before calling.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'set_trader_mode',
    description: 'Switches trader mode. DEMO = paper trading. LIVE = real money on connected exchange. Warn user before switching to LIVE.',
    input_schema: {
      type: 'object',
      properties: { mode: { type: 'string', enum: ['DEMO', 'LIVE'] } },
      required: ['mode'],
    },
  },
  {
    name: 'get_prediction',
    description: 'Returns the live 8-timeframe prediction matrix for a crypto pair, including signal, confidence, TP1/TP2/SL, R:R, and supporting indicators.',
    input_schema: {
      type: 'object',
      properties: {
        base: { type: 'string', description: 'Base currency, e.g. BTC, ETH, SOL' },
        quote: { type: 'string', description: 'Quote currency, usually USDT' },
        timeframe: { type: 'string', description: 'Optional. One of 1m,5m,15m,30m,1h,4h,1d,1w. Omit to get all.' },
      },
      required: ['base', 'quote'],
    },
  },
  {
    name: 'get_agents_status',
    description: 'Returns the status of all 27 agents in the system — which are active, their win rates, decision counts, and most recent decision.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
];

function runTool(name, input) {
  try {
    switch (name) {
      case 'get_trader_status':
        return autonomousTrader.snapshot();
      case 'start_trader':
        return autonomousTrader.start();
      case 'stop_trader':
        return autonomousTrader.stop();
      case 'reset_trader':
        return autonomousTrader.reset();
      case 'set_trader_mode':
        return autonomousTrader.setMode(String(input?.mode || '').toUpperCase());
      case 'get_prediction': {
        const sym = `${input.base}/${input.quote}`.toUpperCase();
        if (input.timeframe) {
          return predictionAgent.analyzePair(sym, input.timeframe) || { error: 'No data for that timeframe' };
        }
        const tfs = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
        const matrix = {};
        for (const tf of tfs) matrix[tf] = predictionAgent.analyzePair(sym, tf);
        return { symbol: sym, matrix };
      }
      case 'get_agents_status':
        return getAllStatus();
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Runs the agentic loop: user msg → Claude → (tool_use)* → final text reply.
 * @param {string} message
 * @param {Array<{role:string,content:any}>} history prior turns (already in Anthropic format)
 * @returns {Promise<{reply:string, toolCalls:Array, history:Array}>}
 */
async function chat(message, history = []) {
  if (!client) {
    return {
      reply: '⚠ Claude API key not configured. Set CLAUDE_API_KEY or ANTHROPIC_API_KEY env var and restart. Running in mock mode — cannot control the trader.',
      toolCalls: [],
      history,
    };
  }

  const messages = [...history, { role: 'user', content: message }];
  const toolCalls = [];
  let iterations = 0;

  while (iterations++ < 8) {
    let response;
    try {
      response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      });
    } catch (err) {
      return { reply: `✖ Claude API error: ${err.message}`, toolCalls, history: messages };
    }

    // Append Claude's turn
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'tool_use') {
      const toolUses = response.content.filter(b => b.type === 'tool_use');
      const toolResults = toolUses.map(tu => {
        const out = runTool(tu.name, tu.input);
        toolCalls.push({ name: tu.name, input: tu.input, output: out });
        return {
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(out).slice(0, 6000),
        };
      });
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    // end_turn
    const textBlock = response.content.find(b => b.type === 'text');
    return {
      reply: textBlock?.text || '(no response)',
      toolCalls,
      history: messages,
    };
  }

  return { reply: '(max iterations reached)', toolCalls, history: messages };
}

module.exports = { chat };
