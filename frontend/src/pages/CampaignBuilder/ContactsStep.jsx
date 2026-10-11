import React, { forwardRef, useMemo, useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../../components/datepicker.css';
import { Alert, Avatar, Badge, Button, Card, IconButton, Input, SelectableCard } from '../../components/ui';
import { useConfirm } from '../../context/ConfirmContext';
import ContactImport from './ContactImport';
import ContactEditor from './ContactEditor';
import {
  defaultScheduleIso, formatIST, formatPhone, formatRupees, hasPersonalisation, isoToPickerDate,
  mergeContacts, pickerDateToIso, plural, RATE_PER_MINUTE,
} from './campaignModel';

const PAGE = 50;
const NONE = [];

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
 * Step 2: who gets called, and when. The list is the main thing; timing and
 * the cost of the run sit beside it so the launch decision is made with the
 * numbers in view.
 */
export default function ContactsStep({ payload, update, readiness, onError }) {
  const confirm = useConfirm();
  const contacts = payload.contacts || NONE;
  const [adding, setAdding] = useState(false);
  const [lastImport, setLastImport] = useState(null); // { added, skipped, duplicates, source, prev }
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState(null); // index into contacts
  // Floor to the next minute so a few seconds of clock drift never makes the
  // current minute unpickable. Read once, at mount.
  const [minDate] = useState(() => isoToPickerDate(new Date(Date.now() + 60_000).toISOString()));

  const setContacts = (next) => update({ contacts: next });
  const showImporter = adding || contacts.length === 0;

  const add = (incoming, { source, skipped }) => {
    const { contacts: next, added, duplicates } = mergeContacts(contacts, incoming);
    setLastImport({ added, skipped, duplicates, source, prev: contacts });
    setContacts(next);
    setAdding(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const indexed = contacts.map((c, index) => ({ c, index }));
    if (!q) return indexed;
    return indexed.filter(({ c }) => `${c.name} ${c.phone} ${c.tag || ''}`.toLowerCase().includes(q));
  }, [contacts, query]);

  const removeAll = async () => {
    const ok = await confirm({
      title: `Remove all ${contacts.length} people?`,
      body: "They won't be called. You can add them again afterwards.",
      confirmLabel: 'Remove all',
      tone: 'danger',
    });
    if (ok) { setContacts([]); setLastImport(null); }
  };

  const scheduled = !!payload.scheduledAt;
  const perCall = payload.callSettings?.maxDuration || 5;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start animate-fade-in">
      <Card className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Who should we call?</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {contacts.length ? plural(contacts.length, 'person', 'people') : 'Add a spreadsheet or paste a list.'}
            </p>
          </div>
          {contacts.length > 0 && (
            <div className="flex items-center gap-2">
              {!adding && <Button variant="subtle" size="sm" icon="person_add" onClick={() => setAdding(true)}>Add more</Button>}
              {adding && <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Done adding</Button>}
              <Button variant="dangerGhost" size="sm" onClick={removeAll}>Remove all</Button>
            </div>
          )}
        </div>

        {lastImport && (
          <Alert
            tone={lastImport.added ? 'positive' : 'caution'}
            className="mb-5"
            title={lastImport.added
              ? `Added ${plural(lastImport.added, 'person', 'people')} from ${lastImport.source}`
              : `No one new in ${lastImport.source}`}
            action={lastImport.added > 0 && (
              <Button variant="ghost" size="sm" onClick={() => { setContacts(lastImport.prev); setLastImport(null); }}>Undo</Button>
            )}
            onDismiss={() => setLastImport(null)}
          >
            {[
              lastImport.duplicates > 0 && `${plural(lastImport.duplicates, 'number')} already on the list`,
              lastImport.skipped > 0 && `${plural(lastImport.skipped, 'row')} skipped — each needs a name and a valid number`,
            ].filter(Boolean).join(' · ') || null}
          </Alert>
        )}

        {showImporter && (
          <div className={contacts.length ? 'mb-5' : ''}>
            <ContactImport onAdd={add} onError={onError} />
          </div>
        )}

        {contacts.length > 0 && (
          <>
            {contacts.length > 8 && (
              <div className="mb-3 max-w-xs">
                <Input icon="search" aria-label="Search people" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder="Search by name, number or tag" />
              </div>
            )}
            {/* Each row is 57px — capped at exactly 7 so the list never
                scrolls for a short list, only once there's an 8th row. */}
            <ul className="divide-y divide-border rounded-xl border border-border max-h-[399px] overflow-y-auto">
              {filtered.slice(0, shown).map(({ c, index }) => (
                <li key={`${c.phone}-${index}`} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={c.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{formatPhone(c.phone)}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5">
                    {(c.tag || c.overrides?.tag) && <Badge dot={false} capitalize={false}>{c.tag || c.overrides.tag}</Badge>}
                    {hasPersonalisation(c) && <Badge tone="brand" dot={false} capitalize={false}>Personalised</Badge>}
                  </div>
                  <IconButton size="sm" icon="edit" title={`Edit ${c.name}`} onClick={() => setEditing(index)} />
                  <IconButton size="sm" tone="danger" icon="close" title={`Remove ${c.name}`} onClick={() => setContacts(contacts.filter((_, i) => i !== index))} />
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">Nobody matches “{query}”.</li>
              )}
            </ul>
            {filtered.length > shown && (
              <div className="mt-3 text-center">
                <Button variant="ghost" size="sm" onClick={() => setShown(s => s + PAGE)}>
                  Show {Math.min(PAGE, filtered.length - shown)} more of {filtered.length - shown}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* top-28 clears the sticky step header above (name + stepper) so this
          card doesn't slide underneath it while the page scrolls. */}
      <Card className="lg:sticky lg:top-28 flex flex-col gap-5">
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
            <SummaryRow label="Questions" value={readiness.questions} />
            <SummaryRow label="Longest call" value={`${perCall} min`} />
            <SummaryRow label="Most it can cost" value={formatRupees(readiness.estCost)} strong />
          </dl>
          <p className="text-xs text-muted-foreground mt-2">₹{RATE_PER_MINUTE} a minute. Most calls end well before the limit.</p>
        </div>
      </Card>

      {editing !== null && contacts[editing] && (
        <ContactEditor
          contact={contacts[editing]}
          campaign={payload}
          isTaken={(phone) => contacts.some((c, i) => i !== editing && c.phone === phone)}
          onSave={(next) => setContacts(contacts.map((c, i) => (i === editing ? next : c)))}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
