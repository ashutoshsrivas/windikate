/* =====================================================================
 * Admin role guard
 * ---------------------------------------------------------------------
 * Mount AFTER `authenticate`. Lets only users whose `role = 'admin'`
 * through. Anyone else gets 403 with a clear reason — important so
 * the frontend can show a helpful message instead of just bouncing.
 * ===================================================================== */

module.exports = function requireAdmin(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Not signed in' });
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            error: 'Admin access required',
            your_role: req.user.role || 'analyst'
        });
    }
    next();
};
