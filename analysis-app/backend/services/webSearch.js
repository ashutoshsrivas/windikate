/* =====================================================================
 * webSearch · live citation lookup for the deviation engine
 * ---------------------------------------------------------------------
 * Every time a deck is uploaded the deviation engine asks this service
 * for a current authoritative URL to cite per benchmark (e.g. "SaaS Series A
 * gross margin benchmark 2026"). That keeps the report from ever pointing
 * at a dead link.
 *
 * Providers (configurable via settings.web_search_provider):
 *   · 'serper'  → https://google.serper.dev/search   — Google SERP, free 2,500/mo
 *                 API key in env: SERPER_API_KEY    (admins paste at /admin/settings)
 *   · 'none'    → return null and let the caller fall back to its static URL
 *
 * Results are cached in `web_search_cache` keyed by the canonical query +
 * provider for `web_search_ttl_days` (default 30). Cache misses run live.
 *
 * Public API:
 *   search(query, opts)         → { url, title, snippet, source } | null
 *   pickBestForBenchmark(key)   → convenience wrapper used by deviationEngine
 * =================================================================== */

const crypto = require('crypto');
const { query: dbQuery, queryOne, insert, update } = require('../db/pool');
const settings = require('./settings');

const SERPER_URL = 'https://google.serper.dev/search';

/* Trusted-domain ranking — higher = more authoritative. Any result NOT
 * on this list is still allowed, but ranked last. We keep a tight list
 * of recognized VC research firms / industry benchmarks because the
 * citation goes into a partner-ready memo.                              */
const DOMAIN_WEIGHTS = {
    'benchmarkit.ai': 100,
    'openviewpartners.com': 100,
    'openview.vc': 100,
    'bvp.com': 100,                     // Bessemer
    'highalpha.com': 95,
    'cfoadvisors.com': 90,
    'pavilion.com': 85,
    'sastrnetwork.com': 85,
    'phoenixstrategy.group': 80,
    'paddle.com': 80,
    'chartmogul.com': 80,
    'keybanc.com': 80,                  // KeyBanc Annual SaaS Survey
    'gartner.com': 75,
    'mckinsey.com': 75,
    'firstround.com': 75,
    'a16z.com': 75,
    'sequoia.com': 75,
    'pitchbook.com': 70,
    'cbinsights.com': 70,
    'crunchbase.com': 65,
    'nvca.org': 65,
    'forbes.com': 50,
    'techcrunch.com': 50,
    'medium.com': 30,
    'linkedin.com': 25
};

/* What we ask Google for, per metric. Keep these tight and current. */
const BENCHMARK_QUERIES = {
    gross_margin:  'SaaS Series A gross margin benchmark current year',
    runway:        'startup runway months recommended Series A current year',
    burn:          'SaaS Series A monthly burn rate benchmark current year',
    cac_ltv_ratio: 'SaaS LTV CAC ratio benchmark 3:1 current year',
    arr_growth:    'SaaS Series A ARR growth benchmark current year',
    nrr:           'SaaS net revenue retention NRR benchmark current year',
    cac_payback:   'SaaS CAC payback months benchmark Series A current year',
    quick_ratio:   'SaaS quick ratio benchmark Series A current year'
};

/* Pretty source labels for each metric — used when we have a search hit
 * but want a human-readable benchmark label. */
const BENCHMARK_LABELS = {
    gross_margin:  'Industry SaaS gross-margin benchmark',
    runway:        'Industry startup runway benchmark',
    burn:          'Industry SaaS burn benchmark',
    cac_ltv_ratio: 'Industry SaaS LTV : CAC benchmark',
    arr_growth:    'Industry SaaS ARR growth benchmark',
    nrr:           'Industry SaaS NRR benchmark',
    cac_payback:   'Industry SaaS CAC payback benchmark',
    quick_ratio:   'Industry SaaS quick-ratio benchmark'
};

/* ------------------------------------------------------------------ */
async function isEnabled() {
    const flag = await settings.get('web_search_enabled', false);
    const key  = await settings.get('serper_api_key', null) || process.env.SERPER_API_KEY;
    return !!flag && !!key;
}

/* ----------------------------- main API --------------------------- */
async function search(rawQuery, { ttlDays, force = false } = {}) {
    const q = normalize(rawQuery);
    if (!q) return null;

    const provider = await settings.get('web_search_provider', 'serper');
    const cacheKey = makeCacheKey(provider, q);

    /* 1) cache lookup */
    if (!force) {
        const cached = await queryOne(
            `SELECT cache_key, results, top_url, top_title, top_snippet, expires_at
               FROM web_search_cache
              WHERE cache_key = :k
                AND (expires_at IS NULL OR expires_at > NOW())`,
            { k: cacheKey }
        );
        if (cached && cached.top_url) {
            await update(`UPDATE web_search_cache SET hits = hits + 1 WHERE cache_key = :k`, { k: cacheKey });
            return {
                url: cached.top_url,
                title: cached.top_title,
                snippet: cached.top_snippet,
                source: 'cache'
            };
        }
    }

    /* 2) live call */
    if (!(await isEnabled())) return null;

    let raw;
    try {
        raw = await callSerper(q);
    } catch (err) {
        console.warn('[webSearch] live search failed:', err.message);
        return null;
    }

    const best = pickBest(raw.organic || []);
    if (!best) return null;

    /* 3) persist */
    const ttl = ttlDays != null ? ttlDays : Number(await settings.get('web_search_ttl_days', 30));
    const expiresAt = ttl > 0 ? new Date(Date.now() + ttl * 86400 * 1000) : null;

    try {
        await dbQuery(
            `INSERT INTO web_search_cache
                (cache_key, query, provider, results, top_url, top_title, top_snippet, expires_at)
             VALUES (:k, :q, :p, :r, :u, :t, :s, :e)
             ON DUPLICATE KEY UPDATE
                results      = VALUES(results),
                top_url      = VALUES(top_url),
                top_title    = VALUES(top_title),
                top_snippet  = VALUES(top_snippet),
                expires_at   = VALUES(expires_at),
                refreshed_at = NOW(),
                hits         = hits + 1`,
            {
                k: cacheKey,
                q,
                p: provider,
                r: JSON.stringify((raw.organic || []).slice(0, 10)),
                u: best.url, t: best.title, s: best.snippet,
                e: expiresAt
            }
        );
    } catch (err) {
        console.warn('[webSearch] cache write failed:', err.message);
    }

    return { url: best.url, title: best.title, snippet: best.snippet, source: 'live' };
}

/* Convenience wrapper used by deviationEngine. */
async function pickBestForBenchmark(metricKey) {
    const q = BENCHMARK_QUERIES[metricKey];
    if (!q) return null;
    const yearStamped = q.replace('current year', String(new Date().getFullYear()));
    const hit = await search(yearStamped);
    if (!hit) return null;
    return {
        url: hit.url,
        title: hit.title,
        snippet: hit.snippet,
        label: BENCHMARK_LABELS[metricKey] || 'Industry benchmark'
    };
}

/* ----------------------------- helpers ---------------------------- */

function normalize(s) {
    if (!s) return null;
    return String(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

function makeCacheKey(provider, q) {
    const h = crypto.createHash('sha1').update(`${provider}::${q}`).digest('hex').slice(0, 24);
    return `${provider}:${h}`;
}

async function callSerper(q) {
    const key = (await settings.get('serper_api_key', null)) || process.env.SERPER_API_KEY;
    if (!key) throw new Error('SERPER_API_KEY not set');
    const res = await fetch(SERPER_URL, {
        method: 'POST',
        headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, num: 10, gl: 'us', hl: 'en' })
    });
    if (!res.ok) {
        const txt = (await res.text()).slice(0, 300);
        throw new Error(`Serper ${res.status}: ${txt}`);
    }
    return res.json();
}

/* Rank the SERP by domain weight + position; return the best survivor. */
function pickBest(results) {
    if (!Array.isArray(results) || !results.length) return null;
    const ranked = results
        .filter(r => r.link)
        .map((r, i) => {
            const host = hostOf(r.link);
            const w = DOMAIN_WEIGHTS[host] || domainFamily(host);
            return { idx: i, host, weight: w, ...r };
        })
        .sort((a, b) => b.weight - a.weight || a.idx - b.idx);
    const top = ranked[0];
    return top ? { url: top.link, title: top.title || top.host, snippet: top.snippet || '' } : null;
}

function hostOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

/* Soft weight for unranked domains based on TLD / sub-suffix. */
function domainFamily(host) {
    if (!host) return 5;
    if (host.endsWith('.gov') || host.endsWith('.edu')) return 60;
    if (host.endsWith('.vc') || host.endsWith('.com'))  return 20;
    return 10;
}

module.exports = {
    search,
    pickBestForBenchmark,
    isEnabled,
    BENCHMARK_QUERIES,
    BENCHMARK_LABELS,
    DOMAIN_WEIGHTS
};
