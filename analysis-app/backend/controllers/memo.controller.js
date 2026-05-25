const { query, queryOne, insert } = require('../db/pool');
const { buildMemo } = require('../services/memoBuilder');

const ALLOWED_FORMATS = ['mckinsey', 'bcg', 'yc', 'custom'];

// POST /api/analyses/:id/memo
async function generateMemo(req, res, next) {
    try {
        const { id } = req.params;
        const { format = 'mckinsey', recommendation = 'deep_dive', include = {}, custom_template = null } = req.body;

        if (!ALLOWED_FORMATS.includes(format))
            return res.status(400).json({ error: 'invalid format' });
        if (!['pass', 'deep_dive', 'partner_meeting'].includes(recommendation))
            return res.status(400).json({ error: 'invalid recommendation' });

        const analysis = await queryOne(
            'SELECT * FROM analyses WHERE id = :id AND user_id = :uid',
            { id, uid: req.user.id }
        );
        if (!analysis) return res.status(404).json({ error: 'analysis not found' });

        const metrics    = await query('SELECT * FROM analysis_metrics WHERE analysis_id = :id', { id });
        const deviations = await query('SELECT * FROM deviations       WHERE analysis_id = :id', { id });
        const competitors= await query('SELECT * FROM competitors      WHERE analysis_id = :id', { id });
        const apercept   = await queryOne('SELECT * FROM apercept_simulations WHERE analysis_id = :id', { id });

        // Parse JSON columns for service input
        const aperceptObj = apercept ? {
            adoption_rate:   apercept.adoption_rate,
            criticism:       safeJson(apercept.criticism),
            feedback_loops:  safeJson(apercept.feedback_loops),
            personas:        safeJson(apercept.personas)
        } : null;

        const content = buildMemo({
            format,
            customTemplate: custom_template,
            include,
            recommendation,
            analysis,
            metrics,
            deviations,
            competitors,
            apercept: aperceptObj
        });

        const memoId = await insert(
            `INSERT INTO memos (analysis_id, format, include_options, recommendation, content)
             VALUES (:aid, :fmt, :inc, :rec, :content)`,
            { aid: id, fmt: format, inc: JSON.stringify(include), rec: recommendation, content }
        );

        res.json({ memo: { id: memoId, analysis_id: Number(id), format, recommendation, include_options: include, content } });
    } catch (err) { next(err); }
}

function safeJson(v) {
    if (v == null) return null;
    if (typeof v === 'object') return v;
    try { return JSON.parse(v); } catch { return null; }
}

module.exports = { generateMemo };
