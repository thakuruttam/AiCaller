import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  const workspace = await prisma.tenant.findUnique({
    where: { slug: 'development-workspace' }
  });

  const passwordHash = await bcrypt.hash('456786', 12);

  const qaUser = await prisma.user.upsert({
    where: { email: 'qa@aicaller.com' },
    update: {
      passwordHash,
      role: 'EDITOR'
    },
    create: {
      email: 'qa@aicaller.com',
      name: 'QA User',
      passwordHash,
      role: 'EDITOR',
      status: 'ACTIVE'
    }
  });

  if (workspace) {
    await prisma.workspaceMember.upsert({
      where: { userId_tenantId: { userId: qaUser.id, tenantId: workspace.id } },
      update: {
        role: 'EDITOR'
      },
      create: {
        userId: qaUser.id,
        tenantId: workspace.id,
        role: 'EDITOR'
      }
    });
    console.log(`✅ Linked QA user to workspace: ${workspace.name}`);
  }

  console.log('✅ QA user created!');
  console.log('   Email:    qa@aicaller.com');
  console.log('   Password: 456786');
}

main()
  .catch(e => { console.error('❌ QA user creation failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
