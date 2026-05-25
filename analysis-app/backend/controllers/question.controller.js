const { query, queryOne, update } = require('../db/pool');

// PUT /api/analyses/:id/questions/:qId
async function updateQuestion(req, res, next) {
    try {
        const { id, qId } = req.params;
        const { text, priority } = req.body;

        if (priority && !['critical', 'important', 'nice_to_know'].includes(priority))
            return res.status(400).json({ error: 'invalid priority' });

        const affected = await update(
            `UPDATE questions q
                JOIN analyses a ON a.id = q.analysis_id
                SET q.text     = COALESCE(:text, q.text),
                    q.priority = COALESCE(:priority, q.priority),
                    q.custom_edit = 1
              WHERE q.id = :qId AND a.id = :id AND a.user_id = :uid`,
            { text: text || null, priority: priority || null, qId, id, uid: req.user.id }
        );

        if (!affected) return res.status(404).json({ error: 'question not found' });
        const question = await queryOne('SELECT * FROM questions WHERE id = :id', { id: qId });
        res.json({ question });
    } catch (err) { next(err); }
}

module.exports = { updateQuestion };
