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

module.exports = { record, dailySummary, byUser, overview };
