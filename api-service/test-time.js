import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function run() {
  const logs = await prisma.callLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(logs.map(l => l.durationMs));
  process.exit(0);
}
run();
