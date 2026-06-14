#!/usr/bin/env node
/* =====================================================================
 * Migration runner
 * ---------------------------------------------------------------------
 *   node db/migrate.js
 *
 * Reads db/migrations/*.sql, runs whatever hasn't already been applied,
 * and records the version in schema_migrations. Idempotent — safe to
 * run on every deploy.
 * ===================================================================== */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs   = require('fs');
const path = require('path');
const { pool } = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function main() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version    VARCHAR(80) PRIMARY KEY,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    `);
    const [appliedRows] = await pool.query('SELECT version FROM schema_migrations');
    const applied = new Set(appliedRows.map(r => r.version));

    const files = fs.readdirSync(MIGRATIONS_DIR)
        .filter(f => f.endsWith('.sql'))
        .sort();

    let ran = 0;
    for (const file of files) {
        const version = file.replace(/\.sql$/, '');
        if (applied.has(version)) continue;

        process.stdout.write(`  ▸ ${version} `);
        const raw = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

        // Strip line comments (-- …) line-by-line so trailing comments
        // after a `;` don't confuse the splitter.
        const cleaned = raw
            .split('\n')
            .map(line => line.replace(/--.*$/, ''))
            .join('\n');

        const statements = cleaned
            .split(';')
            .map(s => s.trim())
            .filter(Boolean);

        const conn = await pool.getConnection();
        try {
            await conn.query('START TRANSACTION');
            for (const stmt of statements) {
                if (stmt) await conn.query(stmt);
            }
            await conn.query('INSERT INTO schema_migrations (version) VALUES (?)', [version]);
            await conn.query('COMMIT');
            process.stdout.write('✓\n');
            ran++;
        } catch (err) {
            await conn.query('ROLLBACK').catch(() => {});
            process.stdout.write(`✗  ${err.message}\n`);
            throw err;
        } finally {
            conn.release();
        }
    }

    console.log(ran ? `Applied ${ran} migration(s).` : 'No pending migrations.');
    await pool.end();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
