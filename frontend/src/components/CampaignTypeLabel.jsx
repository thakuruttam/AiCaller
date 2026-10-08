import React from 'react';
import { Briefcase, UserPlus, TrendingUp, Banknote, MessageSquare, Users } from 'lucide-react';
import { campaignTypeLabel } from './campaignTypes';

// One icon per CampaignType enum value (api-service/prisma/schema.prisma), so
// a type column reads at a glance by shape. Deliberately monochrome: colour in
// this app is reserved for brand and status, and a column of five hues next
// to a status column made both harder to read. Shared by every screen that
// lists campaigns.
const TYPE_ICON = {
  HR: Briefcase,
  RECRUITER: UserPlus,
  SALES: TrendingUp,
  LOAN_RECOVERY: Banknote,
  FEEDBACK: MessageSquare,
};

export default function CampaignTypeLabel({ type, className = '' }) {
  const Icon = TYPE_ICON[type] || Users;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium text-foreground ${className}`}>
      <Icon className="size-4 text-muted-foreground" />
      {campaignTypeLabel(type) || 'Campaign'}
    </span>
  );
}
