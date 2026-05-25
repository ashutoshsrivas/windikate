/* =====================================================================
 * Schema Mapping Engine
 * Phase 3 · Step 1
 * ---------------------------------------------------------------------
 * Extracts key financial metrics (TAM, CAC, LTV, runway, burn rate),
 * maps them to a standardised schema, and flags any missing data points.
 *
 * In production this would call out to an LLM + parser. Here we return
 * a deterministic, realistic-looking result so the rest of the pipeline
 * is exercisable end-to-end.
 * ===================================================================== */

const REQUIRED_KEYS = ['TAM', 'SAM', 'SOM', 'ARR', 'MRR', 'CAC', 'LTV', 'runway', 'burn', 'gross_margin'];

function extractMetrics(deckFilename = '') {
    // Stable but varied output keyed off the filename so the same upload
    // produces the same numbers across calls.
    const seed = hashCode(deckFilename || 'default-seed');
    const rng = mulberry32(seed);

    const extracted = {
        TAM:          { value_number: 8 + rng() * 12,  unit: 'B USD', source_slide: 'Slide 4',  confidence: 'medium' },
        SAM:          { value_number: 1 + rng() * 2.5, unit: 'B USD', source_slide: 'Slide 4',  confidence: 'medium' },
        SOM:          { value_number: 80 + rng() * 200,unit: 'M USD', source_slide: 'Slide 5',  confidence: 'low' },
        ARR:          { value_number: 1.5 + rng() * 4, unit: 'M USD', source_slide: 'Slide 11', confidence: 'high' },
        MRR:          { value_number: 120 + rng() * 240, unit: 'K USD', source_slide: 'Slide 11', confidence: 'high' },
        CAC:          { value_number: 600 + rng() * 1400,unit: 'USD',   source_slide: 'Slide 14', confidence: 'medium' },
        LTV:          { value_number: 2800 + rng() * 4200,unit: 'USD', source_slide: 'Slide 14', confidence: 'medium' },
        runway:       { value_number: 8 + rng() * 14,  unit: 'months', source_slide: 'Slide 15', confidence: 'high' },
        burn:         { value_number: 180 + rng() * 280,unit: 'K USD/mo', source_slide: 'Slide 15', confidence: 'high' },
        gross_margin: { value_number: 55 + rng() * 25, unit: '%',     source_slide: 'Slide 13', confidence: 'high' }
    };

    // Randomly mark one of SOM / LTV / gross_margin as missing to demonstrate the flag.
    const maybeMissing = ['SOM', 'LTV', 'gross_margin'][Math.floor(rng() * 3)];
    extracted[maybeMissing] = { value_number: null, unit: null, source_slide: null, confidence: 'low', is_missing: true };

    return REQUIRED_KEYS.map(key => ({
        metric_key: key,
        value_number: extracted[key].value_number,
        value_text: extracted[key].value_number != null
            ? `${round(extracted[key].value_number, 2)} ${extracted[key].unit || ''}`.trim()
            : null,
        unit: extracted[key].unit,
        source_slide: extracted[key].source_slide,
        confidence: extracted[key].confidence,
        is_missing: !!extracted[key].is_missing
    }));
}

// ---- small helpers ----------------------------------------------------
function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i) | 0;
    return Math.abs(h) || 1;
}
function mulberry32(seed) {
    let s = seed;
    return function () {
        s = (s + 0x6D2B79F5) | 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function round(n, d = 2) { return Math.round(n * 10 ** d) / 10 ** d; }

module.exports = { extractMetrics, REQUIRED_KEYS };
