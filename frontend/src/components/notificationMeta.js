// Presentation for each NotificationType, shared by the bell dropdown and the
// notifications page so the two never drift apart. Keys mirror the
// NotificationType enum in schema.prisma.
export const TYPE_META = {
  CAMPAIGN_CREATED:         { icon: 'rocket_launch',        tone: 'brand',    label: 'Campaign created' },
  CAMPAIGN_STARTED:         { icon: 'play_circle',          tone: 'positive', label: 'Campaign started' },
  CAMPAIGN_PAUSED:          { icon: 'pause_circle',         tone: 'caution',  label: 'Campaign paused' },
  CAMPAIGN_KILLED:          { icon: 'stop_circle',          tone: 'negative', label: 'Campaign stopped' },
  CAMPAIGN_RERUN:           { icon: 'restart_alt',          tone: 'brand',    label: 'Campaign re-run' },
  CAMPAIGN_COMPLETED:       { icon: 'check_circle',         tone: 'positive', label: 'Campaign completed' },
  CALL_COMPLETED:           { icon: 'call',                 tone: 'positive', label: 'Call completed' },
  CALL_FAILED:              { icon: 'phone_missed',         tone: 'negative', label: 'Call failed' },
  MEMBER_INVITED:           { icon: 'mail',                 tone: 'brand',    label: 'Member invited' },
  MEMBER_JOINED:            { icon: 'person_add',           tone: 'positive', label: 'Member joined' },
  MEMBER_ROLE_CHANGED:      { icon: 'key',                  tone: 'caution',  label: 'Role changed' },
  MEMBER_STATUS_CHANGED:    { icon: 'manage_accounts',      tone: 'caution',  label: 'Status changed' },
  MEMBER_REMOVED:           { icon: 'person_remove',        tone: 'neutral',  label: 'Member removed' },
  SUPPORT_TICKET_SUBMITTED: { icon: 'support_agent',        tone: 'brand',    label: 'Ticket submitted' },
  SUPPORT_TICKET_REPLIED:   { icon: 'forum',                tone: 'brand',    label: 'Ticket replied' },
  SUPPORT_TICKET_RESOLVED:  { icon: 'task_alt',             tone: 'positive', label: 'Ticket resolved' },
  TOPUP_SUCCESS:            { icon: 'account_balance_wallet', tone: 'positive', label: 'Top-up successful' },
  BALANCE_LOW:              { icon: 'warning',              tone: 'caution',  label: 'Balance low' },
  BALANCE_DEPLETED:         { icon: 'error',                tone: 'negative', label: 'Balance depleted' },
};

export const FALLBACK_META = { icon: 'notifications', tone: 'neutral', label: 'Notification' };

export const metaFor = (type) => TYPE_META[type] || FALLBACK_META;

// Coarse groupings for the page's type filter, so the dropdown isn't a wall of
// nineteen individual options.
export const TYPE_GROUPS = [
  { value: 'all', label: 'All types', types: [] },
  { value: 'campaigns', label: 'Campaigns', types: [
    'CAMPAIGN_CREATED', 'CAMPAIGN_STARTED', 'CAMPAIGN_PAUSED',
    'CAMPAIGN_KILLED', 'CAMPAIGN_RERUN', 'CAMPAIGN_COMPLETED',
  ] },
  { value: 'calls', label: 'Calls', types: ['CALL_COMPLETED', 'CALL_FAILED'] },
  { value: 'team', label: 'Team', types: [
    'MEMBER_INVITED', 'MEMBER_JOINED', 'MEMBER_ROLE_CHANGED',
    'MEMBER_STATUS_CHANGED', 'MEMBER_REMOVED',
  ] },
  { value: 'support', label: 'Support', types: [
    'SUPPORT_TICKET_SUBMITTED', 'SUPPORT_TICKET_REPLIED', 'SUPPORT_TICKET_RESOLVED',
  ] },
  { value: 'billing', label: 'Billing', types: ['TOPUP_SUCCESS', 'BALANCE_LOW', 'BALANCE_DEPLETED'] },
];

export const typesForGroup = (value) =>
  TYPE_GROUPS.find(g => g.value === value)?.types ?? [];

export function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Buckets for the page's date headings.
export function dateGroup(dateStr) {
  const d = new Date(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const week = new Date(today); week.setDate(week.getDate() - 7);

  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  if (d >= week) return 'Earlier this week';
  return 'Older';
}
