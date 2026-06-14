const express = require('express');
const { authenticate } = require('../middleware/auth');
const requireAdmin = require('../middleware/admin');
const ctl = require('../controllers/persona.controller');

/* ─── Admin-gated router · mount under /api/admin/personas ─────────── */
const adminRouter = express.Router();
adminRouter.use(authenticate, requireAdmin);

adminRouter.get   ('/invites',           ctl.listInvites);
adminRouter.post  ('/invites',           ctl.createInvite);
adminRouter.delete('/invites/:id',       ctl.revokeInvite);

adminRouter.get   ('/',                  ctl.listPersonas);
adminRouter.get   ('/:id',               ctl.getPersona);
adminRouter.post  ('/:id/approve',       ctl.approvePersona);
adminRouter.post  ('/:id/reject',        ctl.rejectPersona);
adminRouter.delete('/:id',               ctl.deletePersona);

/* ─── Public router · mount under /api/invites ─────────────────────── */
const publicRouter = express.Router();
publicRouter.get ('/:token',         ctl.getInvitePublic);
publicRouter.post('/:token/submit',  ctl.submitIntake);

module.exports = { adminRouter, publicRouter };
