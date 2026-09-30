// Display labels for the CampaignType enum. Kept in one place because three
// screens render them (dashboard, campaign detail, admin) and CSS `capitalize`
// mangles acronyms — it turns HR into "Hr".
export const CAMPAIGN_TYPE_LABEL = {
  HR: 'HR',
  RECRUITER: 'Recruiter',
  SALES: 'Sales',
  LOAN_RECOVERY: 'Loan recovery',
  FEEDBACK: 'Feedback',
};

export const campaignTypeLabel = (type) =>
  CAMPAIGN_TYPE_LABEL[type] ?? String(type ?? '').replace(/_/g, ' ').toLowerCase();
