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

    const provider = providerFor(modelId);
    const bearer = process.env.AWS_BEARER_TOKEN_BEDROCK;

    const start = Date.now();
    let lastErr;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            let result;
            if (provider === 'anthropic') {
                /* Anthropic native payload via InvokeModel */
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
                /* Nova (and any future Converse-only model) uses Converse */
                result = await converse(
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
            if (attempt === 1 && /Throttl|ServiceUnavailable|Timeout|fetch failed|ECONN|ETIMEDOUT/i.test(err.name || err.message)) {
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

    const payload = {
        messages: messages.map(m => ({
            role: m.role,
            content: [{ text: typeof m.content === 'string' ? m.content : String(m.content) }]
        })),
        inferenceConfig: { maxTokens, temperature }
    };
    if (system) payload.system = [{ text: system }];

    const bearer = process.env.AWS_BEARER_TOKEN_BEDROCK;
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
