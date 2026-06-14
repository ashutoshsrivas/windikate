const bcrypt = require('bcryptjs');
const { query, queryOne, insert } = require('../db/pool');
const { signToken } = require('../middleware/auth');

async function register(req, res, next) {
    try {
        const { email, password, display_name } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'email and password required' });
        if (password.length < 8) return res.status(400).json({ error: 'password must be at least 8 characters' });

        const existing = await queryOne('SELECT id FROM users WHERE email = :email', { email });
        if (existing) return res.status(409).json({ error: 'email already registered' });

        const hash = await bcrypt.hash(password, 10);
        const id = await insert(
            'INSERT INTO users (email, password_hash, display_name) VALUES (:email, :hash, :name)',
            { email, hash, name: display_name || null }
        );
        const user = await queryOne('SELECT id, email, display_name, role, profession, focus_areas, onboarded_at, allowed_models FROM users WHERE id = :id', { id });
        res.json({ token: signToken(user), user });
    } catch (err) { next(err); }
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'email and password required' });

        const row = await queryOne(
            'SELECT id, email, password_hash, display_name, role, profession, focus_areas, onboarded_at, allowed_models FROM users WHERE email = :email',
            { email }
        );
        if (!row) return res.status(401).json({ error: 'invalid credentials' });

        const ok = await bcrypt.compare(password, row.password_hash);
        if (!ok) return res.status(401).json({ error: 'invalid credentials' });

        const { password_hash, ...user } = row;
        res.json({ token: signToken(user), user });
    } catch (err) { next(err); }
}

module.exports = { register, login };
