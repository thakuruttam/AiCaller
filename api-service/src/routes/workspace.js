import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  listWorkspaces,
  createWorkspace,
  listMembers,
  addMember,
  updateMemberRole,
  removeMember
} from '../controllers/workspace.controller.js';

const router = Router();

// All workspace routes require authentication
router.use(authenticate);

router.get('/', listWorkspaces);
router.post('/', authorize('SUPER_ADMIN', 'ADMIN'), createWorkspace);

router.get('/:id/members', authorize('SUPER_ADMIN', 'ADMIN'), listMembers);
router.post('/:id/members', authorize('SUPER_ADMIN', 'ADMIN'), addMember);
router.patch('/:id/members/:userId', authorize('SUPER_ADMIN', 'ADMIN'), updateMemberRole);
router.delete('/:id/members/:userId', authorize('SUPER_ADMIN', 'ADMIN'), removeMember);

export default router;
