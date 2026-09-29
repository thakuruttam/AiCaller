// Populates the local database with a realistic-looking workspace — enough
// volume and variety that the product screenshots on the landing page show
// what the app actually looks like in use, rather than one test row.
//
// Local/demo only. Run: node scripts/seed-demo.js
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const CAMPAIGNS = [
  {
    name: 'Q4 Enterprise Outbound — North America',
    type: 'SALES',
    goal: 'Qualify inbound enterprise leads and book a technical demo',
    contacts: 480, done: 431, maxDuration: 6,
  },
  {
    name: 'Senior Engineer Screening — Batch 12',
    type: 'RECRUITER',
    goal: 'Screen applicants on experience, notice period and compensation',
    contacts: 212, done: 198, maxDuration: 5,
  },
  {
    name: 'Post-Delivery CSAT — September',
    type: 'FEEDBACK',
    goal: 'Collect a 1–10 satisfaction score and one improvement theme',
    contacts: 1340, done: 1287, maxDuration: 3,
  },
  {
    name: 'EMI Reminder Cycle — Oct 01',
    type: 'LOAN_RECOVERY',
    goal: 'Confirm payment intent and capture a promise-to-pay date',
    contacts: 760, done: 612, maxDuration: 4,
  },
  {
    name: 'Onboarding Check-in — New Accounts',
    type: 'HR',
    goal: 'Confirm setup completion and surface blockers in week one',
    contacts: 96, done: 44, maxDuration: 5,
  },
];

const FIRST = ['Aditya','Priya','Rahul','Sneha','Vikram','Ananya','Karan','Meera','Arjun','Divya',
               'Rohan','Ishita','Nikhil','Kavya','Sameer','Tara','Dev','Riya','Aman','Neha'];
const LAST  = ['Sharma','Verma','Iyer','Nair','Reddy','Kapoor','Mehta','Bose','Rao','Chawla'];
const STATUSES = [
  ['completed', 0.72], ['no-answer', 0.11], ['busy', 0.06],
  ['failed', 0.05], ['cancelled', 0.03], ['in-progress', 0.03],
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

function weightedStatus() {
  const r = Math.random();
  let acc = 0;
  for (const [s, w] of STATUSES) { acc += w; if (r <= acc) return s; }
  return 'completed';
}

async function main() {
  const workspace = await prisma.tenant.findFirst({ where: { slug: 'development-workspace' } });
  const admin = await prisma.user.findFirst({ where: { email: 'admin@aicaller.com' } });
  if (!workspace || !admin) throw new Error('Run prisma/seed.js first — no development workspace found.');

  console.log('Clearing previous demo data…');
  await prisma.callLog.deleteMany({ where: { tenantId: workspace.id } });
  await prisma.campaignContact.deleteMany({
    where: { campaign: { tenantId: workspace.id } },
  });
  await prisma.campaign.deleteMany({ where: { tenantId: workspace.id } });
  await prisma.contact.deleteMany({ where: { tenantId: workspace.id } });

  let totalCalls = 0;

  for (const spec of CAMPAIGNS) {
    const callModule = await prisma.callModule.create({
      data: {
        name: `${spec.name} Script`,
        prompt: `You are a professional voice agent. ${spec.goal}. Be concise and natural.`,
        goal: spec.goal,
        callIntro: 'Hi, am I speaking with {{name}}?',
        callSignOff: 'Thanks for your time — have a great day.',
        tenantId: workspace.id,
      },
    });

    const campaign = await prisma.campaign.create({
      data: {
        name: spec.name,
        type: spec.type,
        tenantId: workspace.id,
        callModuleId: callModule.id,
        createdById: admin.id,
        maxCallDurationSec: spec.maxDuration * 60,
        estimatedTotalMinutes: spec.contacts * spec.maxDuration,
        callSettings: { maxDuration: spec.maxDuration, language: 'en-IN' },
        // Ids match what the wizard writes, so a seeded campaign opens in the
        // builder exactly like one created through the UI.
        dataToCollect: [
          { id: `${spec.type.toLowerCase()}-intent`, key: 'intent', label: 'Stated intent', itemType: 'question', order: 1 },
          { id: `${spec.type.toLowerCase()}-followup`, key: 'followUp', label: 'Follow-up required', itemType: 'question', order: 2 },
        ],
        createdAt: new Date(Date.now() - rand(2, 26) * 86400000),
      },
    });

    // Sample a subset of contacts to keep the seed fast while the campaign
    // still reports its real headline totals.
    const sampleSize = Math.min(spec.contacts, 40);
    for (let i = 0; i < sampleSize; i++) {
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const contact = await prisma.contact.create({
        data: {
          name,
          phone: `+9198${rand(10000000, 99999999)}`,
          tenantId: workspace.id,
        },
      });
      await prisma.campaignContact.create({
        data: { campaignId: campaign.id, contactId: contact.id },
      });

      // Only the "done" proportion of the sample has a call logged against it.
      if (i < Math.round(sampleSize * (spec.done / spec.contacts))) {
        const status = weightedStatus();
        const durationMs = status === 'completed' ? rand(45, 260) * 1000 : rand(4, 25) * 1000;
        await prisma.callLog.create({
          data: {
            tenantId: workspace.id,
            contactId: contact.id,
            campaignId: campaign.id,
            status,
            durationMs,
            billableMinutes: Math.max(1, Math.ceil(durationMs / 60000)),
            transcript: status === 'completed'
              ? `ASSISTANT: Hi, am I speaking with ${name}?\n\nUSER: Yes, speaking.\n\nASSISTANT: ${spec.goal}.\n\nUSER: Sure, that works for me.\n\nASSISTANT: Thanks for your time — have a great day.`
              : null,
            createdAt: new Date(Date.now() - rand(1, 20) * 3600000),
          },
        });
        totalCalls++;
      }
    }

    console.log(`  ✅ ${spec.name} — ${sampleSize} contacts sampled`);
  }

  console.log(`\n🎉 Demo data ready: ${CAMPAIGNS.length} campaigns, ${totalCalls} call logs.`);
}

main()
  .catch((e) => { console.error('❌ Demo seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
