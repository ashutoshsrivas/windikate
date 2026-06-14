const path = require('path');
const { query, queryOne, insert, update } = require('../db/pool');

const { extractMetrics } = require('../services/schemaMapper');
const { detectDeviations } = require('../services/deviationEngine');
const { findCompetitors } = require('../services/competitorIntel');
const { generateQuestions } = require('../services/questionGenerator');
const { runSimulation } = require('../services/apercept');

// POST /api/analyses  (multipart: deck, financials, body: company_name, stage, apercept_enabled)
async function createAnalysis(req, res, next) {
    try {
        const userId = req.user.id;
        const company = (req.body.company_name || '').trim();
        const stage = (req.body.stage || '').trim();
        const aperceptEnabled = String(req.body.apercept_enabled || 'false') === 'true';

        const deckFile = req.files?.deck?.[0];
        const finFile = req.files?.financials?.[0];

        if (!deckFile) return res.status(400).json({ error: 'pitch deck (PDF) is required' });

        const deckPath = deckFile ? path.join('uploads', deckFile.filename) : null;
        const finPath  = finFile  ? path.join('uploads', finFile.filename)  : null;

        const analysisId = await insert(
            `INSERT INTO analyses (user_id, company_name, stage, deck_path, financials_path, apercept_enabled, status, progress)
             VALUES (:uid, :company, :stage, :deck, :fin, :apc, 'processing',
                     '[{"step":"extract","label":"Extracting slides","done":false},{"step":"parse","label":"Parsing financial data","done":false},{"step":"competitors","label":"Identifying competitors","done":false},{"step":"deviations","label":"Building deviation report","done":false}]')`,
            {
                uid: userId,
                company: company || deckFile.originalname.replace(/\.pdf$/i, ''),
                stage: stage || null,
                deck: deckPath,
                fin: finPath,
                apc: aperceptEnabled ? 1 : 0
            }
        );

        // Run the pipeline synchronously (mocked services); in prod -> queue + worker.
        await runPipeline(analysisId, userId, deckFile.originalname, aperceptEnabled, {
            company_name: company || deckFile.originalname.replace(/\.pdf$/i, ''),
            stage: stage || null
        });

        const summary = await fetchAnalysis(analysisId, userId);
        res.json(summary);
    } catch (err) { next(err); }
}

async function runPipeline(analysisId, userId, deckFilename, aperceptEnabled, context = {}) {
    const benchmarks = await queryOne(
        'SELECT preseed_arr_min_inr, preseed_arr_max_inr, cac_ltv_ratio FROM user_benchmarks WHERE user_id = :id',
        { id: userId }
    ) || {};

    // Step 1: schema mapping
    const metrics = extractMetrics(deckFilename);
    for (const m of metrics) {
        await insert(
            `INSERT INTO analysis_metrics (analysis_id, metric_key, value_text, value_number, unit, source_slide, confidence, is_missing)
             VALUES (:aid, :k, :vt, :vn, :u, :slide, :conf, :miss)`,
            { aid: analysisId, k: m.metric_key, vt: m.value_text, vn: m.value_number, u: m.unit, slide: m.source_slide, conf: m.confidence, miss: m.is_missing ? 1 : 0 }
        );
    }

    // Step 2: deviations
    const deviations = detectDeviations(metrics, benchmarks);
    const devIds = [];
    for (const d of deviations) {
        const id = await insert(
            `INSERT INTO deviations (analysis_id, metric_key, title, description, severity, benchmark_label, benchmark_value, benchmark_url, source_slide)
             VALUES (:aid, :k, :t, :desc, :sev, :bl, :bv, :bu, :slide)`,
            { aid: analysisId, k: d.metric_key, t: d.title, desc: d.description, sev: d.severity, bl: d.benchmark_label, bv: d.benchmark_value, bu: d.benchmark_url, slide: d.source_slide }
        );
        devIds.push({ id, ...d });
    }

    // Step 3: competitors
    const comps = findCompetitors(deckFilename);
    for (const c of comps) {
        await insert(
            `INSERT INTO competitors (analysis_id, name, relation, funding_usd, monthly_traffic, features, website, notes)
             VALUES (:aid, :n, :r, :f, :t, :feat, :w, :notes)`,
            { aid: analysisId, n: c.name, r: c.relation, f: c.funding_usd, t: c.monthly_traffic, feat: JSON.stringify(c.features), w: c.website, notes: c.notes }
        );
    }

    // Step 4: questions  (AI when Bedrock is enabled, otherwise template fallback)
    const questions = await generateQuestions(
        devIds.map(d => ({ ...d, __id: d.id })),
        { context }
    );
    for (const q of questions) {
        await insert(
            `INSERT INTO questions (analysis_id, deviation_id, text, category, priority)
             VALUES (:aid, :dev, :t, :c, :p)`,
            { aid: analysisId, dev: q.deviation_id, t: q.text, c: q.category, p: q.priority }
        );
    }

    // Step 5: apercept (conditional)
    if (aperceptEnabled) {
        const sim = runSimulation(deckFilename, metrics);
        await insert(
            `INSERT INTO apercept_simulations (analysis_id, adoption_rate, criticism, feedback_loops, personas)
             VALUES (:aid, :rate, :crit, :loops, :pers)`,
            { aid: analysisId, rate: sim.adoptionRate, crit: JSON.stringify(sim.criticism), loops: JSON.stringify(sim.feedbackLoops), pers: JSON.stringify(sim.personas) }
        );
    }

    await update(
        `UPDATE analyses
            SET status = 'complete',
                completed_at = NOW(),
                progress = '[{"step":"extract","label":"Extracting slides","done":true},{"step":"parse","label":"Parsing financial data","done":true},{"step":"competitors","label":"Identifying competitors","done":true},{"step":"deviations","label":"Building deviation report","done":true}]'
          WHERE id = :id`,
        { id: analysisId }
    );
}

// GET /api/analyses
async function listAnalyses(req, res, next) {
    try {
        const rows = await query(
            `SELECT a.id, a.company_name, a.stage, a.status, a.apercept_enabled, a.created_at, a.completed_at,
                    (SELECT COUNT(*) FROM deviations d WHERE d.analysis_id = a.id AND COALESCE(d.edited_severity, d.severity) = 'red') AS critical_count,
                    (SELECT COUNT(*) FROM deviations d WHERE d.analysis_id = a.id AND COALESCE(d.edited_severity, d.severity) = 'yellow') AS moderate_count
               FROM analyses a
              WHERE a.user_id = :uid
              ORDER BY a.created_at DESC
              LIMIT 50`,
            { uid: req.user.id }
        );
        res.json({ analyses: rows });
    } catch (err) { next(err); }
}

// GET /api/analyses/:id
async function getAnalysis(req, res, next) {
    try {
        const data = await fetchAnalysis(Number(req.params.id), req.user.id);
        if (!data) return res.status(404).json({ error: 'analysis not found' });
        res.json(data);
    } catch (err) { next(err); }
}

async function fetchAnalysis(analysisId, userId) {
    const analysis = await queryOne(
        'SELECT * FROM analyses WHERE id = :id AND user_id = :uid',
        { id: analysisId, uid: userId }
    );
    if (!analysis) return null;

    const metrics    = await query('SELECT * FROM analysis_metrics WHERE analysis_id = :id', { id: analysisId });
    const deviations = await query('SELECT * FROM deviations       WHERE analysis_id = :id', { id: analysisId });
    const competitors= await query('SELECT * FROM competitors      WHERE analysis_id = :id', { id: analysisId });
    const questions  = await query('SELECT * FROM questions        WHERE analysis_id = :id ORDER BY FIELD(priority,"critical","important","nice_to_know")', { id: analysisId });
    const apercept   = await queryOne('SELECT * FROM apercept_simulations WHERE analysis_id = :id', { id: analysisId });

    return { analysis, metrics, deviations, competitors, questions, apercept };
}

// PUT /api/analyses/:id/deviations/:devId
async function updateDeviation(req, res, next) {
    try {
        const { id, devId } = req.params;
        const { edited_severity, analyst_citation, benchmark_label, benchmark_url } = req.body;

        if (edited_severity && !['red', 'yellow', 'green'].includes(edited_severity))
            return res.status(400).json({ error: 'invalid edited_severity' });

        const affected = await update(
            `UPDATE deviations d
                JOIN analyses a ON a.id = d.analysis_id
                SET d.edited_severity  = COALESCE(:sev, d.edited_severity),
                    d.analyst_citation = COALESCE(:cite, d.analyst_citation),
                    d.benchmark_label  = COALESCE(:bl, d.benchmark_label),
                    d.benchmark_url    = COALESCE(:bu, d.benchmark_url),
                    d.edited_by        = :uid,
                    d.edited_at        = NOW()
              WHERE d.id = :devId AND a.id = :id AND a.user_id = :uid`,
            { sev: edited_severity || null, cite: analyst_citation || null, bl: benchmark_label || null, bu: benchmark_url || null, uid: req.user.id, devId, id }
        );

        if (!affected) return res.status(404).json({ error: 'deviation not found' });
        const deviation = await queryOne('SELECT * FROM deviations WHERE id = :id', { id: devId });
        res.json({ deviation });
    } catch (err) { next(err); }
}

module.exports = { createAnalysis, listAnalyses, getAnalysis, updateDeviation };
