/* =====================================================================
 * Persona controller · SAMAJ digital-twin pipeline
 * ---------------------------------------------------------------------
 *   Admin (gated by requireAdmin):
 *     POST   /api/admin/personas/invites          create token + URL
 *     GET    /api/admin/personas/invites          list invites
 *     DELETE /api/admin/personas/invites/:id      revoke
 *     GET    /api/admin/personas                  list personas (?status=)
 *     GET    /api/admin/personas/:id              full payload + summary
 *     POST   /api/admin/personas/:id/approve      compile prompt + traits
 *     POST   /api/admin/personas/:id/reject
 *     DELETE /api/admin/personas/:id
 *
 *   Public (token-gated):
 *     GET  /api/invites/:token                    fetch invite (name/email)
 *     POST /api/invites/:token/submit             submit intake payload
 *
 * Approve flow:
 *   1. Read payload (Stage 1 battery + Stage 2 life story + Stage 3 vignettes)
 *   2. Ask Bedrock (cheapest model) to:
 *        · score Big Five domains 0-100
 *        · choose an archetype keyword for clustering
 *        · craft a 1-paragraph headline
 *        · emit the persona system prompt (1st-person voice)
 *   3. Use the trait scores to place the persona on the SAMAJ map.
 *   4. Persist + return the activated persona.
 *
 * Fallback: if Bedrock is disabled or errors, we still approve with a
 * deterministic compilation so testing the workflow doesn't require AI.
 * ===================================================================== */

const crypto = require('crypto');
const { query, queryOne, insert, update } = require('../db/pool');
const bedrock  = require('../services/bedrockClient');
const settings = require('../services/settings');
const { DEFAULT_MODEL } = require('../services/modelRegistry');

/* ─────────────────────  INVITES  ───────────────────── */

async function createInvite(req, res, next) {
    try {
        const { invitee_email, invitee_name, note, expires_in_days = 14 } = req.body || {};
        const token = crypto.randomBytes(24).toString('base64url');
        const expiresAt = new Date(Date.now() + expires_in_days * 86400 * 1000);

        const id = await insert(
            `INSERT INTO persona_invites (token, invited_by, invitee_email, invitee_name, note, expires_at)
             VALUES (:t, :u, :e, :n, :note, :exp)`,
            { t: token, u: req.user.id, e: invitee_email || null, n: invitee_name || null, note: note || null, exp: expiresAt }
        );
        const invite = await queryOne(
            'SELECT id, token, invitee_email, invitee_name, note, status, created_at, expires_at FROM persona_invites WHERE id = :id',
            { id }
        );
        res.json({
            invite,
            url: buildInviteUrl(req, token)
        });
    } catch (err) { next(err); }
}

async function listInvites(req, res, next) {
    try {
        const rows = await query(
            `SELECT i.id, i.token, i.invitee_email, i.invitee_name, i.note, i.status,
                    i.persona_id, i.created_at, i.submitted_at, i.decided_at, i.expires_at,
                    u.display_name AS invited_by_name
               FROM persona_invites i
               LEFT JOIN users u ON u.id = i.invited_by
               ORDER BY i.created_at DESC
               LIMIT 200`
        );
        res.json({
            invites: rows.map(r => ({ ...r, url: buildInviteUrl(req, r.token) }))
        });
    } catch (err) { next(err); }
}

async function revokeInvite(req, res, next) {
    try {
        const id = Number(req.params.id);
        await update(`UPDATE persona_invites SET status = 'revoked', decided_at = NOW() WHERE id = :id AND status IN ('pending','submitted')`, { id });
        res.json({ ok: true });
    } catch (err) { next(err); }
}

/* ─────────────────────  PUBLIC INTAKE  ───────────────────── */

async function getInvitePublic(req, res, next) {
    try {
        const inv = await queryOne(
            `SELECT id, token, invitee_email, invitee_name, note, status, expires_at
               FROM persona_invites WHERE token = :t`,
            { t: req.params.token }
        );
        if (!inv) return res.status(404).json({ error: 'Invite not found' });
        if (inv.status === 'revoked') return res.status(410).json({ error: 'Invite was revoked' });
        if (inv.expires_at && new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: 'Invite expired' });
        res.json({ invite: inv });
    } catch (err) { next(err); }
}

/* ─────────────────────  TRANSCRIBE STAGE (AUDIO INTERVIEW)  ─────────────────────
 *
 * POST /api/invites/:token/transcribe-stage
 * body: { stage: 'background'|'battery'|'attitudes'|'life_story'|'situational',
 *         transcript: string }
 *
 * Returns: { stage, structured: <shape matching the intake form for that stage> }
 *
 * Strategy: a single Bedrock call per stage with a stage-specific prompt.
 * Deterministic fallback when Bedrock is off — just stuffs the raw transcript
 * into a free-text field for that stage so the user can edit/submit. */
async function transcribeStage(req, res, next) {
    try {
        const inv = await queryOne(
            `SELECT id, status, expires_at FROM persona_invites WHERE token = :t`,
            { t: req.params.token }
        );
        if (!inv) return res.status(404).json({ error: 'Invite not found' });
        if (inv.status === 'revoked')  return res.status(410).json({ error: 'Invite was revoked' });
        if (inv.expires_at && new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: 'Invite expired' });

        const { stage, transcript } = req.body || {};
        if (!stage || !STAGE_PROMPTS[stage]) return res.status(400).json({ error: 'unknown stage' });
        const text = String(transcript || '').trim();
        if (!text) return res.status(400).json({ error: 'transcript is empty' });

        let structured;
        let ai_used = false;

        if (bedrock.isAvailable()) {
            try {
                const modelId = await settings.get('samaj_persona_model', DEFAULT_MODEL);
                const { system, schema_hint, fallback_shape } = STAGE_PROMPTS[stage];
                structured = await bedrock.invokeJSON(
                    `Transcript:\n${text.slice(0, 12000)}\n\nReturn ONLY the JSON described above. No prose, no markdown fences.`,
                    {
                        system: `${system}\n\nReturn JSON matching this shape exactly:\n${schema_hint}`,
                        modelId,
                        maxTokens: 1200,
                        temperature: 0.2,
                        service: `samaj.transcribe_${stage}`
                    }
                );
                ai_used = true;
                // Belt-and-braces: if AI returned something unusable, fall back.
                if (!structured || typeof structured !== 'object') {
                    structured = STAGE_PROMPTS[stage].fallback_shape(text);
                    ai_used = false;
                }
            } catch (err) {
                console.warn(`[samaj] transcribeStage(${stage}) AI failed:`, err.message);
                structured = STAGE_PROMPTS[stage].fallback_shape(text);
            }
        } else {
            structured = STAGE_PROMPTS[stage].fallback_shape(text);
        }

        res.json({ stage, structured, ai_used });
    } catch (err) { next(err); }
}

/* Per-stage prompt + shape declarations. The schema_hint is concatenated to
 * the system prompt so the model knows exactly which keys to emit. */
const STAGE_PROMPTS = {
    background: {
        system: 'You are a careful research assistant cleaning up an interview transcript into a tight biography. Keep specifics (age, geography, education, occupation, family, languages). Drop fillers and false starts. Write in third person if the speaker drifts between first/third, otherwise honour their voice.',
        schema_hint: '{ "background": "<2-4 paragraph biography in their own voice>" }',
        fallback_shape: (text) => ({ background: text })
    },

    battery: {
        system: 'You are scoring a respondent on the Mini-IPIP-20 Big-Five personality inventory from a free-form interview where they described themselves. Each item is rated 1 (very inaccurate as a self-description) to 5 (very accurate). Reverse-keyed items still take the rating that matches what the respondent SAID about themselves — do NOT reverse them yourself, the consumer reverses on aggregation. If a particular item cannot be inferred, score 3 (neutral). Items:\n' +
            'e1 Am the life of the party.\n' +
            'e2 Talk to a lot of different people at parties.\n' +
            'e3 Don\'t talk a lot. (R)\n' +
            'e4 Keep in the background. (R)\n' +
            'a1 Sympathize with others\' feelings.\n' +
            'a2 Feel others\' emotions.\n' +
            'a3 Am not really interested in others. (R)\n' +
            'a4 Am not interested in other people\'s problems. (R)\n' +
            'c1 Get chores done right away.\n' +
            'c2 Like order.\n' +
            'c3 Often forget to put things back in their proper place. (R)\n' +
            'c4 Make a mess of things. (R)\n' +
            'n1 Have frequent mood swings.\n' +
            'n2 Get upset easily.\n' +
            'n3 Am relaxed most of the time. (R)\n' +
            'n4 Seldom feel blue. (R)\n' +
            'o1 Have a vivid imagination.\n' +
            'o2 Am full of ideas.\n' +
            'o3 Am not interested in abstract ideas. (R)\n' +
            'o4 Do not have a good imagination. (R)',
        schema_hint: '{ "e1":N, "e2":N, "e3":N, "e4":N, "a1":N, "a2":N, "a3":N, "a4":N, "c1":N, "c2":N, "c3":N, "c4":N, "n1":N, "n2":N, "n3":N, "n4":N, "o1":N, "o2":N, "o3":N, "o4":N }   // each N is integer 1..5',
        fallback_shape: () => {
            const out = {};
            ['e','a','c','n','o'].forEach(d => { for (let i = 1; i <= 4; i++) out[`${d}${i}`] = 3; });
            return out;
        }
    },

    attitudes: {
        system: 'Extract worldview snapshot from the transcript. Scale items are 1..7 from the LEFT extreme to the RIGHT extreme as labelled. If unsure, score 4 (centre). Use the speaker\'s own words for the free-text items; keep them short.\n' +
            'Items:\n' +
            '- ideology: 1 (very liberal) ↔ 7 (very conservative)\n' +
            '- religiosity: 1 (not at all religious / spiritual) ↔ 7 (deeply)\n' +
            '- trust: 1 (strongly disagree "most people can be trusted") ↔ 7 (strongly agree)\n' +
            '- party: free-text party or political identification (≤ 60 chars)\n' +
            '- issues: free-text 3 top issues they care about (≤ 120 chars, comma-separated)',
        schema_hint: '{ "ideology":N, "religiosity":N, "trust":N, "party":"<text>", "issues":"<text>" }',
        fallback_shape: (text) => ({ ideology: 4, religiosity: 4, trust: 4, party: '', issues: text.slice(0, 120) })
    },

    life_story: {
        system: 'Reshape the transcript into a clean, well-edited autobiographical narrative in the speaker\'s own voice. Preserve specific names, places, and emotional beats. Aim for ~600-1200 words. Also extract a list of chapter labels if the speaker offered them (or invent reasonable ones from the content).',
        schema_hint: '{ "life_story": "<long narrative>", "chapters": ["chapter 1", "chapter 2", "…"] }',
        fallback_shape: (text) => ({ life_story: text, chapters: [] })
    },

    situational: {
        system: 'The respondent answered seven situational-judgment questions in a single free-form recording. Extract one concise (1-3 sentence) answer per question, in the speaker\'s own voice. If a question wasn\'t addressed at all, leave the value as "". The seven question IDs:\n' +
            '- extra_change: shopkeeper gave too much change, noticed only after leaving\n' +
            '- honest_feedback: close friend asks for honest feedback on weak work\n' +
            '- dictator_split: how much to keep when splitting money with a stranger\n' +
            '- group_disagree: strongly disagree with a group direction\n' +
            '- free_weekend: free weekend with no obligations\n' +
            '- risky_offer: high-payoff risky opportunity\n' +
            '- recent_decision: walk through a recent difficult decision',
        schema_hint: '{ "extra_change":"…", "honest_feedback":"…", "dictator_split":"…", "group_disagree":"…", "free_weekend":"…", "risky_offer":"…", "recent_decision":"…" }',
        fallback_shape: (text) => ({
            extra_change: '', honest_feedback: '', dictator_split: '',
            group_disagree: '', free_weekend: '', risky_offer: '',
            recent_decision: text
        })
    }
};

async function submitIntake(req, res, next) {
    try {
        const inv = await queryOne(
            `SELECT id, status, expires_at, invitee_email, invitee_name FROM persona_invites WHERE token = :t`,
            { t: req.params.token }
        );
        if (!inv) return res.status(404).json({ error: 'Invite not found' });
        if (inv.status === 'revoked')   return res.status(410).json({ error: 'Invite was revoked' });
        if (inv.status === 'approved')  return res.status(409).json({ error: 'Already processed' });
        if (inv.expires_at && new Date(inv.expires_at) < new Date()) return res.status(410).json({ error: 'Invite expired' });

        const payload = sanitizePayload(req.body || {});
        if (!payload.display_name) return res.status(400).json({ error: 'display_name is required' });

        /* Create a pending persona row. */
        const personaId = await insert(
            `INSERT INTO personas (invite_id, display_name, headline, payload, status, avatar_seed)
             VALUES (:inv, :name, :head, :p, 'pending', :seed)`,
            {
                inv: inv.id,
                name: payload.display_name,
                head: payload.headline || null,
                p: JSON.stringify(payload),
                seed: crypto.randomBytes(6).toString('hex')
            }
        );

        await update(
            `UPDATE persona_invites SET status = 'submitted', submitted_at = NOW(), persona_id = :pid WHERE id = :iid`,
            { pid: personaId, iid: inv.id }
        );

        res.json({ ok: true, persona_id: personaId, status: 'submitted' });
    } catch (err) { next(err); }
}

/* ─────────────────────  ADMIN: PERSONAS  ───────────────────── */

async function listPersonas(req, res, next) {
    try {
        const status = req.query.status;
        const where = status ? 'WHERE status = :status' : '';
        const rows = await query(
            `SELECT id, display_name, headline, archetype, status, traits, map_x, map_y,
                    avatar_seed, approved_at, created_at
               FROM personas ${where}
               ORDER BY created_at DESC
               LIMIT 500`,
            status ? { status } : {}
        );
        res.json({ personas: rows });
    } catch (err) { next(err); }
}

async function getPersona(req, res, next) {
    try {
        const id = Number(req.params.id);
        const persona = await queryOne(
            `SELECT * FROM personas WHERE id = :id`, { id }
        );
        if (!persona) return res.status(404).json({ error: 'Persona not found' });
        res.json({ persona });
    } catch (err) { next(err); }
}

async function approvePersona(req, res, next) {
    try {
        const id = Number(req.params.id);
        const persona = await queryOne(`SELECT * FROM personas WHERE id = :id`, { id });
        if (!persona) return res.status(404).json({ error: 'Persona not found' });
        if (persona.status === 'approved') return res.status(409).json({ error: 'Already approved' });

        const payload = typeof persona.payload === 'string' ? JSON.parse(persona.payload) : persona.payload;

        const modelId = await settings.get('samaj_persona_model', DEFAULT_MODEL);
        const compiled = await compilePersona(payload, { modelId, user_id: req.user.id });

        const { map_x, map_y } = placeOnMap(compiled.traits);

        await update(
            `UPDATE personas SET
                archetype = :arch,
                headline  = COALESCE(:head, headline),
                traits    = :t,
                system_prompt_md = :sys,
                map_x = :x, map_y = :y,
                status = 'approved',
                approved_by = :uid, approved_at = NOW()
             WHERE id = :id`,
            {
                id, uid: req.user.id,
                arch: compiled.archetype,
                head: compiled.headline,
                t: JSON.stringify(compiled.traits),
                sys: compiled.system_prompt_md,
                x: map_x, y: map_y
            }
        );
        await update(
            `UPDATE persona_invites SET status = 'approved', decided_at = NOW() WHERE persona_id = :id`,
            { id }
        );

        const fresh = await queryOne(`SELECT id, display_name, headline, archetype, status, traits, map_x, map_y, system_prompt_md FROM personas WHERE id = :id`, { id });
        res.json({ persona: fresh, ai_used: compiled.ai_used });
    } catch (err) { next(err); }
}

async function rejectPersona(req, res, next) {
    try {
        const id = Number(req.params.id);
        await update(`UPDATE personas SET status = 'rejected' WHERE id = :id`, { id });
        await update(`UPDATE persona_invites SET status = 'rejected', decided_at = NOW() WHERE persona_id = :id`, { id });
        res.json({ ok: true });
    } catch (err) { next(err); }
}

async function deletePersona(req, res, next) {
    try {
        const id = Number(req.params.id);
        await update(`DELETE FROM personas WHERE id = :id`, { id });
        res.json({ ok: true });
    } catch (err) { next(err); }
}

/* ─────────────────────  HELPERS  ───────────────────── */

function buildInviteUrl(req, token) {
    const base = process.env.PUBLIC_APP_URL ||
        `${req.protocol}://${req.get('host')}`;
    return `${base}/invite/${token}`;
}

function sanitizePayload(body) {
    /* Whitelisted shape — see the paper for what each stage captures.
     * Anything else the user puts in body is dropped. */
    const out = {
        display_name: trim(body.display_name, 190),
        headline:     trim(body.headline, 255),
        background:   trim(body.background, 4000),
        battery:      typeof body.battery === 'object' && body.battery ? body.battery : {},
        life_story:   trim(body.life_story, 20000),
        chapters:     Array.isArray(body.chapters) ? body.chapters.slice(0, 20).map(c => trim(c, 1000)) : [],
        situational:  typeof body.situational === 'object' && body.situational ? body.situational : {},
        attitudes:    typeof body.attitudes === 'object' && body.attitudes ? body.attitudes : {},
        writing_sample: trim(body.writing_sample, 8000),
        consent:      !!body.consent
    };
    return out;
}

function trim(s, max) {
    if (s == null) return null;
    s = String(s).trim();
    if (!s.length) return null;
    return s.length > max ? s.slice(0, max) : s;
}

/* ----- Compile persona — Bedrock-driven with deterministic fallback. */
async function compilePersona(payload, { modelId, user_id }) {
    if (!bedrock.isAvailable()) {
        return fallbackCompile(payload, 'bedrock_disabled');
    }
    try {
        const sys = `You are extracting a digital-twin profile from a self-report. Output ONLY a JSON object with keys:
  traits:    { openness, conscientiousness, extraversion, agreeableness, neuroticism, honesty_humility } — integers 0..100
  archetype: one of "visionary","builder","scholar","caregiver","skeptic","explorer","steward","connector"
  headline:  ≤ 90 chars, 3rd person, vivid, no clichés
  system_prompt_md: the persona's voice rules — markdown, ≤ 700 words. Written in 2nd person addressed to the model ("You are X."), specifies tone, opinions, values, recurring phrases, and 3-5 grounding facts from the life story. Includes the rule "stay in character; if asked something outside your knowledge, answer as this person would speculate."
No prose outside the JSON. No markdown fences.`;
        const compact = JSON.stringify(payload).slice(0, 12000);
        const json = await bedrock.invokeJSON(
            `Profile:\n${compact}`,
            { system: sys, modelId, maxTokens: 1600, temperature: 0.4, user_id, service: 'samaj.compile_persona' }
        );
        return {
            traits:           normalizeTraits(json.traits),
            archetype:        json.archetype || 'explorer',
            headline:         json.headline  || null,
            system_prompt_md: json.system_prompt_md || fallbackSystemPrompt(payload),
            ai_used: true
        };
    } catch (err) {
        console.warn('[samaj] compilePersona AI failed → fallback:', err.message);
        return fallbackCompile(payload, err.code || 'ai_error');
    }
}

function normalizeTraits(t = {}) {
    const clip = v => Math.max(0, Math.min(100, Math.round(Number(v) || 50)));
    return {
        openness:          clip(t.openness),
        conscientiousness: clip(t.conscientiousness),
        extraversion:      clip(t.extraversion),
        agreeableness:     clip(t.agreeableness),
        neuroticism:       clip(t.neuroticism),
        honesty_humility:  clip(t.honesty_humility)
    };
}

function fallbackCompile(payload, reason) {
    return {
        traits: normalizeTraits({}),
        archetype: 'explorer',
        headline: payload.headline || `${payload.display_name} — newly joined SAMAJ`,
        system_prompt_md: fallbackSystemPrompt(payload),
        ai_used: false,
        fallback_reason: reason
    };
}

function fallbackSystemPrompt(payload) {
    return [
        `You are ${payload.display_name}.`,
        payload.headline ? payload.headline : null,
        payload.background ? `Background:\n${payload.background}` : null,
        payload.life_story ? `Life story (your own words):\n${payload.life_story.slice(0, 2500)}` : null,
        'Stay in character. Respond in your own voice. Where you don\'t know something, speculate as this person plausibly would. Be candid and grounded; avoid disclaimers.'
    ].filter(Boolean).join('\n\n');
}

/* ----- Place persona on SAMAJ map using Big Five — x = extraversion-vs-introversion,
 * y = openness-vs-conscientiousness. Scaled to [0,1]. */
function placeOnMap(traits) {
    const map_x = clamp01(traits.extraversion      / 100);
    const map_y = clamp01((traits.openness - traits.conscientiousness + 100) / 200);
    // Jitter slightly so personas with identical scores don't sit on top of each other.
    const jx = (Math.random() - 0.5) * 0.04;
    const jy = (Math.random() - 0.5) * 0.04;
    return {
        map_x: Number((clamp01(map_x + jx)).toFixed(5)),
        map_y: Number((clamp01(map_y + jy)).toFixed(5))
    };
}
function clamp01(n) { return Math.max(0, Math.min(1, n)); }

module.exports = {
    createInvite, listInvites, revokeInvite,
    getInvitePublic, submitIntake, transcribeStage,
    listPersonas, getPersona,
    approvePersona, rejectPersona, deletePersona
};
