// prisma/seed.js
// Run: node prisma/seed.js

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create default workspace
  const workspace = await prisma.tenant.upsert({
    where: { slug: 'development-workspace' },
    update: {},
    create: {
      name: 'Development Workspace',
      slug: 'development-workspace'
    }
  });
  console.log(`✅ Workspace: "${workspace.name}" (${workspace.id})`);

  // 2. Create super admin user
  const passwordHash = await bcrypt.hash('456786', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@aicaller.com' },
    update: {},
    create: {
      email: 'admin@aicaller.com',
      name: 'Super Admin',
      passwordHash,
      role: 'SUPER_ADMIN',
      status: 'ACTIVE'
    }
  });
  console.log(`✅ User: ${admin.email} (role: ${admin.role})`);

  // 3. Add admin to workspace as ADMIN
  await prisma.workspaceMember.upsert({
    where: { userId_tenantId: { userId: admin.id, tenantId: workspace.id } },
    update: {},
    create: {
      userId: admin.id,
      tenantId: workspace.id,
      role: 'ADMIN'
    }
  });
  console.log(`✅ Linked admin to workspace as ADMIN`);

  console.log('\n🎉 Seed complete!');
  console.log('   Email:    admin@aicaller.com');
  console.log('   Password: 456786');
}

main()
  .catch(e => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
