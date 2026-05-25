const { queryOne, query, update } = require('../db/pool');

const ALLOWED_ROLES = ['vc_analyst', 'investment_associate', 'incubator_manager', 'angel_investor'];
const ALLOWED_FOCUS = ['b2b_saas','fintech','healthtech','deeptech','consumer','climate','startup_incubation','startup_acceleration'];

async function me(req, res, next) {
    try {
        const benchmarks = await queryOne(
            'SELECT preseed_arr_min_inr, preseed_arr_max_inr, cac_ltv_ratio FROM user_benchmarks WHERE user_id = :id',
            { id: req.user.id }
        );
        res.json({ user: req.user, benchmarks: benchmarks || null });
    } catch (err) { next(err); }
}

async function saveOnboarding(req, res, next) {
    try {
        const { display_name, role, focus_areas, benchmarks } = req.body;

        if (role && !ALLOWED_ROLES.includes(role))
            return res.status(400).json({ error: 'invalid role' });
        if (focus_areas && (!Array.isArray(focus_areas) || focus_areas.some(f => !ALLOWED_FOCUS.includes(f))))
            return res.status(400).json({ error: 'invalid focus_areas' });

        await update(
            `UPDATE users
                SET display_name = COALESCE(:name, display_name),
                    role         = COALESCE(:role, role),
                    focus_areas  = COALESCE(:focus, focus_areas),
                    onboarded_at = COALESCE(onboarded_at, NOW())
              WHERE id = :id`,
            {
                id: req.user.id,
                name: display_name || null,
                role: role || null,
                focus: focus_areas ? JSON.stringify(focus_areas) : null
            }
        );

        if (benchmarks) {
            await query(
                `INSERT INTO user_benchmarks (user_id, preseed_arr_min_inr, preseed_arr_max_inr, cac_ltv_ratio)
                 VALUES (:id, :min, :max, :ratio)
                 ON DUPLICATE KEY UPDATE
                    preseed_arr_min_inr = VALUES(preseed_arr_min_inr),
                    preseed_arr_max_inr = VALUES(preseed_arr_max_inr),
                    cac_ltv_ratio       = VALUES(cac_ltv_ratio)`,
                {
                    id: req.user.id,
                    min: benchmarks.preseed_arr_min_inr ?? null,
                    max: benchmarks.preseed_arr_max_inr ?? null,
                    ratio: benchmarks.cac_ltv_ratio ?? null
                }
            );
        }

        const updated = await queryOne(
            'SELECT id, email, display_name, role, focus_areas, onboarded_at FROM users WHERE id = :id',
            { id: req.user.id }
        );
        res.json({ user: updated });
    } catch (err) { next(err); }
}

module.exports = { me, saveOnboarding };
