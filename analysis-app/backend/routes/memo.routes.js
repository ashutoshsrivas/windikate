const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctl = require('../controllers/memo.controller');

router.post('/:id/memo', authenticate, ctl.generateMemo);

module.exports = router;
