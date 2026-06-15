const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const requireAdmin     = require('../middleware/admin');
const ctl              = require('../controllers/admin.controller');

// Every route below requires sign-in + admin role
router.use(authenticate, requireAdmin);

router.get('/overview',  ctl.overview);
router.get('/models',    ctl.getModels);

router.get ('/settings',             ctl.getSettings);
router.put ('/settings',             ctl.putSettings);
router.post('/settings/test-search', ctl.testSearch);
router.post('/settings/test-gemini', ctl.testGemini);

router.get('/users',     ctl.listUsers);
router.post('/users',    ctl.createUser);
router.patch('/users/:id', ctl.patchUser);
router.delete('/users/:id', ctl.deleteUser);

router.get('/usage',        ctl.usageReport);
router.get('/usage/events', ctl.usageEvents);
router.get('/usage/facets', ctl.usageFacets);

module.exports = router;
