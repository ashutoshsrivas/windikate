/* =====================================================================
 * Memo Builder
 * Phase 4 · Memo Tab
 * ---------------------------------------------------------------------
 * Generates the IC memo in one of four formats:
 *   • mckinsey  · Situation · Complication · Question · Answer
 *   • bcg       · Insight  · Implication · Action
 *   • yc        · YC application long-form
 *   • custom    · uses a caller-supplied template string
 *
 * Returns a markdown string the frontend can render or export to PDF.
 * ===================================================================== */

function buildMemo({
    format = 'mckinsey',
    customTemplate = null,
    include = {},
    recommendation = 'deep_dive',
    analysis,
    metrics = [],
    deviations = [],
    competitors = [],
    apercept = null
}) {
    const company = analysis.company_name || 'Target Company';
    const stage   = analysis.stage || 'Series A';

    const summary = buildSummary(metrics, deviations);

    if (format === 'mckinsey')   return mckinsey(company, stage, summary, deviations, competitors, apercept, include, recommendation);
    if (format === 'bcg')        return bcg(company, stage, summary, deviations, competitors, apercept, include, recommendation);
    if (format === 'yc')         return yc(company, stage, summary, deviations, competitors, apercept, include, recommendation);
    if (format === 'custom' && customTemplate) {
        return customTemplate
            .replace(/{{company}}/g, company)
            .replace(/{{summary}}/g, summary)
            .replace(/{{recommendation}}/g, prettyRec(recommendation));
    }
    return mckinsey(company, stage, summary, deviations, competitors, apercept, include, recommendation);
}

// ---------- format builders -------------------------------------------
function mckinsey(c, s, sum, devs, comps, apc, inc, rec) {
    return [
        `# ${c} · Investment Memo`,
        `_${s} · McKinsey-style_`,
        ``,
        `## Situation`,
        sum.situation,
        ``,
        `## Complication`,
        sum.complication,
        ``,
        `## Question`,
        `Is ${c} positioned to clear its next milestone with the unit economics it has today?`,
        ``,
        `## Answer`,
        `**Recommendation: ${prettyRec(rec)}.** ${sum.answer}`,
        ``,
        inc.deviation_analysis ? deviationSection(devs) : '',
        inc.competitive_landscape_map ? competitorSection(comps) : '',
        inc.apercept_simulation && apc ? aperceptSection(apc) : '',
        inc.meeting_transcript_excerpts ? `## Meeting Transcript Excerpts\n_(Add transcript here once the founder call is complete.)_\n` : ''
    ].filter(Boolean).join('\n');
}

function bcg(c, s, sum, devs, comps, apc, inc, rec) {
    return [
        `# ${c} · Investment Memo`,
        `_${s} · BCG-style_`,
        ``,
        `## Insight`,
        sum.situation,
        ``,
        `## Implication`,
        sum.complication,
        ``,
        `## Action`,
        `**${prettyRec(rec)}.** ${sum.answer}`,
        ``,
        inc.deviation_analysis ? deviationSection(devs) : '',
        inc.competitive_landscape_map ? competitorSection(comps) : '',
        inc.apercept_simulation && apc ? aperceptSection(apc) : ''
    ].filter(Boolean).join('\n');
}

function yc(c, s, sum, devs, comps, apc, inc, rec) {
    return [
        `# ${c} · YC Application Format`,
        ``,
        `**Recommendation:** ${prettyRec(rec)}`,
        ``,
        `### What does your company do?`,
        `${c} (${s}) — see deck. ${sum.situation}`,
        ``,
        `### Why this team?`,
        `_(Add founder backgrounds and prior wins here.)_`,
        ``,
        `### Why now?`,
        sum.complication,
        ``,
        `### How do you make money?`,
        `Revenue model and unit economics summarised in the deviation analysis below.`,
        ``,
        `### What's hard about this?`,
        sum.answer,
        ``,
        inc.deviation_analysis ? deviationSection(devs) : '',
        inc.competitive_landscape_map ? competitorSection(comps) : '',
        inc.apercept_simulation && apc ? aperceptSection(apc) : ''
    ].filter(Boolean).join('\n');
}

// ---------- shared section builders -----------------------------------
function deviationSection(devs) {
    const lines = ['## Deviation Analysis', '', '| Metric | Severity | Detail | Source |', '|---|---|---|---|'];
    for (const d of devs) {
        const sev = (d.edited_severity || d.severity || '').toUpperCase();
        lines.push(`| ${d.metric_key} | ${sev} | ${d.description || ''} | ${d.benchmark_label || ''} |`);
    }
    return lines.join('\n') + '\n';
}

function competitorSection(comps) {
    if (!comps.length) return '';
    const lines = ['## Competitive Landscape', '', '| Competitor | Relation | Funding | Monthly Traffic |', '|---|---|---|---|'];
    for (const c of comps) {
        lines.push(`| ${c.name} | ${c.relation} | $${(c.funding_usd / 1e6).toFixed(1)}M | ${(c.monthly_traffic / 1000).toFixed(0)}K |`);
    }
    return lines.join('\n') + '\n';
}

function aperceptSection(apc) {
    return [
        '## Apercept AI Simulation',
        ``,
        `**Adoption rate estimate:** ${apc.adoption_rate}%`,
        ``,
        '**Persona criticism**',
        ...(apc.criticism || []).map(c => `- _${c.persona}_: ${c.point}`),
        ``,
        '**Feedback loops**',
        ...(apc.feedback_loops || []).map(f => `- _${f.persona}_: ${f.loop}`)
    ].join('\n');
}

function buildSummary(metrics, deviations) {
    const reds = deviations.filter(d => (d.edited_severity || d.severity) === 'red');
    const yellows = deviations.filter(d => (d.edited_severity || d.severity) === 'yellow');
    return {
        situation: `Schema mapping completed across ${metrics.length} financial metrics. ${reds.length} critical and ${yellows.length} moderate deviations were detected against industry benchmarks and firm thresholds.`,
        complication: reds.length
            ? `Critical concerns: ${reds.slice(0, 3).map(d => d.title.toLowerCase()).join('; ')}.`
            : `No critical deviations detected. The opportunity sits within stage-appropriate ranges on every measured dimension.`,
        answer: reds.length
            ? `Open the second meeting with structured answers to the questions in the Question tab. The path to investment runs through resolution of the critical deviations.`
            : `Pattern matches the fund's prior winners — recommend partner meeting and term-sheet conversations within two weeks.`
    };
}

function prettyRec(r) { return ({ pass: 'Pass', deep_dive: 'Deep Dive', partner_meeting: 'Partner Meeting' })[r] || 'Deep Dive'; }

module.exports = { buildMemo };
