// Everything the campaign builder knows that isn't a component: the payload
// shape the API speaks, the starter templates, weight balancing, readiness
// checks and contact parsing. Kept pure so it can be tested without a DOM.
//
// The payload is exactly what POST/PUT /api/campaigns/wizard accept — see
// createWizardCampaign in api-service/src/controllers/campaign.controller.js.

export const RATE_PER_MINUTE = 5; // ₹/min, matches api-service/src/config/billing.js

export const CAMPAIGN_TYPES = [
  { value: 'HR', label: 'HR screening', icon: 'badge' },
  { value: 'RECRUITER', label: 'Recruiter', icon: 'work' },
  { value: 'SALES', label: 'Sales', icon: 'trending_up' },
  { value: 'LOAN_RECOVERY', label: 'Payment reminder', icon: 'payments' },
  { value: 'FEEDBACK', label: 'Feedback', icon: 'mood' },
];

// The three the call engine understands (VoiceAgent.js / plivoStreamHandler.js).
export const LANGUAGES = ['English', 'Hindi', 'Hinglish'];

// Gemini Live's prebuilt voices — kept in sync with GEMINI_VOICES in
// api-service/src/controllers/campaign.controller.js. Stored as
// callSettings.geminiVoice.
export const VOICES = [
  { value: 'Kore', desc: 'Firm' },
  { value: 'Aoede', desc: 'Breezy' },
  { value: 'Puck', desc: 'Upbeat' },
  { value: 'Charon', desc: 'Informative' },
  { value: 'Leda', desc: 'Youthful' },
  { value: 'Sulafat', desc: 'Warm' },
  { value: 'Zephyr', desc: 'Bright' },
  { value: 'Orus', desc: 'Firm' },
  { value: 'Autonoe', desc: 'Bright' },
  { value: 'Umbriel', desc: 'Easy-going' },
  { value: 'Erinome', desc: 'Clear' },
  { value: 'Laomedeia', desc: 'Upbeat' },
  { value: 'Schedar', desc: 'Even' },
  { value: 'Achird', desc: 'Friendly' },
  { value: 'Sadachbia', desc: 'Lively' },
  { value: 'Fenrir', desc: 'Excitable' },
  { value: 'Enceladus', desc: 'Breathy' },
  { value: 'Algieba', desc: 'Smooth' },
  { value: 'Algenib', desc: 'Gravelly' },
  { value: 'Achernar', desc: 'Soft' },
  { value: 'Gacrux', desc: 'Mature' },
  { value: 'Zubenelgenubi', desc: 'Casual' },
  { value: 'Sadaltager', desc: 'Knowledgeable' },
  { value: 'Callirrhoe', desc: 'Easy-going' },
  { value: 'Iapetus', desc: 'Clear' },
  { value: 'Despina', desc: 'Smooth' },
  { value: 'Rasalgethi', desc: 'Informative' },
  { value: 'Alnilam', desc: 'Firm' },
  { value: 'Pulcherrima', desc: 'Forward' },
  { value: 'Vindemiatrix', desc: 'Gentle' },
];
export const DEFAULT_VOICE = 'Kore';
// Shown before "Show all voices" — a spread of characters, not the first six.
export const FEATURED_VOICES = ['Kore', 'Aoede', 'Puck', 'Charon', 'Leda', 'Sulafat'];

export const CALL_LENGTHS = [2, 3, 5, 10, 15, 20, 30];

export const RETRY_OPTIONS = [
  { value: 0, label: "Don't try again" },
  { value: 1, label: 'Try once more' },
  { value: 2, label: 'Try 2 more times' },
  { value: 3, label: 'Try 3 more times' },
];

// The matching vocabulary the evaluator understands.
export const CONDITIONS = [
  'contains', 'does not contain', 'equals', 'starts with', 'ends with',
  'is greater than', 'is less than',
];
const ANY = 'is any value';

export const uid = () => Math.random().toString(36).slice(2, 9);

export function newItem(itemType = 'question', text = '') {
  return {
    id: uid(),
    order: 0,
    itemType,
    text,
    is_mandatory: false,
    weight: 0,
    isWeightManuallySet: false,
    expectedAnswer: { condition: ANY, value: '' },
    scoringCriteria: '',
    scoringActiveTab: 'condition',
    onAnswer: {
      action: 'continue',
      skipToId: '',
      skipConditionActiveTab: 'semantic',
      skipCondition: { condition: 'contains', value: '' },
      skipSemanticCondition: '',
    },
    fieldsToExtract: [],
  };
}

export function emptyPayload() {
  return {
    name: '',
    type: 'HR',
    prompt: '',
    goals: { goal: '', callIntro: '', callSignOff: '' },
    dataToCollect: [],
    endCallIf: '',
    rules: { successScore: 50, list: [], fieldsToExtract: [], scoringRules: [] },
    callSettings: {
      tone: 'Professional',
      language: 'English',
      voice: 'marin',
      geminiVoice: DEFAULT_VOICE,
      maxDuration: 5,
      retryAttempts: 2,
    },
    contacts: [],
    // null = call as soon as it starts; an ISO string = dial at that instant.
    scheduledAt: null,
  };
}

// ── Templates ───────────────────────────────────────────────────────────────
// A complete, runnable script per campaign type, so nobody starts from an
// empty page. Square-bracket words other than [Name] are deliberate gaps the
// operator fills in — readiness refuses to dial while any remain, because the
// agent would read them out literally.

const q = (text, extra = {}) => ({ ...newItem('question', text), ...extra });
const say = (text) => newItem('information', text);
const judged = (criteria) => ({ scoringActiveTab: 'semantic', scoringCriteria: criteria });
const endIf = (when) => ({
  onAnswer: { ...newItem().onAnswer, action: 'end_call', skipConditionActiveTab: 'semantic', skipSemanticCondition: when },
});

export const TEMPLATES = [
  {
    type: 'HR',
    title: 'Screen job applicants',
    blurb: 'Check interest, experience, notice period and salary.',
    build: () => ({
      name: 'Applicant screening',
      goals: {
        goal: 'Shortlist applicants for a first-round interview.',
        callIntro: 'Hi [Name], this is an automated call from the hiring team at [Company] about the role you applied for.',
        callSignOff: 'Thank you for your time. Our team will review your answers and get back to you soon.',
      },
      endCallIf: 'The person says they are not looking for a job change, or asks not to be called again.',
      dataToCollect: [
        q('Are you still interested in this role?', {
          is_mandatory: true, ...judged('Full marks if they confirm they are still interested.'),
          ...endIf('They say they are no longer interested.'),
        }),
        q('How many years of relevant experience do you have?', judged('Full marks for 3 or more years, half for 1 to 2 years, none for less than a year.')),
        q('What is your notice period?', judged('Full marks for 30 days or less, half for up to 60 days, none for longer.')),
        q('What salary are you expecting?'),
      ],
    }),
  },
  {
    type: 'RECRUITER',
    title: 'Check candidate availability',
    blurb: 'Find who is open to a new role and when they can start.',
    build: () => ({
      name: 'Candidate availability',
      goals: {
        goal: 'Find candidates who are open to a new opportunity and can start soon.',
        callIntro: 'Hi [Name], this is [Agency] calling about a new opportunity that matches your profile.',
        callSignOff: "Thanks so much. We'll share the details with you shortly. Have a great day!",
      },
      endCallIf: 'The person asks not to be contacted again.',
      dataToCollect: [
        q('Are you open to new opportunities right now?', {
          is_mandatory: true, ...judged('Full marks if they are open to new opportunities.'),
          ...endIf('They are not open to new opportunities.'),
        }),
        q('What kind of role are you looking for?'),
        q('How soon could you start?', judged('Full marks for within 2 weeks, half for within a month, none for longer.')),
        q('What pay are you expecting?'),
      ],
    }),
  },
  {
    type: 'SALES',
    title: 'Book product demos',
    blurb: 'Qualify the lead and offer a short demo.',
    build: () => ({
      name: 'Demo booking',
      goals: {
        goal: 'Qualify the lead and book a product demo.',
        callIntro: "Hi [Name], I'm calling from [Company]. We help teams like yours [what you do].",
        callSignOff: "Wonderful — we'll send your demo invite shortly. Thanks for your time!",
      },
      endCallIf: 'The person says they are not interested or asks not to be called again.',
      dataToCollect: [
        q('Is this something your team is looking to improve this year?', judged('Full marks if it is a current priority.')),
        q('How many people on your team would use it?', judged('Full marks for 10 or more people, half for 3 to 9.')),
        q('Would you like to book a 20-minute demo this week?', {
          is_mandatory: true, ...judged('Full marks if they agree to a demo.'),
        }),
      ],
    }),
  },
  {
    type: 'LOAN_RECOVERY',
    title: 'Remind about a payment',
    blurb: 'Remind about a due EMI and get a payment date.',
    build: () => ({
      name: 'EMI reminder',
      goals: {
        goal: 'Get a firm date for the overdue payment.',
        callIntro: 'Hello [Name], this is a reminder call from [Lender] about your loan account.',
        callSignOff: 'Thank you for your time. Please make the payment by the date you mentioned.',
      },
      endCallIf: 'The person says they are not the account holder.',
      dataToCollect: [
        say('Your EMI of [Amount] was due on [Due date] and is still unpaid.'),
        q('Will you be able to make the payment in the next 3 days?', {
          is_mandatory: true, ...judged('Full marks if they commit to paying within 3 days.'),
        }),
        q('On which date will you make the payment?', { is_mandatory: true }),
        q('Is anything stopping you from paying on time?'),
      ],
    }),
  },
  {
    type: 'FEEDBACK',
    title: 'Collect customer feedback',
    blurb: 'A quick satisfaction score and what to improve.',
    build: () => ({
      name: 'Customer feedback',
      goals: {
        goal: 'Measure how satisfied the customer is and what we can improve.',
        callIntro: 'Hi [Name], this is a quick call from [Company] to hear about your recent experience with us.',
        callSignOff: 'Thank you so much for your feedback — it really helps us improve. Goodbye!',
      },
      endCallIf: 'The person says they are busy or does not want to give feedback.',
      dataToCollect: [
        q('On a scale of 1 to 10, how likely are you to recommend us to a friend?', {
          is_mandatory: true, ...judged('Full marks for 9 or 10, half for 7 or 8, none for 6 or below.'),
        }),
        q('What did you like most about your experience?'),
        q('What is one thing we could do better?'),
      ],
    }),
  },
];

/** The fields a template fills, normalised the way the editor expects. */
export function fromTemplate(type) {
  const tpl = TEMPLATES.find(t => t.type === type) || TEMPLATES[0];
  const built = tpl.build();
  return { ...built, type: tpl.type, dataToCollect: normalizeItems(built.dataToCollect) };
}

// ── Script items ────────────────────────────────────────────────────────────

const isQuestion = (item) => (item.itemType || 'question') === 'question';

/** A question's contribution to the score; sub-fields carry it when present. */
export function itemWeight(item) {
  if (!isQuestion(item)) return 0;
  const subs = item.fieldsToExtract || [];
  return subs.length ? subs.reduce((s, sf) => s + (sf.weight || 0), 0) : (item.weight || 0);
}

export const totalWeight = (items = []) => items.reduce((s, i) => s + itemWeight(i), 0);

/**
 * The single place the script list is made consistent after any edit:
 * ids and order are filled in, statements carry no weight, questions nobody
 * weighted by hand share whatever the hand-weighted ones left over, sub-fields
 * split their question's weight, and a jump that no longer points forward
 * loses its target (readiness then asks for a new one rather than silently
 * turning it into "continue").
 */
export function normalizeItems(items = []) {
  let list = items.map((item, idx) => ({
    ...item,
    id: item.id || uid(),
    order: idx + 1,
    weight: isQuestion(item) ? (item.weight || 0) : 0,
  }));

  const questions = list.filter(isQuestion);
  const auto = questions.filter(q => !q.isWeightManuallySet);
  if (auto.length) {
    const used = questions.filter(q => q.isWeightManuallySet).reduce((s, q) => s + (q.weight || 0), 0);
    const remaining = Math.max(0, 100 - used);
    const base = Math.floor(remaining / auto.length);
    const extra = remaining % auto.length;
    const share = new Map(auto.map((q, i) => [q.id, i < extra ? base + 1 : base]));
    list = list.map(item => (share.has(item.id) ? { ...item, weight: share.get(item.id) } : item));
  }

  list = list.map(item => {
    const subs = item.fieldsToExtract || [];
    if (!isQuestion(item) || !subs.length || subs.some(sf => sf.isWeightManuallySet)) return item;
    const base = Math.floor(item.weight / subs.length);
    const extra = item.weight % subs.length;
    return { ...item, fieldsToExtract: subs.map((sf, i) => ({ ...sf, weight: i < extra ? base + 1 : base })) };
  });

  return list.map((item, idx) => {
    const target = item.onAnswer?.skipToId;
    if (item.onAnswer?.action !== 'skip_question' || !target) return item;
    const targetIdx = list.findIndex(other => other.id === target);
    return targetIdx > idx ? item : { ...item, onAnswer: { ...item.onAnswer, skipToId: '' } };
  });
}

export function moveItem(items, from, to) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return normalizeItems(next);
}

/** How a question is scored, as the editor presents it. */
export function scoringMode(item) {
  if (item.scoringActiveTab === 'semantic') return 'ai';
  const c = item.expectedAnswer?.condition;
  return c && c !== ANY ? 'match' : 'any';
}

export function setScoringMode(item, mode) {
  if (mode === 'ai') return { ...item, scoringActiveTab: 'semantic' };
  if (mode === 'match') {
    const c = item.expectedAnswer?.condition;
    return {
      ...item,
      scoringActiveTab: 'condition',
      expectedAnswer: { condition: c && c !== ANY ? c : 'contains', value: item.expectedAnswer?.value || '' },
    };
  }
  return { ...item, scoringActiveTab: 'condition', expectedAnswer: { condition: ANY, value: '' } };
}

/** The [Company]-style gaps in a piece of text. [Name] is filled per call. */
export function placeholdersIn(text) {
  const found = new Set();
  for (const m of String(text || '').matchAll(/\[([^\]]+)\]/g)) {
    if (m[1].trim().toLowerCase() !== 'name') found.add(`[${m[1].trim()}]`);
  }
  return [...found];
}

/** Every gap still in the script, across all of its lines. */
export function findPlaceholders(payload) {
  const texts = [
    payload.goals?.goal, payload.goals?.callIntro, payload.goals?.callSignOff,
    ...(payload.dataToCollect || []).map(i => i.text),
  ];
  return [...new Set(texts.flatMap(placeholdersIn))];
}

const GOAL_FIELDS = { goal: 'Goal', callIntro: 'Opening line', callSignOff: 'Closing line' };

// ── Readiness ───────────────────────────────────────────────────────────────

export const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

/** Estimated minutes, honouring per-contact length overrides. */
export function estimateMinutes(payload) {
  const perCall = payload.callSettings?.maxDuration || 5;
  return (payload.contacts || []).reduce((sum, c) => {
    const sec = c.overrides?.maxCallDurationSec;
    return sum + (sec ? Math.ceil(sec / 60) : perCall);
  }, 0);
}

/**
 * Everything that stands between this campaign and dialling, tagged with the
 * step where it gets fixed. `blockers` stop a launch (saving a draft is always
 * allowed); `warnings` are worth knowing but legal.
 */
export function getReadiness(payload, now = Date.now()) {
  const items = payload.dataToCollect || [];
  const questions = items.filter(isQuestion);
  const contacts = payload.contacts?.length || 0;
  const weight = totalWeight(items);
  const blockers = [];
  const warnings = [];
  // `itemId` / `field` say where the fix goes; `gap` marks an unfilled
  // [placeholder], which the editor flags the moment it appears.
  const block = (step, text, where = {}) => blockers.push({ step, text, ...where });
  const gaps = (text) => placeholdersIn(text).join(', ');

  if (!payload.name?.trim()) block('script', 'Give the campaign a name.');
  for (const [field, label] of Object.entries(GOAL_FIELDS)) {
    const g = gaps(payload.goals?.[field]);
    if (g) block('script', `${label}: replace ${g} with your own words — the agent would say it out loud.`, { field, gap: true });
  }
  if (!questions.length) block('script', 'Add at least one question.');

  items.forEach((item, idx) => {
    const n = idx + 1;
    if (!item.text?.trim()) {
      block('script', `Line ${n} is empty — write it or remove it.`, { itemId: item.id });
      return;
    }
    const g = gaps(item.text);
    if (g) block('script', `Line ${n}: replace ${g} with your own words.`, { itemId: item.id, gap: true });
    if (!isQuestion(item)) return;
    const mode = scoringMode(item);
    if (mode === 'ai' && !item.scoringCriteria?.trim()) {
      block('script', `Question ${n}: describe what a good answer is.`, { itemId: item.id });
    }
    if (mode === 'match' && !String(item.expectedAnswer?.value ?? '').trim()) {
      block('script', `Question ${n}: enter the answer to match.`, { itemId: item.id });
    }
    const action = item.onAnswer?.action;
    if (action === 'end_call' || action === 'skip_question') {
      const semantic = item.onAnswer.skipConditionActiveTab !== 'condition';
      const cond = item.onAnswer.skipCondition || {};
      const missing = semantic
        ? !item.onAnswer.skipSemanticCondition?.trim()
        : cond.condition !== ANY && !String(cond.value ?? '').trim();
      if (missing) block('script', `Question ${n}: say when to ${action === 'end_call' ? 'end the call' : 'skip ahead'}.`, { itemId: item.id });
    }
    if (action === 'skip_question' && !item.onAnswer.skipToId) {
      block('script', `Question ${n}: choose where to skip to.`, { itemId: item.id });
    }
  });

  if (weight > 100) block('script', `Question weights add up to ${weight}% — bring them down to 100%.`);

  if (!contacts) block('contacts', 'Add the people you want to call.');
  if (payload.scheduledAt && new Date(payload.scheduledAt).getTime() <= now) {
    block('contacts', 'The scheduled time has passed — pick a later one.');
  }

  if (questions.length && weight < 100) {
    warnings.push(`Question weights add up to ${weight}%, so a perfect call scores ${weight}.`);
  }

  const estMinutes = estimateMinutes(payload);
  return {
    blockers,
    warnings,
    questions: questions.length,
    contacts,
    weight,
    estMinutes,
    estCost: estMinutes * RATE_PER_MINUTE,
  };
}

// ── Loading an existing campaign ────────────────────────────────────────────

/** GET /api/campaigns/:id → the payload the builder edits. */
export function fromCampaign(c) {
  const base = emptyPayload();
  return {
    ...base,
    name: c.name || '',
    type: c.type || base.type,
    endCallIf: c.endCallIf || '',
    // Weights already saved were chosen by someone (or balanced and then
    // saved); treat them as deliberate so opening a campaign never reshuffles
    // its scoring.
    dataToCollect: normalizeItems((c.dataToCollect || []).map(i => ({
      ...i,
      isWeightManuallySet: i.isWeightManuallySet ?? true,
    }))),
    rules: { ...base.rules, ...(c.rules || {}) },
    callSettings: { ...base.callSettings, ...(c.callSettings || {}) },
    goals: {
      goal: c.callModule?.goal || '',
      callIntro: c.callModule?.callIntro || '',
      callSignOff: c.callModule?.callSignOff || '',
    },
    contacts: (c.campaignContacts || []).map(cc => ({
      name: cc.overrides?.name || cc.contact?.name || '',
      phone: cc.contact?.phone || '',
      tag: cc.overrides?.tag || '',
      overrides: cc.overrides || {},
    })),
    scheduledAt: c.scheduledAt || null,
  };
}

// ── Contacts ────────────────────────────────────────────────────────────────

export const COUNTRY_CODES = ['+91', '+1', '+44', '+971', '+61', '+65'];

/**
 * A typed or imported number in E.164, or null if it can't be one.
 * "98765 43210", "098765-43210", "919876543210" and "+91 98765 43210" all
 * become +919876543210 with the default code +91.
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
    phone = digits.startsWith(code) && digits.length >= code.length + 10
      ? `+${digits}`
      : `+${code}${digits}`;
  }
  return /^\+\d{8,15}$/.test(phone) ? phone : null;
}

/**
 * Lines of "Name, phone[, tag]" — commas, tabs or just a space between the
 * name and the number all work. A first line with no number is taken to be a
 * header and ignored; any other line that can't be read is counted as skipped.
 */
export function parsePastedContacts(text, defaultCode = '+91') {
  const contacts = [];
  let skipped = 0;
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const parts = line.split(/[,\t;]/).map(p => p.trim()).filter(Boolean);
    let name = '';
    let phoneRaw = '';
    let tag = '';
    const phoneIdx = parts.findIndex(p => /\d{6,}/.test(p.replace(/[\s\-().]/g, '')));
    if (parts.length > 1 && phoneIdx >= 0) {
      phoneRaw = parts[phoneIdx];
      const rest = parts.filter((_, j) => j !== phoneIdx);
      name = rest[0] || '';
      tag = rest[1] || '';
    } else {
      // "Priya Sharma 98765 43210" — the number is the trailing run of digits.
      const m = line.match(/^(.*?)(\+?[\d][\d\s\-().]{6,})$/);
      if (m) { name = m[1].trim(); phoneRaw = m[2]; }
    }
    const phone = normalizePhone(phoneRaw, defaultCode);
    if (!phone || !name) {
      if (!(i === 0 && !phoneRaw)) skipped += 1;
      return;
    }
    contacts.push({ name, phone, tag });
  });
  return { contacts, skipped };
}

/** Best guess at which spreadsheet columns hold the name, phone and tag. */
export function guessColumns(headers = []) {
  const find = (re) => headers.find(h => re.test(String(h))) || '';
  return {
    nameCol: find(/name/i),
    phoneCol: find(/phone|mobile|number|contact|whatsapp|cell/i),
    tagCol: find(/tag|group|segment|label|team|batch/i),
  };
}

export function rowsToContacts(rows, { nameCol, phoneCol, tagCol }, defaultCode = '+91') {
  const contacts = [];
  let skipped = 0;
  for (const row of rows) {
    const name = String(row[nameCol] ?? '').trim();
    const phone = normalizePhone(row[phoneCol], defaultCode);
    if (!name || !phone) { skipped += 1; continue; }
    contacts.push({ name, phone, tag: tagCol ? String(row[tagCol] ?? '').trim() : '' });
  }
  return { contacts, skipped };
}

/**
 * Adds new people to the list, one row per phone number (the API keeps one
 * configuration per number). Returns how many were actually added.
 */
export function mergeContacts(existing = [], incoming = []) {
  const seen = new Set(existing.map(c => c.phone));
  const added = [];
  for (const c of incoming) {
    if (seen.has(c.phone)) continue;
    seen.add(c.phone);
    added.push({ ...c, overrides: { ...(c.overrides || {}), name: c.name, tag: c.tag || '' } });
  }
  return { contacts: [...existing, ...added], added: added.length, duplicates: incoming.length - added.length };
}

/** +919876543210 → "+91 98765 43210" for reading; other numbers as stored. */
export function formatPhone(phone) {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone || '');
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}

export const hasPersonalisation = (c) =>
  !!(c.overrides?.goals || c.overrides?.maxCallDurationSec || c.overrides?.dataToCollect);

// ── Scheduling (always India Standard Time) ─────────────────────────────────
// Calls are scheduled in IST by convention, whatever the viewer's own clock
// says. react-datepicker reads a Date's local getters, so the picker is fed a
// Date whose local fields hold the IST wall-clock numbers.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function isoToPickerDate(iso) {
  if (!iso) return null;
  const s = new Date(new Date(iso).getTime() + IST_OFFSET_MS);
  return new Date(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), s.getUTCHours(), s.getUTCMinutes());
}

export function pickerDateToIso(date) {
  if (!date) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const wall = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00+05:30`;
  return new Date(wall).toISOString();
}

export const formatIST = (iso) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });

/** Tomorrow at 10:00 IST — a sensible first suggestion when scheduling. */
export function defaultScheduleIso(now = Date.now()) {
  const ist = new Date(now + IST_OFFSET_MS);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth();
  const d = ist.getUTCDate() + 1;
  return new Date(Date.UTC(y, m, d, 10, 0) - IST_OFFSET_MS).toISOString();
}

export const formatRupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
