import React, { useState, useRef } from 'react';
import {
  Button, IconButton, Tabs, Table, THead, Th, TBody, Tr, Td, RowActions,
} from '../../../components/ui';
import { createPortal } from 'react-dom';
import { Upload, UserPlus, X, AlertTriangle, ArrowLeft } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ─── Column Mapper Modal ──────────────────────────────────────────────────────
function ColumnMapperModal({ headers, preview, totalRows, onApply, onClose }) {
  const [nameCol, setNameCol]         = useState(() => headers.find(h => /name/i.test(h)) || '');
  const [phoneCol, setPhoneCol]       = useState(() => headers.find(h => /phone|mobile|contact/i.test(h)) || '');
  const [tagCol, setTagCol]           = useState(() => headers.find(h => /tag|group|segment|label/i.test(h)) || '');
  const [countryCode, setCountryCode] = useState('+91');
  const [error, setError]             = useState('');

  const handleApply = () => {
    if (!nameCol)  { setError('Please select the Name field.');  return; }
    if (!phoneCol) { setError('Please select the Phone field.'); return; }
    setError('');
    onApply({ nameCol, phoneCol, tagCol, countryCode: countryCode.trim() });
  };


  // Compute preview rows with auto-assigned IDs
  const previewRows = preview.slice(0, 5);
  const baseId = 1000;

  // Which columns to show in preview: ID + mapped cols first + remaining
  const mappedCols = [nameCol, phoneCol, tagCol].filter(Boolean);
  const otherCols  = headers.filter(h => !mappedCols.includes(h));
  const displayCols = [...mappedCols, ...otherCols].slice(0, 4);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
      <div className="bg-card dark:bg-muted rounded-2xl w-full max-w-3xl shadow-overlay flex flex-col overflow-hidden" style={{maxHeight: '90vh'}}>

        {/* Header — centered */}
        <div className="pt-8 pb-5 px-8 text-center shrink-0">
          <h3 className="text-sm font-semibold text-ink-100 dark:text-paper-200 tracking-tight">Map your data columns</h3>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 pb-6">

          {/* 4-column field mapping row */}
          <div className="grid grid-cols-4 gap-5 mb-7">
            {[
              { label: 'Name Field', value: nameCol, onChange: e => { setNameCol(e.target.value); setError(''); }, options: headers, placeholder: '— select —' },
              { label: 'Phone Field', value: phoneCol, onChange: e => { setPhoneCol(e.target.value); setError(''); }, options: headers, placeholder: '— select —' },
              { label: 'Group / Tag', value: tagCol, onChange: e => setTagCol(e.target.value), options: headers, placeholder: '— none —' },
            ].map(({ label, value, onChange, options, placeholder }) => (
              <div key={label}>
                <p className="text-xs font-medium text-ink-800 dark:text-ink-800 mb-2">{label}</p>
                <div className="relative">
                  <select
                    className="w-full h-11 rounded-control border border-paper-500 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-3 pr-8 text-sm text-ink-100 dark:text-paper-200 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 transition-colors cursor-pointer appearance-none"
                    value={value}
                    onChange={onChange}
                  >
                    <option value="">{placeholder}</option>
                    {options.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-ink-800 dark:text-ink-800 text-[18px]">expand_more</span>
                </div>
              </div>
            ))}
            <div>
              <p className="text-xs font-medium text-ink-800 dark:text-ink-800 mb-2">Default Code</p>
              <input
                type="text"
                className="w-full h-11 rounded-control border border-paper-500 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-3 text-sm text-ink-100 dark:text-paper-200 placeholder:text-ink-800 dark:placeholder:text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500/25 focus:border-brand-500 transition-colors"
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                placeholder="+1"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-negative-dim dark:text-negative bg-negative/10 dark:bg-negative/15 border border-negative/10 dark:border-negative/15 px-4 py-3 rounded-control mb-5">
              <AlertTriangle size={14} className="shrink-0" /> {error}
            </div>
          )}

          {/* Data Preview */}
          {previewRows.length > 0 && (
            <div>
              <div className="mb-3">
                <p className="text-xs font-medium text-ink-100 dark:text-paper-200 ">Data Preview</p>
              </div>
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <THead>
                      <Th align="right" className="w-12">ID</Th>
                      {displayCols.map(h => {
                        const isName  = h === nameCol  && nameCol;
                        const isPhone = h === phoneCol && phoneCol;
                        return (
                          <Th key={h} className={isName || isPhone ? '!text-brand-500 dark:!text-brand-300' : ''}>
                            {h}
                          </Th>
                        );
                      })}
                  </THead>
                  <TBody>
                    {previewRows.map((row, i) => (
                      <Tr key={i}>
                        <Td numeric muted>{baseId + i}</Td>
                        {displayCols.map(h => {
                          const isName  = h === nameCol  && nameCol;
                          const isPhone = h === phoneCol && phoneCol;
                          return (
                            <Td key={h} muted={!(isName || isPhone)} className={`whitespace-nowrap max-w-[200px] truncate ${isName || isPhone ? 'font-medium !text-brand-500 dark:!text-brand-300' : ''}`}>
                              {String(row[h] ?? '—')}
                            </Td>
                          );
                        })}
                      </Tr>
                    ))}
                  </TBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-paper-400 dark:border-ink-400 flex items-center justify-between bg-paper-100 dark:bg-ink-200 shrink-0">
          <div className="flex items-center gap-2 text-sm text-ink-600 dark:text-ink-900">
            <span className="w-2 h-2 rounded-full bg-positive shrink-0" />
            {totalRows} record{totalRows !== 1 ? 's' : ''} ready
          </div>
          <div className="flex items-center gap-5">
            <Button variant="ghost" size="md" onClick={onClose} icon="close">Cancel</Button>
            <Button variant="primary" size="md" onClick={handleApply}>
              Continue to Review
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Step5Contacts({ payload, updatePayload }) {
  const [toggleManual, setToggleManual] = useState(false);
  const [newContact, setNewContact]     = useState({ name: '', phone: '', tag: '' });
  const [dragging, setDragging]         = useState(false);
  const [mapperData, setMapperData]     = useState(null);
  const fileRef = useRef(null);

  const inputCls = "h-10 w-full rounded-control border border-paper-600 dark:border-ink-400 bg-paper-100 dark:bg-ink-300 px-3 text-sm text-ink-100 dark:text-paper-200 placeholder:text-ink-800 dark:placeholder:text-ink-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-colors";

  // ── file parsing ────────────────────────────────────────────────────────────
  const parseFile = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: ({ data, meta }) => {
          const headers = meta.fields || [];
          if (!headers.length) return;
          setMapperData({ headers, rows: data });
        }
      });
    } else if (['xlsx', 'xls'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb   = XLSX.read(e.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        const headers = rows.length ? Object.keys(rows[0]) : [];
        if (!headers.length) return;
        setMapperData({ headers, rows });
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Please upload a .csv, .xlsx, or .xls file.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = '';
  };

  // ── apply mapping ───────────────────────────────────────────────────────────
  const applyMapping = ({ nameCol, phoneCol, tagCol, countryCode }) => {
    const imported = [];
    let skipped = 0;

    for (const row of mapperData.rows) {
      const name = String(row[nameCol] ?? '').trim();
      let   phone = String(row[phoneCol] ?? '').trim();
      if (!name || !phone) { skipped++; continue; }
      if (countryCode && !phone.startsWith('+')) phone = countryCode + phone;
      if (imported.find(c => c.phone === phone)) continue;
      imported.push({
        name, phone,
        tag: tagCol ? String(row[tagCol] ?? '').trim() : '',
        overrides: { name, tag: tagCol ? String(row[tagCol] ?? '').trim() : '' }
      });
    }

    const existing = payload.contacts || [];
    const merged   = [...existing];
    for (const c of imported) {
      if (!merged.find(e => e.phone === c.phone)) merged.push(c);
    }

    updatePayload({ contacts: merged });
    setMapperData(null);
    setToggleManual(true);

    if (skipped > 0) {
      alert(`${imported.length} contact${imported.length !== 1 ? 's' : ''} imported. ${skipped} row${skipped !== 1 ? 's were' : ' was'} skipped (missing name or phone).`);
    }
  };

  // ── manual entry ────────────────────────────────────────────────────────────
  const addContact = () => {
    if (!newContact.name || !newContact.phone) return;
    const exists = payload.contacts.find(c => c.phone.trim() === newContact.phone.trim());
    if (exists) {
      alert("A contact with this phone number is already in the campaign. The system only supports one configuration per phone number.");
      return;
    }
    updatePayload({
      contacts: [...payload.contacts, {
        ...newContact,
        overrides: { ...newContact.overrides, name: newContact.name, tag: newContact.tag }
      }]
    });
    setNewContact({ name: '', phone: '', tag: '' });
  };

  const removeContact = (idx) => {
    const list = [...payload.contacts];
    list.splice(idx, 1);
    updatePayload({ contacts: list });
  };

  const editContact = (idx, field, value) => {
    const list = payload.contacts.map((c, i) => {
      if (i !== idx) return c;
      const updated = { ...c, [field]: value, overrides: { ...c.overrides, [field]: value } };
      return updated;
    });
    updatePayload({ contacts: list });
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      {mapperData && (
        <ColumnMapperModal
          headers={mapperData.headers}
          preview={mapperData.rows.slice(0, 3)}
          totalRows={mapperData.rows.length}
          onApply={applyMapping}
          onClose={() => setMapperData(null)}
        />
      )}

      {/* Tab toggle */}
      <Tabs
        value={toggleManual ? 'manual' : 'csv'}
        onChange={(v) => setToggleManual(v === 'manual')}
        items={[
          { value: 'csv', label: 'Upload CSV', icon: 'upload_file' },
          { value: 'manual', label: 'Manual entry', icon: 'edit' },
        ]}
      />

      {/* Upload tab */}
      {!toggleManual && (
        <div
          className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-card transition-colors cursor-pointer ${dragging ? 'border-brand-300 bg-brand-100 dark:bg-brand-500/15' : 'border-paper-500 dark:border-ink-400 bg-paper-200 dark:bg-ink-50 hover:border-brand-300'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileInput} />
          <Upload className="w-12 h-12 text-ink-800 dark:text-ink-800 mb-4" />
          <h4 className="text-sm font-semibold text-ink-500 dark:text-ink-900 mb-1">
            {dragging ? 'Drop your file here' : 'Drag and drop CSV here'}
          </h4>
          <p className="text-sm text-ink-700 dark:text-ink-900 mb-4">Supports CSV, Excel (.xlsx, .xls)</p>
          <Button variant="secondary" size="md" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>Browse Files</Button>
        </div>
      )}

      {/* Manual entry tab */}
      {toggleManual && (
        <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-500 dark:text-ink-900">Name</label>
              <input type="text" className={inputCls} value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && addContact()} placeholder="John Doe" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-500 dark:text-ink-900">Phone</label>
              <input type="text" className={inputCls} value={newContact.phone} onChange={e => setNewContact({ ...newContact, phone: e.target.value })} onKeyDown={e => e.key === 'Enter' && addContact()} placeholder="+1234567890" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-ink-500 dark:text-ink-900">Group / Tag</label>
              <input type="text" className={inputCls} value={newContact.tag} onChange={e => setNewContact({ ...newContact, tag: e.target.value })} onKeyDown={e => e.key === 'Enter' && addContact()} placeholder="Lead" />
            </div>
          </div>
          <Button variant="primary" size="md" onClick={addContact}>
            <UserPlus className="w-4 h-4" /> Add Contact Manually
          </Button>
          {(newContact.name || newContact.phone) && (
            <div className="flex items-center gap-2 text-sm font-medium text-caution-dim bg-caution/10 border border-caution/30 p-2.5 rounded-control mt-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Don't forget to click the Add button above to save this contact!
            </div>
          )}
        </div>
      )}

      {/* Contact table */}
      {payload.contacts.length > 0 && (
        <div className="mt-2">
          <h4 className="font-semibold text-ink-100 dark:text-paper-200 text-sm mb-3">
            Current Contacts <span className="text-ink-800 dark:text-ink-800 font-normal text-sm">({payload.contacts.length})</span>
          </h4>
          <div className="bg-card dark:bg-muted rounded-2xl shadow-primary overflow-hidden">
            {/* Raw <table> rather than <Table>: that one's overflow-x wrapper
                would become the sticky header's scroll container instead of
                this maxHeight box, and the header would stop sticking. */}
            <div className="overflow-auto" style={{maxHeight: '340px'}}>
              <table className="w-full text-left text-sm">
                <THead sticky>
                    <Th>Name</Th>
                    <Th>Phone</Th>
                    <Th>Tag</Th>
                    <Th className="w-10"><span className="sr-only">Actions</span></Th>
                </THead>
                <TBody>
                  {payload.contacts.map((c, i) => (
                    <Tr key={i}>
                      <Td className="!py-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-500/15 flex items-center justify-center text-xs font-semibold text-brand-500 dark:text-brand-300 shrink-0">
                            {c.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <input
                            value={c.name}
                            onChange={e => editContact(i, 'name', e.target.value)}
                            className="flex-1 font-medium text-sm text-foreground bg-transparent border border-transparent hover:border-paper-500 dark:hover:border-ink-400 focus:border-brand-500 focus:bg-paper-100 dark:focus:bg-ink-100 rounded-field px-2 py-1 outline-none transition-all min-w-0"
                          />
                        </div>
                      </Td>
                      <Td className="!py-2">
                        <input
                          value={c.phone}
                          onChange={e => editContact(i, 'phone', e.target.value)}
                          className="w-full text-sm tabular-nums text-muted-foreground bg-transparent border border-transparent hover:border-paper-500 dark:hover:border-ink-400 focus:border-brand-500 focus:bg-paper-100 dark:focus:bg-ink-100 rounded-field px-2 py-1 outline-none transition-all"
                        />
                      </Td>
                      <Td className="!py-2">
                        <input
                          value={c.tag || c.overrides?.tag || ''}
                          onChange={e => editContact(i, 'tag', e.target.value)}
                          placeholder="—"
                          className="w-full text-sm text-muted-foreground bg-transparent border border-transparent hover:border-paper-500 dark:hover:border-ink-400 focus:border-brand-500 focus:bg-paper-100 dark:focus:bg-ink-100 rounded-field px-2 py-1 outline-none transition-all placeholder:text-ink-900"
                        />
                      </Td>
                      <Td align="right" className="!py-2">
                        <RowActions>
                          <Button variant="dangerGhost" size="sm" onClick={() => removeContact(i)} aria-label={`Remove ${c.name || 'contact'}`}>
                            <X size={15} />
                          </Button>
                        </RowActions>
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
