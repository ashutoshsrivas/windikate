/* =====================================================================
 * Deviation Highlighter
 * Phase 3 · Step 2
 * ---------------------------------------------------------------------
 * Compares extracted metrics against:
 *   • industry benchmarks (built-in defaults)
 *   • firm's custom thresholds (Phase 1 step 2)
 * Returns a list of colour-coded deviations with citations.
 * ===================================================================== */

const INDUSTRY_BENCHMARKS = {
    gross_margin:  { healthyMin: 70, label: 'Gartner 2025 · SaaS Series A',     url: 'https://gartner.com/saas-bench-2025', unit: '%' },
    runway:        { healthyMin: 18, label: 'NVCA 2025 Survey',                  url: 'https://nvca.org/runway-2025',         unit: 'months' },
    burn:          { healthyMax: 250,label: 'Bessemer Cloud Index 2025',        url: 'https://bvp.com/cloud-index-2025',     unit: 'K USD/mo' },
    cac_ltv_ratio: { healthyMin: 3,  label: 'OpenView SaaS Benchmarks 2025',    url: 'https://openviewpartners.com/saas-2025', unit: 'ratio' }
};

/**
 * @param {Array<{metric_key:string,value_number:number|null,unit:string,source_slide:string,is_missing:boolean}>} metrics
 * @param {{cac_ltv_ratio?:number|null, preseed_arr_min_inr?:number|null, preseed_arr_max_inr?:number|null}} firmBenchmarks
 */
function detectDeviations(metrics, firmBenchmarks = {}) {
    const byKey = Object.fromEntries(metrics.map(m => [m.metric_key, m]));
    const out = [];

    // -- missing data points are always 'red' --------------------------
    metrics.filter(m => m.is_missing).forEach(m => {
        out.push({
            metric_key: m.metric_key,
            title: `Missing data: ${humanize(m.metric_key)}`,
            description: `The deck does not disclose ${humanize(m.metric_key)}. Founders should be asked to provide this directly.`,
            severity: 'red',
            benchmark_label: 'Windikate · required for memo',
            benchmark_value: 'required',
            benchmark_url: null,
            source_slide: null
        });
    });

    // -- Gross margin --------------------------------------------------
    const gm = byKey.gross_margin;
    if (gm && !gm.is_missing) {
        const b = INDUSTRY_BENCHMARKS.gross_margin;
        const sev = gm.value_number >= b.healthyMin ? 'green'
                  : gm.value_number >= b.healthyMin - 8 ? 'yellow' : 'red';
        out.push(devRow('gross_margin', `Gross margin ${sev === 'green' ? 'on benchmark' : sev === 'yellow' ? 'below benchmark' : 'well below benchmark'}`,
            `Reported ${round(gm.value_number)}% vs. stage median ${b.healthyMin}%+.`,
            sev, b, gm));
    }

    // -- Runway --------------------------------------------------------
    const rw = byKey.runway;
    if (rw && !rw.is_missing) {
        const b = INDUSTRY_BENCHMARKS.runway;
        const sev = rw.value_number >= b.healthyMin ? 'green'
                  : rw.value_number >= 12 ? 'yellow' : 'red';
        out.push(devRow('runway', sev === 'red' ? 'Runway below safe threshold' : sev === 'yellow' ? 'Runway tight for next milestone' : 'Runway healthy',
            `${round(rw.value_number)} months runway against ${b.healthyMin}-month healthy threshold.`,
            sev, b, rw));
    }

    // -- Burn ----------------------------------------------------------
    const burn = byKey.burn;
    if (burn && !burn.is_missing) {
        const b = INDUSTRY_BENCHMARKS.burn;
        const sev = burn.value_number <= b.healthyMax ? 'green'
                  : burn.value_number <= b.healthyMax + 80 ? 'yellow' : 'red';
        out.push(devRow('burn', sev === 'red' ? 'High burn vs. stage' : sev === 'yellow' ? 'Burn above peer median' : 'Burn in healthy band',
            `Monthly burn of ${round(burn.value_number)}K USD against ${b.healthyMax}K stage median.`,
            sev, b, burn));
    }

    // -- CAC : LTV ratio (firm override possible) ---------------------
    const cac = byKey.CAC, ltv = byKey.LTV;
    if (cac && ltv && !cac.is_missing && !ltv.is_missing) {
        const ratio = ltv.value_number / cac.value_number;
        const minRatio = firmBenchmarks.cac_ltv_ratio || INDUSTRY_BENCHMARKS.cac_ltv_ratio.healthyMin;
        const sev = ratio >= minRatio ? 'green' : ratio >= minRatio - 0.7 ? 'yellow' : 'red';
        const label = firmBenchmarks.cac_ltv_ratio
            ? `Firm threshold · 1:${minRatio}`
            : INDUSTRY_BENCHMARKS.cac_ltv_ratio.label;
        out.push({
            metric_key: 'cac_ltv_ratio',
            title: sev === 'green' ? 'CAC : LTV ratio acceptable' : 'CAC : LTV ratio below threshold',
            description: `Computed ratio 1:${round(ratio, 1)} against minimum 1:${minRatio}.`,
            severity: sev,
            benchmark_label: label,
            benchmark_value: `1:${minRatio}+`,
            benchmark_url: INDUSTRY_BENCHMARKS.cac_ltv_ratio.url,
            source_slide: cac.source_slide
        });
    }

    // -- ARR vs firm pre-seed range -----------------------------------
    const arr = byKey.ARR;
    if (arr && !arr.is_missing && firmBenchmarks.preseed_arr_min_inr) {
        const arrInr = arr.value_number * 1_000_000 * 83;        // M USD → INR @ ~83
        const min = firmBenchmarks.preseed_arr_min_inr;
        const max = firmBenchmarks.preseed_arr_max_inr || Infinity;
        const inRange = arrInr >= min && arrInr <= max;
        out.push({
            metric_key: 'firm_arr_range',
            title: inRange ? 'ARR within firm pre-seed range' : 'ARR outside firm pre-seed range',
            description: `Reported ARR ≈ ₹${round(arrInr / 1e7, 2)} Cr against firm range ₹${round(min/1e7,1)}–${round(max/1e7,1)} Cr.`,
            severity: inRange ? 'green' : 'yellow',
            benchmark_label: 'Firm preference · onboarding',
            benchmark_value: `₹${round(min/1e7,1)}–${round(max/1e7,1)} Cr`,
            benchmark_url: null,
            source_slide: arr.source_slide
        });
    }

    return out;
}

function devRow(metric_key, title, description, severity, benchmark, metric) {
    return {
        metric_key,
        title,
        description,
        severity,
        benchmark_label: benchmark.label,
        benchmark_value: benchmark.healthyMin != null ? `${benchmark.healthyMin}${benchmark.unit}+` : `≤ ${benchmark.healthyMax}${benchmark.unit}`,
        benchmark_url: benchmark.url,
        source_slide: metric.source_slide
    };
}

function humanize(k) { return k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function round(n, d = 0) { return Math.round(n * 10 ** d) / 10 ** d; }

module.exports = { detectDeviations, INDUSTRY_BENCHMARKS };
