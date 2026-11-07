// Campaign variables: columns from an uploaded contact file, usable as
// {{variable}} in any campaign text and filled in per person at call time.
//
// Pure (no imports, no Node or browser APIs) and kept byte-identical in
//   api-service/src/utils/contactVariables.js        (import, Try it)
//   telephony-gateway/src/utils/contactVariables.js  (live calls)
//   frontend/src/lib/contactVariables.js             (builder, preview)
// A test in api-service fails if the copies drift — edit one, copy it over
// the others.
//
// Text stores variables by stable id ({{v_ab12cd}}) so renaming a variable
// never breaks a line that uses it; the editor shows and accepts names
// ({{amount}}) and converts with toIdTokens / toKeyTokens.

export const MAX_ROWS = 10000;
export const MAX_VARIABLES = 30;
export const MAX_VALUE_CHARS = 200;
export const MAX_KEY_CHARS = 40;
export const VARIABLE_TYPES = ['text', 'number', 'money', 'date'];

/** Built in to every campaign: each person's name. */
export const NAME_VARIABLE = { id: 'name', key: 'name', label: 'Name', type: 'text', builtIn: true };

/** {{ anything }} — the reference inside is an id or a name. */
export const TOKEN_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g;

/** Shown under every text box that accepts variables. */
export const VARIABLE_HINT = 'Type ## or {{ to add a column from your file, e.g. {{amount}}';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_NAMES = MONTHS.map(m => m[0].toUpperCase() + m.slice(1));

// ── Cleaning ────────────────────────────────────────────────────────────────

/**
 * A cell as it may be used: no control characters or line breaks (a value is
 * data inside a sentence or prompt, never structure), spaces collapsed,
 * length-capped.
 */
export function cleanValue(raw) {
  return String(raw ?? '')
    // eslint-disable-next-line no-control-regex -- stripping control characters is the point
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_VALUE_CHARS);
}

/** "Amount Owed (₹)" → "amount_owed" — what people type between {{ }}. */
export function toKey(label) {
  let key = String(label ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, MAX_KEY_CHARS);
  if (!key) key = 'column';
  if (/^[0-9]/.test(key)) key = `col_${key}`.slice(0, MAX_KEY_CHARS);
  return key;
}

/** `key`, or key_2, key_3… if it's taken. */
export function uniqueKey(key, taken = []) {
  const used = new Set(taken);
  if (!used.has(key)) return key;
  for (let n = 2; ; n += 1) {
    const candidate = `${key.slice(0, MAX_KEY_CHARS - String(n).length - 1)}_${n}`;
    if (!used.has(candidate)) return candidate;
  }
}

export const newVariableId = () => `v_${Math.random().toString(36).slice(2, 8)}`;

/**
 * A typed or imported number in E.164, or null. "98765 43210",
 * "098765-43210", "919876543210" and "+91 98765 43210" all become
 * +919876543210 with the default code +91.
 */
export function normalizePhone(raw, defaultCode = '+91') {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  let digits = s.replace(/[^\d]/g, '');
  let phone;
  if (s.startsWith('+')) phone = `+${digits}`;
  else if (digits.startsWith('00')) phone = `+${digits.slice(2)}`;
  else {
    const code = defaultCode.replace(/[^\d]/g, '');
    digits = digits.replace(/^0+/, '');
    phone = digits.startsWith(code) && digits.length >= code.length + 10 ? `+${digits}` : `+${code}${digits}`;
  }
  return /^\+\d{8,15}$/.test(phone) ? phone : null;
}

// ── Parsing by type ─────────────────────────────────────────────────────────

const pad = (n) => String(n).padStart(2, '0');

function isoDate(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

const fullYear = (y, now) => {
  if (y == null) return new Date(now).getUTCFullYear();
  const n = Number(y);
  return n < 100 ? 2000 + n : n;
};

const monthIndex = (word) => {
  const w = String(word).toLowerCase();
  const i = MONTHS.findIndex(m => m.startsWith(w.slice(0, 3)));
  return i >= 0 && w.length >= 3 ? i + 1 : null;
};

/** "₹1,25,000", "Rs. 460", "460/-", "1,250.50" → number, or null. */
export function parseMoney(raw) {
  const s = String(raw ?? '').replace(/₹|rs\.?|inr|rupees?|\/-|,|\s/gi, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

export function parseNumber(raw) {
  const s = String(raw ?? '').replace(/,|\s/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/**
 * A date as "YYYY-MM-DD", or null. Reads Excel serial numbers (46338),
 * ISO (2026-11-12), Indian day-first (12/11/2026, 12-11-26, 12.11.2026) and
 * written dates (12 Nov 2026, 12 November, Nov 12, 2026). A missing year
 * means the current year.
 */
export function parseDate(raw, now = Date.now()) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Math.floor(Number(s));
    if (serial < 20000 || serial > 80000) return null;
    const dt = new Date(Date.UTC(1899, 11, 30) + serial * 864e5);
    return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (m) return isoDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) return isoDate(fullYear(m[3], now), +m[2], +m[1]);
  m = s.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?(?:[\s-]+(\d{2,4}))?$/);
  if (m && monthIndex(m[2])) return isoDate(fullYear(m[3], now), monthIndex(m[2]), +m[1]);
  m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?(?:\s+(\d{4}))?$/);
  if (m && monthIndex(m[1])) return isoDate(fullYear(m[3], now), monthIndex(m[1]), +m[2]);
  return null;
}

/** One cell for a variable of this type: { raw, value }, value null if it can't be read. */
export function parseValue(raw, type = 'text', now = Date.now()) {
  const clean = cleanValue(raw);
  if (!clean) return { raw: '', value: null };
  if (type === 'money') return { raw: clean, value: parseMoney(clean) };
  if (type === 'number') return { raw: clean, value: parseNumber(clean) };
  if (type === 'date') return { raw: clean, value: parseDate(clean, now) };
  return { raw: clean, value: clean };
}

// Whole words only: a bare "rs" used to match "Experience (Years)" and make
// it money; "fee" matched "coffee".
const MONEY_HEADER = /\b(amount|amt|price|prices|balance|fees?|emi|payments?|owed|outstanding|dues|rupees?|inr|rs|cost|total|bill|salary|ctc|lpa)\b|₹/i;
const DATE_HEADER = /date|due|deadline|dob|birthday|expiry|valid|day\b/i;

/**
 * The likely type of a column from its header and up to ~50 sample cells.
 * 80% of non-empty samples must agree; otherwise it's text.
 */
export function detectType(header, samples = [], now = Date.now()) {
  const vals = samples.map(cleanValue).filter(Boolean).slice(0, 50);
  if (!vals.length) return 'text';
  const share = (fn) => vals.filter(fn).length / vals.length;
  const dateLike = (v) => /[a-z]{3}|[/\-.]/i.test(v);
  if (share(v => /₹|rs\.?\s*\d|inr|\/-$/i.test(v) && parseMoney(v) != null) >= 0.8) return 'money';
  if (DATE_HEADER.test(header) && share(v => parseDate(v, now) != null) >= 0.8) return 'date';
  if (share(v => dateLike(v) && parseDate(v, now) != null) >= 0.8) return 'date';
  if (share(v => parseNumber(v) != null) >= 0.8) return MONEY_HEADER.test(header) ? 'money' : 'number';
  return 'text';
}

// ── Formatting for speech ───────────────────────────────────────────────────

/** A parsed value as it should be said: ₹1,25,000 · 12 November · 4,500. */
export function formatValue(value, type = 'text', now = Date.now()) {
  if (value == null || value === '') return '';
  if (type === 'money') {
    const n = Number(value);
    return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;
  }
  if (type === 'number') return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  if (type === 'date') {
    const [y, m, d] = String(value).split('-').map(Number);
    if (!y || !m || !d) return String(value);
    const thisYear = new Date(now).getUTCFullYear();
    return `${d} ${MONTH_NAMES[m - 1]}${y !== thisYear ? ` ${y}` : ''}`;
  }
  return String(value);
}

// ── Tokens and rendering ────────────────────────────────────────────────────

/** Every reference ({{x}}) in a text, in order, without duplicates. */
export function tokensIn(text) {
  const out = [];
  for (const m of String(text ?? '').matchAll(TOKEN_RE)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

const allVariables = (variables = []) => [NAME_VARIABLE, ...variables];

/** The variable a reference means — by id first, then by name. */
export function resolveRef(ref, variables = []) {
  const all = allVariables(variables);
  return all.find(v => v.id === ref) || all.find(v => v.key === ref) || null;
}

/** Editor text → stored text: {{amount}} becomes {{v_ab12cd}}; unknown names stay as written. */
export function toIdTokens(text, variables = []) {
  return String(text ?? '').replace(TOKEN_RE, (whole, ref) => {
    const v = resolveRef(ref, variables);
    return v ? `{{${v.id}}}` : whole;
  });
}

/** Stored text → editor text: {{v_ab12cd}} shows as {{amount}}. */
export function toKeyTokens(text, variables = []) {
  return String(text ?? '').replace(TOKEN_RE, (whole, ref) => {
    const v = resolveRef(ref, variables);
    return v ? `{{${v.key}}}` : whole;
  });
}

/**
 * Names used in texts that aren't variables yet — written before any file
 * was uploaded. They become variables that need a column at upload.
 */
export function undeclaredRefs(texts = [], variables = []) {
  const out = [];
  for (const t of texts) for (const ref of tokensIn(t)) {
    if (!resolveRef(ref, variables) && !out.includes(ref)) out.push(ref);
  }
  return out;
}

/** A variable created from a name typed before upload. */
export function declareVariable(ref, variables = []) {
  const key = uniqueKey(toKey(ref), allVariables(variables).map(v => v.key));
  return { id: newVariableId(), key, label: key.replace(/_/g, ' '), type: 'text', sourceColumns: [], required: true, fallback: '', agentCanSee: true, needsColumn: true };
}

/**
 * A text with one person's values filled in. [Name] (the original
 * placeholder) means the name too. A variable with no value uses its
 * fallback, or becomes empty — `missing` lists those, `unknown` lists
 * references to no variable at all (left as written).
 */
export function renderText(text, { variables = [], values = {}, contactName = '', now = Date.now() } = {}) {
  const missing = [];
  const unknown = [];
  const filled = String(text ?? '')
    .replace(/\[name\]/gi, contactName || '')
    .replace(TOKEN_RE, (whole, ref) => {
      const v = resolveRef(ref, variables);
      if (!v) { if (!unknown.includes(ref)) unknown.push(ref); return whole; }
      if (v.id === NAME_VARIABLE.id) return contactName || '';
      const value = values?.[v.id]?.value;
      const said = formatValue(value, v.type, now);
      if (said) return said;
      if (!missing.includes(v.id)) missing.push(v.id);
      return cleanValue(v.fallback);
    });
  return { text: filled, missing, unknown };
}

/**
 * The facts the agent may use about this person, one per line — only
 * variables marked agentCanSee and with a value.
 */
export function aboutThisPerson({ variables = [], values = {}, contactName = '', now = Date.now() } = {}) {
  const lines = contactName ? [`- Name: ${cleanValue(contactName)}`] : [];
  for (const v of variables) {
    if (v.agentCanSee === false) continue;
    const said = formatValue(values?.[v.id]?.value, v.type, now);
    if (said) lines.push(`- ${cleanValue(v.label || v.key)}: ${said}`);
  }
  return lines.join('\n');
}

// A cell that reads like an instruction to the agent rather than data —
// flagged at import so a bad (or malicious) file is caught before a call.
const INSTRUCTION_LIKE = /\b(ignore|disregard|forget)\b.{0,30}\b(instructions?|rules?|prompt|above|previous)\b|\byou are now\b|\bsystem prompt\b|\bact as\b|\bnew instructions?\b/i;

export const looksLikeInstruction = (value) => INSTRUCTION_LIKE.test(String(value ?? ''));

// ── Rows ────────────────────────────────────────────────────────────────────

/** A person's name from one or more columns: First + Last → "Rakesh Kumar". */
export function buildName(row, nameColumns = []) {
  return cleanValue(nameColumns.map(c => cleanValue(row?.[c])).filter(Boolean).join(' '));
}

/**
 * Rows with valid, unique phones — the first row for a number wins; later
 * ones are reported as duplicates. `existingPhones` are numbers already in
 * the campaign (an upload updates those people instead of adding copies).
 */
export function dedupeByPhone(rows = [], { phoneOf, existingPhones = [] } = {}) {
  const seen = new Set();
  const existing = new Set(existingPhones);
  const unique = [];
  const duplicates = [];
  rows.forEach((row, index) => {
    const phone = phoneOf(row);
    if (!phone) return;
    if (seen.has(phone)) { duplicates.push({ index, phone }); return; }
    seen.add(phone);
    unique.push({ row, index, phone, existing: existing.has(phone) });
  });
  return { unique, duplicates };
}
