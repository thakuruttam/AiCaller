import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Button, Field, Modal, Select, Textarea } from '../../components/ui';
import { COUNTRY_CODES, guessColumns, parsePastedContacts, rowsToContacts } from './campaignModel';

const SAMPLE_CSV = 'Name,Phone,Tag\nPriya Sharma,9876543210,Batch A\nRahul Verma,+91 98123 45678,Batch B\n';

function downloadSample() {
  const url = URL.createObjectURL(new Blob([SAMPLE_CSV], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'contacts-sample.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** Only when the columns can't be guessed — most files never see this. */
function ColumnPicker({ file, onApply, onClose }) {
  const guess = guessColumns(file.headers);
  const [cols, setCols] = useState(guess);
  const set = (key) => (e) => setCols(c => ({ ...c, [key]: e.target.value }));
  const ready = cols.nameCol && cols.phoneCol;

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      icon="table_view"
      title="Which columns are which?"
      description={`We couldn't tell from the headings in ${file.name}.`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => onApply(cols)} disabled={!ready}>Add {file.rows.length} rows</Button>
      </>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Field label="Name">
          <Select value={cols.nameCol} onChange={set('nameCol')} className="text-xs">
            <option value="">Choose a column</option>
            {file.headers.map(h => <option key={h} value={h}>{h}</option>)}
          </Select>
        </Field>
        <Field label="Phone number">
          <Select value={cols.phoneCol} onChange={set('phoneCol')} className="text-xs">
            <option value="">Choose a column</option>
            {file.headers.map(h => <option key={h} value={h}>{h}</option>)}
          </Select>
        </Field>
        <Field label="Tag (optional)">
          <Select value={cols.tagCol} onChange={set('tagCol')} className="text-xs">
            <option value="">None</option>
            {file.headers.map(h => <option key={h} value={h}>{h}</option>)}
          </Select>
        </Field>
      </div>
      <div className="mt-5 rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border">
              {file.headers.slice(0, 5).map(h => (
                <th key={h} className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {file.rows.slice(0, 3).map((row, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                {file.headers.slice(0, 5).map(h => (
                  <td key={h} className="px-3 py-2 text-foreground whitespace-nowrap max-w-[180px] truncate">{String(row[h] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

/**
 * Two ways to add people, side by side: drop a spreadsheet, or paste lines of
 * "name, number". Columns are guessed from the headings and numbers are
 * normalised to the chosen country code, so a typical file goes straight in
 * with no mapping step.
 */
export default function ContactImport({ onAdd, onError }) {
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [pasted, setPasted] = useState('');
  const [code, setCode] = useState('+91');
  const [pending, setPending] = useState(null); // a file whose columns need picking

  const importRows = (file, cols) => {
    const { contacts, skipped } = rowsToContacts(file.rows, cols, code);
    onAdd(contacts, { source: file.name, skipped });
  };

  const readFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const handle = (headers, rows) => {
      if (!headers.length || !rows.length) { onError(`${file.name} looks empty.`); return; }
      const parsed = { name: file.name, headers, rows };
      const cols = guessColumns(headers);
      if (cols.nameCol && cols.phoneCol) importRows(parsed, cols);
      else setPending(parsed);
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
          <p className="text-xs text-muted-foreground mt-0.5">CSV or Excel, with a name and a phone column</p>
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
        <ColumnPicker
          file={pending}
          onClose={() => setPending(null)}
          onApply={(cols) => { importRows(pending, cols); setPending(null); }}
        />
      )}
    </div>
  );
}

