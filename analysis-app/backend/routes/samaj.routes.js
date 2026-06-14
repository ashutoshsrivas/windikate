const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const ctl = require('../controllers/samaj.controller');

router.use(authenticate);

router.get ('/personas',                       ctl.listApprovedPersonas);
router.post('/sessions',                       ctl.createSession);
router.get ('/sessions',                       ctl.listSessions);
router.get ('/sessions/:id',                   ctl.getSession);
router.post('/sessions/:id/messages',          ctl.postMessage);
router.post('/sessions/:id/run-discussion',    ctl.runDiscussionEndpoint);
router.post('/apercept',                       ctl.runAperceptEndpoint);

module.exports = router;
