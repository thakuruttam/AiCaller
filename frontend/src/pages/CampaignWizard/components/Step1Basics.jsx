import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Building2, User, Lock } from 'lucide-react';

const CAMPAIGN_TYPES = [
  { value: 'HR',            label: 'HR',            desc: 'Recruitment & talent outreach' },
  { value: 'RECRUITER',     label: 'Recruiter',      desc: 'Agency staffing calls' },
  { value: 'SALES',         label: 'Sales',          desc: 'Lead gen & product demos' },
  { value: 'LOAN_RECOVERY', label: 'Loan Recovery',  desc: 'EMI reminders & collections' },
  { value: 'FEEDBACK',      label: 'Feedback',       desc: 'CSAT & post-service surveys' },
];

export default function Step1Basics({ payload, updatePayload }) {
  const { user } = useAuth();

  const workspaceName = user?.workspace?.name  || user?.workspaceName || '—';
  const creatorName   = user?.name             || '—';

  const ReadOnlyField = ({ icon: Icon, label, value }) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium leading-none text-muted-foreground flex items-center gap-1.5">
        <Icon size={13} />
        {label}
      </label>
      <div className="flex items-center gap-2 h-10 w-full rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-foreground/70 select-none">
        <Lock size={12} className="text-muted-foreground/50 shrink-0" />
        <span>{value}</span>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in flex flex-col gap-7">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight">Campaign Basics</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Give your campaign a name, confirm context, and choose its type.
        </p>
      </div>

      {/* Autofilled context row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReadOnlyField icon={Building2} label="Workspace" value={workspaceName} />
        <ReadOnlyField icon={User}      label="Created By" value={creatorName} />
      </div>

      {/* Campaign name */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium leading-none">
          Campaign Name <span className="text-destructive">*</span>
        </label>
        <input
          type="text"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={payload.name}
          onChange={e => updatePayload({ name: e.target.value })}
          placeholder="e.g. Q3 Software Engineer Hiring"
        />
      </div>

      {/* Campaign type */}
      <div className="flex flex-col gap-3">
        <label className="text-sm font-medium leading-none">
          Campaign Type <span className="text-destructive">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CAMPAIGN_TYPES.map(({ value, label, desc }) => (
            <button
              key={value}
              type="button"
              onClick={() => updatePayload({ type: value })}
              className={`flex flex-col items-start gap-1 p-4 rounded-xl border text-left transition-all
                ${payload.type === value
                  ? 'border-primary ring-1 ring-primary bg-primary/5 text-primary'
                  : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
            >
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-xs text-muted-foreground leading-snug">{desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
