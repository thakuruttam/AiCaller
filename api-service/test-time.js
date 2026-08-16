import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function run() {
  const logs = await prisma.callLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(logs.map(l => l.durationMs));
  process.exit(0);
}
run();
