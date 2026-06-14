/* =====================================================================
 * Bedrock client · shared wrapper around @aws-sdk/client-bedrock-runtime
 * ---------------------------------------------------------------------
 * Exposes two helpers used by the intelligence-layer services:
 *
 *   await invokeText(prompt, opts)
 *     · returns the model's response as a plain string
 *
 *   await invokeJSON(prompt, opts)
 *     · same call, but parses out the first JSON block in the response
 *       (Claude often wraps JSON in ```json fences or prose)
 *
 * Both honour the BEDROCK_ENABLED flag — when it's off (or AWS creds
 * are missing) they throw a sentinel error that callers catch to fall
 * back to deterministic logic.
 * ===================================================================== */

const REGION     = process.env.AWS_REGION       || process.env.BEDROCK_REGION  || 'us-east-1';
const MODEL_ID   = process.env.BEDROCK_MODEL_ID || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';
const ENABLED    = String(process.env.BEDROCK_ENABLED || 'false').toLowerCase() === 'true';
const MAX_TOKENS = Number(process.env.BEDROCK_MAX_TOKENS) || 1600;

/* Lazy-load the SDK only on first invocation. That way the app boots
 * even if @aws-sdk/client-bedrock-runtime isn't installed yet (mock
 * fallback still works).
 *
 * SDK credential resolution order:
 *   1) AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY env vars
 *   2) Shared credentials file (~/.aws/credentials)
 *   3) EC2 instance metadata role (production-recommended)
 */
let _sdk = null;
let _client = null;
function client() {
    if (!_client) {
        if (!_sdk) _sdk = require('@aws-sdk/client-bedrock-runtime');
        _client = new _sdk.BedrockRuntimeClient({ region: REGION });
    }
    return _client;
}

class BedrockDisabledError extends Error {
    constructor(reason) {
        super(reason || 'Bedrock is not enabled');
        this.code = 'BEDROCK_DISABLED';
    }
}

function isAvailable() {
    return ENABLED;
}

/* --------------------------------------------------------------------
 * Core invoker. Returns the model's raw text response.
 * Retries once on transient throttling / timeout.
 * ------------------------------------------------------------------ */
async function invokeText(userPrompt, {
    system = '',
    maxTokens = MAX_TOKENS,
    temperature = 0.3,
    modelId = MODEL_ID
} = {}) {
    if (!ENABLED) throw new BedrockDisabledError('BEDROCK_ENABLED is not true');

    const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: 'user', content: userPrompt }]
    };

    const sdk = (_sdk = _sdk || require('@aws-sdk/client-bedrock-runtime'));
    const cmd = new sdk.InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload)
    });

    let lastErr;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            const res = await client().send(cmd);
            const body = JSON.parse(new TextDecoder().decode(res.body));
            const text = (body.content || [])
                .map(part => part.text)
                .filter(Boolean)
                .join('\n');
            if (!text) throw new Error('Empty content from Bedrock');
            return text;
        } catch (err) {
            lastErr = err;
            // Retry once on throttling / transient failures
            if (attempt === 1 && /ThrottlingException|ServiceUnavailable|TimeoutError/i.test(err.name || err.message)) {
                await new Promise(r => setTimeout(r, 800));
                continue;
            }
            throw err;
        }
    }
    throw lastErr;
}

/* --------------------------------------------------------------------
 * Same call but parses the first JSON value out of the response.
 * Tries fenced blocks first, then plain inline JSON.
 * ------------------------------------------------------------------ */
async function invokeJSON(prompt, opts = {}) {
    const text = await invokeText(prompt, opts);
    const json = extractJSON(text);
    if (json == null) {
        const err = new Error('Bedrock response did not contain valid JSON');
        err.responseText = text;
        throw err;
    }
    return json;
}

function extractJSON(text) {
    // 1) Fenced ```json … ```
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced) {
        try { return JSON.parse(fenced[1]); } catch { /* fall through */ }
    }
    // 2) First balanced [...] or {...} block
    const start = text.search(/[\[{]/);
    if (start >= 0) {
        const open = text[start];
        const close = open === '[' ? ']' : '}';
        let depth = 0;
        for (let i = start; i < text.length; i++) {
            if (text[i] === open)  depth++;
            if (text[i] === close) {
                depth--;
                if (depth === 0) {
                    try { return JSON.parse(text.slice(start, i + 1)); } catch { /* fall through */ }
                    break;
                }
            }
        }
    }
    return null;
}

module.exports = {
    invokeText,
    invokeJSON,
    isAvailable,
    BedrockDisabledError,
    MODEL_ID,
    REGION
};
