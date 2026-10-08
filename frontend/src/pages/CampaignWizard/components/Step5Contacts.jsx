import React, { useState, useRef } from 'react';
import {
  Button, IconButton, Tabs, Table, THead, Th, TBody, Tr, Td, RowActions, Field, Input, Select, Alert,
} from '../../../components/ui';
import Modal from '../../../components/Modal';
import { useToast } from '../../../context/ToastContext';
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

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      icon="table_view"
      title="Map your data columns"
      description="Pick which spreadsheet columns hold each contact's name, phone and tag."
      footer={<>
        <div className="flex items-center gap-2 text-sm text-muted-foreground sm:mr-auto">
          <span className="w-2 h-2 rounded-full bg-positive shrink-0" />
          {totalRows} record{totalRows !== 1 ? 's' : ''} ready
        </div>
        <Button variant="ghost" size="md" onClick={onClose} icon="close">Cancel</Button>
        <Button variant="primary" size="md" onClick={handleApply} iconRight="arrow_forward">
          Continue to Review
        </Button>
      </>}
    >
      {/* 4-column field mapping row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Name Field', value: nameCol, onChange: e => { setNameCol(e.target.value); setError(''); }, options: headers, placeholder: '— select —' },
          { label: 'Phone Field', value: phoneCol, onChange: e => { setPhoneCol(e.target.value); setError(''); }, options: headers, placeholder: '— select —' },
          { label: 'Group / Tag', value: tagCol, onChange: e => setTagCol(e.target.value), options: headers, placeholder: '— none —' },
        ].map(({ label, value, onChange, options, placeholder }) => (
          <Field key={label} label={label}>
            <Select value={value} onChange={onChange}>
              <option value="">{placeholder}</option>
              {options.map(h => <option key={h} value={h}>{h}</option>)}
            </Select>
          </Field>
        ))}
        <Field label="Default Code">
          <Input
            type="text"
            value={countryCode}
            onChange={e => setCountryCode(e.target.value)}
            placeholder="+1"
          />
        </Field>
      </div>

      {error && <Alert tone="negative" title={error} className="mb-5" />}

      {/* Data Preview */}
      {previewRows.length > 0 && (
        <div>
          <div className="mb-3">
            <p className="text-xs font-medium text-foreground">Data Preview</p>
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
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Step5Contacts({ payload, updatePayload }) {
  const { addToast } = useToast();
  const [toggleManual, setToggleManual] = useState(false);
  const [newContact, setNewContact]     = useState({ name: '', phone: '', tag: '' });
  const [dragging, setDragging]         = useState(false);
  const [mapperData, setMapperData]     = useState(null);
  const fileRef = useRef(null);


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
      addToast('Please upload a .csv, .xlsx, or .xls file.', 'error');
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
      addToast(`${imported.length} contact${imported.length !== 1 ? 's' : ''} imported. ${skipped} row${skipped !== 1 ? 's were' : ' was'} skipped (missing name or phone).`, 'success');
    }
  };

  // ── manual entry ────────────────────────────────────────────────────────────
  const addContact = () => {
    if (!newContact.name || !newContact.phone) return;
    const exists = payload.contacts.find(c => c.phone.trim() === newContact.phone.trim());
    if (exists) {
      addToast("A contact with this phone number is already in the campaign. The system only supports one configuration per phone number.", 'warning');
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
          className={`flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-card transition-colors cursor-pointer ${dragging ? 'border-brand-500/50 bg-brand-500/10' : 'border-border bg-paper-200/60 dark:bg-white/[0.02] hover:border-brand-500/50'}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileInput} />
          <Upload className="w-12 h-12 text-muted-foreground mb-4" />
          <h4 className="text-sm font-semibold text-muted-foreground mb-1">
            {dragging ? 'Drop your file here' : 'Drag and drop CSV here'}
          </h4>
          <p className="text-sm text-muted-foreground mb-4">Supports CSV, Excel (.xlsx, .xls)</p>
          <Button variant="secondary" size="md" onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>Browse Files</Button>
        </div>
      )}

      {/* Manual entry tab */}
      {toggleManual && (
        <div className="bg-card dark:bg-muted rounded-2xl shadow-primary p-5 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Name">
              <Input type="text" value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} onKeyDown={e => e.key === 'Enter' && addContact()} placeholder="John Doe" />
            </Field>
            <Field label="Phone">
              <Input type="text" value={newContact.phone} onChange={e => setNewContact({ ...newContact, phone: e.target.value })} onKeyDown={e => e.key === 'Enter' && addContact()} placeholder="+1234567890" />
            </Field>
            <Field label="Group / Tag">
              <Input type="text" value={newContact.tag} onChange={e => setNewContact({ ...newContact, tag: e.target.value })} onKeyDown={e => e.key === 'Enter' && addContact()} placeholder="Lead" />
            </Field>
          </div>
          <Button variant="primary" size="md" onClick={addContact}>
            <UserPlus className="w-4 h-4" /> Add Contact Manually
          </Button>
          {(newContact.name || newContact.phone) && (
            <div className="flex items-center gap-2 text-sm font-medium text-caution-dim bg-caution/10 border border-caution/25 p-2.5 rounded-control mt-1">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Don't forget to click the Add button above to save this contact!
            </div>
          )}
        </div>
      )}

      {/* Contact table */}
      {payload.contacts.length > 0 && (
        <div className="mt-2">
          <h4 className="font-semibold text-foreground text-sm mb-3">
            Current Contacts <span className="text-muted-foreground font-normal text-sm">({payload.contacts.length})</span>
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
                          <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center text-xs font-semibold text-brand-500 dark:text-brand-300 shrink-0">
                            {c.name?.charAt(0)?.toUpperCase() || '?'}
                          </div>
                          <input
                            value={c.name}
                            onChange={e => editContact(i, 'name', e.target.value)}
                            aria-label={`Name, row ${i + 1}`}
                            className="flex-1 font-medium text-sm text-foreground bg-transparent border border-transparent hover:border-border focus:border-brand-450 focus:bg-card dark:focus:bg-white/[0.04] focus:ring-[3px] focus:ring-brand-500/20 rounded-control px-2 py-1 outline-none transition-[border-color,box-shadow,background-color] min-w-0"
                          />
                        </div>
                      </Td>
                      <Td className="!py-2">
                        <input
                          value={c.phone}
                          onChange={e => editContact(i, 'phone', e.target.value)}
                          aria-label={`Phone, row ${i + 1}`}
                          className="w-full text-sm tabular-nums text-muted-foreground bg-transparent border border-transparent hover:border-border focus:border-brand-450 focus:bg-card dark:focus:bg-white/[0.04] focus:ring-[3px] focus:ring-brand-500/20 rounded-control px-2 py-1 outline-none transition-[border-color,box-shadow,background-color]"
                        />
                      </Td>
                      <Td className="!py-2">
                        <input
                          value={c.tag || c.overrides?.tag || ''}
                          onChange={e => editContact(i, 'tag', e.target.value)}
                          aria-label={`Tag, row ${i + 1}`}
                          placeholder="—"
                          className="w-full text-sm text-muted-foreground bg-transparent border border-transparent hover:border-border focus:border-brand-450 focus:bg-card dark:focus:bg-white/[0.04] focus:ring-[3px] focus:ring-brand-500/20 rounded-control px-2 py-1 outline-none transition-[border-color,box-shadow,background-color] placeholder:text-muted-foreground"
                        />
                      </Td>
                      <Td align="right" className="!py-2">
                        <RowActions>
                          <IconButton tone="danger" size="sm" onClick={() => removeContact(i)} title={`Remove ${c.name || 'contact'}`}>
                            <X size={15} />
                          </IconButton>
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
