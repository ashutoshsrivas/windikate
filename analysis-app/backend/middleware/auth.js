const jwt = require('jsonwebtoken');
const { queryOne } = require('../db/pool');

async function authenticate(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) return res.status(401).json({ error: 'Missing bearer token' });

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await queryOne(
            `SELECT id, email, display_name, role, profession, focus_areas, onboarded_at,
                    allowed_models, monthly_spend_cents, monthly_cap_cents
               FROM users WHERE id = :id`,
            { id: payload.sub }
        );
        if (!user) return res.status(401).json({ error: 'Invalid token subject' });

        req.user = user;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

function signToken(user) {
    return jwt.sign(
        { sub: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
}

module.exports = { authenticate, signToken };
