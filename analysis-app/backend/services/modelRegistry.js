/* =====================================================================
 * Bedrock model registry + pricing
 * ---------------------------------------------------------------------
 * Single source of truth for which Anthropic models Windikate exposes
 * via Bedrock, what they cost, and how fast they are.
 * Prices in USD per 1 000 000 tokens (Bedrock published rates).
 * Update this file when AWS revises pricing or new models ship.
 * ===================================================================== */

const MODELS = {
    'us.anthropic.claude-3-5-haiku-20241022-v1:0': {
        label:    'Claude 3.5 Haiku',
        tier:     'cheap',
        speed:    'fast',
        inputPer1M:  0.80,
        outputPer1M: 4.00,
        context:  200000,
        good_for: 'Fast, low-cost text generation. Default for question generator.'
    },
    'us.anthropic.claude-3-5-sonnet-20241022-v2:0': {
        label:    'Claude 3.5 Sonnet v2',
        tier:     'balanced',
        speed:    'medium',
        inputPer1M:  3.00,
        outputPer1M: 15.00,
        context:  200000,
        good_for: 'Balanced reasoning. Good for memos.'
    },
    'us.anthropic.claude-sonnet-4-5-20250929-v1:0': {
        label:    'Claude Sonnet 4.5',
        tier:     'balanced',
        speed:    'medium',
        inputPer1M:  3.00,
        outputPer1M: 15.00,
        context:  200000,
        good_for: 'Best balance. Recommended for production once quotas allow.'
    },
    'us.anthropic.claude-haiku-4-5-20250929-v1:0': {
        label:    'Claude Haiku 4.5',
        tier:     'cheap',
        speed:    'fast',
        inputPer1M:  1.00,
        outputPer1M: 5.00,
        context:  200000,
        good_for: 'Cheap and fast on the latest generation.'
    }
};

const DEFAULT_MODEL = 'us.anthropic.claude-3-5-haiku-20241022-v1:0';

function listModels() {
    return Object.entries(MODELS).map(([id, m]) => ({ id, ...m }));
}

function getModel(id) {
    return MODELS[id] ? { id, ...MODELS[id] } : null;
}

/* Returns cost in **integer cents** (so we can sum without float drift). */
function calcCostCents(modelId, inputTokens, outputTokens) {
    const m = MODELS[modelId] || MODELS[DEFAULT_MODEL];
    const inputDollars  = (inputTokens  / 1_000_000) * m.inputPer1M;
    const outputDollars = (outputTokens / 1_000_000) * m.outputPer1M;
    return {
        input_cost_cents:  Math.round(inputDollars  * 100),
        output_cost_cents: Math.round(outputDollars * 100),
        total_cost_cents:  Math.round((inputDollars + outputDollars) * 100)
    };
}

module.exports = { listModels, getModel, calcCostCents, DEFAULT_MODEL, MODELS };
