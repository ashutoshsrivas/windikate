/* =====================================================================
 * Question Generator
 * Phase 3 · Step 4
 * ---------------------------------------------------------------------
 * Builds the MEETING PREP QUESTIONNAIRE off the back of detected
 * deviations and missing data points, prioritised critical → important
 * → nice-to-know.
 * ===================================================================== */

const TEMPLATES = {
    gross_margin: {
        category: 'unit_economics',
        critical:   'Your reported gross margin is materially below stage median. Which cost line drove the compression — infrastructure, services, or COGS — and what is the path to {bench}+?',
        yellow:     'Gross margin is tracking below the {bench}% benchmark. What is the 12-month plan to close the gap?'
    },
    runway: {
        category: 'capital_efficiency',
        critical:   'Runway of {value} months is below the {bench}-month safe threshold. What contingency exists if the next round timeline slips by a quarter?',
        yellow:     'With ~{value} months of runway, when do you plan to open the next round, and what milestones gate it?'
    },
    burn: {
        category: 'capital_efficiency',
        critical:   'Monthly burn of {value}K is meaningfully above peers. Which line items are temporary vs. structural?',
        yellow:     'Burn is running above the {bench}K median. What changes if growth drops 30%?'
    },
    cac_ltv_ratio: {
        category: 'unit_economics',
        critical:   'Computed CAC : LTV of 1:{value} is below your firm threshold of 1:{bench}. What does cohort behaviour look like beyond month 18?',
        yellow:     'CAC : LTV is just under the 1:{bench} threshold. Which channel is most efficient and how concentrated is the mix?'
    },
    firm_arr_range: {
        category: 'stage_fit',
        yellow:     'Reported ARR is outside our typical pre-seed band. Is this round positioned as bridge, extension, or true Series A?'
    },
    _missing: {
        category: 'data_completeness',
        critical:   'The deck does not disclose {metric}. Can you share the latest internal figure with the methodology used?'
    }
};

/**
 * @param {Array} deviations
 * @returns {Array<{deviation_id:?number,text:string,category:string,priority:'critical'|'important'|'nice_to_know'}>}
 */
function generateQuestions(deviations) {
    const out = [];
    for (const dev of deviations) {
        const tpl = TEMPLATES[dev.metric_key] || TEMPLATES._missing;
        const isMissing = dev.title.startsWith('Missing data');
        let text;
        if (isMissing) {
            text = TEMPLATES._missing.critical.replace('{metric}', humanize(dev.metric_key));
        } else if (dev.severity === 'red' && tpl.critical) {
            text = bind(tpl.critical, dev);
        } else if (dev.severity === 'yellow' && tpl.yellow) {
            text = bind(tpl.yellow, dev);
        } else if (dev.severity === 'green') {
            continue; // green doesn't warrant a meeting question by default
        } else {
            text = bind(tpl.critical || tpl.yellow || 'Tell us more about your {metric} — what context are we missing?', dev);
        }

        out.push({
            deviation_id: dev.__id || null,
            text,
            category: tpl.category,
            priority: dev.severity === 'red' || isMissing ? 'critical'
                    : dev.severity === 'yellow' ? 'important' : 'nice_to_know'
        });
    }

    // Always add a couple of high-value generic prompts at the bottom
    out.push({ deviation_id: null, text: 'Walk us through the top three risks you lose sleep over — and the trigger that would force a pivot.', category: 'judgment',     priority: 'important' });
    out.push({ deviation_id: null, text: 'Which slide in the deck do you least believe yet, and what evidence would change your mind?',     category: 'judgment',     priority: 'nice_to_know' });

    return out;
}

function bind(tpl, dev) {
    const benchNum = parseFirstNumber(dev.benchmark_value);
    const valueNum = parseFirstNumber(dev.description);
    return tpl
        .replace('{bench}', benchNum != null ? benchNum : dev.benchmark_value || '')
        .replace('{value}', valueNum != null ? valueNum : '')
        .replace('{metric}', humanize(dev.metric_key));
}
function parseFirstNumber(s) {
    if (!s) return null;
    const m = String(s).match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
}
function humanize(k) { return k.replace(/_/g, ' '); }

module.exports = { generateQuestions };
