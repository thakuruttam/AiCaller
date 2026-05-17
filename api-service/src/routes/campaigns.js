import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { verifyCampaignAccess, verifyCallLogAccess } from '../middleware/campaignAuth.js';
import {
  getCampaignById,
  updateWizardCampaign,
  createWizardCampaign,
  uploadContacts,
  getCampaigns,
  getCallDetails,
  fetchRecording,
  updateCampaignStatus,
  reevaluateCall,
  recallCall
} from '../controllers/campaign.controller.js';

const router = Router();

// All campaign routes require a valid login
router.use(authenticate);

// Read-only — Viewers can access
router.get('/', authorize('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'), getCampaigns);
router.get('/:id', authorize('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'), verifyCampaignAccess('id'), getCampaignById);
router.get('/calls/:id', authorize('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'), verifyCallLogAccess('id'), getCallDetails);

// Write actions — Editors and above
router.post('/calls/:id/fetch-recording', authorize('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'), verifyCallLogAccess('id'), fetchRecording);
router.post('/calls/:id/evaluate', authorize('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'), verifyCallLogAccess('id'), reevaluateCall);
router.post('/calls/:callLogId/recall', authorize('SUPER_ADMIN', 'ADMIN', 'EDITOR', 'VIEWER'), verifyCallLogAccess('callLogId'), recallCall);
router.post('/wizard', authorize('SUPER_ADMIN', 'ADMIN', 'EDITOR'), createWizardCampaign);
router.put('/wizard/:id', authorize('SUPER_ADMIN', 'ADMIN', 'EDITOR'), verifyCampaignAccess('id'), updateWizardCampaign);
router.post('/:id/status', authorize('SUPER_ADMIN', 'ADMIN', 'EDITOR'), verifyCampaignAccess('id'), updateCampaignStatus);
router.post('/:campaignId/contacts', authorize('SUPER_ADMIN', 'ADMIN', 'EDITOR'), verifyCampaignAccess('campaignId'), uploadContacts);


export default router;
