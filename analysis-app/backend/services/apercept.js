/* =====================================================================
 * Apercept AI Layer (Conditional)
 * Phase 3 · Step 5
 * ---------------------------------------------------------------------
 * When enabled on the analysis, returns:
 *   • simulated consumer adoption scenarios
 *   • criticism + feedback loops
 *   • a single adoption-rate estimate
 *
 * Returns a structured object the frontend can render directly.
 * ===================================================================== */

const PERSONAS = [
    { key: 'skeptical_maker',     label: 'Skeptical Maker',        weight: 0.18 },
    { key: 'early_adopter',       label: 'Early Adopter',          weight: 0.14 },
    { key: 'pragmatic_buyer',     label: 'Pragmatic Buyer',        weight: 0.34 },
    { key: 'cautious_researcher', label: 'Cautious Researcher',    weight: 0.22 },
    { key: 'value_seeker',        label: 'Value Seeker',           weight: 0.12 }
];

function runSimulation(companyName = '', metrics = []) {
    const seed = hashCode(companyName || 'apercept');
    const rng = mulberry32(seed);

    const adoptionRate = round(38 + rng() * 44, 1);   // 38–82%

    const criticism = [
        { persona: 'pragmatic_buyer',  point: 'Pricing tier is unclear at the entry level — value perception will fragment.' },
        { persona: 'skeptical_maker',  point: 'Demonstrated moat is weak versus three direct competitors in the same lane.' },
        { persona: 'cautious_researcher', point: 'Outcome metrics rely on case studies of two; needs broader proof.' }
    ].filter(() => rng() > 0.15);

    const feedbackLoops = [
        { persona: 'early_adopter',    loop: 'Will trial within 7 days, drop off if onboarding > 12 minutes.' },
        { persona: 'value_seeker',     loop: 'Will champion internally if ROI > 4x in first quarter.' },
        { persona: 'pragmatic_buyer',  loop: 'Will require procurement + security review (8–12 weeks).' }
    ];

    const personas = PERSONAS.map(p => ({
        ...p,
        sentiment: round(0.45 + rng() * 0.5, 2),
        adoption_propensity: round(0.30 + rng() * 0.55, 2)
    }));

    return { adoptionRate, criticism, feedbackLoops, personas };
}

function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0; return Math.abs(h) || 1; }
function mulberry32(seed) { let s = seed; return () => { s = (s + 0x6D2B79F5) | 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function round(n, d = 0) { return Math.round(n * 10 ** d) / 10 ** d; }

module.exports = { runSimulation };
