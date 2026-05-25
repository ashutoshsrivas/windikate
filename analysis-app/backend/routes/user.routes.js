const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctl = require('../controllers/user.controller');

router.get('/me', authenticate, ctl.me);
router.put('/me/onboarding', authenticate, ctl.saveOnboarding);

module.exports = router;
