import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getBilling,
  getHistory,
  getUsage,
  createOrder,
  verifyPayment,
  razorpayWebhook,
} from '../controllers/billing.controller.js';

const router = Router();

// Webhook must use raw body — mount before authenticate
router.post('/webhook', razorpayWebhook);

router.use(authenticate);

router.get('/', getBilling);
router.get('/history', getHistory);
router.get('/usage', getUsage);
router.post('/order', createOrder);
router.post('/verify', verifyPayment);

export default router;
