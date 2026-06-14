/* =====================================================================
 * samajChat · 1:1 conversation engine for an approved persona
 * ---------------------------------------------------------------------
 * Loads the persona's compiled system_prompt_md + the last N turns from
 * simulation_messages, sends a Converse call to Bedrock (cheapest model
 * by default — Nova Micro), persists both the user message and the
 * persona's reply, and returns the new message rows.
 *
 *  reply({ session, persona, userMessage, user_id })
 *      → { user_message, persona_message }
 *
 * Honors the global samaj_simulation_paused flag. When Bedrock is
 * disabled or errors, the persona_message is stored with an "AI offline"
 * marker so the conversation thread stays consistent.
 * ===================================================================== */

const { query, insert } = require('../db/pool');
const bedrock  = require('./bedrockClient');
const settings = require('./settings');
const { DEFAULT_MODEL } = require('./modelRegistry');

const HISTORY_TURNS = 16;     // last N messages fed back into Converse

async function assertNotPaused() {
    const paused = await settings.get('samaj_simulation_paused', false);
    if (paused) {
        const err = new Error('SAMAJ simulation is paused by an administrator');
        err.status = 503; err.code = 'SAMAJ_PAUSED';
        throw err;
    }
}

async function reply({ session, persona, userMessage, user_id }) {
    await assertNotPaused();
    const modelId = await settings.get('samaj_persona_model', DEFAULT_MODEL);

    // Persist user message first so it's never lost on AI failure.
    const userId = await insert(
        `INSERT INTO simulation_messages (session_id, persona_id, speaker, content, phase)
         VALUES (:sid, NULL, 'user', :c, 'user')`,
        { sid: session.id, c: userMessage }
    );

    // Build the Converse messages array from history + this turn.
    const history = await query(
        `SELECT speaker, content
           FROM simulation_messages
          WHERE session_id = :sid
          ORDER BY id ASC
          LIMIT :n`,
        { sid: session.id, n: HISTORY_TURNS * 2 }
    );
    const messages = [];
    for (const m of history) {
        const role = m.speaker === 'user' ? 'user' : 'assistant';
        messages.push({ role, content: m.content });
    }
    // Last row is the just-inserted user turn, included above. Ensure we have at least one user turn.
    if (!messages.length || messages[messages.length - 1].role !== 'user') {
        messages.push({ role: 'user', content: userMessage });
    }

    let replyText;
    let aiUsed = false, errorCode = null;
    try {
        const out = await bedrock.converse(messages, {
            system: buildSystem(persona),
            modelId,
            maxTokens: 600,
            temperature: 0.7
        });
        replyText = (out.text || '').trim();
        if (!replyText) throw new Error('Empty reply');
        aiUsed = true;
    } catch (err) {
        errorCode = err.code || (err.status && String(err.status)) || 'ai_error';
        replyText = buildOfflineReply(persona, err);
    }

    const replyId = await insert(
        `INSERT INTO simulation_messages
            (session_id, persona_id, speaker, content, phase, meta)
         VALUES (:sid, :pid, :speaker, :c, :phase, :meta)`,
        {
            sid: session.id,
            pid: persona.id,
            speaker: persona.display_name,
            c: replyText,
            phase: aiUsed ? 'ai' : 'offline',
            meta: JSON.stringify({ model_id: modelId, ai_used: aiUsed, error_code: errorCode })
        }
    );

    return {
        user_message:    { id: userId,  speaker: 'user',                content: userMessage },
        persona_message: { id: replyId, speaker: persona.display_name,  content: replyText, ai_used: aiUsed, error_code: errorCode }
    };
}

function buildSystem(persona) {
    return [
        `You are ${persona.display_name}. Speak only as them.`,
        persona.headline ? `Headline: ${persona.headline}` : null,
        '',
        '--- Persona profile ---',
        persona.system_prompt_md || '',
        '',
        '--- Voice rules ---',
        '- Stay in character at every turn.',
        '- Respond in 2–6 sentences unless the user explicitly asks for more.',
        '- Where you do not know something, speculate as this person plausibly would.',
        '- Do not break the fourth wall, do not say you are an AI.',
        '- Maintain the values, vocabulary, and tone implied by the profile above.'
    ].filter(Boolean).join('\n');
}

function buildOfflineReply(persona, err) {
    const code = err?.code || (err?.status && String(err.status)) || 'unknown';
    return [
        `[${persona.display_name} · AI offline — ${code}]`,
        'The model used to voice this twin is currently unavailable',
        '(usually a daily quota reset is needed).',
        'The conversation has been recorded; try again shortly.'
    ].join(' ');
}

module.exports = { reply, assertNotPaused };
