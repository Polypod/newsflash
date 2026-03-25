const Anthropic = require('@anthropic-ai/sdk');
const config = require('../config/env');
const logger = require('../utils/logger');

let _client = null;
function getClient() {
  if (!_client) {
    _client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return _client;
}

const SCORE_TOOL = {
  name: 'score_headline',
  description: 'Score a news headline for geopolitical and security criticality.',
  input_schema: {
    type: 'object',
    properties: {
      score: {
        type: 'integer',
        minimum: 0,
        maximum: 100,
        description: 'Criticality score 0-100. 0=irrelevant, 100=immediate global crisis.',
      },
      reason: {
        type: 'string',
        description: 'One plain-English sentence explaining the score.',
      },
    },
    required: ['score', 'reason'],
  },
};

const PROMPT = (title, description) =>
  `Rate this news headline for geopolitical and security criticality (0–100).

Consider: direct military conflict or escalation, state actor involvement,
infrastructure or energy sector impact, humanitarian crisis, geopolitical alliance shifts.

Title: ${title}
Description: ${description || '(none)'}`;

async function scoreHeadline(title, description) {
  if (!config.anthropicApiKey) {
    logger.warn('ANTHROPIC_API_KEY not set — skipping headline scoring');
    return { score: null, reason: null };
  }

  try {
    const client = getClient();
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      tools: [SCORE_TOOL],
      tool_choice: { type: 'tool', name: 'score_headline' },
      messages: [{ role: 'user', content: PROMPT(title, description) }],
    });

    const toolUse = response.content.find((b) => b.type === 'tool_use' && b.name === 'score_headline');
    if (!toolUse) {
      logger.warn('scoreHeadline: no tool_use block in response');
      return { score: 50, reason: 'Scoring unavailable' };
    }

    return { score: toolUse.input.score, reason: toolUse.input.reason };
  } catch (err) {
    logger.error(`scoreHeadline failed: ${err.message}`);
    return { score: null, reason: null };
  }
}

module.exports = { scoreHeadline };
