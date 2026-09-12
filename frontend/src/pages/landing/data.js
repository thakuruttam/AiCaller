// Real product content, carried over from the previous landing page — only the
// presentation is being redesigned, not the claims. Icons are lucide-react
// component references (not JSX) so consumers render them as <item.icon />.
import {
  GitBranch, Brain, Mic, Languages, ClipboardCheck, ShieldCheck, FileText,
  CreditCard, Upload, Phone, BarChart3, PhoneCall, Bot, Gauge,
} from 'lucide-react';

export const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#demo', label: 'Demo' },
  { href: '#faq', label: 'FAQ' },
];

export const FEATURES = [
  {
    icon: GitBranch,
    title: 'Branching call flows',
    body: 'Skip a question or end the call early based on how someone actually answers — no dead-end conversations, no wasted minutes.',
  },
  {
    icon: Brain,
    title: 'Semantic answer scoring',
    body: 'Describe what a good answer looks like in plain English — the AI judges it. No regex, no rigid keyword rules.',
  },
  {
    icon: Mic,
    title: 'Natural, interruptible speech',
    body: 'Real-time conversation with barge-in handling — talk over the AI mid-sentence, just like a real call.',
  },
  {
    icon: Languages,
    title: 'Multi-language support',
    body: 'English, Hindi, and Hinglish today, with more configurable per campaign.',
  },
  {
    icon: ClipboardCheck,
    title: 'Automatic call evaluation',
    body: 'Every call is transcribed and scored automatically — sentiment, outcome, and question-level quality — with no manual review.',
  },
  {
    icon: ShieldCheck,
    title: 'Full team oversight',
    body: 'Live visibility across every campaign and call, with role-based workspaces for admins, editors, and viewers.',
  },
  {
    icon: FileText,
    title: 'Recordings & transcripts',
    body: 'Every conversation is captured, searchable, and tied directly back to its evaluation score.',
  },
  {
    icon: CreditCard,
    title: 'Usage-based billing',
    body: 'Consumption is tracked by call minutes, so you always know exactly what a campaign costs before and after it runs.',
  },
];

export const STEPS = [
  { icon: Upload, title: 'Build your campaign', body: 'Use our no-code wizard to add your contact list, questions, and branching logic — no script writing required.' },
  { icon: Phone, title: 'The AI agent calls', body: 'Calls go out over telephony automatically, following your objective in a natural conversation.' },
  { icon: ClipboardCheck, title: 'Every call is scored', body: 'Transcripts, sentiment, and outcome are captured and evaluated the moment a call ends.' },
  { icon: BarChart3, title: 'Review results live', body: 'Track campaign performance on the dashboard, or share a report link with anyone who needs it.' },
];

export const PILLARS = [
  { icon: PhoneCall, label: 'Enterprise-grade telephony' },
  { icon: Bot, label: 'Powered by top AI models' },
  { icon: Gauge, label: 'Live dashboards, not batch reports' },
  { icon: ShieldCheck, label: 'Role-based workspaces' },
];

export const FAQS = [
  {
    q: 'What is AI Caller Pro?',
    a: 'AI Caller Pro is an AI-powered outbound calling platform. You launch a voice campaign, an AI agent conducts each call, and every call is automatically evaluated and reported on in real time.',
  },
  {
    q: 'How does the AI agent make calls?',
    a: 'Campaigns run over enterprise-grade telephony infrastructure. The AI agent follows the objective you set for the campaign and holds a natural, real-time conversation with each contact.',
  },
  {
    q: 'How is call quality evaluated?',
    a: 'Every completed call is transcribed and scored automatically using top AI models — covering sentiment, outcome (completed, reschedule, wrong person, and more), and question-level quality — so nobody has to listen to every recording.',
  },
  {
    q: 'Can I share results with my team or clients?',
    a: 'Yes. Campaign and call reports can be shared through a link without the recipient needing an account, and workspaces support role-based access for admins, editors, and viewers.',
  },
  {
    q: 'How do I get access?',
    a: 'Sign in to get started. Usage is tracked by call minutes so you can monitor and control consumption as campaigns scale.',
  },
  {
    q: 'Does the AI sound robotic?',
    a: 'No — it uses natural text-to-speech with real-time interruption handling, so it responds like a real conversation, not a phone tree.',
  },
  {
    q: 'What languages are supported?',
    a: 'English, Hindi, and Hinglish today, with more configurable per campaign.',
  },
  {
    q: 'Do I need to write any code to build a campaign?',
    a: 'No — campaigns are built entirely through a no-code wizard: questions, branching logic, and scoring rules, all from the dashboard.',
  },
];

// Placeholder frames until real app screenshots are captured (see TourModal.jsx
// comment) — image paths point at /public/screenshots/*.png that don't exist
// yet, so TourModal falls back to an illustrative gradient card when a given
// image 404s.
export const TOUR_STEPS = [
  {
    image: '/screenshots/dashboard.png',
    title: 'Build your campaign',
    body: 'Add your contact list, write your questions, and set branching logic — entirely from a no-code wizard.',
  },
  {
    image: '/screenshots/wizard-voice.png',
    title: 'Pick a voice, set the script',
    body: 'Choose from natural AI voices and preview them before you launch — no engineering required.',
  },
  {
    image: '/screenshots/call-details.png',
    title: 'Every call, transcribed and scored',
    body: 'Recordings, transcripts, and an automatic quality score land the moment a call ends.',
  },
  {
    image: '/screenshots/admin-dashboard.png',
    title: 'Track it all live',
    body: 'See every campaign and call across your team, with role-based access for who gets to see what.',
  },
];
