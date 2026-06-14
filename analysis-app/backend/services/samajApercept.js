/* =====================================================================
 * samajApercept · product feedback simulation against the SAMAJ panel
 * ---------------------------------------------------------------------
 *   runApercept({ requested_by, analysis_id?, personas, product_brief })
 *
 * For each persona we make one structured call asking:
 *   { will_adopt, sentiment, wtp_inr, personal_view, discussion_pts }
 *
 * The aggregate is computed locally (cheap) and persisted to
 * apercept_runs + apercept_responses. A final consensus_md is generated
 * with one extra Bedrock call summarising the panel.
 * ===================================================================== */

const { insert, update } = require('../db/pool');
const bedrock  = require('./bedrockClient');
const settings = require('./settings');
const samajChat = require('./samajChat');
const { DEFAULT_MODEL } = require('./modelRegistry');

const SENTIMENT_TO_SCORE = {
    strong_pos: 2, pos: 1, neutral: 0, neg: -1, strong_neg: -2
};

async function runApercept({ requested_by, analysis_id = null, session_id = null, personas, product_brief }) {
    await samajChat.assertNotPaused();
    const modelId = await settings.get('samaj_persona_model', DEFAULT_MODEL);

    // 1) Create the run row up front so the UI can poll if we ever go async.
    const runId = await insert(
        `INSERT INTO apercept_runs
            (analysis_id, session_id, requested_by, product_brief, persona_count, status)
         VALUES (:a, :s, :u, :b, :n, 'running')`,
        { a: analysis_id, s: session_id, u: requested_by, b: product_brief, n: personas.length }
    );

    // 2) Per-persona structured call — parallel.
    const responses = await Promise.all(personas.map(p => personaResponse(modelId, p, product_brief)));
    await Promise.all(responses.map(r =>
        insert(
            `INSERT INTO apercept_responses
                (run_id, persona_id, will_adopt, sentiment, wtp_inr, personal_view, discussion_pts)
             VALUES (:r, :p, :a, :s, :w, :v, :d)`,
            { r: runId, p: r.persona_id, a: r.will_adopt ? 1 : 0, s: r.sentiment, w: r.wtp_inr, v: r.personal_view, d: r.discussion_pts }
        )
    ));

    // 3) Aggregate locally.
    const stats = aggregate(responses);

    // 4) Optional final synthesis pass.
    let consensus_md, synthErr = null;
    try {
        const lines = responses.map(r =>
            `- ${r.persona_name} · ${r.will_adopt ? 'WOULD ADOPT' : 'would NOT adopt'} · ` +
            `sentiment=${r.sentiment} · wtp=₹${r.wtp_inr ?? '—'} · "${(r.personal_view || '').slice(0, 240)}"`
        ).join('\n');
        const out = await bedrock.converse(
            [{ role: 'user', content:
                `You are summarising a SAMAJ adoption study. Write a short, partner-ready note in ` +
                `the following exact structure:\n\n` +
                `**Headline**\n…\n\n**Adopters say**\n- …\n\n**Skeptics say**\n- …\n\n` +
                `**Pricing signal**\n…\n\n**Top three product pushbacks**\n1. …\n2. …\n3. …\n\n` +
                `Product brief: ${product_brief}\n\nPanel:\n${lines}\n\n` +
                `Headline numbers: adoption ${stats.adoption_pct}%, average WTP ₹${stats.avg_wtp_inr ?? '—'}, ` +
                `net sentiment ${stats.net_sentiment.toFixed(2)}.`
            }],
            { modelId, maxTokens: 900, temperature: 0.4 }
        );
        consensus_md = out.text;
    } catch (err) {
        synthErr = err.code || (err.status && String(err.status)) || 'ai_error';
        consensus_md = buildConsensusFallback(stats, responses, product_brief, synthErr);
    }

    await update(
        `UPDATE apercept_runs SET
            adoption_pct       = :ap,
            avg_wtp_inr        = :wtp,
            wtp_distribution   = :wdist,
            sentiment_summary  = :sent,
            consensus_md       = :c,
            status             = 'complete',
            completed_at       = NOW()
         WHERE id = :id`,
        {
            id: runId,
            ap:   stats.adoption_pct,
            wtp:  stats.avg_wtp_inr,
            wdist: JSON.stringify(stats.wtp_distribution),
            sent:  JSON.stringify(stats.sentiment_distribution),
            c:    consensus_md
        }
    );

    return {
        run_id: runId,
        stats,
        responses,
        consensus_md,
        ai_synthesis_error: synthErr
    };
}

/* Per-persona structured call — one round-trip per twin. */
async function personaResponse(modelId, persona, brief) {
    const sys = [
        `You are ${persona.display_name}. Speak only as them.`,
        persona.headline ? `Headline: ${persona.headline}` : null,
        '',
        '--- Persona profile ---',
        persona.system_prompt_md || '',
        '',
        '--- Task ---',
        'You will be shown a product brief. Decide as this person would.',
        'Return ONLY a JSON object — no prose, no fences — matching this exact shape:',
        '{',
        '  "will_adopt":   true | false,',
        '  "sentiment":    "strong_pos" | "pos" | "neutral" | "neg" | "strong_neg",',
        '  "wtp_inr":      <integer rupees this person would actually pay per month (or null)>,',
        '  "personal_view":"3–5 sentence first-person reaction in your voice",',
        '  "discussion_pts":"2–3 short bullet phrases you would raise in a panel"',
        '}'
    ].filter(Boolean).join('\n');

    try {
        const r = await bedrock.invokeJSON(
            `Product brief:\n${brief}`,
            { system: sys, modelId, maxTokens: 600, temperature: 0.5, service: 'samaj.apercept' }
        );
        return {
            persona_id:    persona.id,
            persona_name:  persona.display_name,
            will_adopt:    !!r.will_adopt,
            sentiment:     normalizeSentiment(r.sentiment),
            wtp_inr:       toIntOrNull(r.wtp_inr),
            personal_view: String(r.personal_view || '').trim().slice(0, 4000),
            discussion_pts:String(r.discussion_pts || '').trim().slice(0, 2000),
            ai_used:       true
        };
    } catch (err) {
        return {
            persona_id:    persona.id,
            persona_name:  persona.display_name,
            will_adopt:    null,
            sentiment:     null,
            wtp_inr:       null,
            personal_view: `[${persona.display_name} · AI offline — adoption signal unavailable.]`,
            discussion_pts:'',
            ai_used:       false,
            error_code:    err.code || (err.status && String(err.status)) || 'ai_error'
        };
    }
}

function normalizeSentiment(s) {
    const v = String(s || '').toLowerCase();
    if (SENTIMENT_TO_SCORE.hasOwnProperty(v)) return v;
    if (v === 'positive') return 'pos';
    if (v === 'negative') return 'neg';
    return 'neutral';
}

function toIntOrNull(v) {
    if (v == null || v === '' || v === false) return null;
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? n : null;
}

function aggregate(responses) {
    const known = responses.filter(r => r.will_adopt !== null);
    const adopters = known.filter(r => r.will_adopt).length;
    const adoption_pct = known.length ? Math.round((adopters / known.length) * 1000) / 10 : 0;

    const wtps = responses.map(r => r.wtp_inr).filter(n => typeof n === 'number');
    const avg_wtp_inr = wtps.length ? Math.round(wtps.reduce((a, b) => a + b, 0) / wtps.length) : null;

    const wtp_distribution = quantiles(wtps);

    const sentiments = responses.map(r => r.sentiment).filter(Boolean);
    const sentiment_distribution = sentiments.reduce((acc, s) => {
        acc[s] = (acc[s] || 0) + 1; return acc;
    }, {});
    const net_sentiment = sentiments.length
        ? sentiments.reduce((s, x) => s + (SENTIMENT_TO_SCORE[x] || 0), 0) / sentiments.length
        : 0;

    return {
        n:                    responses.length,
        n_known:              known.length,
        adopters:             adopters,
        adoption_pct,
        avg_wtp_inr,
        wtp_distribution,
        sentiment_distribution,
        net_sentiment
    };
}

function quantiles(arr) {
    if (!arr.length) return null;
    const a = [...arr].sort((x, y) => x - y);
    const at = q => a[Math.min(a.length - 1, Math.floor(q * (a.length - 1)))];
    return { min: a[0], p25: at(0.25), median: at(0.5), p75: at(0.75), max: a[a.length - 1] };
}

function buildConsensusFallback(stats, responses, brief, err) {
    return [
        `_AI consensus offline (${err}). Raw aggregate below._`,
        '',
        `Adoption: ${stats.adoption_pct}% (${stats.adopters} of ${stats.n_known} who answered)`,
        `Average WTP: ${stats.avg_wtp_inr != null ? `₹${stats.avg_wtp_inr}/mo` : '—'}`,
        `Sentiment distribution: ${JSON.stringify(stats.sentiment_distribution)}`,
        '',
        `Brief: ${brief.slice(0, 400)}`
    ].join('\n');
}

module.exports = { runApercept };
