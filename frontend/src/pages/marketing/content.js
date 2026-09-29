// Every claim here is carried over from the product's own capabilities — no
// invented customers, logos, testimonials or metrics. An enterprise buyer will
// check, and a fabricated proof point is worse than none.

export const NAV_LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#capabilities', label: 'Capabilities' },
  { href: '#how', label: 'How it works' },
  { href: '#security', label: 'Security' },
  { href: '#faq', label: 'FAQ' },
];

// The three screens a buyer actually meets, in order.
export const TOUR = [
  {
    key: 'build',
    step: '01',
    label: 'Build',
    title: 'Design the conversation without writing a script',
    body: 'Choose the campaign type, set a per-call budget, pick from 30 voices, then add questions with branching rules. No prompt engineering, no code.',
    src: '/product/campaign-builder.jpg',
    alt: 'Campaign builder showing campaign name, campaign type tiles, max call duration and a grid of selectable AI voices.',
    points: ['30 prebuilt voices', 'Branching per answer', 'Per-call cost ceiling'],
  },
  {
    key: 'run',
    step: '02',
    label: 'Run',
    title: 'Watch the campaign dial, live',
    body: 'Calls queued, completed and success rate update as the campaign runs — with per-campaign progress and spend tracked against your estimate.',
    src: '/product/dashboard.jpg',
    alt: 'Dashboard showing calls queued, completed calls and success rate above a table of active campaigns with progress and spend.',
    points: ['Live totals, not batch reports', 'Spend vs. estimate per campaign', 'Fair per-tenant dispatch'],
  },
  {
    key: 'review',
    step: '03',
    label: 'Review',
    title: 'Every call transcribed, scored and attributable',
    body: 'Drill into a campaign for per-contact outcomes and durations, then open any single call for its transcript, recording and evaluation.',
    src: '/product/campaign-report.jpg',
    alt: 'Campaign detail listing every contact with call status, duration and a link into the individual call report.',
    points: ['Automatic transcription', 'Sentiment and outcome scoring', 'Shareable report links'],
  },
];

export const CAPABILITIES = [
  {
    icon: 'account_tree',
    title: 'Branching call flows',
    body: 'Skip a question or end the call early based on how someone actually answers — no dead ends, no wasted minutes.',
  },
  {
    icon: 'psychology',
    title: 'Semantic answer scoring',
    body: 'Describe a good answer in plain English and the model judges it. No regex, no brittle keyword rules.',
  },
  {
    icon: 'graphic_eq',
    title: 'Natural, interruptible speech',
    body: 'Real-time conversation with barge-in handling — a contact can talk over the agent mid-sentence, as on a real call.',
  },
  {
    icon: 'translate',
    title: 'Multi-language',
    body: 'English, Hindi and Hinglish today, configurable per campaign.',
  },
  {
    icon: 'fact_check',
    title: 'Automatic evaluation',
    body: 'Every call is transcribed and scored for sentiment, outcome and question-level quality — with no manual review.',
  },
  {
    icon: 'groups',
    title: 'Role-based workspaces',
    body: 'Admins, editors and viewers, with visibility scoped per workspace across every campaign and call.',
  },
  {
    icon: 'description',
    title: 'Recordings & transcripts',
    body: 'Every conversation captured, searchable, and tied back to the evaluation that scored it.',
  },
  {
    icon: 'payments',
    title: 'Usage-based billing',
    body: 'Consumption tracked by call minute, so a campaign’s cost is known before and after it runs.',
  },
];

export const STEPS = [
  { n: '01', title: 'Upload your contacts', body: 'Bring a CSV or add contacts by hand. Map columns once; per-contact overrides are supported.' },
  { n: '02', title: 'Define the objective', body: 'Set what the agent must find out, what ends the call early, and how each answer should be judged.' },
  { n: '03', title: 'Launch and watch', body: 'Calls dial over enterprise telephony with per-tenant concurrency limits protecting your other campaigns.' },
  { n: '04', title: 'Read the scored result', body: 'Transcripts, sentiment and outcomes land as each call ends — share a report link with anyone.' },
];

// Framed as architecture facts rather than compliance badges the product does
// not hold.
export const TRUST = [
  {
    icon: 'lock',
    title: 'Workspace isolation',
    body: 'Every campaign, contact and call log is scoped to a tenant, and access is enforced per request — not just hidden in the UI.',
  },
  {
    icon: 'speed',
    title: 'Protected concurrency',
    body: 'A fair per-tenant dispatcher caps simultaneous calls, so one large campaign cannot starve another team’s.',
  },
  {
    icon: 'link',
    title: 'Expiring share links',
    body: 'Reports can be shared with people who have no account, through links that carry an explicit expiry.',
  },
  {
    icon: 'history',
    title: 'Full call provenance',
    body: 'Recording, transcript and evaluation stay attached to the call that produced them, for audit after the fact.',
  },
];

export const FAQS = [
  {
    q: 'What is AI Caller Pro?',
    a: 'An AI-powered outbound calling platform. You launch a voice campaign, an AI agent conducts each call, and every call is automatically evaluated and reported on in real time.',
  },
  {
    q: 'How does the agent place calls?',
    a: 'Campaigns run over enterprise-grade telephony. The agent follows the objective you set and holds a natural, real-time conversation with each contact.',
  },
  {
    q: 'How is call quality evaluated?',
    a: 'Every completed call is transcribed and scored automatically — sentiment, outcome (completed, reschedule, wrong person and more), and question-level quality — so nobody has to listen to every recording.',
  },
  {
    q: 'Can I share results outside my team?',
    a: 'Yes. Campaign and call reports can be shared through a link without the recipient needing an account, and workspaces support role-based access for admins, editors and viewers.',
  },
  {
    q: 'Does the agent sound robotic?',
    a: 'No. It uses natural speech synthesis with real-time interruption handling, so it responds like a conversation rather than a phone tree.',
  },
  {
    q: 'Which languages are supported?',
    a: 'English, Hindi and Hinglish today, configurable per campaign.',
  },
  {
    q: 'Do I need to write code?',
    a: 'No. Campaigns are built entirely through a no-code wizard — questions, branching logic and scoring rules, all from the dashboard.',
  },
  {
    q: 'How is usage billed?',
    a: 'By call minute. Each campaign shows an estimated total before it runs and tracks actual spend against it as calls complete.',
  },
];
