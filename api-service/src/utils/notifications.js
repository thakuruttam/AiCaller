// Kept as the import path the controllers already use. The implementation now
// lives in src/notifications/, which writes the in-app row and then fans the
// same notification out to email/SMS according to each user's preferences.
export { notify as createNotification, notifyWorkspace, availableChannels } from '../notifications/index.js';
