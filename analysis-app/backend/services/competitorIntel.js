/* =====================================================================
 * Competitor Intelligence
 * Phase 3 · Step 3
 * ---------------------------------------------------------------------
 * Production: web-scrape Crunchbase + SimilarWeb + product feature feeds.
 * Here: stable mock of 4–6 competitors keyed off company name.
 * ===================================================================== */

const POOL = [
    { name: 'Northbridge AI',    funding_usd: 12_500_000, monthly_traffic: 240_000, features: ['multi-agent', 'memo export', 'benchmark library'], website: 'https://northbridge.ai' },
    { name: 'Aperture Capital OS',funding_usd: 22_000_000,monthly_traffic: 410_000, features: ['CRM sync', 'IC voting', 'data room ingestion'],     website: 'https://aperture.capital' },
    { name: 'DeckIQ',            funding_usd: 4_300_000,  monthly_traffic: 96_000,  features: ['deck parsing', 'auto-extraction'],                  website: 'https://deckiq.io' },
    { name: 'Sigma Diligence',   funding_usd: 8_700_000,  monthly_traffic: 152_000, features: ['risk scoring', 'memo templates'],                   website: 'https://sigma-dd.com' },
    { name: 'FoundrLens',        funding_usd: 1_900_000,  monthly_traffic: 38_000,  features: ['founder background', 'cap table parsing'],          website: 'https://foundrlens.com' },
    { name: 'Verdant Analytics', funding_usd: 14_200_000, monthly_traffic: 198_000, features: ['portfolio benchmarking', 'LP reporting'],           website: 'https://verdant.ai' },
    { name: 'PitchPilot',        funding_usd: 2_400_000,  monthly_traffic: 64_000,  features: ['question generation', 'meeting prep'],              website: 'https://pitchpilot.com' }
];

function findCompetitors(companyName = '') {
    const seed = hashCode(companyName || 'default') % POOL.length;
    const picked = [];
    for (let i = 0; i < 5; i++) picked.push(POOL[(seed + i) % POOL.length]);

    return picked.map((c, idx) => ({
        ...c,
        relation: idx < 3 ? 'direct' : 'indirect',
        notes: idx === 0 ? 'Closest functional overlap based on extracted feature set.' : null
    }));
}

function hashCode(s) { let h = 0; for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i) | 0; return Math.abs(h) || 1; }

module.exports = { findCompetitors };
