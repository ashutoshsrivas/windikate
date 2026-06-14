/* =====================================================================
 * samajDiscussion · group prompt → personal views → cross-talk → synthesis
 * ---------------------------------------------------------------------
 * Three-phase group simulation:
 *   1. Personal views   — each persona answers the prompt in private (parallel)
 *   2. Cross-talk       — each persona reacts to the others' views (parallel)
 *   3. Synthesis        — one combined "consensus" message summarising
 *                         agreement, disagreement, and what would change
 *                         each twin's mind
 *
 * All messages are persisted to simulation_messages with `phase`
 * tagging the stage. Returns the assembled transcript.
 *
 * Honors the global pause flag via samajChat.assertNotPaused.
 * ===================================================================== */

const { query, queryOne, insert, update } = require('../db/pool');
const bedrock   = require('./bedrockClient');
const settings  = require('./settings');
const samajChat = require('./samajChat');
const { DEFAULT_MODEL } = require('./modelRegistry');

async function runDiscussion({ session, personas, prompt, user_id }) {
    await samajChat.assertNotPaused();
    const modelId = await settings.get('samaj_persona_model', DEFAULT_MODEL);

    // Phase 0 · store the moderator prompt
    await insert(
        `INSERT INTO simulation_messages
            (session_id, persona_id, speaker, content, phase)
         VALUES (:sid, NULL, 'moderator', :c, 'prompt')`,
        { sid: session.id, c: prompt }
    );

    // Phase 1 · personal views (parallel)
    const personalViews = await Promise.all(personas.map(async (p) => {
        const out = await safeConverse(modelId, p, [
            { role: 'user', content:
                `Question for you: ${prompt}\n\n` +
                `Share your honest first reaction in 3–6 sentences. Speak as yourself, ` +
                `with the values and vocabulary of your profile. Do not be polite for its own sake.`
            }
        ]);
        await insert(
            `INSERT INTO simulation_messages
                (session_id, persona_id, speaker, content, phase, meta)
             VALUES (:sid, :pid, :spk, :c, 'personal_view', :meta)`,
            { sid: session.id, pid: p.id, spk: p.display_name, c: out.text,
              meta: JSON.stringify({ model_id: modelId, ai_used: out.ai_used, error_code: out.error_code }) }
        );
        return { persona: p, view: out.text };
    }));

    // Phase 2 · cross-talk
    const others = (self) => personalViews
        .filter(v => v.persona.id !== self.persona.id)
        .map(v => `- ${v.persona.display_name}: ${v.view}`)
        .join('\n');

    const reactions = await Promise.all(personalViews.map(async (mine) => {
        const out = await safeConverse(modelId, mine.persona, [
            { role: 'user', content:
                `You're in a group conversation. The question was:\n"${prompt}"\n\n` +
                `Here is what the others said:\n${others(mine)}\n\n` +
                `Now respond — in 2–4 sentences — to whichever view you most agree or ` +
                `disagree with. Name them. Stay in your own voice and don't be performatively polite.`
            }
        ]);
        await insert(
            `INSERT INTO simulation_messages
                (session_id, persona_id, speaker, content, phase, meta)
             VALUES (:sid, :pid, :spk, :c, 'reaction', :meta)`,
            { sid: session.id, pid: mine.persona.id, spk: mine.persona.display_name, c: out.text,
              meta: JSON.stringify({ model_id: modelId, ai_used: out.ai_used, error_code: out.error_code }) }
        );
        return { persona: mine.persona, view: out.text };
    }));

    // Phase 3 · synthesis (single call, no persona system prompt — neutral moderator)
    const transcript = personalViews.map(v => `${v.persona.display_name}: ${v.view}`).concat(
        reactions.map(r => `${r.persona.display_name} (reaction): ${r.view}`)
    ).join('\n\n');

    let synthesisText, ai_used = false, error_code = null;
    try {
        const r = await bedrock.converse(
            [{ role: 'user', content:
                `Moderator brief: synthesise the following group discussion into a short ` +
                `consensus note. Use this exact markdown structure:\n\n` +
                `**Where they agree**\n- …\n\n` +
                `**Where they disagree**\n- …\n\n` +
                `**Strongest pushback**\n- name: line\n\n` +
                `**What might change their minds**\n- …\n\n` +
                `Original prompt: ${prompt}\n\nTranscript:\n${transcript}`
            }],
            { modelId, maxTokens: 800, temperature: 0.4 }
        );
        synthesisText = r.text;
        ai_used = true;
    } catch (err) {
        error_code = err.code || (err.status && String(err.status)) || 'ai_error';
        synthesisText = buildSynthesisFallback(personas, prompt);
    }

    await insert(
        `INSERT INTO simulation_messages
            (session_id, persona_id, speaker, content, phase, meta)
         VALUES (:sid, NULL, 'moderator', :c, 'synthesis', :meta)`,
        { sid: session.id, c: synthesisText, meta: JSON.stringify({ model_id: modelId, ai_used, error_code }) }
    );

    await update(
        `UPDATE simulation_sessions SET status = 'complete', summary_md = :s WHERE id = :id`,
        { id: session.id, s: synthesisText }
    );

    return {
        prompt,
        personal_views: personalViews,
        reactions,
        synthesis_md: synthesisText
    };
}

/* Single Converse call that always resolves with a text — even on failure. */
async function safeConverse(modelId, persona, messages, opts = {}) {
    try {
        const r = await bedrock.converse(messages, {
            system: buildSystem(persona),
            modelId,
            maxTokens: opts.maxTokens || 500,
            temperature: opts.temperature ?? 0.6
        });
        return { text: r.text || '(empty)', ai_used: true, error_code: null };
    } catch (err) {
        return {
            text: `[${persona.display_name} · AI offline — would speak here once the daily quota is back.]`,
            ai_used: false,
            error_code: err.code || (err.status && String(err.status)) || 'ai_error'
        };
    }
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
        '- Be terse and grounded in the values of the profile.',
        '- Where you do not know something, speculate as this person plausibly would.',
        '- Do not break character, do not say you are an AI.'
    ].filter(Boolean).join('\n');
}

function buildSynthesisFallback(personas, prompt) {
    return [
        '_AI offline — synthesis stub._',
        '',
        `Prompt: ${prompt}`,
        '',
        `Participants: ${personas.map(p => p.display_name).join(', ')}`,
        '',
        'Each participant\'s view above stands as the record until the model is back online.'
    ].join('\n');
}

module.exports = { runDiscussion };
