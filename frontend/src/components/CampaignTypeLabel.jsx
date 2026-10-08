import React from 'react';
import { Briefcase, UserPlus, TrendingUp, Banknote, MessageSquare, Users } from 'lucide-react';
import { campaignTypeLabel } from './campaignTypes';

// One icon/tone per CampaignType enum value (api-service/prisma/schema.prisma)
// so a table's type column reads at a glance instead of everything being the
// same colour. Plain coloured icon + label, no pill background — a column of
// filled pills next to a status column competed for attention. Shared by
// every screen that lists campaigns.
const TYPE_META = {
  HR: { icon: Briefcase, tone: 'text-sky-500' },
  RECRUITER: { icon: UserPlus, tone: 'text-purple-500' },
  SALES: { icon: TrendingUp, tone: 'text-emerald-500' },
  LOAN_RECOVERY: { icon: Banknote, tone: 'text-orange-500' },
  FEEDBACK: { icon: MessageSquare, tone: 'text-pink-500' },
};
const FALLBACK = { icon: Users, tone: 'text-muted-foreground' };

export default function CampaignTypeLabel({ type, className = '' }) {
  const { icon: Icon, tone } = TYPE_META[type] || FALLBACK;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium ${tone} ${className}`}>
      <Icon className="size-4" />
      {campaignTypeLabel(type) || 'Campaign'}
    </span>
  );
}
