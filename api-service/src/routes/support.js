import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { createTicket, listTickets, getTicket, updateStatus, addReply } from '../controllers/support.controller.js';

const router = Router();

router.use(authenticate);

router.post('/',           createTicket);
router.get('/',            listTickets);
router.get('/:id',         getTicket);
router.patch('/:id/status', updateStatus);
router.post('/:id/reply',  addReply);

export default router;
