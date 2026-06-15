/* =====================================================================
 * Bedrock model registry + pricing
 * ---------------------------------------------------------------------
 * Single source of truth for which models Windikate exposes via Bedrock,
 * what they cost, and how fast they are.
 *
 * Two model families are supported:
 *   · Anthropic Claude — invoke schema "anthropic_version: bedrock-2023-05-31"
 *   · Amazon Nova     — invoke schema (Bedrock Converse API uses one shape)
 *
 * Default is Amazon Nova Micro — the cheapest model on Bedrock at the time
 * of writing (~10x cheaper than Claude Haiku) and plenty for SAMAJ
 * persona role-play and Apercept simulation.
 *
 * Prices in USD per 1 000 000 tokens (Bedrock published rates).
 * Update this file when AWS revises pricing or new models ship.
 * ===================================================================== */

const MODELS = {
    // ─── Amazon Nova — cheapest, fastest, default for SAMAJ ─────────────
    'us.amazon.nova-micro-v1:0': {
        label:    'Amazon Nova Micro',
        provider: 'amazon',
        tier:     'budget',
        speed:    'very fast',
        inputPer1M:  0.035,
        outputPer1M: 0.14,
        context:  128000,
        good_for: 'Cheapest, fastest path. SAMAJ persona chat, group discussion, default for all services.'
    },
    'us.amazon.nova-lite-v1:0': {
        label:    'Amazon Nova Lite',
        provider: 'amazon',
        tier:     'cheap',
        speed:    'very fast',
        inputPer1M:  0.06,
        outputPer1M: 0.24,
        context:  300000,
        good_for: 'Multimodal + long context. Use when you need image input or 200k+ tokens.'
    },
    'us.amazon.nova-pro-v1:0': {
        label:    'Amazon Nova Pro',
        provider: 'amazon',
        tier:     'balanced',
        speed:    'fast',
        inputPer1M:  0.80,
        outputPer1M: 3.20,
        context:  300000,
        good_for: 'Higher-quality Nova. Use for memos when Sonnet is too pricey.'
    },

    // ─── Anthropic Claude — quality tier ────────────────────────────────
    'us.anthropic.claude-3-5-haiku-20241022-v1:0': {
        label:    'Claude 3.5 Haiku',
        provider: 'anthropic',
        tier:     'cheap',
        speed:    'fast',
        inputPer1M:  0.80,
        outputPer1M: 4.00,
        context:  200000,
        good_for: 'Fast Claude. Good fallback when Nova quality is insufficient.'
    },
    'us.anthropic.claude-haiku-4-5-20250929-v1:0': {
        label:    'Claude Haiku 4.5',
        provider: 'anthropic',
        tier:     'cheap',
        speed:    'fast',
        inputPer1M:  1.00,
        outputPer1M: 5.00,
        context:  200000,
        good_for: 'Latest-generation Haiku. Improved reasoning at modest cost.'
    },
    'us.anthropic.claude-3-5-sonnet-20241022-v2:0': {
        label:    'Claude 3.5 Sonnet v2',
        provider: 'anthropic',
        tier:     'balanced',
        speed:    'medium',
        inputPer1M:  3.00,
        outputPer1M: 15.00,
        context:  200000,
        good_for: 'Balanced reasoning. Good for memos.'
    },
    'us.anthropic.claude-sonnet-4-5-20250929-v1:0': {
        label:    'Claude Sonnet 4.5',
        provider: 'anthropic',
        tier:     'premium',
        speed:    'medium',
        inputPer1M:  3.00,
        outputPer1M: 15.00,
        context:  200000,
        good_for: 'Best balance. Recommended for memo generation when budget allows.'
    },

    // ─── Google Gemini & Gemma — non-Bedrock provider ──────────────────
    // Free tier: 1500 req/day, no credit card required. Get a key at
    // https://aistudio.google.com — paste into /admin/settings.
    'google.gemini-2.0-flash': {
        label:    'Gemini 2.0 Flash',
        provider: 'google',
        tier:     'budget',
        speed:    'very fast',
        inputPer1M:  0.10,
        outputPer1M: 0.40,
        context:  1000000,
        good_for: 'Free 1500/day on Google AI Studio. Use when Bedrock is throttled. 1M context, multimodal.'
    },
    'google.gemini-1.5-flash': {
        label:    'Gemini 1.5 Flash',
        provider: 'google',
        tier:     'budget',
        speed:    'very fast',
        inputPer1M:  0.075,
        outputPer1M: 0.30,
        context:  1000000,
        good_for: 'Cheaper, stable Gemini. Free tier identical to 2.0.'
    },
    'google.gemma-3-27b-it': {
        label:    'Gemma 3 27B',
        provider: 'google',
        tier:     'cheap',
        speed:    'fast',
        inputPer1M:  0.0,
        outputPer1M: 0.0,
        context:  128000,
        good_for: 'Google\'s open-weight model. Free on AI Studio. Smaller than Gemini Flash but no usage cost.'
    }
};

/* Cheapest by default — Nova Micro. */
const DEFAULT_MODEL = 'us.amazon.nova-micro-v1:0';

function listModels() {
    return Object.entries(MODELS).map(([id, m]) => ({ id, ...m }));
}

/* Most registry keys carry the 'us.' prefix; live Bedrock calls can come
 * in with eu./apac. variants too — strip and re-add 'us.' for the lookup.
 * Non-Bedrock providers (google.*) keep their own prefix and don't get
 * rewritten. */
function canonicalKey(id) {
    if (!id) return id;
    if (/^google\./.test(id))    return id;
    if (/^(openai|groq)\./.test(id)) return id;
    const stripped = String(id).replace(/^(us|eu|apac)\./, '');
    return 'us.' + stripped;
}

function getModel(id) {
    const key = canonicalKey(id);
    return MODELS[key] ? { id, ...MODELS[key] } : null;
}

function providerFor(modelId) {
    const key = canonicalKey(modelId);
    return (MODELS[key] || MODELS[DEFAULT_MODEL]).provider;
}

/* Returns cost in **integer cents** (so we can sum without float drift). */
function calcCostCents(modelId, inputTokens, outputTokens) {
    const key = canonicalKey(modelId);
    const m = MODELS[key] || MODELS[DEFAULT_MODEL];
    const inputDollars  = (inputTokens  / 1_000_000) * m.inputPer1M;
    const outputDollars = (outputTokens / 1_000_000) * m.outputPer1M;
    return {
        input_cost_cents:  Math.round(inputDollars  * 100),
        output_cost_cents: Math.round(outputDollars * 100),
        total_cost_cents:  Math.round((inputDollars + outputDollars) * 100)
    };
}

module.exports = { listModels, getModel, providerFor, calcCostCents, DEFAULT_MODEL, MODELS };
