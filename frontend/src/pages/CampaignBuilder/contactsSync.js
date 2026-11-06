// Saves a campaign's people through POST /api/campaigns/:id/contacts/sync,
// apart from the script: the whole list, in chunks that share one syncId, so
// the server can drop repeats across chunks and, on the last chunk, remove
// anyone who is no longer on the list.

export const MAX_CHUNK_ROWS = 1000;
// nginx in front of the API accepts 1 MB by default — stay well under it.
export const MAX_CHUNK_BYTES = 700_000;

const newSyncId = () => (globalThis.crypto?.randomUUID?.() || `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`);

/** What the server needs per person. */
export const toRow = (c) => ({ name: c.name, phone: c.phone, tag: c.tag || '', overrides: c.overrides || {}, vars: c.vars || {} });

/** Rows split so each chunk has at most MAX_CHUNK_ROWS rows and MAX_CHUNK_BYTES of JSON. Always at least one chunk. */
export function chunkRows(rows, { maxRows = MAX_CHUNK_ROWS, maxBytes = MAX_CHUNK_BYTES } = {}) {
  const chunks = [];
  let current = [];
  let bytes = 2;
  for (const row of rows) {
    const size = JSON.stringify(row).length + 1;
    if (current.length && (current.length >= maxRows || bytes + size > maxBytes)) {
      chunks.push(current);
      current = [];
      bytes = 2;
    }
    current.push(row);
    bytes += size;
  }
  chunks.push(current);
  return chunks;
}

/**
 * Sends the whole list; resolves to the combined result. Each chunk is
 * retried once on a network error — the server dedupes by syncId, so a
 * retried chunk never adds anyone twice.
 */
export async function syncContacts(api, campaignId, contacts, { fileName, onProgress } = {}) {
  const syncId = newSyncId();
  const chunks = chunkRows(contacts.map(toRow));
  const total = { added: 0, updated: 0, removed: 0, skippedRows: [], flaggedRows: [] };
  let rowOffset = 0;
  for (let i = 0; i < chunks.length; i += 1) {
    const body = { syncId, chunkIndex: i, rowOffset, final: i === chunks.length - 1, fileName, rows: chunks[i] };
    rowOffset += chunks[i].length;
    let data;
    try {
      ({ data } = await api.post(`/api/campaigns/${campaignId}/contacts/sync`, body));
    } catch (err) {
      if (err.response) throw err;
      ({ data } = await api.post(`/api/campaigns/${campaignId}/contacts/sync`, body));
    }
    total.added += data.added || 0;
    total.updated += data.updated || 0;
    total.removed += data.removed || 0;
    total.skippedRows.push(...(data.skippedRows || []));
    total.flaggedRows.push(...(data.flaggedRows || []));
    onProgress?.(i + 1, chunks.length);
  }
  return total;
}
