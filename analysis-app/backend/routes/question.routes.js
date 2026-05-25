const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctl = require('../controllers/question.controller');

router.put('/:id/questions/:qId', authenticate, ctl.updateQuestion);

module.exports = router;
