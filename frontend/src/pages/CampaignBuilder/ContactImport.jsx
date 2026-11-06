import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Button, Checkbox, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import { COUNTRY_CODES, contactsFromRows, guessColumns, parsePastedContacts } from './campaignModel';
import { VARIABLE_TYPES, detectType, formatValue, newVariableId, parseValue, toKey } from '../../lib/contactVariables';

const SAMPLE_CSV = 'Name,Phone,Amount,Last date\nPriya Sharma,9876543210,460,12/11/2026\nRahul Verma,+91 98123 45678,1250,15/11/2026\n';
const TYPE_LABELS = { text: 'Text', number: 'Number', money: 'Money (₹)', date: 'Date' };

function downloadSample() {
  const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'contacts-sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** First + last name columns, when the file splits the name. */
function guessNameColumns(headers, guessed) {
  const first = headers.find(h => /first\s*name|^first$|fname|given/i.test(h));
  const last = headers.find(h => /last\s*name|^last$|surname|lname|family/i.test(h));
  if (first && last) return [first, last];
  return guessed ? [guessed] : [];
}

/**
 * Which column is which: the name (from one or more columns), the phone, an
 * optional tag, and every other column — kept as a variable usable as
 * {{name}} in the call, with its type, or left out. A column whose name
 * matches a variable already typed in the script fills that variable.
 */
function ColumnMapper({ file, variables, onApply, onClose }) {
  const guess = guessColumns(file.headers);
  const [nameColumns, setNameColumns] = useState(() => guessNameColumns(file.headers, guess.nameCol));
  const [phoneColumn, setPhoneColumn] = useState(guess.phoneCol || '');
  const [tagColumn, setTagColumn] = useState(guess.tagCol || '');
  const samplesOf = (h) => file.rows.slice(0, 50).map(r => r[h]);
  const [extra, setExtra] = useState(() => Object.fromEntries(file.headers.map(h => {
    const existing = variables.find(v => v.sourceColumns?.includes(h) || v.key === toKey(h));
    return [h, {
      use: true,
      key: existing?.key || toKey(h),
      type: existing && !existing.needsColumn ? existing.type : detectType(h, samplesOf(h)),
      target: existing?.id || 'new',
    }];
  })));

  const taken = new Set([...nameColumns, phoneColumn, tagColumn].filter(Boolean));
  const others = file.headers.filter(h => !taken.has(h));
  const used = others.filter(h => extra[h].use);
  const keys = used.map(h => extra[h].key);
  const keyClash = keys.find((k, i) => !k || k === 'name' || keys.indexOf(k) !== i
    || variables.some(v => v.key === k && !used.some(h => extra[h].target === v.id)));
  const ready = nameColumns.length > 0 && phoneColumn && !keyClash;
  const setCol = (h, patch) => setExtra(x => ({ ...x, [h]: { ...x[h], ...patch } }));
  const sample = file.rows.find(r => phoneColumn && r[phoneColumn]) || file.rows[0];

  const apply = () => {
    let nextVariables = [...variables];
    const columns = {};
    for (const h of used) {
      const { key, type, target } = extra[h];
      const existing = nextVariables.find(v => v.id === target);
      if (existing) {
        nextVariables = nextVariables.map(v => (v.id === existing.id
          ? { ...v, key, type, label: v.needsColumn ? h : v.label, sourceColumns: [h], needsColumn: false }
          : v));
        columns[h] = existing.id;
      } else {
        const v = { id: newVariableId(), key, label: h, type, sourceColumns: [h], fallback: '', agentCanSee: true };
        nextVariables.push(v);
        columns[h] = v.id;
      }
    }
    onApply({ nameColumns, phoneColumn, tagColumn, columns }, nextVariables);
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      icon="table_view"
      title={`Columns in ${file.name}`}
      description={`${file.rows.length.toLocaleString('en-IN')} rows. Pick the name and phone columns; every other column you keep can be used in the call as {{its_name}}.`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={apply} disabled={!ready}>Add {file.rows.length.toLocaleString('en-IN')} rows</Button>
      </>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Field label="Name" hint="Pick more than one to join them, e.g. first + last.">
          <div className="flex flex-col gap-1.5">
            {[0, 1, 2].slice(0, Math.min(3, nameColumns.length + 1)).map(i => (
              <Select
                key={i}
                aria-label={`Name column ${i + 1}`}
                value={nameColumns[i] || ''}
                onChange={(e) => {
                  const next = [...nameColumns];
                  if (e.target.value) next[i] = e.target.value; else next.splice(i, 1);
                  setNameColumns(next.filter(Boolean));
                }}
                className="text-xs"
              >
                <option value="">{i === 0 ? 'Choose a column' : '+ add another column'}</option>
                {file.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </Select>
            ))}
          </div>
        </Field>
        <Field label="Phone number">
          <Select aria-label="Phone column" value={phoneColumn} onChange={(e) => setPhoneColumn(e.target.value)} className="text-xs">
            <option value="">Choose a column</option>
            {file.headers.map(h => <option key={h} value={h}>{h}</option>)}
          </Select>
        </Field>
        <Field label="Tag (optional)">
          <Select aria-label="Tag column" value={tagColumn} onChange={(e) => setTagColumn(e.target.value)} className="text-xs">
            <option value="">None</option>
            {file.headers.map(h => <option key={h} value={h}>{h}</option>)}
          </Select>
        </Field>
      </div>
      {sample && nameColumns.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">First person: <span className="text-foreground font-medium">{nameColumns.map(c => String(sample[c] ?? '').trim()).filter(Boolean).join(' ') || '—'}</span></p>
      )}

      {others.length > 0 && (
        <div className="mt-6">
          <p className="text-[13px] font-medium text-foreground">Other columns</p>
          <p className="text-xs text-muted-foreground mb-2">Keep a column to use it in the call — type {'{{'} or ## in any line to pick it.</p>
          <div className="rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Keep</th>
                  <th className="px-3 py-2 font-medium">Column</th>
                  <th className="px-3 py-2 font-medium">Use as</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Said as</th>
                </tr>
              </thead>
              <tbody>
                {others.map(h => {
                  const c = extra[h];
                  const said = formatValue(parseValue(sample?.[h], c.type).value, c.type);
                  const waiting = variables.filter(v => v.needsColumn);
                  return (
                    <tr key={h} className="border-b border-border last:border-0 align-middle">
                      <td className="px-3 py-2"><Checkbox aria-label={`Keep ${h}`} checked={c.use} onChange={(e) => setCol(h, { use: e.target.checked })} /></td>
                      <td className="px-3 py-2 text-foreground whitespace-nowrap max-w-[160px] truncate">{h}</td>
                      <td className="px-3 py-2 min-w-[180px]">
                        {waiting.length > 0 && (
                          <Select
                            aria-label={`${h} fills`}
                            value={c.target}
                            disabled={!c.use}
                            onChange={(e) => {
                              const v = variables.find(x => x.id === e.target.value);
                              setCol(h, { target: e.target.value, ...(v ? { key: v.key } : {}) });
                            }}
                            className="text-xs mb-1"
                          >
                            <option value="new">New variable</option>
                            {waiting.map(v => <option key={v.id} value={v.id}>Fills {'{{'}{v.key}{'}}'}</option>)}
                          </Select>
                        )}
                        <Input aria-label={`Variable name for ${h}`} value={c.key} disabled={!c.use} onChange={(e) => setCol(h, { key: toKey(e.target.value) })} className="!h-8 text-xs font-mono" />
                      </td>
                      <td className="px-3 py-2">
                        <Select aria-label={`Type of ${h}`} value={c.type} disabled={!c.use} onChange={(e) => setCol(h, { type: e.target.value })} className="!h-8 text-xs">
                          {VARIABLE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap max-w-[160px] truncate">{c.use ? (said || <span className="text-caution-dim dark:text-caution">can't read “{String(sample?.[h] ?? '')}”</span>) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {keyClash !== undefined && <p className="mt-2 text-xs text-negative-dim dark:text-negative">Each kept column needs its own name (not “name”).</p>}
        </div>
      )}
    </Modal>
  );
}

/**
 * Two ways to add people, side by side: drop a spreadsheet, or paste lines of
 * "name, number". Columns are guessed from the headings and numbers are
 * normalised to the chosen country code, so a typical file goes straight in
 * with no mapping step.
 */
export default function ContactImport({ onAdd, onError, variables = [] }) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState('');
  const [code, setCode] = useState('+91');
  const [pending, setPending] = useState(null); // a file whose columns are being mapped

  const importRows = (file, mapping, nextVariables) => {
    const { contacts, skipped, duplicates } = contactsFromRows(file.rows, mapping, code);
    onAdd(contacts, { source: file.name, skipped, fileDuplicates: duplicates, variables: nextVariables });
  };

  const readFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const handle = (headers, rows) => {
      if (!headers.length || !rows.length) { onError(`${file.name} looks empty.`); return; }
      if (rows.length > 10000) { onError(`${file.name} has ${rows.length.toLocaleString('en-IN')} rows — a campaign can call at most 10,000 people.`); return; }
      // Always map: name, phone, and which other columns become variables.
      setPending({ name: file.name, headers, rows });
    };
    if (ext === 'csv' || ext === 'txt') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: ({ data, meta }) => handle(meta.fields || [], data),
        error: () => onError(`Couldn't read ${file.name}.`),
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'array' });
          // Cell values, not their display text: a date cell arrives as Excel's
          // serial number (read exactly by parseDate) rather than display text
          // like "11/12/26", which may be US month-first.
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
          handle(rows.length ? Object.keys(rows[0]) : [], rows);
        } catch {
          onError(`Couldn't read ${file.name}.`);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      onError('Use a .csv, .xlsx or .xls file.');
    }
  };

  const addPasted = () => {
    const { contacts, skipped } = parsePastedContacts(pasted, code);
    if (!contacts.length) {
      onError('Nothing to add — put one person per line, like “Priya Sharma, 98765 43210”.');
      return;
    }
    onAdd(contacts, { source: 'pasted list', skipped });
    setPasted('');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files?.[0]); }}
        className={`flex flex-col items-center justify-center text-center gap-3 rounded-xl border-2 border-dashed p-6 min-h-[200px] transition-colors
          ${dragging ? 'border-brand-500 bg-brand-500/10' : 'border-border bg-paper-200/60 dark:bg-white/[0.02]'}`}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-300">
          <span className="material-symbols-outlined [--icon-size:22px]">upload_file</span>
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">{dragging ? 'Drop it here' : 'Drop a spreadsheet here'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">CSV or Excel, with a name and a phone column. Other columns can be used in the call.</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          aria-label="Upload a contacts file"
          onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ''; }}
        />
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button variant="secondary" size="sm" icon="upload_file" onClick={() => fileRef.current?.click()}>Choose file</Button>
          <Button variant="link" size="sm" onClick={downloadSample}>Download a sample</Button>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <Textarea
          aria-label="Paste names and numbers"
          rows={6}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          placeholder={'Or paste them, one person per line:\nPriya Sharma, 98765 43210\nRahul Verma, +91 98123 45678'}
          className="flex-1 min-h-[150px] font-mono text-xs leading-relaxed"
        />
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Numbers without a code get
            <Select value={code} onChange={(e) => setCode(e.target.value)} className="!h-8 !w-auto text-xs" aria-label="Default country code">
              {COUNTRY_CODES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </label>
          <Button size="sm" icon="person_add" onClick={addPasted} disabled={!pasted.trim()}>Add</Button>
        </div>
      </div>

      {pending && (
        <ColumnMapper
          file={pending}
          variables={variables}
          onClose={() => setPending(null)}
          onApply={(mapping, nextVariables) => { importRows(pending, mapping, nextVariables); setPending(null); }}
        />
      )}
    </div>
  );
}

