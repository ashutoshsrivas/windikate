/* =====================================================================
 * Global settings · in-memory cache backed by the settings table
 * ---------------------------------------------------------------------
 * Reads are O(1) (served from a Map). Writes invalidate.
 * Each value is JSON — primitives wrapped (JSON_QUOTE in SQL, JSON.stringify here).
 * ===================================================================== */

const { query, queryOne } = require('../db/pool');

let cache = null;       // Map<keyName, value>
let lastLoad = 0;
const TTL = 30_000;     // re-poll every 30 s in case the admin tab updated it

async function load() {
    const rows = await query('SELECT key_name, value FROM settings');
    cache = new Map();
    for (const r of rows) {
        let v = r.value;
        if (typeof v === 'string') {
            try { v = JSON.parse(v); } catch { /* keep string */ }
        }
        cache.set(r.key_name, v);
    }
    lastLoad = Date.now();
    return cache;
}

async function getAll() {
    if (!cache || Date.now() - lastLoad > TTL) await load();
    return Object.fromEntries(cache);
}

async function get(key, fallback = null) {
    if (!cache || Date.now() - lastLoad > TTL) await load();
    return cache.has(key) ? cache.get(key) : fallback;
}

async function set(key, value, updatedBy = null) {
    await query(
        `INSERT INTO settings (key_name, value, updated_by)
         VALUES (:k, CAST(:v AS JSON), :u)
         ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)`,
        { k: key, v: JSON.stringify(value), u: updatedBy }
    );
    cache = null; // invalidate
}

module.exports = { getAll, get, set, invalidate: () => { cache = null; } };
