import React, { useState } from 'react';
import { Upload, UserPlus, X, AlertTriangle } from 'lucide-react';

export default function Step5Contacts({ payload, updatePayload }) {
  const [toggleManual, setToggleManual] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', tag: '' });

  const addContact = () => {
    if (newContact.name && newContact.phone) {
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
    }
  };

  const removeContact = (idx) => {
    const list = [...payload.contacts];
    list.splice(idx, 1);
    updatePayload({ contacts: list });
  };

  const inputCls = "h-10 w-full rounded-lg border border-zinc-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 text-sm text-zinc-900 dark:text-slate-100 placeholder:text-zinc-400 dark:placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-colors";

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-slate-100 tracking-tight">Contacts</h3>
        <p className="text-zinc-500 dark:text-slate-400 text-sm mt-1">Upload CSV or add people manually for this campaign.</p>
      </div>

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

      {!toggleManual ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-zinc-200 dark:border-slate-700 rounded-xl bg-zinc-50 dark:bg-slate-900">
          <Upload className="w-12 h-12 text-zinc-400 dark:text-slate-500 mb-4" />
          <h4 className="font-semibold text-zinc-700 dark:text-slate-300 mb-1">Drag and drop CSV here</h4>
          <p className="text-sm text-zinc-500 dark:text-slate-400 mb-4">Format: Name, Phone, Tag</p>
          <button
            className="inline-flex items-center justify-center rounded-lg text-sm font-medium h-9 px-4 border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-zinc-50 dark:hover:bg-slate-700/50 text-zinc-700 dark:text-slate-300 shadow-sm transition-colors"
            onClick={() => alert("CSV upload mocked for MVP")}
          >
            Browse Files
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-zinc-700 dark:text-slate-300">Name</label>
              <input type="text" className={inputCls} value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} placeholder="John Doe" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-zinc-700 dark:text-slate-300">Phone</label>
              <input type="text" className={inputCls} value={newContact.phone} onChange={e => setNewContact({ ...newContact, phone: e.target.value })} placeholder="+1234567890" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-zinc-700 dark:text-slate-300">Group / Tag</label>
              <input type="text" className={inputCls} value={newContact.tag} onChange={e => setNewContact({ ...newContact, tag: e.target.value })} placeholder="Lead" />
            </div>
          </div>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold h-10 px-4 bg-indigo-600 text-white hover:bg-indigo-700 transition-colors mt-1"
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

      {payload.contacts.length > 0 && (
        <div className="mt-2">
          <h4 className="font-semibold text-zinc-900 dark:text-slate-100 text-base mb-3">
            Current Contacts <span className="text-zinc-400 dark:text-slate-500 font-normal text-sm">({payload.contacts.length})</span>
          </h4>
          <div className="flex flex-col gap-2">
            {payload.contacts.map((c, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-3 rounded-lg border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:border-zinc-300 dark:hover:border-slate-600 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                    {c.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <span className="font-semibold text-zinc-900 dark:text-slate-100 text-sm">{c.name}</span>
                  <span className="text-sm font-mono text-zinc-500 dark:text-slate-400">{c.phone}</span>
                  {c.overrides?.tag && (
                    <span className="inline-flex items-center rounded-full border border-zinc-200 dark:border-slate-700 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:text-slate-400 bg-zinc-100 dark:bg-slate-700">
                      {c.overrides.tag}
                    </span>
                  )}
                </div>
                <button className="text-zinc-400 dark:text-slate-500 hover:text-red-500 transition-colors p-1 rounded-md" onClick={() => removeContact(i)}>
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
