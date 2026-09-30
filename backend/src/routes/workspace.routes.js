const express = require('express');
const {
  getCurrentWorkspace,
  getWorkspaceMembers,
  createInvitation,
  getMyInvitations,
  getWorkspaceInvitations,
  acceptInvitation,
  declineInvitation,
  cancelInvitation
} = require('../controllers/workspace.controller');
const { protect } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const {
  createInvitationSchema,
  invitationIdParamSchema,
  workspaceQuerySchema
} = require('../schemas/workspace.schema');

const router = express.Router();

// All workspace routes require authentication
router.use(protect);

// Current workspace info & members
router.get('/current', validate(workspaceQuerySchema), getCurrentWorkspace);
router.get('/current/members', validate(workspaceQuerySchema), getWorkspaceMembers);

// Invitations management for current workspace
router.post('/current/invitations', validate(createInvitationSchema), createInvitation);
router.get('/current/invitations', validate(workspaceQuerySchema), getWorkspaceInvitations);

// Invitations sent to the current user
router.get('/invitations/my', validate(workspaceQuerySchema), getMyInvitations);
router.post('/invitations/:id/accept', validate(invitationIdParamSchema), acceptInvitation);
router.post('/invitations/:id/decline', validate(invitationIdParamSchema), declineInvitation);
router.delete('/invitations/:id', validate(invitationIdParamSchema), cancelInvitation);

module.exports = router;
