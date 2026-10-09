// Campaign run state, derived from its call logs.
//
// Campaign has no status column in the schema (see api-service/prisma/
// schema.prisma) — what a campaign is "doing" only exists as the spread of
// statuses across its CallLog rows. Every screen that shows or acts on that
// needs the same reading of it, so it lives here rather than being
// re-derived per page: the Dashboard's status column, its row actions, and
// the campaign detail header all have to agree on whether a campaign can be
// started, or is already running.

// A contact is finished with when their latest log reaches one of these.
export const TERMINAL_STATUSES = new Set([
  'completed', 'failed', 'no-answer', 'busy', 'cancelled',
]);

// Statuses that mean a call is live or about to be: the campaign is working.
const LIVE_STATUSES = new Set(['queued', 'in-progress']);

/** The most recent call log per contact — a re-run keeps the older ones. */
export function latestLogsByContact(campaign) {
  const latest = {};
  (campaign?.callLogs || []).forEach(log => {
    const prev = latest[log.contactId];
    if (!prev || new Date(log.createdAt) > new Date(prev.createdAt)) {
      latest[log.contactId] = log;
    }
  });
  return Object.values(latest);
}

/** Contacts finished vs. total, plus the ratio the progress bar fills to. */
export function contactProgress(campaign) {
  const totalContacts = campaign?.campaignContacts?.length || 0;
  const contactsDone = latestLogsByContact(campaign)
    .filter(log => TERMINAL_STATUSES.has(log.status)).length;
  return {
    totalContacts,
    contactsDone,
    ratio: totalContacts > 0 ? contactsDone / totalContacts : 0,
  };
}

/**
 * What the campaign is doing right now — the single value the run controls
 * and the status column both read.
 *
 * Precedence is deliberate: a campaign can hold a mix of statuses at once
 * (some contacts dialing while others sit paused), and the state shown has
 * to be the one the operator would act on first. Live calls outrank
 * everything, then a pause they need to lift, then a schedule that hasn't
 * fired. 'done' only once every contact is genuinely finished.
 *
 * @returns {'empty'|'draft'|'scheduled'|'running'|'paused'|'done'}
 */
export function campaignRunState(campaign) {
  const totalContacts = campaign?.campaignContacts?.length || 0;
  if (totalContacts === 0) return 'empty';

  const logs = campaign?.callLogs || [];
  if (logs.length === 0) return 'draft';

  if (logs.some(l => LIVE_STATUSES.has(l.status))) return 'running';
  if (logs.some(l => l.status === 'paused')) return 'paused';
  if (logs.some(l => l.status === 'scheduled')) return 'scheduled';

  const { contactsDone } = contactProgress(campaign);
  if (contactsDone >= totalContacts) return 'done';

  return 'draft';
}

// Reader-facing label per state. Not routed through the app-wide
// statusLabel() — that maps CallLog statuses, and these are campaign-level
// states with their own vocabulary ('empty' is not a call status at all).
export const RUN_STATE_LABEL = {
  empty:     'No contacts',
  draft:     'Draft',
  scheduled: 'Scheduled',
  running:   'Running',
  paused:    'Paused',
  done:      'Completed',
};

// Status reads as plain coloured text in the table rather than a pill.
// 'running' takes brand blue and 'done' green so "working on it" and
// "finished" never look alike — the app-wide tone map collapses both to
// positive, which is exactly the distinction this column exists to make.
export const RUN_STATE_TEXT = {
  empty:     'text-muted-foreground',
  draft:     'text-muted-foreground',
  scheduled: 'text-brand-500',
  running:   'text-brand-500',
  paused:    'text-caution-dim dark:text-caution',
  done:      'text-positive',
};

export function runStateLabel(state) {
  return RUN_STATE_LABEL[state] ?? state;
}

/**
 * The lifecycle actions valid from a given state, in the order they should
 * be offered. `primary: true` marks the one that belongs on a row as a
 * single-click control; the rest need the detail screen (or an overflow).
 *
 * `action` is the value POST /api/campaigns/:id/status expects.
 */
const ACTIONS = {
  start:  { action: 'start',  label: 'Start campaign', shortLabel: 'Start',     icon: 'play_arrow',  tone: 'brand',   primary: true },
  resume: { action: 'resume', label: 'Resume',         shortLabel: 'Resume',    icon: 'play_arrow',  tone: 'brand',   primary: true },
  pause:  { action: 'pause',  label: 'Pause',          shortLabel: 'Pause',     icon: 'pause',       tone: 'neutral', primary: true },
  stop:   { action: 'kill',   label: 'Stop campaign',  shortLabel: 'Stop',      icon: 'stop',        tone: 'danger',  primary: false },
  rerun:  { action: 'rerun',  label: 'Run again',      shortLabel: 'Run again', icon: 'refresh',     tone: 'brand',   primary: true },
  // Pausing a scheduled campaign cancels its pending delayed jobs rather
  // than stopping calls in flight (see updateCampaignStatus) — so it's
  // labelled for what it actually does to the operator's schedule.
  // Icon names must exist in the Material Symbols subset requested in
  // frontend/index.html (`icon_names=…`). A name outside it renders as its
  // own literal text, not a glyph.
  unschedule: { action: 'pause', label: 'Cancel schedule', shortLabel: 'Cancel schedule', icon: 'cancel', tone: 'neutral', primary: false },
};

const STATE_ACTIONS = {
  empty:     [],
  draft:     [ACTIONS.start],
  scheduled: [ACTIONS.start, ACTIONS.unschedule],
  running:   [ACTIONS.pause, ACTIONS.stop],
  paused:    [ACTIONS.resume, ACTIONS.stop],
  done:      [ACTIONS.rerun],
};

export function actionsForState(state) {
  return STATE_ACTIONS[state] ?? [];
}

export function primaryActionForState(state) {
  return actionsForState(state).find(a => a.primary) ?? null;
}

// Actions that need a confirmation step, and the copy for it. Stopping
// hangs up live calls and cancels everything queued; re-running re-dials
// every contact, which spends real minutes. Start/pause/resume are
// cheap and reversible, so they fire immediately.
export const ACTION_CONFIRM = {
  kill: {
    title: 'Stop this campaign?',
    body: 'Calls in progress will be hung up and everything still queued is cancelled. Completed calls, recordings and reports are kept.',
    confirmLabel: 'Stop campaign',
    tone: 'danger',
  },
  rerun: {
    title: 'Call every contact again?',
    body: 'A fresh call is queued for all contacts in this campaign. This spends minutes from your balance. Previous recordings, transcripts and reports are kept.',
    confirmLabel: 'Run again',
    tone: 'danger',
  },
};

// What to tell the operator once the action lands. Phrased as the outcome
// they just caused, not the request that succeeded.
export const ACTION_TOAST = {
  start:  'Campaign started — calls are being placed now.',
  resume: 'Campaign resumed.',
  pause:  'Campaign paused. Queued calls are on hold.',
  kill:   'Campaign stopped.',
  rerun:  'Every contact re-queued for a fresh call.',
};
