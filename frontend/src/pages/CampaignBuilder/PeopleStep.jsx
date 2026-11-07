import React, { useMemo, useState } from 'react';
import { Alert, Avatar, Badge, Button, Card, IconButton, Input, Select } from '../../components/ui';
import { useConfirm } from '../../context/ConfirmContext';
import ContactImport from './ContactImport';
import ContactEditor from './ContactEditor';
import {
  clearFlaggedCells, flaggedContacts, formatPhone, hasPersonalisation, mergeContacts, plural, removeVariable,
  renameVariable, usedVariableRefs,
} from './campaignModel';
import { VARIABLE_HINT, VARIABLE_TYPES, formatValue, parseValue } from '../../lib/contactVariables';

const PAGE = 50;
const NONE = [];
const TYPE_LABELS = { text: 'Text', number: 'Number', money: 'Money (₹)', date: 'Date' };

/** One variable: its name in {{ }}, type, whether the agent may mention it, and what to say when a cell is empty. */
function VariableRow({ v, used, sample, onRename, onChange, onRemove }) {
  const [key, setKey] = useState(v.key);
  const [error, setError] = useState('');
  const commit = () => {
    if (key === v.key) return;
    if (!onRename(key)) { setError('Taken or empty — pick another name.'); setKey(v.key); } else setError('');
  };
  const said = formatValue(parseValue(sample, v.type).value, v.type);
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-mono">{'{{'}</span>
        <Input
          aria-label={`Name of ${v.label}`}
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          className="!h-8 text-xs font-mono"
        />
        <span className="text-xs text-muted-foreground font-mono">{'}}'}</span>
        <IconButton size="sm" tone="danger" icon="close" title={`Remove ${v.key}`} onClick={onRemove} />
      </div>
      {error && <p className="mt-1 text-xs text-negative-dim dark:text-negative">{error}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {v.needsColumn
          ? <Badge tone="caution" dot={false} capitalize={false}>Needs a column — upload a file with it</Badge>
          : <span className="text-xs text-muted-foreground truncate max-w-[200px]">From “{v.sourceColumns?.join(' + ') || v.label}”{said ? ` · e.g. ${said}` : ''}</span>}
        {used && <Badge tone="brand" dot={false} capitalize={false}>Used in the call</Badge>}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Select aria-label={`Type of ${v.key}`} value={v.type} onChange={(e) => onChange({ type: e.target.value })} className="!h-8 text-xs">
          {VARIABLE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </Select>
        <Input aria-label={`If ${v.key} is empty, say`} value={v.fallback || ''} onChange={(e) => onChange({ fallback: e.target.value })} placeholder="If empty, say…" className="!h-8 text-xs" />
      </div>
    </li>
  );
}

/**
 * Step 1: who gets called. Upload a sheet or paste a list; every other
 * column can become a variable, used in the call as {{name}}. Comes before
 * the script so the variables exist while it's written.
 */
export default function PeopleStep({ payload, update, onError }) {
  const confirm = useConfirm();
  const contacts = payload.contacts || NONE;
  const variables = payload.variables || NONE;
  const [adding, setAdding] = useState(false);
  const [lastImport, setLastImport] = useState(null);
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [editing, setEditing] = useState(null);

  const setContacts = (next) => update({ contacts: next });
  const showImporter = adding || contacts.length === 0;
  const used = useMemo(() => new Set(usedVariableRefs(payload)), [payload]);
  const flagged = useMemo(() => flaggedContacts(contacts).length, [contacts]);
  const shownVars = variables.filter(v => !v.needsColumn).slice(0, 2);

  const add = (incoming, { source, skipped, fileDuplicates = 0, variables: nextVariables }) => {
    const { contacts: next, added, updated, duplicates } = mergeContacts(contacts, incoming);
    setLastImport({ added, updated, skipped, duplicates: duplicates + fileDuplicates, source, prev: { contacts, variables } });
    update({ contacts: next, ...(nextVariables ? { variables: nextVariables } : {}) });
    setAdding(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const indexed = contacts.map((c, index) => ({ c, index }));
    if (!q) return indexed;
    return indexed.filter(({ c }) => `${c.name} ${c.phone} ${c.tag || ''} ${Object.values(c.vars || {}).join(' ')}`.toLowerCase().includes(q));
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

  const dropVariable = async (v) => {
    if (used.has(v.key) || used.has(v.id)) {
      const ok = await confirm({
        title: `Remove {{${v.key}}}?`,
        body: 'It is used in the call. Those lines will need fixing before you can start.',
        confirmLabel: 'Remove',
        tone: 'danger',
      });
      if (!ok) return;
    }
    update(removeVariable(payload, v.id));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start animate-fade-in">
      <Card className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Who are you calling?</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {contacts.length ? plural(contacts.length, 'person', 'people') : 'Upload a spreadsheet or paste a list. You can also do this later — but not start without it.'}
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
            tone={lastImport.added || lastImport.updated ? 'positive' : 'caution'}
            className="mb-5"
            title={lastImport.added || lastImport.updated
              ? [lastImport.added && `Added ${plural(lastImport.added, 'person', 'people')}`, lastImport.updated && `updated ${plural(lastImport.updated, 'person', 'people')}`].filter(Boolean).join(', ') + ` from ${lastImport.source}`
              : `No one new in ${lastImport.source}`}
            action={(lastImport.added > 0 || lastImport.updated > 0) && (
              <Button variant="ghost" size="sm" onClick={() => { update(lastImport.prev); setLastImport(null); }}>Undo</Button>
            )}
            onDismiss={() => setLastImport(null)}
          >
            {[
              lastImport.duplicates > 0 && `${plural(lastImport.duplicates, 'duplicate phone number')} removed — the first row was kept`,
              lastImport.skipped > 0 && `${plural(lastImport.skipped, 'row')} skipped — each needs a name and a valid number`,
            ].filter(Boolean).join(' · ') || null}
          </Alert>
        )}

        {flagged > 0 && (
          <Alert
            tone="negative"
            className="mb-5"
            title={`${plural(flagged, 'person has', 'people have')} a cell that reads like instructions to the agent`}
            action={<Button variant="ghost" size="sm" onClick={() => setContacts(clearFlaggedCells(contacts))}>Clear those cells</Button>}
          >
            Values are spoken as data, but text like “ignore your instructions” is cleared before starting, to be safe.
          </Alert>
        )}

        {showImporter && (
          <div className={contacts.length ? 'mb-5' : ''}>
            <ContactImport onAdd={add} onError={onError} variables={variables} />
          </div>
        )}

        {contacts.length > 0 && (
          <>
            {contacts.length > 8 && (
              <div className="mb-3 max-w-xs">
                <Input icon="search" aria-label="Search people" value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder="Search by name, number, tag or value" />
              </div>
            )}
            <ul className="divide-y divide-border rounded-xl border border-border max-h-[399px] overflow-y-auto">
              {filtered.slice(0, shown).map(({ c, index }) => (
                <li key={`${c.phone}-${index}`} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar name={c.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground tabular-nums truncate">
                      {formatPhone(c.phone)}
                      {shownVars.map(v => {
                        const said = formatValue(parseValue(c.vars?.[v.id], v.type).value, v.type);
                        return said ? <span key={v.id}> · {v.key}: {said}</span> : null;
                      })}
                    </p>
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

      {/* top-28 clears the sticky step header above. */}
      <Card className="lg:sticky lg:top-28">
        <h2 className="text-sm font-semibold text-foreground">Variables</h2>
        <p className="text-xs text-muted-foreground mt-0.5 mb-4">
          Columns you can use in the call. {VARIABLE_HINT}. {'{{name}}'} is always there. The agent only knows a value where you put it — the column's name means nothing to it.
        </p>
        {variables.length === 0 ? (
          <p className="text-xs text-muted-foreground">Upload a spreadsheet with more columns — like an amount or a date — and they appear here.</p>
        ) : (
          <ul aria-label="Variables" className="divide-y divide-border">
            {variables.map(v => (
              <VariableRow
                key={v.id}
                v={v}
                used={used.has(v.key) || used.has(v.id)}
                sample={contacts.find(c => c.vars?.[v.id])?.vars?.[v.id]}
                onRename={(key) => { const next = renameVariable(payload, v.id, key); if (next) update(next); return !!next; }}
                onChange={(patch) => update({ variables: variables.map(x => (x.id === v.id ? { ...x, ...patch } : x)) })}
                onRemove={() => dropVariable(v)}
              />
            ))}
          </ul>
        )}
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
