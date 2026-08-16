// call-worker/src/db.js
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env from project root regardless of CWD — must happen before the
// first import of this file so DATABASE_URL is available when the client is constructed.
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
config({ path: resolve(__dirname, '../../.env'), quiet: true });

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error']
});
