import { Router } from 'express';
import { authenticate, requireWorkspaceAdmin, requireWorkspaceMember } from '../middleware/auth.js';
import {
  listWorkspaces,
  createWorkspace,
  updateWorkspace,
  listMembers,
  addMember,
  updateMemberRole,
  updateMemberStatus,
  removeMember,
  createInvite,
  listInvites,
  revokeInvite,
  getInvite,
  acceptInvite
} from '../controllers/workspace.controller.js';

const router = Router();

// Public — must be before authenticate middleware
router.get('/invite/:token', getInvite);

router.use(authenticate);

// Accept invite (logged-in user)
router.post('/invite/:token/accept', acceptInvite);

// Any authenticated user can list their own workspaces or create a new one
router.get('/', listWorkspaces);
router.post('/', createWorkspace);

// Workspace-scoped ops
router.patch('/:id', requireWorkspaceAdmin, updateWorkspace);
router.get('/:id/members', requireWorkspaceMember, listMembers);
router.post('/:id/members', requireWorkspaceAdmin, addMember);
router.patch('/:id/members/:userId', requireWorkspaceAdmin, updateMemberRole);
router.patch('/:id/members/:userId/status', requireWorkspaceAdmin, updateMemberStatus);
router.delete('/:id/members/:userId', requireWorkspaceAdmin, removeMember);
router.post('/:id/invites', requireWorkspaceAdmin, createInvite);
router.get('/:id/invites', requireWorkspaceAdmin, listInvites);
router.delete('/:id/invites/:inviteId', requireWorkspaceAdmin, revokeInvite);

export default router;
