import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { chatRateLimit } from '../middleware/chatRateLimit.js';
import { getFaq, postMessage } from '../controllers/chatbot.controller.js';

const router = Router();

router.use(authenticate);

router.get('/faq',      getFaq);
router.post('/message', chatRateLimit, postMessage);

export default router;
