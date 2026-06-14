/* =====================================================================
 * samaj.controller · session / chat / discussion / apercept endpoints
 * ---------------------------------------------------------------------
 *   POST   /api/samaj/sessions                          create a session
 *   GET    /api/samaj/sessions                          list mine
 *   GET    /api/samaj/sessions/:id                      session + messages
 *   POST   /api/samaj/sessions/:id/messages             chat — send + get reply
 *   POST   /api/samaj/sessions/:id/run-discussion       N personas → views + synthesis
 *   POST   /api/samaj/apercept                          adoption study (creates its own session)
 *   GET    /api/samaj/personas                          approved personas (analysts can list)
 *
 * Every endpoint is authenticated. Discussion / Apercept also block on
 * the samaj_simulation_paused settings flag (via the underlying services).
 * ===================================================================== */

const { query, queryOne, insert, update } = require('../db/pool');
const samajChat       = require('../services/samajChat');
const samajDiscussion = require('../services/samajDiscussion');
const samajApercept   = require('../services/samajApercept');

/* ─── PUBLIC LIST · approved personas (any signed-in user) ──────── */
async function listApprovedPersonas(req, res, next) {
    try {
        const rows = await query(
            `SELECT id, display_name, headline, archetype, traits, map_x, map_y, avatar_seed
               FROM personas
              WHERE status = 'approved'
              ORDER BY display_name ASC`
        );
        res.json({ personas: rows });
    } catch (err) { next(err); }
}

/* ─── SESSIONS ───────────────────────────────────────────────── */
async function createSession(req, res, next) {
    try {
        const { mode = 'chat', persona_ids = [], title, analysis_id } = req.body || {};
        if (!['chat', 'discussion', 'apercept'].includes(mode)) {
            return res.status(400).json({ error: 'invalid mode' });
        }
        const ids = (persona_ids || []).map(Number).filter(Boolean);
        if (!ids.length) return res.status(400).json({ error: 'at least one persona_id required' });
        if (mode === 'chat' && ids.length !== 1) {
            return res.status(400).json({ error: 'chat mode requires exactly one persona_id' });
        }

        const personas = await loadPersonas(ids);
        if (personas.length !== ids.length) return res.status(404).json({ error: 'one or more personas not found' });

        const computedTitle = title || (mode === 'chat'
            ? `Chat with ${personas[0].display_name}`
            : `Group: ${personas.map(p => p.display_name).join(', ').slice(0, 80)}`);

        const sessionId = await insert(
            `INSERT INTO simulation_sessions (owner_id, title, mode, status, analysis_id)
             VALUES (:u, :t, :m, 'active', :aid)`,
            { u: req.user.id, t: computedTitle, m: mode, aid: analysis_id || null }
        );
        for (const p of personas) {
            await insert(
                `INSERT INTO simulation_participants (session_id, persona_id) VALUES (:s, :p)`,
                { s: sessionId, p: p.id }
            );
        }
        const session = await queryOne(`SELECT * FROM simulation_sessions WHERE id = :id`, { id: sessionId });
        res.json({ session, personas });
    } catch (err) { next(err); }
}

async function listSessions(req, res, next) {
    try {
        const rows = await query(
            `SELECT s.*,
                    (SELECT COUNT(*) FROM simulation_messages WHERE session_id = s.id) AS message_count,
                    (SELECT GROUP_CONCAT(p.display_name SEPARATOR ', ')
                       FROM simulation_participants sp
                       JOIN personas p ON p.id = sp.persona_id
                      WHERE sp.session_id = s.id) AS participants
               FROM simulation_sessions s
              WHERE s.owner_id = :u
              ORDER BY s.updated_at DESC
              LIMIT 100`,
            { u: req.user.id }
        );
        res.json({ sessions: rows });
    } catch (err) { next(err); }
}

async function getSession(req, res, next) {
    try {
        const id = Number(req.params.id);
        const session = await queryOne(
            `SELECT * FROM simulation_sessions WHERE id = :id AND owner_id = :u`,
            { id, u: req.user.id }
        );
        if (!session) return res.status(404).json({ error: 'session not found' });

        const personas = await query(
            `SELECT p.id, p.display_name, p.headline, p.archetype, p.avatar_seed, p.traits
               FROM simulation_participants sp
               JOIN personas p ON p.id = sp.persona_id
              WHERE sp.session_id = :id`,
            { id }
        );
        const messages = await query(
            `SELECT id, persona_id, speaker, phase, content, created_at
               FROM simulation_messages
              WHERE session_id = :id
              ORDER BY id ASC`,
            { id }
        );
        res.json({ session, personas, messages });
    } catch (err) { next(err); }
}

/* ─── CHAT (1:1) ──────────────────────────────────────────────── */
async function postMessage(req, res, next) {
    try {
        const id = Number(req.params.id);
        const { content } = req.body || {};
        if (!content || !content.trim()) return res.status(400).json({ error: 'content required' });

        const session = await queryOne(
            `SELECT * FROM simulation_sessions WHERE id = :id AND owner_id = :u`,
            { id, u: req.user.id }
        );
        if (!session) return res.status(404).json({ error: 'session not found' });
        if (session.mode !== 'chat') return res.status(400).json({ error: 'session is not a 1:1 chat' });
        if (session.status === 'paused') return res.status(409).json({ error: 'session paused' });

        const persona = (await loadParticipants(id))[0];
        if (!persona) return res.status(400).json({ error: 'no persona on this session' });

        const out = await samajChat.reply({ session, persona, userMessage: content.trim(), user_id: req.user.id });
        await update(`UPDATE simulation_sessions SET updated_at = NOW() WHERE id = :id`, { id });
        res.json(out);
    } catch (err) {
        if (err.code === 'SAMAJ_PAUSED') return res.status(503).json({ error: err.message });
        next(err);
    }
}

/* ─── DISCUSSION (N personas, one prompt, synthesis) ─────────── */
async function runDiscussionEndpoint(req, res, next) {
    try {
        const id = Number(req.params.id);
        const { prompt } = req.body || {};
        if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'prompt required' });

        const session = await queryOne(
            `SELECT * FROM simulation_sessions WHERE id = :id AND owner_id = :u`,
            { id, u: req.user.id }
        );
        if (!session) return res.status(404).json({ error: 'session not found' });
        if (session.mode !== 'discussion') return res.status(400).json({ error: 'session is not a discussion' });

        const personas = await loadParticipants(id);
        if (!personas.length) return res.status(400).json({ error: 'no participants on this session' });

        const result = await samajDiscussion.runDiscussion({
            session, personas, prompt: prompt.trim(), user_id: req.user.id
        });
        res.json(result);
    } catch (err) {
        if (err.code === 'SAMAJ_PAUSED') return res.status(503).json({ error: err.message });
        next(err);
    }
}

/* ─── APERCEPT (adoption study) ──────────────────────────────── */
async function runAperceptEndpoint(req, res, next) {
    try {
        const { product_brief, persona_ids, analysis_id, panel_size } = req.body || {};
        if (!product_brief || !product_brief.trim()) {
            return res.status(400).json({ error: 'product_brief required' });
        }
        let ids = (persona_ids || []).map(Number).filter(Boolean);
        if (!ids.length) {
            const limit = Math.min(Math.max(Number(panel_size) || 12, 1), 50);
            const rows = await query(
                `SELECT id FROM personas WHERE status = 'approved' ORDER BY RAND() LIMIT :n`,
                { n: limit }
            );
            ids = rows.map(r => r.id);
        }
        const personas = await loadPersonas(ids);
        if (!personas.length) return res.status(400).json({ error: 'no approved personas available' });

        // Create a session to attach the apercept run to
        const sessionId = await insert(
            `INSERT INTO simulation_sessions (owner_id, title, mode, status, analysis_id, prompt)
             VALUES (:u, :t, 'apercept', 'active', :a, :p)`,
            { u: req.user.id, t: `Apercept · ${product_brief.slice(0, 60)}`, a: analysis_id || null, p: product_brief.trim() }
        );
        for (const p of personas) {
            await insert(
                `INSERT INTO simulation_participants (session_id, persona_id) VALUES (:s, :p)`,
                { s: sessionId, p: p.id }
            );
        }

        const result = await samajApercept.runApercept({
            requested_by: req.user.id,
            analysis_id:  analysis_id || null,
            session_id:   sessionId,
            personas,
            product_brief: product_brief.trim()
        });
        await update(`UPDATE simulation_sessions SET status = 'complete' WHERE id = :id`, { id: sessionId });
        res.json({ session_id: sessionId, ...result });
    } catch (err) {
        if (err.code === 'SAMAJ_PAUSED') return res.status(503).json({ error: err.message });
        next(err);
    }
}

/* ─── HELPERS ────────────────────────────────────────────────── */
async function loadPersonas(ids) {
    if (!ids.length) return [];
    const placeholders = ids.map((_, i) => `:p${i}`).join(',');
    const params = Object.fromEntries(ids.map((id, i) => [`p${i}`, id]));
    return query(
        `SELECT id, display_name, headline, archetype, traits, system_prompt_md, avatar_seed, map_x, map_y
           FROM personas
          WHERE status = 'approved' AND id IN (${placeholders})`,
        params
    );
}

async function loadParticipants(sessionId) {
    return query(
        `SELECT p.id, p.display_name, p.headline, p.archetype, p.traits, p.system_prompt_md, p.avatar_seed
           FROM simulation_participants sp
           JOIN personas p ON p.id = sp.persona_id
          WHERE sp.session_id = :s`,
        { s: sessionId }
    );
}

module.exports = {
    listApprovedPersonas,
    createSession, listSessions, getSession,
    postMessage,
    runDiscussionEndpoint, runAperceptEndpoint
};
