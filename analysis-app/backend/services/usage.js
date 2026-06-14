/* =====================================================================
 * AI usage logger + rollup queries
 * ---------------------------------------------------------------------
 * Every call to bedrockClient routes here so we have a per-call audit
 * trail (model, tokens, cost, success, duration). Admin dashboard reads
 * these for daily/monthly cost charts and per-user attribution.
 * ===================================================================== */

const { query, insert, update } = require('../db/pool');
const { calcCostCents } = require('./modelRegistry');

/**
 * Log a single AI call.
 *
 * @param {Object} args
 * @param {number|null} args.user_id
 * @param {number|null} args.analysis_id
 * @param {string} args.service              e.g. 'questionGenerator'
 * @param {string} args.model_id
 * @param {number} args.input_tokens
 * @param {number} args.output_tokens
 * @param {boolean} args.success
 * @param {string|null} args.error_code
 * @param {number} args.duration_ms
 */
async function record(args) {
    const cost = calcCostCents(args.model_id, args.input_tokens || 0, args.output_tokens || 0);
    const id = await insert(
        `INSERT INTO usage_events
            (user_id, analysis_id, service, model_id,
             input_tokens, output_tokens,
             input_cost_cents, output_cost_cents, total_cost_cents,
             success, error_code, duration_ms)
         VALUES
            (:u, :a, :s, :m, :it, :ot, :ic, :oc, :tc, :ok, :err, :dur)`,
        {
            u:   args.user_id     || null,
            a:   args.analysis_id || null,
            s:   args.service     || 'unknown',
            m:   args.model_id    || '',
            it:  args.input_tokens  || 0,
            ot:  args.output_tokens || 0,
            ic:  cost.input_cost_cents,
            oc:  cost.output_cost_cents,
            tc:  cost.total_cost_cents,
            ok:  args.success ? 1 : 0,
            err: args.error_code || null,
            dur: args.duration_ms || 0
        }
    );

    /* Roll the cost up onto the user's running monthly spend, if attributable. */
    if (args.user_id && args.success && cost.total_cost_cents > 0) {
        await update(
            `UPDATE users SET monthly_spend_cents = monthly_spend_cents + :c WHERE id = :id`,
            { c: cost.total_cost_cents, id: args.user_id }
        );
    }

    return { id, ...cost };
}

/* --------------------------------------------------------------------
 * Rollup queries — these feed the admin dashboard.
 * ------------------------------------------------------------------ */

/** Day-by-day cost & call count for the last N days. */
async function dailySummary(days = 30) {
    const rows = await query(
        `SELECT
            DATE(created_at)             AS day,
            COUNT(*)                     AS calls,
            SUM(success)                 AS ok_calls,
            SUM(total_cost_cents)        AS cents,
            SUM(input_tokens)            AS in_tokens,
            SUM(output_tokens)           AS out_tokens
         FROM usage_events
         WHERE created_at >= NOW() - INTERVAL :d DAY
         GROUP BY day
         ORDER BY day ASC`,
        { d: days }
    );
    return rows.map(r => ({
        day:       r.day instanceof Date ? r.day.toISOString().slice(0, 10) : String(r.day),
        calls:     Number(r.calls),
        ok_calls:  Number(r.ok_calls),
        cents:     Number(r.cents || 0),
        in_tokens: Number(r.in_tokens || 0),
        out_tokens:Number(r.out_tokens || 0)
    }));
}

/** Per-user attribution for the last N days (top spenders first). */
async function byUser(days = 30) {
    return query(
        `SELECT
            u.id, u.email, u.display_name, u.role,
            COUNT(e.id)              AS calls,
            COALESCE(SUM(e.total_cost_cents), 0) AS cents,
            u.monthly_spend_cents,
            u.monthly_cap_cents
         FROM users u
         LEFT JOIN usage_events e
             ON e.user_id = u.id
            AND e.created_at >= NOW() - INTERVAL :d DAY
         GROUP BY u.id
         ORDER BY cents DESC, u.id ASC`,
        { d: days }
    );
}

/** Headline numbers for the admin Overview tab. */
async function overview() {
    const [todayRow] = await query(
        `SELECT COUNT(*) AS calls, COALESCE(SUM(total_cost_cents),0) AS cents
         FROM usage_events
         WHERE DATE(created_at) = CURDATE()`
    );
    const [monthRow] = await query(
        `SELECT COUNT(*) AS calls, COALESCE(SUM(total_cost_cents),0) AS cents
         FROM usage_events
         WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`
    );
    const [userRow] = await query('SELECT COUNT(*) AS n FROM users');
    const [analysisRow] = await query('SELECT COUNT(*) AS n FROM analyses');
    return {
        today:     { calls: Number(todayRow.calls), cents: Number(todayRow.cents) },
        month:     { calls: Number(monthRow.calls), cents: Number(monthRow.cents) },
        users:     Number(userRow.n),
        analyses:  Number(analysisRow.n)
    };
}

/* --------------------------------------------------------------------
 *  Per-call audit feed for /admin/usage → "Recent calls" tab.
 *
 *  Supports filters: user_id, service, model_id, status (success|error),
 *  free-text search (matches service/model/email/error_code), and a
 *  time range (from/to as YYYY-MM-DD or ISO). Returns the page plus the
 *  unfiltered totals so the UI can show "showing N of M".
 *  ----------------------------------------------------------------- */
async function listEvents({
    limit   = 50,
    offset  = 0,
    user_id = null,
    service = null,
    model_id= null,
    status  = null,    // 'success' | 'error' | null
    search  = null,
    from    = null,
    to      = null
} = {}) {
    const params = {
        lim: Math.min(Math.max(Number(limit) || 50, 1), 500),
        off: Math.max(Number(offset) || 0, 0)
    };
    const where = [];
    if (user_id)  { where.push('e.user_id = :user_id');         params.user_id  = Number(user_id); }
    if (service)  { where.push('e.service = :service');         params.service  = service; }
    if (model_id) { where.push('e.model_id = :model_id');       params.model_id = model_id; }
    if (status === 'success') where.push('e.success = 1');
    if (status === 'error')   where.push('e.success = 0');
    if (from)     { where.push('e.created_at >= :from');        params.from = from; }
    if (to)       { where.push('e.created_at <= :to');          params.to   = to; }
    if (search)   {
        where.push(`(
            e.service   LIKE :q  OR
            e.model_id  LIKE :q  OR
            e.error_code LIKE :q OR
            u.email     LIKE :q  OR
            u.display_name LIKE :q
        )`);
        params.q = `%${search}%`;
    }
    const W = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await query(
        `SELECT
            e.id, e.user_id, u.email AS user_email, u.display_name AS user_name,
            e.analysis_id, e.service, e.model_id,
            e.input_tokens, e.output_tokens,
            e.input_cost_cents, e.output_cost_cents, e.total_cost_cents,
            e.success, e.error_code, e.duration_ms,
            e.created_at
         FROM usage_events e
         LEFT JOIN users u ON u.id = e.user_id
         ${W}
         ORDER BY e.id DESC
         LIMIT :lim OFFSET :off`,
        params
    );

    const [totalRow] = await query(
        `SELECT
            COUNT(*) AS total,
            COALESCE(SUM(e.total_cost_cents),0) AS sum_cents,
            COALESCE(SUM(e.input_tokens),0)     AS sum_in,
            COALESCE(SUM(e.output_tokens),0)    AS sum_out
         FROM usage_events e
         LEFT JOIN users u ON u.id = e.user_id
         ${W}`,
        params
    );

    return {
        rows: rows.map(r => ({
            ...r,
            input_tokens:      Number(r.input_tokens || 0),
            output_tokens:     Number(r.output_tokens || 0),
            input_cost_cents:  Number(r.input_cost_cents || 0),
            output_cost_cents: Number(r.output_cost_cents || 0),
            total_cost_cents:  Number(r.total_cost_cents || 0),
            duration_ms:       Number(r.duration_ms || 0),
            success:           !!r.success
        })),
        total:     Number(totalRow.total),
        sum_cents: Number(totalRow.sum_cents),
        sum_in:    Number(totalRow.sum_in),
        sum_out:   Number(totalRow.sum_out),
        limit:     params.lim,
        offset:    params.off
    };
}

/* Distinct values for the filter UI's dropdowns. */
async function eventFacets() {
    const services = await query(`SELECT DISTINCT service FROM usage_events WHERE service IS NOT NULL ORDER BY service`);
    const models   = await query(`SELECT DISTINCT model_id FROM usage_events WHERE model_id IS NOT NULL AND model_id != '' ORDER BY model_id`);
    return {
        services: services.map(s => s.service),
        models:   models.map(m => m.model_id)
    };
}

module.exports = { record, dailySummary, byUser, overview, listEvents, eventFacets };
