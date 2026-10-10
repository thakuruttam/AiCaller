// Every claim here is carried over from the product's own capabilities — no
// invented customers, logos, testimonials or metrics. An enterprise buyer will
// check, and a fabricated proof point is worse than none.

// Every top-level link is its own page — no in-page jumps dressed up as
// navigation. `to` renders a client-side <Link>, still a plain crawlable <a>.
export const NAV_LINKS = [
  { to: '/product', label: 'Product' },
  { to: '/use-cases', label: 'Use cases' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/security', label: 'Security' },
  { to: '/faq', label: 'FAQ' },
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
  { n: '01', icon: 'upload_file', tone: 'blue', title: 'Upload your contacts', body: 'Bring a CSV or add contacts by hand. Map columns once; per-contact overrides are supported.' },
  { n: '02', icon: 'target', tone: 'violet', title: 'Define the objective', body: 'Set what the agent must find out, what ends the call early, and how each answer should be judged.' },
  { n: '03', icon: 'rocket_launch', tone: 'amber', title: 'Launch and watch', body: 'Calls dial over enterprise telephony with per-tenant concurrency limits protecting your other campaigns.' },
  { n: '04', icon: 'fact_check', tone: 'emerald', title: 'Read the scored result', body: 'Transcripts, sentiment and outcomes land as each call ends — share a report link with anyone.' },
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
    icon: 'badge',
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
    icon: 'groups',
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
    icon: 'trending_up',
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
    icon: 'account_balance_wallet',
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
    icon: 'sentiment_satisfied',
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

// /product — the full feature reference, grouped by the stage of a campaign
// it belongs to. Deeper than the home page's highlights; every line is a
// feature that exists in the app today.
export const PRODUCT_SECTIONS = [
  {
    id: 'build',
    nav: 'Build',
    title: 'Build a campaign without code',
    body: 'A five-step wizard takes a campaign from a name to a launch-ready call plan.',
    image: { src: '/product/campaign-builder.jpg', alt: 'The campaign builder: campaign name, campaign type tiles, maximum call duration and a grid of AI voices.' },
    features: [
      { title: 'Five campaign types', body: 'HR screening, recruiting, sales, loan recovery and customer feedback, each with a sensible starting structure.' },
      { title: 'Questions with branching', body: 'Add questions or information statements, then skip ahead or end the call based on how each answer is scored.' },
      { title: 'Plain-English scoring', body: 'Describe what a good answer looks like in your own words; the model judges every response against it.' },
      { title: '30 AI voices', body: 'Prebuilt voices from firm to friendly, each with a sample you can play before choosing.' },
      { title: 'Call guardrails', body: 'Set a maximum call duration, an intro, a sign-off and the conditions that end a call early.' },
      { title: 'Test before launch', body: 'Talk to the agent in the AI sandbox to hear exactly how it will open and handle answers.' },
    ],
  },
  {
    id: 'contacts',
    nav: 'Contacts',
    title: 'Bring your contacts as they are',
    body: 'Import a list once and personalise every call from its columns.',
    features: [
      { title: 'CSV and Excel import', body: 'Upload .csv, .xlsx or .xls files and map columns once — or add contacts by hand.' },
      { title: 'Per-contact overrides', body: 'Fill names, amounts, dates or any field into the script per contact, and override call settings for individual people.' },
      { title: 'Duplicate protection', body: 'The same phone number is never added to a campaign twice, so nobody is called twice at once.' },
    ],
  },
  {
    id: 'run',
    nav: 'Run',
    title: 'Run it live',
    body: 'Launch now or schedule a start time, then watch results arrive as calls end.',
    image: { src: '/product/dashboard.jpg', alt: 'The dashboard: calls queued, completed calls, success rate and spend above the list of campaigns.' },
    features: [
      { title: 'Natural, interruptible calls', body: 'Real-time conversation with barge-in handling — people can talk over the agent, as on a normal call.' },
      { title: 'English, Hindi and Hinglish', body: 'Choose the language per campaign; the agent holds the whole conversation in it.' },
      { title: 'Scheduled launches', body: 'Set a start time and the campaign begins dialling on its own.' },
      { title: 'Fair concurrency', body: 'Per-workspace call limits keep one large campaign from slowing down anyone else’s.' },
      { title: 'Live progress and spend', body: 'Calls queued, completed and success rate update live, with spend tracked against each campaign’s estimate.' },
    ],
  },
  {
    id: 'review',
    nav: 'Review',
    title: 'Review every call',
    body: 'Each call ends with a recording, a transcript and an evaluation — no manual listening.',
    image: { src: '/product/campaign-report.jpg', alt: 'A campaign report listing every contact with call status, duration and a link to the individual call report.' },
    features: [
      { title: 'Automatic evaluation', body: 'Sentiment, outcome (completed, reschedule, wrong person and more) and a score for every question.' },
      { title: 'Recordings and transcripts', body: 'Every conversation captured and tied to the evaluation that scored it.' },
      { title: 'Filter, sort and export', body: 'Slice results by outcome, sentiment or status and export exactly what you see to CSV.' },
      { title: 'Shareable reports', body: 'Send a campaign or call report to anyone through a link that expires after 3, 7, 14 or 30 days.' },
    ],
  },
  {
    id: 'manage',
    nav: 'Team & billing',
    title: 'Manage your team and spend',
    body: 'Workspaces, roles and minute-based billing for teams of any size.',
    features: [
      { title: 'Workspaces and roles', body: 'Separate workspaces per team or client, with admin, editor and viewer roles inside each.' },
      { title: 'Invite links', body: 'Invite teammates by email with the role they should have; links expire on their own.' },
      { title: 'Email and SMS notifications', body: 'Get told when campaigns finish, calls fail or your balance runs low — on the channels you choose.' },
      { title: 'Minute-based billing', body: 'Prepaid minute packs with a per-campaign and per-call usage breakdown.' },
    ],
  },
];

// /security — how data is protected, stated as how the system works rather
// than as certifications the product does not hold.
export const SECURITY_SECTIONS = [
  {
    title: 'Access control',
    items: [
      { title: 'Workspace isolation', body: 'Every campaign, contact and call record belongs to one workspace, and the server checks that on every request — not only in the interface.' },
      { title: 'Roles inside each workspace', body: 'Admins manage members and billing, editors build and run campaigns, viewers can only read results.' },
      { title: 'Hashed passwords and Google sign-in', body: 'Passwords are stored as bcrypt hashes, never in plain text; teams can sign in with Google instead.' },
      { title: 'Short-lived sessions', body: 'Access tokens expire quickly and are refreshed in the background, so a leaked token stops working on its own.' },
    ],
  },
  {
    title: 'Sharing and invitations',
    items: [
      { title: 'Expiring share links', body: 'Reports shared outside your team use unguessable links that stop working after the period you choose.' },
      { title: 'Expiring invites', body: 'Invitations carry the role they grant and expire if they are not accepted.' },
      { title: 'Shared pages stay out of search', body: 'Shared reports and invitations are excluded from search engines and AI crawlers.' },
    ],
  },
  {
    title: 'Calls and data',
    items: [
      { title: 'Full call provenance', body: 'Recording, transcript and evaluation stay attached to the call that produced them, for audit after the fact.' },
      { title: 'Protected concurrency', body: 'A fair per-workspace dispatcher caps simultaneous calls, so one campaign cannot starve another team’s.' },
      { title: 'Identity checks on sensitive calls', body: 'Campaigns can confirm they are speaking to the right person before discussing any details, and end politely if not.' },
      { title: 'Encrypted in transit', body: 'The app and its API are served only over HTTPS.' },
    ],
  },
];

export const SECURITY_FAQS = [
  {
    q: 'Who can see my campaigns and calls?',
    a: 'Only members of the workspace they belong to, within the limits of their role — plus anyone you explicitly send an expiring share link to.',
  },
  {
    q: 'Can a shared report link be found by search engines?',
    a: 'No. Shared reports use unguessable links, expire after the period you choose, and are excluded from search engines and AI crawlers.',
  },
  {
    q: 'Do you hold compliance certifications?',
    a: 'We describe how the system protects your data rather than claim certifications we do not hold. For specific requirements, contact us before you start.',
  },
];

// /faq — every question in one place, grouped. Home shows the first few of
// the product group; FAQ structured data lives on /faq only, so each
// question has one canonical home.
export const FAQ_GROUPS = [
  { id: 'product', title: 'Product', items: FAQS },
  { id: 'pricing', title: 'Pricing and billing', items: PRICING_FAQS },
  { id: 'security', title: 'Security and privacy', items: SECURITY_FAQS },
];

// Home stats band — counts of what the product does today, nothing measured
// on customers. Each number is checkable against the app.
export const HOME_STATS = [
  { value: 30, suffix: '', label: 'Prebuilt AI voices', icon: 'graphic_eq', tone: 'blue' },
  { value: 3, suffix: '', label: 'Call languages — English, Hindi, Hinglish', icon: 'translate', tone: 'violet' },
  { value: 5, suffix: '', label: 'Campaign types, from HR to collections', icon: 'campaign', tone: 'amber' },
  { value: 0, suffix: '', label: 'Lines of code to launch a campaign', icon: 'data_object', tone: 'emerald' },
];

export const DEMO_VIDEO = {
  src: '/demo.mp4',
  poster: '/product/demo-poster.jpg',
  title: 'AI Caller Pro product walkthrough',
  description: 'A walkthrough of building a campaign, watching it run live and reviewing scored calls in AI Caller Pro.',
  duration: 'PT56S',
  uploadDate: '2026-09-29',
};
