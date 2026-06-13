export const PACKS = [
  {
    id: 'TRIAL',
    label: 'Trial',
    amountPaise: 50000,       // ₹500
    displayAmount: '₹500',
    minutes: 100,
    rateDisplay: '₹5.00/min',
    tier: 'TRIAL',
  },
  {
    id: 'BASIC',
    label: 'Basic',
    amountPaise: 200000,      // ₹2,000
    displayAmount: '₹2,000',
    minutes: 440,
    rateDisplay: '₹4.55/min',
    tier: 'BASIC',
  },
  {
    id: 'STANDARD',
    label: 'Standard',
    amountPaise: 500000,      // ₹5,000
    displayAmount: '₹5,000',
    minutes: 1150,
    rateDisplay: '₹4.35/min',
    tier: 'STANDARD',
  },
  {
    id: 'PROFESSIONAL',
    label: 'Professional',
    amountPaise: 1500000,     // ₹15,000
    displayAmount: '₹15,000',
    minutes: 3600,
    rateDisplay: '₹4.17/min',
    tier: 'PROFESSIONAL',
  },
  {
    id: 'ENTERPRISE',
    label: 'Enterprise',
    amountPaise: 5000000,     // ₹50,000
    displayAmount: '₹50,000',
    minutes: 12500,
    rateDisplay: '₹4.00/min',
    tier: 'ENTERPRISE',
  },
  {
    id: 'ENTERPRISE_PLUS',
    label: 'Enterprise+',
    amountPaise: 10000000,    // ₹1,00,000
    displayAmount: '₹1,00,000',
    minutes: 27000,
    rateDisplay: '₹3.70/min',
    tier: 'ENTERPRISE_PLUS',
  },
];

export const TIER_LIMITS = {
  TRIAL:          { teamMembers: 2,  workspaces: 1, campaigns: 1,  contacts: 500,   api: false },
  BASIC:          { teamMembers: 5,  workspaces: 1, campaigns: 3,  contacts: 2000,  api: false },
  STANDARD:       { teamMembers: 10, workspaces: 2, campaigns: 10, contacts: 10000, api: false },
  PROFESSIONAL:   { teamMembers: 25, workspaces: 5, campaigns: -1, contacts: -1,    api: true },
  ENTERPRISE:     { teamMembers: -1, workspaces: -1,campaigns: -1, contacts: -1,    api: true },
  ENTERPRISE_PLUS:{ teamMembers: -1, workspaces: -1,campaigns: -1, contacts: -1,    api: true },
};

// ₹5/min charged to customer, in paise per minute
export const RATE_PER_MINUTE_PAISE = 500;

// Low balance warning threshold (minutes)
export const LOW_BALANCE_THRESHOLD = 30;
