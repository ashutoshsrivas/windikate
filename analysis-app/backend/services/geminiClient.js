/* =====================================================================
 * geminiClient · Google Generative AI client (Gemini + Gemma)
 * ---------------------------------------------------------------------
 * Drop-in alternative provider for when AWS Bedrock is rate-limited.
 * Speaks Google's generateContent API. Free tier (1500 req/day, no card)
 * is plenty for SAMAJ chat, group discussion and Apercept.
 *
 * Key resolution order:
 *   1. settings.google_api_key   (admin-managed via /admin/settings)
 *   2. process.env.GEMINI_API_KEY
 *
 * Same return shape as bedrockClient so the dispatcher upstream doesn't
 * have to know which provider answered:
 *     invokeText(...)  → string
 *     converse(...)    → { text, usage: { input_tokens, output_tokens } }
 *
 * Logs every call to usage_events with service prefix 'google.*' so the
 * /admin/usage feed treats it uniformly with Bedrock calls.
 * ===================================================================== */

const settings = require('./settings');

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';

async function isAvailable() {
    const key = (await settings.get('google_api_key', null)) || process.env.GEMINI_API_KEY;
    return !!key;
}

async function getKey() {
    const key = (await settings.get('google_api_key', null)) || process.env.GEMINI_API_KEY;
    if (!key) {
        const err = new Error('Google API key not configured');
        err.code = 'GEMINI_NO_KEY';
        throw err;
    }
    return key;
}

/* Map our registry IDs (e.g. 'google.gemini-2.0-flash') to the bare
 * Google model name used in the URL. */
function googleModelName(id) {
    return String(id).replace(/^google\./, '');
}

/* --------------------------------------------------------------------
 * Single-turn text invocation. Same opts shape as bedrockClient.invokeText
 * so callers don't have to branch on provider.
 * ------------------------------------------------------------------ */
async function invokeText(prompt, {
    system = '',
    maxTokens = 1600,
    temperature = 0.3,
    modelId,
    user_id = null,
    analysis_id = null,
    service = 'unknown'
} = {}) {
    const key   = await getKey();
    const model = googleModelName(modelId);
    const url   = `${ENDPOINT}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

    const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
            maxOutputTokens: maxTokens,
            temperature
        }
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const start = Date.now();
    let resJson, lastErr;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) {
            const errText = (await res.text()).slice(0, 400);
            const err = new Error(`Gemini ${res.status}: ${errText}`);
            err.status = res.status;
            throw err;
        }
        resJson = await res.json();
    } catch (err) {
        lastErr = err;
        await logUsage({
            user_id, analysis_id, service, model_id: modelId,
            input_tokens: 0, output_tokens: 0,
            success: false, error_code: extractErrorCode(err),
            duration_ms: Date.now() - start
        });
        throw err;
    }

    const text  = extractText(resJson);
    const usage = extractUsage(resJson);
    if (!text) {
        const err = new Error('Empty content from Gemini');
        await logUsage({
            user_id, analysis_id, service, model_id: modelId,
            input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
            success: false, error_code: 'EMPTY',
            duration_ms: Date.now() - start
        });
        throw err;
    }

    await logUsage({
        user_id, analysis_id, service, model_id: modelId,
        input_tokens:  usage.input_tokens,
        output_tokens: usage.output_tokens,
        success: true, error_code: null,
        duration_ms: Date.now() - start
    });
    return text;
}

/* --------------------------------------------------------------------
 * Multi-turn converse. Maps our { role: user|assistant, content: str }
 * shape onto Google's { role: user|model, parts: [{text}] }.
 * ------------------------------------------------------------------ */
async function converse(messages, {
    system = '',
    modelId,
    maxTokens = 1600,
    temperature = 0.3
} = {}) {
    const key   = await getKey();
    const model = googleModelName(modelId);
    const url   = `${ENDPOINT}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

    const body = {
        contents: messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: typeof m.content === 'string' ? m.content : String(m.content) }]
        })),
        generationConfig: {
            maxOutputTokens: maxTokens,
            temperature
        }
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const errText = (await res.text()).slice(0, 400);
        const err = new Error(`Gemini ${res.status}: ${errText}`);
        err.status = res.status;
        throw err;
    }
    const data = await res.json();
    return {
        text:  extractText(data),
        usage: extractUsage(data)
    };
}

/* ----- helpers ---------------------------------------------------- */

function extractText(resJson) {
    const cands = resJson?.candidates || [];
    if (!cands.length) return '';
    const parts = cands[0]?.content?.parts || [];
    return parts.map(p => p.text || '').filter(Boolean).join('\n').trim();
}

function extractUsage(resJson) {
    const u = resJson?.usageMetadata || {};
    return {
        input_tokens:  Number(u.promptTokenCount     || 0),
        output_tokens: Number(u.candidatesTokenCount || 0)
    };
}

function extractErrorCode(err) {
    if (err.status) return String(err.status);
    if (err.code)   return String(err.code);
    return 'unknown';
}

async function logUsage(args) {
    try {
        const usage = require('./usage');
        await usage.record(args);
    } catch (logErr) {
        console.warn('[geminiClient] usage log failed:', logErr.message);
    }
}

module.exports = { invokeText, converse, isAvailable };
