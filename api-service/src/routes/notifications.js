import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  listNotifications,
  getUnreadCount,
  markRead,
  markUnread,
  markAllRead,
  markManyRead,
  deleteNotification,
  deleteNotifications,
} from '../controllers/notification.controller.js';

const router = Router();

router.use(authenticate);

router.get('/',              listNotifications);
router.get('/unread-count',  getUnreadCount);
router.patch('/read-all',    markAllRead);
router.patch('/read-many',   markManyRead);
router.patch('/:id/read',    markRead);
router.patch('/:id/unread',  markUnread);
router.delete('/',           deleteNotifications);
router.delete('/:id',        deleteNotification);

export default router;
