import express from 'express';
import cors from 'cors';
import passport from 'passport';

import './db.js';
import campaignRoutes from './routes/campaigns.js';
import sandboxRoutes from './routes/sandbox.js';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspace.js';
import shareRoutes from './routes/share.js';
import notificationRoutes from './routes/notifications.js';
import supportRoutes from './routes/support.js';
import billingRoutes from './routes/billing.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(passport.initialize());

import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/recordings', express.static(path.join(__dirname, '../../recordings')));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'api-service' }));

app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/sandbox', sandboxRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/billing', billingRoutes);

// Any unmatched route (e.g. someone hitting the bare API host in a browser) falls back to the frontend login page.
app.use((req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(`${frontendUrl}/login`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[api-service] Server running on port ${PORT}`);
});

