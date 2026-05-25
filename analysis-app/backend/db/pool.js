const mysql = require('mysql2/promise');

/* TLS is required by most hosted MySQL providers (TiDB Cloud, PlanetScale,
 * Aiven). We enable it automatically when DB_SSL=true or the host looks
 * remote. Local XAMPP / 127.0.0.1 stays plain TCP. */
const isRemote = !!process.env.DB_HOST && !/^(127\.0\.0\.1|localhost)$/.test(process.env.DB_HOST);
const useSSL = process.env.DB_SSL === 'true' || isRemote;

const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'windikate_analysis',
    ssl: useSSL ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    namedPlaceholders: true,
    timezone: 'Z'
});

async function query(sql, params = {}) {
    const [rows] = await pool.execute(sql, params);
    return rows;
}

async function queryOne(sql, params = {}) {
    const rows = await query(sql, params);
    return rows[0] || null;
}

async function insert(sql, params = {}) {
    const [result] = await pool.execute(sql, params);
    return result.insertId;
}

async function update(sql, params = {}) {
    const [result] = await pool.execute(sql, params);
    return result.affectedRows;
}

module.exports = { pool, query, queryOne, insert, update };
