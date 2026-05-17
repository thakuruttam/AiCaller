// src/db.js — Prisma singleton
import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' }
  ]
});

prisma.$on('error', (e) => {
  logger.error({ msg: e.message, target: e.target }, '[DB] Prisma error');
});

export { prisma };
