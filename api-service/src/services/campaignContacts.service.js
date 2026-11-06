import { prisma } from '../db.js';
import { enqueueCall, removeQueuedCall } from '../queue/publisher.js';
import {
  MAX_ROWS, MAX_VARIABLES, VARIABLE_TYPES, cleanValue, looksLikeInstruction, normalizePhone, parseValue, toKey,
} from '../utils/contactVariables.js';

// Who a campaign calls, kept apart from the script: the builder saves the
// script through the wizard endpoints and syncs people here, in chunks, with
// a handful of queries per chunk instead of two per person (10,000 people
// used to mean ~20,000 round trips to Atlas).

export const MAX_CHUNK_ROWS = 1000;
const UPDATE_BATCH = 50;
const SYNC_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const VARIABLE_ID_RE = /^v_[a-z0-9]{6}$/;
const TERMINAL = ['completed', 'failed', 'cancelled', 'no-answer', 'busy'];

/**
 * A campaign's variable list as it may be stored, or { error }. Unknown
 * fields are dropped; names are made typeable and unique.
 */
export function readVariables(list) {
  if (list == null) return { variables: [] };
  if (!Array.isArray(list)) return { error: 'variables must be a list.' };
  if (list.length > MAX_VARIABLES) return { error: `A campaign can have at most ${MAX_VARIABLES} variables.` };
  const keys = new Set(['name']);
  const ids = new Set();
  const variables = [];
  for (const v of list) {
    if (!VARIABLE_ID_RE.test(String(v?.id))) return { error: 'Each variable needs a valid id.' };
    if (ids.has(v.id)) return { error: 'Two variables share an id.' };
    const key = toKey(v.key || v.label);
    if (keys.has(key)) return { error: `Two variables are called "${key}" — rename one.` };
    ids.add(v.id); keys.add(key);
    variables.push({
      id: v.id,
      key,
      label: cleanValue(v.label) || key.replace(/_/g, ' '),
      type: VARIABLE_TYPES.includes(v.type) ? v.type : 'text',
      sourceColumns: (Array.isArray(v.sourceColumns) ? v.sourceColumns : []).map(cleanValue).filter(Boolean).slice(0, 3),
      fallback: cleanValue(v.fallback),
      agentCanSee: v.agentCanSee !== false,
      needsColumn: v.needsColumn === true,
    });
  }
  return { variables };
}

/** Per-person overrides are free-form; keep them an object, never trust their name. */
const cleanOverrides = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});

/**
 * One row as it will be stored, or { reason } if it can't be. Variable cells
 * are parsed by the campaign's variable types; cells for unknown variables
 * are dropped.
 */
export function readRow(row, variables, now = Date.now()) {
  const name = cleanValue(row?.name);
  const phone = normalizePhone(row?.phone);
  if (!name && !phone) return { reason: 'No name or phone number' };
  if (!name) return { reason: 'No name' };
  if (!phone) return { reason: `"${cleanValue(row?.phone)}" isn't a valid phone number` };
  const vars = {};
  const flagged = [];
  for (const v of variables) {
    const raw = row?.vars?.[v.id];
    if (raw == null || raw === '') continue;
    const parsed = parseValue(raw, v.type, now);
    if (!parsed.raw) continue;
    vars[v.id] = parsed;
    if (looksLikeInstruction(parsed.raw)) flagged.push(v.id);
  }
  const tag = cleanValue(row?.tag);
  return { name, phone, vars, flagged, overrides: { ...cleanOverrides(row?.overrides), name, ...(tag ? { tag } : {}) } };
}

async function inBatches(items, fn) {
  for (let i = 0; i < items.length; i += UPDATE_BATCH) {
    await Promise.all(items.slice(i, i + UPDATE_BATCH).map(fn));
  }
}

/**
 * One chunk of a contacts sync. A sync is the campaign's whole list, sent in
 * chunks that share `syncId`: rows are added or updated (an existing phone
 * gets the new name and values — never a second entry), a phone repeated
 * within the sync is dropped (first row wins), and on the `final` chunk
 * everyone the sync didn't include is removed from the campaign.
 */
export async function syncContactsChunk({ campaign, userId, syncId, chunkIndex = 0, rowOffset, final = false, fileName, rows }) {
  if (!SYNC_ID_RE.test(String(syncId))) return { status: 400, body: { error: 'Send a syncId.' } };
  if (!Array.isArray(rows)) return { status: 400, body: { error: 'Send the people as rows.' } };
  if (rows.length > MAX_CHUNK_ROWS) return { status: 400, body: { error: `Send at most ${MAX_CHUNK_ROWS} people per request.` } };
  // Rows before this chunk — chunks are split by size too, so not always 1,000 each.
  const offset = Number.isInteger(rowOffset) && rowOffset >= 0 ? rowOffset : chunkIndex * MAX_CHUNK_ROWS;
  if (offset + rows.length > MAX_ROWS) return { status: 400, body: { error: `A campaign can call at most ${MAX_ROWS.toLocaleString('en-IN')} people.` } };

  const tenantId = campaign.tenantId;
  const variables = Array.isArray(campaign.variables) ? campaign.variables : [];
  const skipped = [];
  const flagged = [];

  // 1. Read and validate every row; drop repeats within this chunk.
  const byPhone = new Map();
  rows.forEach((raw, i) => {
    const r = readRow(raw, variables);
    if (r.reason) { skipped.push({ row: offset + i + 1, reason: r.reason }); return; }
    if (byPhone.has(r.phone)) { skipped.push({ row: offset + i + 1, phone: r.phone, reason: 'Duplicate phone number' }); return; }
    byPhone.set(r.phone, { ...r, row: offset + i + 1 });
    if (r.flagged.length) flagged.push({ row: offset + i + 1, phone: r.phone, variables: r.flagged });
  });

  // 2. Contacts (tenant-wide): one lookup, one bulk insert for the new ones.
  const phones = [...byPhone.keys()];
  const found = phones.length ? await prisma.contact.findMany({ where: { tenantId, phone: { in: phones } }, select: { id: true, phone: true } }) : [];
  const contactByPhone = new Map();
  for (const c of found) if (!contactByPhone.has(c.phone)) contactByPhone.set(c.phone, c.id);
  const missing = phones.filter(p => !contactByPhone.has(p));
  if (missing.length) {
    await prisma.contact.createMany({ data: missing.map(p => ({ tenantId, phone: p, name: byPhone.get(p).name })) });
    const created = await prisma.contact.findMany({ where: { tenantId, phone: { in: missing } }, select: { id: true, phone: true } });
    for (const c of created) if (!contactByPhone.has(c.phone)) contactByPhone.set(c.phone, c.id);
  }

  // 3. This campaign's entries for those contacts.
  const contactIds = phones.map(p => contactByPhone.get(p));
  const existing = contactIds.length
    ? await prisma.campaignContact.findMany({ where: { campaignId: campaign.id, contactId: { in: contactIds } }, select: { id: true, contactId: true, syncId: true } })
    : [];
  const ccByContact = new Map();
  for (const cc of existing) if (!ccByContact.has(cc.contactId)) ccByContact.set(cc.contactId, cc);

  const toCreate = [];
  const toUpdate = [];
  for (const [phone, r] of byPhone) {
    const contactId = contactByPhone.get(phone);
    const cc = ccByContact.get(contactId);
    if (cc?.syncId === syncId) { skipped.push({ row: r.row, phone, reason: 'Duplicate phone number' }); continue; }
    const data = { overrides: r.overrides, vars: r.vars, syncId };
    if (cc) toUpdate.push({ id: cc.id, data });
    else toCreate.push({ campaignId: campaign.id, contactId, ...data });
  }

  // 4. Write: new entries and their draft call logs in bulk, updates in batches.
  if (toCreate.length) {
    await prisma.campaignContact.createMany({ data: toCreate });
    await prisma.callLog.createMany({ data: toCreate.map(c => ({ tenantId, contactId: c.contactId, campaignId: campaign.id, status: 'draft' })) });
  }
  await inBatches(toUpdate, (u) => prisma.campaignContact.update({ where: { id: u.id }, data: u.data }));

  // 5. Audit — one record per sync, counts accumulated across chunks.
  const counts = { added: toCreate.length, updated: toUpdate.length, skipped: skipped.length };
  await prisma.contactImport.upsert({
    where: { id: syncId },
    create: {
      id: syncId, campaignId: campaign.id, tenantId, userId: userId || null, fileName: cleanValue(fileName) || null,
      rowCount: rows.length, ...counts, skippedRows: skipped.slice(0, 500),
    },
    update: {
      rowCount: { increment: rows.length },
      added: { increment: counts.added },
      updated: { increment: counts.updated },
      skipped: { increment: counts.skipped },
    },
  });

  let removed = 0;
  if (final) {
    removed = await removeUnsynced(campaign.id, syncId);
    await reconcileSchedule(campaign);
    await refreshEstimatedMinutes(campaign);
  }

  return { status: 200, body: { ...counts, removed, skippedRows: skipped, flaggedRows: flagged } };
}

/** Drops everyone a finished sync didn't include. Call history stays; only never-attempted draft logs go. */
async function removeUnsynced(campaignId, syncId) {
  // Rows from before syncs existed have no syncId at all — match unset too.
  const stale = await prisma.campaignContact.findMany({
    where: { campaignId, OR: [{ syncId: { not: syncId } }, { syncId: null }, { syncId: { isSet: false } }] },
    select: { id: true, contactId: true },
  });
  if (!stale.length) return 0;
  // A contact can have a stale duplicate entry next to the synced one (old
  // data); keep the draft call of anyone still on the list.
  const kept = await prisma.campaignContact.findMany({ where: { campaignId, syncId }, select: { contactId: true } });
  const keptIds = new Set(kept.map(k => k.contactId));
  const contactIds = [...new Set(stale.map(s => s.contactId))].filter(id => !keptIds.has(id));
  if (contactIds.length) await prisma.callLog.deleteMany({ where: { campaignId, contactId: { in: contactIds }, status: 'draft' } });
  await prisma.campaignContact.deleteMany({ where: { id: { in: stale.map(s => s.id) } } });
  return stale.length;
}

/** estimatedTotalMinutes from everyone's effective call length. */
export async function refreshEstimatedMinutes(campaign) {
  const maxSec = campaign.maxCallDurationSec || 300;
  const ccs = await prisma.campaignContact.findMany({ where: { campaignId: campaign.id }, select: { overrides: true } });
  const estimatedTotalMinutes = ccs.reduce((sum, cc) => sum + Math.ceil((cc.overrides?.maxCallDurationSec || maxSec) / 60), 0);
  await prisma.campaign.update({ where: { id: campaign.id }, data: { estimatedTotalMinutes } });
}

/**
 * Makes queued calls match the campaign's schedule: with a future
 * `scheduledAt`, everyone gets a delayed job (a fresh log if they've only
 * finished calls); without one, scheduled jobs are cancelled and their logs
 * go back to draft. Moved here from updateWizardCampaign so a contacts sync
 * can run it too.
 */
export async function reconcileSchedule(campaign) {
  const { id, tenantId } = campaign;
  const scheduleDate = campaign.scheduledAt && new Date(campaign.scheduledAt).getTime() > Date.now() ? new Date(campaign.scheduledAt) : null;
  const existingLogs = await prisma.callLog.findMany({ where: { campaignId: id } });

  if (!scheduleDate) {
    for (const log of existingLogs) {
      if (log.status === 'scheduled') {
        await removeQueuedCall(tenantId, log.id);
        await prisma.callLog.update({ where: { id: log.id }, data: { status: 'draft' } });
      }
    }
    return;
  }

  const ccs = await prisma.campaignContact.findMany({ where: { campaignId: id }, include: { contact: true } });
  const logsByContact = new Map();
  for (const log of existingLogs) {
    if (!logsByContact.has(log.contactId)) logsByContact.set(log.contactId, []);
    logsByContact.get(log.contactId).push(log);
  }
  const delay = scheduleDate.getTime() - Date.now();
  for (const cc of ccs) {
    const logs = logsByContact.get(cc.contactId) || [];
    let target = logs.find(l => ['draft', 'scheduled'].includes(l.status));
    if (!target) {
      const allTerminal = logs.length === 0 || logs.every(l => TERMINAL.includes(l.status));
      if (!allTerminal) continue;
      target = await prisma.callLog.create({ data: { tenantId, contactId: cc.contactId, campaignId: id, status: 'draft' } });
    }
    // BullMQ won't move an existing job's delay — remove it first so a
    // changed time actually takes effect.
    await removeQueuedCall(tenantId, target.id);
    await prisma.callLog.update({ where: { id: target.id }, data: { status: 'scheduled' } });
    await enqueueCall(tenantId, { contactId: cc.contactId, campaignId: id, callLogId: target.id, phone: cc.contact.phone }, { delay, jobId: target.id });
  }
}
