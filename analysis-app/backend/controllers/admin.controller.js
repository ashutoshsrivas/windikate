const bcrypt = require('bcryptjs');
const { query, queryOne, insert, update } = require('../db/pool');
const settings = require('../services/settings');
const usage    = require('../services/usage');
const { listModels, getModel, DEFAULT_MODEL } = require('../services/modelRegistry');

/* --------------------------------------------------------------------
 *  /api/admin/overview · headline numbers for the admin dashboard
 * ------------------------------------------------------------------ */
async function overview(req, res, next) {
    try {
        const numbers = await usage.overview();
        const cap = await settings.get('monthly_cap_cents', null);
        const defaultModel = await settings.get('default_model', DEFAULT_MODEL);
        const bedrockEnabled = await settings.get('bedrock_enabled', false);
        res.json({
            ...numbers,
            month_cap_cents: cap != null ? Number(cap) : null,
            default_model:   defaultModel,
            bedrock_enabled: !!bedrockEnabled
        });
    } catch (err) { next(err); }
}

/* --------------------------------------------------------------------
 *  /api/admin/models · list models with prices
 * ------------------------------------------------------------------ */
async function getModels(req, res) {
    res.json({ models: listModels(), default: DEFAULT_MODEL });
}

/* --------------------------------------------------------------------
 *  /api/admin/settings
 * ------------------------------------------------------------------ */
/* POST /api/admin/settings/test-search · runs one live Serper query
 * against the currently-saved key + returns the top result. Lets admins
 * confirm the key works without having to upload a deck first. */
async function testSearch(req, res, next) {
    try {
        const webSearch = require('../services/webSearch');
        const q = (req.body && req.body.q) || 'SaaS Series A gross margin benchmark 2026';
        const hit = await webSearch.search(q, { force: true });
        if (!hit) {
            return res.status(400).json({
                ok: false,
                error: 'Web search returned nothing. Check that the toggle is on and the API key is set.'
            });
        }
        res.json({ ok: true, query: q, hit });
    } catch (err) { next(err); }
}

async function getSettings(req, res, next) {
    try { res.json({ settings: maskSecrets(await settings.getAll()) }); }
    catch (err) { next(err); }
}

async function putSettings(req, res, next) {
    try {
        const ALLOWED = [
            'default_model', 'bedrock_enabled', 'monthly_cap_cents',
            'web_search_enabled', 'web_search_provider', 'web_search_ttl_days',
            'serper_api_key'
        ];
        for (const [k, v] of Object.entries(req.body || {})) {
            if (!ALLOWED.includes(k)) continue;
            if (k === 'default_model' && !getModel(v)) {
                return res.status(400).json({ error: `unknown model: ${v}` });
            }
            await settings.set(k, v, req.user.id);
        }
        res.json({ settings: maskSecrets(await settings.getAll()) });
    } catch (err) { next(err); }
}

function maskSecrets(s) {
    /* Never echo back the raw key — admins only need to know it's set. */
    if (s && typeof s === 'object' && s.serper_api_key) {
        const v = String(s.serper_api_key);
        s.serper_api_key = v.length > 8 ? v.slice(0, 4) + '••••' + v.slice(-4) : '••••';
    }
    return s;
}

/* --------------------------------------------------------------------
 *  /api/admin/users
 * ------------------------------------------------------------------ */
async function listUsers(req, res, next) {
    try {
        const rows = await query(
            `SELECT id, email, display_name, role, focus_areas, allowed_models,
                    monthly_spend_cents, monthly_cap_cents,
                    onboarded_at, created_at
               FROM users ORDER BY created_at DESC`
        );
        res.json({ users: rows });
    } catch (err) { next(err); }
}

async function createUser(req, res, next) {
    try {
        const { email, password, display_name, role = 'analyst', allowed_models = null, monthly_cap_cents = null } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'email + password required' });
        if (password.length < 8) return res.status(400).json({ error: 'password must be 8+ chars' });
        if (!['admin', 'analyst'].includes(role)) return res.status(400).json({ error: 'invalid role' });

        const existing = await queryOne('SELECT id FROM users WHERE email = :email', { email });
        if (existing) return res.status(409).json({ error: 'email already registered' });

        const hash = await bcrypt.hash(password, 10);
        const id = await insert(
            `INSERT INTO users (email, password_hash, display_name, role, allowed_models, monthly_cap_cents, onboarded_at)
             VALUES (:email, :hash, :name, :role, :am, :cap, NOW())`,
            {
                email, hash, name: display_name || null, role,
                am: allowed_models ? JSON.stringify(allowed_models) : null,
                cap: monthly_cap_cents != null ? Number(monthly_cap_cents) : null
            }
        );
        const user = await queryOne(
            'SELECT id, email, display_name, role, allowed_models, monthly_cap_cents, created_at FROM users WHERE id = :id',
            { id }
        );
        res.json({ user });
    } catch (err) { next(err); }
}

async function patchUser(req, res, next) {
    try {
        const id = Number(req.params.id);
        const { role, allowed_models, monthly_cap_cents, display_name, password } = req.body;
        if (role && !['admin', 'analyst'].includes(role)) {
            return res.status(400).json({ error: 'invalid role' });
        }

        // Don't let an admin demote themselves accidentally
        if (id === req.user.id && role && role !== 'admin') {
            return res.status(400).json({ error: 'cannot demote yourself' });
        }

        const fields = [];
        const params = { id };
        if (role !== undefined)             { fields.push('role = :role');                params.role = role; }
        if (display_name !== undefined)     { fields.push('display_name = :name');         params.name = display_name || null; }
        if (allowed_models !== undefined)   { fields.push('allowed_models = :am');         params.am = allowed_models ? JSON.stringify(allowed_models) : null; }
        if (monthly_cap_cents !== undefined){ fields.push('monthly_cap_cents = :cap');     params.cap = monthly_cap_cents != null ? Number(monthly_cap_cents) : null; }
        if (password) {
            if (password.length < 8) return res.status(400).json({ error: 'password must be 8+ chars' });
            fields.push('password_hash = :ph');
            params.ph = await bcrypt.hash(password, 10);
        }

        if (!fields.length) return res.status(400).json({ error: 'no fields to update' });

        await update(`UPDATE users SET ${fields.join(', ')} WHERE id = :id`, params);
        const user = await queryOne(
            'SELECT id, email, display_name, role, allowed_models, monthly_cap_cents, monthly_spend_cents FROM users WHERE id = :id',
            { id }
        );
        res.json({ user });
    } catch (err) { next(err); }
}

async function deleteUser(req, res, next) {
    try {
        const id = Number(req.params.id);
        if (id === req.user.id) return res.status(400).json({ error: 'cannot delete yourself' });
        await update('DELETE FROM users WHERE id = :id', { id });
        res.json({ ok: true });
    } catch (err) { next(err); }
}

/* --------------------------------------------------------------------
 *  /api/admin/usage
 * ------------------------------------------------------------------ */
async function usageEvents(req, res, next) {
    try {
        const payload = await usage.listEvents({
            limit:    req.query.limit,
            offset:   req.query.offset,
            user_id:  req.query.user_id || null,
            service:  req.query.service || null,
            model_id: req.query.model_id || null,
            status:   req.query.status   || null,
            search:   req.query.q        || null,
            from:     req.query.from     || null,
            to:       req.query.to       || null
        });
        res.json(payload);
    } catch (err) { next(err); }
}

async function usageFacets(req, res, next) {
    try { res.json(await usage.eventFacets()); }
    catch (err) { next(err); }
}

async function usageReport(req, res, next) {
    try {
        const days = Math.min(Number(req.query.days) || 30, 90);
        const [daily, byUserRows] = await Promise.all([
            usage.dailySummary(days),
            usage.byUser(days)
        ]);
        res.json({
            days,
            daily,
            by_user: byUserRows.map(r => ({
                ...r,
                cents:               Number(r.cents),
                calls:               Number(r.calls),
                monthly_spend_cents: Number(r.monthly_spend_cents || 0),
                monthly_cap_cents:   r.monthly_cap_cents != null ? Number(r.monthly_cap_cents) : null
            }))
        });
    } catch (err) { next(err); }
}

module.exports = {
    overview, getModels,
    getSettings, putSettings,
    listUsers, createUser, patchUser, deleteUser,
    usageReport, usageEvents, usageFacets,
    testSearch
};
