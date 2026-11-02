// Canonical product FAQ — the single source of truth for both the Support
// page (GET /api/chatbot/faq) and the chatbot's system prompt, so the two
// can never drift out of sync with each other.
export const FAQS = [
  { q: 'How do I create a new campaign?', a: 'Click "New Campaign" in the left sidebar. The Campaign Wizard guides you through 7 steps: pick a call module, configure settings, define data to collect, set scoring questions, upload contacts, and review before launch.' },
  { q: "Why aren't my calls connecting?", a: 'Verify your Twilio credentials in the environment config. Ensure phone numbers use E.164 format (+1XXXXXXXXXX). Check your Twilio account balance and confirm the caller ID is active and verified.' },
  { q: 'How do I upload contacts?', a: 'In Step 5 of the Campaign Wizard (or from Campaign Details), click "Upload Contacts" and pick a CSV. The column mapper lets you link columns to Name, Phone, and optional Tag fields.' },
  { q: "What's the difference between campaign types?", a: 'AI Caller Pro supports 5 types: HR (employee engagement), Recruiter (candidate outreach), Sales (lead qualification), Loan Recovery (payment reminders), and Feedback (customer satisfaction). Each shapes the AI tone and evaluation criteria.' },
  { q: 'How does AI scoring work?', a: 'After each call, the evaluation pipeline scores 0–100 based on question coverage, sentiment analysis, identity verification (if enabled), and custom scoring rules per campaign. Scores appear in the Campaign Report.' },
  { q: 'Can I share a campaign report externally?', a: 'Yes. Open a campaign report and click "Share" to generate a time-limited read-only link. Recipients can view scores and transcripts without needing an account.' },
  { q: "What happens when a contact doesn't answer?", a: "The call is logged as NO_ANSWER. Retry behavior can be configured in Campaign Settings. You can also manually re-queue failed calls from the Admin Panel." },
  { q: 'How do I add team members to my workspace?', a: 'Go to Settings → Members tab and click "Invite Member." Enter their email and choose a role: Admin (full access), Editor (create/edit campaigns), or Viewer (read-only).' },
];
