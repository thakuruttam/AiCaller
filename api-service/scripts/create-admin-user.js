import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash('456786', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@aicaller.com' },
    update: { passwordHash, role: 'ADMIN' },
    create: {
      email: 'admin@aicaller.com',
      name: 'Admin',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    }
  });

  // Create default workspace if it doesn't exist
  const workspace = await prisma.tenant.upsert({
    where: { slug: 'default-workspace' },
    update: {},
    create: { name: 'Default Workspace', slug: 'default-workspace' }
  });

  // Link admin to the workspace as ADMIN
  await prisma.workspaceMember.upsert({
    where: { userId_tenantId: { userId: admin.id, tenantId: workspace.id } },
    update: { role: 'ADMIN' },
    create: { userId: admin.id, tenantId: workspace.id, role: 'ADMIN' }
  });

  console.log('✅ Admin user ready!');
  console.log('   Email:     admin@aicaller.com');
  console.log('   Password:  456786');
  console.log('   Role:      ADMIN');
  console.log('   Workspace:', workspace.name, `(${workspace.id})`);
}

main()
  .catch(e => { console.error('❌ Admin user creation failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
