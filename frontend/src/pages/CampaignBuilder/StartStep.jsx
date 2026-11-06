import React, { forwardRef, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../../components/datepicker.css';
import { Button, Card, SelectableCard } from '../../components/ui';
import {
  defaultScheduleIso, formatIST, formatRupees, isoToPickerDate, pickerDateToIso, plural, RATE_PER_MINUTE,
} from './campaignModel';

// A button, not react-datepicker's default <input>: a button can't take typed
// text, so the time is always picked from the calendar. The ref is forwarded
// so the popper can anchor to it.
const CalendarButton = forwardRef(function CalendarButton({ value, onClick }, ref) {
  return (
    <Button variant="secondary" onClick={onClick} ref={ref} icon="calendar_month" className="w-full !justify-start">
      {value} IST
    </Button>
  );
});

function SummaryRow({ label, value, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-border last:border-0">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className={`text-sm tabular-nums ${strong ? 'font-semibold text-foreground' : 'text-foreground'}`}>{value}</dd>
    </div>
  );
}

/**
 * Step 3: when to call, and what the run costs — the launch decision is made
 * with the numbers in view.
 */
export default function StartStep({ payload, update, readiness }) {
  // Floor to the next minute so a few seconds of clock drift never makes the
  // current minute unpickable. Read once, at mount.
  const [minDate] = useState(() => isoToPickerDate(new Date(Date.now() + 60_000).toISOString()));
  const scheduled = !!payload.scheduledAt;
  const perCall = payload.callSettings?.maxDuration || 5;
  const conversation = payload.mode === 'conversation';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start animate-fade-in">
      <Card className="flex flex-col gap-5">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">When should we call?</h2>
          <div role="radiogroup" aria-label="When to call" className="grid grid-cols-2 gap-2">
            <SelectableCard compact selected={!scheduled} onSelect={() => update({ scheduledAt: null })}>
              <span className="block text-xs font-semibold text-foreground">Right away</span>
              <span className="block text-[11px] text-muted-foreground">When you press start</span>
            </SelectableCard>
            <SelectableCard compact selected={scheduled} onSelect={() => update({ scheduledAt: payload.scheduledAt || defaultScheduleIso() })}>
              <span className="block text-xs font-semibold text-foreground">Later</span>
              <span className="block text-[11px] text-muted-foreground">At a time you pick</span>
            </SelectableCard>
          </div>
          {scheduled && (
            <div className="mt-3 animate-fade-in">
              <DatePicker
                selected={isoToPickerDate(payload.scheduledAt)}
                onChange={(date) => update({ scheduledAt: pickerDateToIso(date) })}
                minDate={minDate}
                showTimeSelect
                timeIntervals={15}
                dateFormat="d MMM yyyy, h:mm aa"
                customInput={<CalendarButton />}
                portalId="datepicker-portal"
                wrapperClassName="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                Calls start by themselves on {formatIST(payload.scheduledAt)} IST.
              </p>
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">This run</h2>
          <dl>
            <SummaryRow label="People" value={readiness.contacts.toLocaleString('en-IN')} />
            {conversation
              ? <SummaryRow label="Kind of call" value="Conversation" />
              : <SummaryRow label="Questions" value={readiness.questions} />}
            <SummaryRow label="Variables" value={(payload.variables || []).length} />
            <SummaryRow label="Longest call" value={`${perCall} min`} />
            <SummaryRow label="Most it can cost" value={formatRupees(readiness.estCost)} strong />
          </dl>
          <p className="text-xs text-muted-foreground mt-2">₹{RATE_PER_MINUTE} a minute. Most calls end well before the limit.</p>
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-foreground mb-3">Before you start</h2>
        {readiness.blockers.length === 0 ? (
          <p className="text-sm text-foreground flex items-center gap-2">
            <span className="material-symbols-outlined [--icon-size:18px] text-positive">check_circle</span>
            Everything is in place — {plural(readiness.contacts, 'person', 'people')} ready to call.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-[13px]">
            {readiness.blockers.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-foreground">
                <span className="material-symbols-outlined [--icon-size:16px] text-caution-dim dark:text-caution mt-px">error</span>
                {b.text}
              </li>
            ))}
          </ul>
        )}
        {readiness.warnings.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5 text-xs text-muted-foreground">
            {readiness.warnings.map((w, i) => <li key={i}>· {w}</li>)}
          </ul>
        )}
      </Card>
    </div>
  );
}
