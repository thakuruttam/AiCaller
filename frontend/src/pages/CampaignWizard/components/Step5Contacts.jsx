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
      updatePayload({ contacts: [...payload.contacts, { ...newContact, overrides: { ...newContact.overrides, name: newContact.name, tag: newContact.tag } }] });
      setNewContact({ name: '', phone: '', tag: '' });
    }
  };

  const removeContact = (idx) => {
    const list = [...payload.contacts];
    list.splice(idx, 1);
    updatePayload({ contacts: list });
  };

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight">Contacts</h3>
        <p className="text-muted-foreground text-sm mt-1">Upload CSV or add people manually for this campaign.</p>
      </div>

      <div className="flex bg-muted/30 p-1 rounded-lg w-max border">
         <button className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${!toggleManual ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setToggleManual(false)}>Upload CSV</button>
         <button className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${toggleManual ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setToggleManual(true)}>Manual Entry</button>
      </div>

      {!toggleManual ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-xl bg-muted/10">
           <Upload className="w-12 h-12 text-muted-foreground mb-4" />
           <h4 className="font-semibold mb-1">Drag and drop CSV here</h4>
           <p className="text-sm text-muted-foreground mb-4">Format: Name, Phone, Tag</p>
           <button className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground" onClick={() => alert("CSV upload mocked for MVP")}>Browse Files</button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="flex flex-col gap-2">
               <label className="text-sm font-medium leading-none">Name</label>
               <input type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} placeholder="John Doe" />
             </div>
             <div className="flex flex-col gap-2">
               <label className="text-sm font-medium leading-none">Phone</label>
               <input type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} placeholder="+1234567890" />
             </div>
             <div className="flex flex-col gap-2">
               <label className="text-sm font-medium leading-none">Group / Tag</label>
               <input type="text" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={newContact.tag} onChange={e => setNewContact({...newContact, tag: e.target.value})} placeholder="Lead" />
             </div>
          </div>
          <button className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 mt-2" onClick={addContact}>
            <UserPlus className="w-4 h-4 mr-2" /> Add Contact Manually
          </button>
          {(newContact.name || newContact.phone) && (
            <div className="flex items-center justify-center text-sm font-medium text-amber-600 bg-amber-50 border border-amber-200 p-2 rounded-md mt-2">
               <AlertTriangle className="w-4 h-4 mr-2" /> Don't forget to click the Add button above to save this contact!
            </div>
          )}
        </div>
      )}

      {payload.contacts.length > 0 && (
         <div className="mt-4">
           <h4 className="font-semibold text-lg mb-3">Current Contacts ({payload.contacts.length})</h4>
           <div className="flex flex-col gap-2">
             {payload.contacts.map((c, i) => (
               <div key={i} className="flex items-center justify-between p-3 rounded-md border bg-card text-card-foreground shadow-sm">
                 <div className="flex items-center gap-4">
                   <span className="font-semibold">{c.name}</span>
                   <span className="text-sm font-mono text-muted-foreground">{c.phone}</span>
                   {c.overrides?.tag && <span className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold bg-secondary text-secondary-foreground">{c.overrides.tag}</span>}
                 </div>
                 <button className="text-muted-foreground hover:text-destructive transition-colors p-1" onClick={() => removeContact(i)}>
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
