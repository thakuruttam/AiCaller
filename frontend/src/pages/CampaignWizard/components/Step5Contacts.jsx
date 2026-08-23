import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Upload, UserPlus, X, AlertTriangle, ArrowLeft } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ─── Column Mapper Modal ──────────────────────────────────────────────────────
function ColumnMapperModal({ headers, preview, totalRows, onApply, onClose }) {
  const [nameCol, setNameCol]         = useState(() => headers.find(h => /name/i.test(h)) || '');
  const [phoneCol, setPhoneCol]       = useState(() => headers.find(h => /phone|mobile|contact/i.test(h)) || '');
  const [tagCol, setTagCol]           = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [error, setError]             = useState('');

  const handleApply = () => {
    if (!nameCol)  { setError('Please select the Name field.');  return; }
    if (!phoneCol) { setError('Please select the Phone field.'); return; }
    setError('');
    onApply({ nameCol, phoneCol, tagCol, countryCode: countryCode.trim() });
  };

  const selectCls = "w-full h-11 rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 pr-8 text-sm text-zinc-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0d9488]/20 focus:border-[#0d9488] transition-colors cursor-pointer appearance-none";

  // Compute preview rows with auto-assigned IDs
  const previewRows = preview.slice(0, 5);
  const baseId = 1000;

  // Which columns to show in preview: ID + mapped cols first + remaining
  const mappedCols = [nameCol, phoneCol, tagCol].filter(Boolean);
  const otherCols  = headers.filter(h => !mappedCols.includes(h));
  const displayCols = [...mappedCols, ...otherCols].slice(0, 4);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
      <div className="w-full max-w-3xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{maxHeight: '90vh'}}>

        {/* Header — centered */}
        <div className="pt-8 pb-5 px-8 text-center shrink-0">
          <h3 className="text-2xl font-bold text-[#0f172a] dark:text-slate-100 tracking-tight">Map your data columns</h3>
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
                <p className="text-[10px] font-semibold text-zinc-400 dark:text-slate-500 uppercase tracking-widest mb-2">{label}</p>
                <div className="relative">
                  <select
                    className="w-full h-11 rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 pr-8 text-sm text-zinc-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0d9488]/20 focus:border-[#0d9488] transition-colors cursor-pointer appearance-none"
                    value={value}
                    onChange={onChange}
                  >
                    <option value="">{placeholder}</option>
                    {options.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-400 dark:text-slate-500 text-[18px]">expand_more</span>
                </div>
              </div>
            ))}
            <div>
              <p className="text-[10px] font-semibold text-zinc-400 dark:text-slate-500 uppercase tracking-widest mb-2">Default Code</p>
              <input
                type="text"
                className="w-full h-11 rounded-lg border border-zinc-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 text-sm text-zinc-800 dark:text-slate-100 placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0d9488]/20 focus:border-[#0d9488] transition-colors"
                value={countryCode}
                onChange={e => setCountryCode(e.target.value)}
                placeholder="+1"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-4 py-3 rounded-lg mb-5">
              <AlertTriangle size={14} className="shrink-0" /> {error}
            </div>
          )}

          {/* Data Preview */}
          {previewRows.length > 0 && (
            <div>
              <div className="mb-3">
                <p className="text-[11px] font-bold text-[#0f172a] dark:text-slate-100 uppercase tracking-widest">Data Preview</p>
              </div>
              <div className="rounded-xl border border-zinc-200 dark:border-slate-700 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#f7f6fb] dark:bg-slate-900 border-b border-zinc-200 dark:border-slate-700">
                      <th className="px-5 py-3 text-left text-[11px] font-semibold text-zinc-400 dark:text-slate-500 uppercase tracking-wider">ID</th>
                      {displayCols.map(h => {
                        const isName  = h === nameCol  && nameCol;
                        const isPhone = h === phoneCol && phoneCol;
                        return (
                          <th key={h} className={`px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider ${isName || isPhone ? 'text-[#0d9488] dark:text-teal-400' : 'text-zinc-400 dark:text-slate-500'}`}>
                            {h}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-slate-700">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="bg-white dark:bg-slate-800">
                        <td className="px-5 py-3.5 text-sm text-zinc-400 dark:text-slate-500 font-mono">{baseId + i}</td>
                        {displayCols.map(h => {
                          const isName  = h === nameCol  && nameCol;
                          const isPhone = h === phoneCol && phoneCol;
                          return (
                            <td key={h} className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap max-w-[200px] truncate ${isName || isPhone ? 'text-[#0d9488] dark:text-teal-400' : 'text-zinc-600 dark:text-slate-400'}`}>
                              {String(row[h] ?? '—')}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-zinc-100 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-sm text-[#334155] dark:text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            {totalRows} record{totalRows !== 1 ? 's' : ''} ready
          </div>
          <div className="flex items-center gap-5">
            <button onClick={onClose} className="text-sm font-semibold text-[#334155] dark:text-slate-400 hover:text-[#0f172a] dark:hover:text-slate-100 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-2 bg-[#0d9488] hover:bg-[#1e00a9] active:scale-[0.98] text-white text-sm font-semibold px-6 py-2.5 rounded-full transition-all shadow-sm"
            >
              Continue to Review
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
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

  const inputCls = "h-10 w-full rounded-lg border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 text-sm text-zinc-900 dark:text-slate-100 placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-colors";

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
      <div className="flex bg-zinc-100 dark:bg-slate-700 p-1 rounded-lg w-max border border-zinc-200 dark:border-slate-600">
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${!toggleManual ? 'bg-white dark:bg-slate-800 shadow-sm text-zinc-900 dark:text-slate-100 border border-zinc-200 dark:border-slate-600' : 'text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-300'}`}
          onClick={() => setToggleManual(false)}
        >
          Upload CSV
        </button>
        <button
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${toggleManual ? 'bg-white dark:bg-slate-800 shadow-sm text-zinc-900 dark:text-slate-100 border border-zinc-200 dark:border-slate-600' : 'text-zinc-500 dark:text-slate-400 hover:text-zinc-700 dark:hover:text-slate-300'}`}
          onClick={() => setToggleManual(true)}
        >
          Manual Entry
        </button>
      </div>

      {/* Upload tab */}
      {!toggleManual && (
        <div
          className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl transition-colors cursor-pointer ${dragging ? 'border-teal-400 bg-teal-50 dark:bg-teal-900/20' : 'border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-900 hover:border-teal-300'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileInput} />
          <Upload className="w-12 h-12 text-zinc-400 dark:text-slate-500 mb-4" />
          <h4 className="font-semibold text-zinc-700 dark:text-slate-300 mb-1">
            {dragging ? 'Drop your file here' : 'Drag and drop CSV here'}
          </h4>
          <p className="text-sm text-zinc-500 dark:text-slate-400 mb-4">Supports CSV, Excel (.xlsx, .xls)</p>
          <button
            className="inline-flex items-center justify-center rounded-lg text-sm font-medium h-9 px-4 border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-zinc-50 dark:hover:bg-slate-700/50 text-zinc-700 dark:text-slate-300 shadow-sm transition-colors"
            onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}
          >
            Browse Files
          </button>
        </div>
      )}

      {/* Manual entry tab */}
      {toggleManual && (
        <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-zinc-700 dark:text-slate-300">Name</label>
              <input type="text" className={inputCls} value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && addContact()} placeholder="John Doe" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-zinc-700 dark:text-slate-300">Phone</label>
              <input type="text" className={inputCls} value={newContact.phone} onChange={e => setNewContact({ ...newContact, phone: e.target.value })} onKeyDown={e => e.key === 'Enter' && addContact()} placeholder="+1234567890" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-zinc-700 dark:text-slate-300">Group / Tag</label>
              <input type="text" className={inputCls} value={newContact.tag} onChange={e => setNewContact({ ...newContact, tag: e.target.value })} onKeyDown={e => e.key === 'Enter' && addContact()} placeholder="Lead" />
            </div>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold h-10 px-4 bg-teal-600 text-white hover:bg-teal-700 transition-colors mt-1"
            onClick={addContact}
          >
            <UserPlus className="w-4 h-4" /> Add Contact Manually
          </button>
          {(newContact.name || newContact.phone) && (
            <div className="flex items-center gap-2 text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-lg mt-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Don't forget to click the Add button above to save this contact!
            </div>
          )}
        </div>
      )}

      {/* Contact table */}
      {payload.contacts.length > 0 && (
        <div className="mt-2">
          <h4 className="font-semibold text-zinc-900 dark:text-slate-100 text-base mb-3">
            Current Contacts <span className="text-zinc-400 dark:text-slate-500 font-normal text-sm">({payload.contacts.length})</span>
          </h4>
          <div className="border border-zinc-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-y-auto" style={{maxHeight: '340px'}}>
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-zinc-50 dark:bg-slate-900 border-b border-zinc-200 dark:border-slate-700">
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Name</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Phone</th>
                    <th className="px-5 py-3 text-left text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Tag</th>
                    <th className="px-5 py-3 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-slate-800 bg-white dark:bg-slate-800">
                  {payload.contacts.map((c, i) => (
                    <tr key={i} className="hover:bg-zinc-50/60 dark:hover:bg-slate-900/60 transition-colors group">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#e2dfff] flex items-center justify-center text-xs font-bold text-[#0d9488] shrink-0">
                            {c.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <input
                            value={c.name}
                            onChange={e => editContact(i, 'name', e.target.value)}
                            className="flex-1 font-semibold text-sm text-zinc-900 dark:text-slate-100 bg-transparent border border-transparent hover:border-zinc-200 dark:hover:border-slate-700 focus:border-[#0d9488] focus:bg-white dark:focus:bg-slate-900 rounded-md px-2 py-1 outline-none transition-all min-w-0"
                          />
                        </div>
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          value={c.phone}
                          onChange={e => editContact(i, 'phone', e.target.value)}
                          className="w-full font-mono text-sm text-zinc-500 dark:text-slate-400 bg-transparent border border-transparent hover:border-zinc-200 dark:hover:border-slate-700 focus:border-[#0d9488] focus:bg-white dark:focus:bg-slate-900 rounded-md px-2 py-1 outline-none transition-all"
                        />
                      </td>
                      <td className="px-5 py-2.5">
                        <input
                          value={c.tag || c.overrides?.tag || ''}
                          onChange={e => editContact(i, 'tag', e.target.value)}
                          placeholder="—"
                          className="w-full text-sm text-zinc-500 dark:text-slate-400 bg-transparent border border-transparent hover:border-zinc-200 dark:hover:border-slate-700 focus:border-[#0d9488] focus:bg-white dark:focus:bg-slate-900 rounded-md px-2 py-1 outline-none transition-all placeholder:text-zinc-300"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button onClick={() => removeContact(i)} className="p-1 text-zinc-300 hover:text-red-500 transition-colors rounded opacity-0 group-hover:opacity-100">
                          <X size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
