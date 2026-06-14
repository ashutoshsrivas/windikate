/* =====================================================================
 * Bedrock client · shared wrapper for Claude + Nova
 * ---------------------------------------------------------------------
 * Exposes:
 *
 *   await invokeText(prompt, opts)  → string (raw model output)
 *   await invokeJSON(prompt, opts)  → parsed first JSON block
 *   await converse(messages, opts)  → { text, usage }  (multi-turn)
 *
 * Provider routing:
 *   · Anthropic Claude — InvokeModel with anthropic_version payload
 *   · Amazon Nova      — Converse API (one unified schema)
 *
 * Auth resolution (tried in order):
 *   1) AWS_BEARER_TOKEN_BEDROCK · the new Bedrock API key (2025) →
 *      native fetch with `Authorization: Bearer …`. No SDK needed.
 *   2) SDK · classic SigV4 with IAM access key / role / shared creds.
 *
 * Honors the BEDROCK_ENABLED flag — when off (or AWS creds missing) it
 * throws BedrockDisabledError that callers catch to fall back to
 * deterministic logic.
 * ===================================================================== */

const { providerFor, DEFAULT_MODEL: REGISTRY_DEFAULT } = require('./modelRegistry');

/* When the primary model returns 429 / throttle / quota-exceeded, the
 * client transparently retries with the next model in this list. Each
 * model has its own daily token quota on Bedrock, so a chain of cheap →
 * mid-tier models means "AI offline" only happens when ALL of them are
 * exhausted. Admins can override via settings.model_fallback_chain. */
/* Note: the Nova family shares a single account-wide daily token quota,
 * so cycling micro → lite → pro doesn't actually buy you more headroom
 * when you're throttled. The chain still includes them in case AWS
 * splits the quotas later, but the primary fallback for real quota
 * relief is the Claude family — which currently requires a one-time
 * Anthropic Use-Case form submission on the Bedrock console. */
const DEFAULT_FALLBACK_CHAIN = [
    'us.amazon.nova-micro-v1:0',
    'us.amazon.nova-lite-v1:0',
    'us.amazon.nova-pro-v1:0',
    'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    'us.anthropic.claude-sonnet-4-5-20250929-v1:0'
];

function isQuotaError(err) {
    if (!err) return false;
    if (err.status === 429) return true;
    if (err.code === 'ThrottlingException' || err.code === 'ServiceQuotaExceededException') return true;
    const msg = String(err.message || '');
    return /\b(429|too many|throttl|quota|rate.?limit|service unavailable|503)\b/i.test(msg);
}

/* Resolve the chain starting from `head`. Reads settings.model_fallback_chain
 * if present (JSON array); otherwise uses DEFAULT_FALLBACK_CHAIN. The head
 * model is moved to position 0 and de-duplicated. */
async function resolveChain(head) {
    let chain = DEFAULT_FALLBACK_CHAIN;
    try {
        const settings = require('./settings');
        const fromAdmin = await settings.get('model_fallback_chain', null);
        if (Array.isArray(fromAdmin) && fromAdmin.length) chain = fromAdmin;
    } catch { /* settings unavailable — keep defaults */ }
    const seen = new Set([head]);
    const out = [head];
    for (const m of chain) {
        if (!seen.has(m)) { out.push(m); seen.add(m); }
    }
    return out;
}

const REGION     = process.env.AWS_REGION       || process.env.BEDROCK_REGION  || 'us-east-1';
const MODEL_ID   = process.env.BEDROCK_MODEL_ID || REGISTRY_DEFAULT;
const ENABLED    = String(process.env.BEDROCK_ENABLED || 'false').toLowerCase() === 'true';
const MAX_TOKENS = Number(process.env.BEDROCK_MAX_TOKENS) || 1600;

/* Lazy-load the SDK only on first invocation. */
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

function isAvailable() { return ENABLED; }

/* --------------------------------------------------------------------
 * Core single-turn invoker.
 * ------------------------------------------------------------------ */
async function invokeText(userPrompt, {
    system = '',
    maxTokens = MAX_TOKENS,
    temperature = 0.3,
    modelId = MODEL_ID,
    user_id = null,
    analysis_id = null,
    service = 'unknown'
} = {}) {
    if (!ENABLED) throw new BedrockDisabledError('BEDROCK_ENABLED is not true');

    const chain = await resolveChain(modelId);
    let lastErr;
    for (const tryModel of chain) {
        try {
            return await _invokeTextOnce(userPrompt, {
                system, maxTokens, temperature, modelId: tryModel,
                user_id, analysis_id, service
            });
        } catch (err) {
            lastErr = err;
            if (!isQuotaError(err)) throw err;
            console.warn(`[bedrock] ${tryModel} quota-exceeded (${err.status || err.code}) — trying next in chain`);
        }
    }
    throw lastErr;
}

async function _invokeTextOnce(userPrompt, {
    system, maxTokens, temperature, modelId, user_id, analysis_id, service
}) {
    const provider = providerFor(modelId);
    const bearer = process.env.AWS_BEARER_TOKEN_BEDROCK;
    const start = Date.now();
    let lastErr;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            let result;
            if (provider === 'anthropic') {
                const payload = {
                    anthropic_version: 'bedrock-2023-05-31',
                    max_tokens: maxTokens,
                    temperature,
                    system,
                    messages: [{ role: 'user', content: userPrompt }]
                };
                result = bearer
                    ? await invokeBedrockBearer(modelId, payload, '/invoke', parseAnthropicResponse)
                    : await invokeBedrockSdk(modelId, payload, parseAnthropicResponse);
            } else {
                /* Use the single-shot Converse path (no chain — already in the wrapper above) */
                result = await _converseOnce(
                    [{ role: 'user', content: userPrompt }],
                    { system, modelId, maxTokens, temperature }
                );
            }
            if (!result.text) throw new Error('Empty content from Bedrock');
            await logUsage({
                user_id, analysis_id, service, model_id: modelId,
                input_tokens:  result.usage?.input_tokens  || 0,
                output_tokens: result.usage?.output_tokens || 0,
                success: true, error_code: null,
                duration_ms: Date.now() - start
            });
            return result.text;
        } catch (err) {
            lastErr = err;
            // 1 retry on transient network/timeout — quota errors bubble straight up
            // so the fallback chain in invokeText can move to the next model.
            if (attempt === 1 && !isQuotaError(err) &&
                /Timeout|fetch failed|ECONN|ETIMEDOUT/i.test(err.name || err.message)) {
                await new Promise(r => setTimeout(r, 800));
                continue;
            }
            await logUsage({
                user_id, analysis_id, service, model_id: modelId,
                input_tokens: 0, output_tokens: 0,
                success: false,
                error_code: extractErrorCode(err),
                duration_ms: Date.now() - start
            });
            throw err;
        }
    }
    throw lastErr;
}

/* --------------------------------------------------------------------
 * Multi-turn Converse API (Nova family, also works for Claude on Bedrock).
 *
 * messages: [{ role: 'user'|'assistant', content: string }]
 * Returns { text, usage: { input_tokens, output_tokens } }
 * ------------------------------------------------------------------ */
async function converse(messages, {
    system = '',
    modelId = MODEL_ID,
    maxTokens = MAX_TOKENS,
    temperature = 0.3
} = {}) {
    if (!ENABLED) throw new BedrockDisabledError('BEDROCK_ENABLED is not true');

    const chain = await resolveChain(modelId);
    let lastErr;
    for (const tryModel of chain) {
        try {
            return await _converseOnce(messages, { system, modelId: tryModel, maxTokens, temperature });
        } catch (err) {
            lastErr = err;
            if (!isQuotaError(err)) throw err;
            console.warn(`[bedrock·converse] ${tryModel} quota-exceeded — trying next in chain`);
        }
    }
    throw lastErr;
}

/* Single-shot converse — handles both Anthropic and Nova families.
 * For Anthropic, we still use the native /invoke schema (Converse works
 * too, but /invoke supports system + multi-turn equivalently and is what
 * the existing prompts were tuned for). */
async function _converseOnce(messages, { system, modelId, maxTokens, temperature }) {
    const provider = providerFor(modelId);
    const bearer = process.env.AWS_BEARER_TOKEN_BEDROCK;

    if (provider === 'anthropic') {
        const payload = {
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: maxTokens,
            temperature,
            system,
            messages: messages.map(m => ({ role: m.role, content: m.content }))
        };
        return bearer
            ? invokeBedrockBearer(modelId, payload, '/invoke', parseAnthropicResponse)
            : invokeBedrockSdk(modelId, payload, parseAnthropicResponse);
    }

    /* Nova / generic Converse-API model */
    const payload = {
        messages: messages.map(m => ({
            role: m.role,
            content: [{ text: typeof m.content === 'string' ? m.content : String(m.content) }]
        })),
        inferenceConfig: { maxTokens, temperature }
    };
    if (system) payload.system = [{ text: system }];

    return bearer
        ? invokeBedrockBearer(modelId, payload, '/converse', parseConverseResponse)
        : invokeConverseSdk(modelId, payload);
}

/* --------------------------------------------------------------------
 * Generic Bedrock bearer-token fetch (works for both /invoke and /converse).
 * ------------------------------------------------------------------ */
async function invokeBedrockBearer(modelId, payload, suffix, parse) {
    const bearer = process.env.AWS_BEARER_TOKEN_BEDROCK;
    const url = `https://bedrock-runtime.${REGION}.amazonaws.com/model/${encodeURIComponent(modelId)}${suffix}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${bearer}`,
            'Content-Type':  'application/json',
            'Accept':        'application/json'
        },
        body: JSON.stringify(payload)
    });
    if (!res.ok) {
        const errText = (await res.text()).slice(0, 400);
        const err = new Error(`Bedrock ${res.status}: ${errText}`);
        err.status = res.status;
        throw err;
    }
    const body = await res.json();
    return parse(body);
}

/* InvokeModel SDK path (Anthropic) */
async function invokeBedrockSdk(modelId, payload, parse) {
    if (!_sdk) _sdk = require('@aws-sdk/client-bedrock-runtime');
    const cmd = new _sdk.InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload)
    });
    const res = await client().send(cmd);
    const body = JSON.parse(new TextDecoder().decode(res.body));
    return parse(body);
}

/* Converse SDK path (Nova) */
async function invokeConverseSdk(modelId, payload) {
    if (!_sdk) _sdk = require('@aws-sdk/client-bedrock-runtime');
    const cmd = new _sdk.ConverseCommand({ modelId, ...payload });
    const res = await client().send(cmd);
    return parseConverseResponse(res);
}

/* ----- Response parsers ------------------------------------------- */

function parseAnthropicResponse(body) {
    return {
        text:  (body.content || []).map(p => p.text).filter(Boolean).join('\n'),
        usage: {
            input_tokens:  body.usage?.input_tokens  || 0,
            output_tokens: body.usage?.output_tokens || 0
        }
    };
}

function parseConverseResponse(body) {
    const content = body.output?.message?.content || [];
    return {
        text:  content.map(p => p.text || '').filter(Boolean).join('\n'),
        usage: {
            input_tokens:  body.usage?.inputTokens  || 0,
            output_tokens: body.usage?.outputTokens || 0
        }
    };
}

/* ----- Usage logging + error extraction --------------------------- */

async function logUsage(args) {
    try {
        const usage = require('./usage');
        await usage.record(args);
    } catch (logErr) {
        console.warn('[bedrockClient] usage log failed:', logErr.message);
    }
}

function extractErrorCode(err) {
    if (err.status) return String(err.status);
    if (err.name && err.name !== 'Error') return err.name;
    const m = /\b([A-Za-z]+Exception)\b/.exec(err.message || '');
    return m ? m[1] : null;
}

/* --------------------------------------------------------------------
 * JSON convenience — same call, parses the first JSON value out of the
 * response. Tries fenced blocks first, then plain inline JSON.
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
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
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
                    try { return JSON.parse(text.slice(start, i + 1)); } catch {}
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
    converse,
    isAvailable,
    BedrockDisabledError,
    MODEL_ID,
    REGION
};
