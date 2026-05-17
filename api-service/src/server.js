import express from 'express';
import cors from 'cors';

import './db.js';
import campaignRoutes from './routes/campaigns.js';
import sandboxRoutes from './routes/sandbox.js';
import authRoutes from './routes/auth.js';
import workspaceRoutes from './routes/workspace.js';

const app = express();

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());

import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use('/recordings', express.static(path.join(__dirname, '../../recordings')));

app.use('/api/auth', authRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/sandbox', sandboxRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[api-service] Server running on port ${PORT}`);
});

