// Every claim here is carried over from the product's own capabilities — no
// invented customers, logos, testimonials or metrics. An enterprise buyer will
// check, and a fabricated proof point is worse than none.

// Real routes use `to` (client-side, and crawlable as plain links); home
// sections use `href` with an absolute path so they work from every page —
// on the home page the browser treats "/#faq" as an in-page jump.
export const NAV_LINKS = [
  { href: '/#product', label: 'Product' },
  { to: '/use-cases', label: 'Use cases' },
  { to: '/pricing', label: 'Pricing' },
  { href: '/#security', label: 'Security' },
  { href: '/#faq', label: 'FAQ' },
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

// Prepaid minute packs and the limits each unlocks — a copy of
// api-service/src/config/billing.js (PACKS + TIER_LIMITS), because the public
// pricing page is pre-rendered without the API. test/pricingParity.test.js
// fails if the two drift. -1 means unlimited.
export const PRICING = [
  { id: 'TRIAL', label: 'Trial', amountInr: 500, minutes: 100, ratePerMin: 5.0,
    limits: { teamMembers: 2, workspaces: 1, campaigns: 1, contacts: 500, api: false } },
  { id: 'BASIC', label: 'Basic', amountInr: 2000, minutes: 440, ratePerMin: 4.55,
    limits: { teamMembers: 5, workspaces: 1, campaigns: 3, contacts: 2000, api: false } },
  { id: 'STANDARD', label: 'Standard', amountInr: 5000, minutes: 1150, ratePerMin: 4.35,
    limits: { teamMembers: 10, workspaces: 2, campaigns: 10, contacts: 10000, api: false } },
  { id: 'PROFESSIONAL', label: 'Professional', amountInr: 15000, minutes: 3600, ratePerMin: 4.17,
    limits: { teamMembers: 25, workspaces: 5, campaigns: -1, contacts: -1, api: true } },
  { id: 'ENTERPRISE', label: 'Enterprise', amountInr: 50000, minutes: 12500, ratePerMin: 4.0,
    limits: { teamMembers: -1, workspaces: -1, campaigns: -1, contacts: -1, api: true } },
  { id: 'ENTERPRISE_PLUS', label: 'Enterprise+', amountInr: 100000, minutes: 27000, ratePerMin: 3.7,
    limits: { teamMembers: -1, workspaces: -1, campaigns: -1, contacts: -1, api: true } },
];

export const PRICING_FAQS = [
  {
    q: 'How does pricing work?',
    a: 'You buy a prepaid pack of call minutes. Minutes are deducted as calls run, billed by call minute, and every campaign shows its estimated cost before it starts.',
  },
  {
    q: 'Is there a subscription?',
    a: 'No. Packs are one-time top-ups — larger packs carry a lower per-minute rate and unlock higher team, workspace, campaign and contact limits.',
  },
  {
    q: 'What does the per-minute rate include?',
    a: 'The AI voice agent conducting the call over enterprise telephony, plus automatic transcription and evaluation of every completed call.',
  },
  {
    q: 'What happens when my balance runs low?',
    a: 'The dashboard flags a low balance so you can top up before a campaign stalls, and usage is broken down per campaign and per call.',
  },
];

// One page per CampaignType (api-service/prisma/schema.prisma). Every claim
// maps to something the campaign wizard actually does — the question flow,
// branching, semantic scoring, languages, recordings and evaluation — not to
// invented results.
export const USE_CASES = [
  {
    slug: 'hr-screening',
    cta: 'Start screening candidates',
    type: 'HR',
    name: 'HR screening calls',
    title: 'AI Phone Screening for HR & Recruitment Teams',
    description:
      'Automate first-round candidate screening calls. An AI voice agent asks your questions, follows up on answers and scores every candidate call.',
    h1: 'Screen every applicant by phone — without a recruiter on every call',
    intro:
      'Set the questions a first-round screen has to answer — notice period, current and expected compensation, location, role fit — and the agent calls each candidate, holds a natural conversation, and returns a transcript and a score for every answer.',
    tasks: [
      'Confirm the candidate’s interest and availability for the role',
      'Ask notice period, current and expected compensation and preferred location',
      'Skip or follow up on questions based on the answer given',
      'End politely when the person is not the intended candidate',
    ],
    outcomes: [
      'A scored transcript per candidate instead of hand-written notes',
      'Answers judged against what you described as a good answer, in plain English',
      'Shareable report links for hiring managers without an account',
    ],
  },
  {
    slug: 'recruiting',
    cta: 'Start calling candidates',
    type: 'RECRUITER',
    name: 'Recruiting agency calls',
    title: 'AI Calling for Recruiting & Staffing Agencies',
    description:
      'Call every candidate in your pipeline with an AI voice agent that qualifies, confirms availability and scores each call for recruiters.',
    h1: 'Work the whole candidate pipeline, not just the top of it',
    intro:
      'Staffing agencies carry more candidates than recruiters can phone. Upload the list, define what each call must find out, and the agent calls every candidate with per-contact details filled into the conversation.',
    tasks: [
      'Introduce the opening and check whether the candidate is open to it',
      'Collect availability, experience and compensation expectations',
      'Personalise each call with per-contact overrides from your CSV',
      'Handle a candidate talking over the agent mid-sentence, as on a real call',
    ],
    outcomes: [
      'Every candidate contacted, with outcome and sentiment recorded',
      'Filter and sort results by outcome, then export to CSV',
      'Workspaces and roles that keep each client’s campaigns separate',
    ],
  },
  {
    slug: 'sales-outreach',
    cta: 'Start qualifying leads',
    type: 'SALES',
    name: 'Sales outreach & lead qualification',
    title: 'AI Sales Calls for Lead Qualification & Outreach',
    description:
      'Qualify every lead by phone. An AI voice agent asks your qualifying questions, branches on answers and scores intent, with every call transcribed.',
    h1: 'Qualify every lead the day it arrives',
    intro:
      'Describe your qualifying questions and what a strong answer sounds like. The agent calls each lead, adapts the conversation to their answers, and hands your team a scored, searchable record of who is worth a follow-up.',
    tasks: [
      'Open with your pitch and confirm the person is the right contact',
      'Ask budget, timeline and need, branching on each answer',
      'End the call early when a lead is clearly not a fit — no wasted minutes',
      'Capture a callback request when the timing is wrong',
    ],
    outcomes: [
      'Intent and outcome scored for every lead, automatically',
      'Live campaign progress and spend tracked against the estimate',
      'Recordings and transcripts tied to the evaluation that scored them',
    ],
  },
  {
    slug: 'loan-recovery',
    cta: 'Start a collections campaign',
    type: 'LOAN_RECOVERY',
    name: 'Loan recovery & EMI reminders',
    title: 'AI Voice Agent for EMI Reminders & Collections',
    description:
      'Automate EMI reminder and collections calls in English, Hindi or Hinglish. The AI agent verifies the borrower, states dues and records promises to pay.',
    h1: 'EMI reminders and collections calls, at the scale of your book',
    intro:
      'Reminder and early-collections calls are high-volume and repetitive. The agent confirms it is speaking to the borrower, states the pending amount from your data, and records what the borrower commits to — in English, Hindi or Hinglish.',
    tasks: [
      'Verify identity before discussing any account details',
      'State the due amount and date from per-contact fields',
      'Record a promise-to-pay date or a reason for delay',
      'Apologise and end the call if the wrong person answers',
    ],
    outcomes: [
      'Outcome per borrower — completed, reschedule, wrong person and more',
      'Full call provenance — recording, transcript and evaluation — for audit',
      'Usage tracked by call minute, per campaign',
    ],
  },
  {
    slug: 'customer-feedback',
    cta: 'Start a feedback survey',
    type: 'FEEDBACK',
    name: 'Customer feedback & CSAT surveys',
    title: 'AI Phone Surveys for Customer Feedback & CSAT',
    description:
      'Run CSAT and feedback surveys by phone. An AI voice agent asks follow-ups, captures open answers and scores sentiment on every call.',
    h1: 'Phone surveys customers actually finish',
    intro:
      'A conversation gets answers a form does not. The agent asks your survey questions, follows up on low scores to find out why, and every call lands with sentiment and per-question results already scored.',
    tasks: [
      'Ask a rating question and follow up when the score is low',
      'Capture open-ended feedback in the customer’s own words',
      'Keep the survey short with branching that skips irrelevant questions',
      'Run in English, Hindi or Hinglish per campaign',
    ],
    outcomes: [
      'Sentiment breakdown across the whole campaign',
      'Question-by-question results you can filter and export',
      'Report links to share results with the wider team',
    ],
  },
];
