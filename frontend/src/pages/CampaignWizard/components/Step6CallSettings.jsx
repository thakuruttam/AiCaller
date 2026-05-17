import React from 'react';

export default function Step6CallSettings({ payload, updatePayload }) {
  const updateSettings = (key, value) => {
    updatePayload({
       callSettings: {
         ...payload.callSettings,
         [key]: value
       }
    });
  }

  return (
    <div className="animate-fade-in flex flex-col gap-6">
      <div>
        <h3 className="text-2xl font-semibold tracking-tight">Call Settings</h3>
        <p className="text-muted-foreground text-sm mt-1">Control the AI voice behavior and call limits.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="flex flex-col gap-6">
           <div className="flex flex-col gap-2">
             <label className="text-sm font-medium leading-none">AI Tone</label>
             <select 
               className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" 
               value={payload.callSettings?.tone || 'Professional'}
               onChange={(e) => updateSettings('tone', e.target.value)}
             >
               <option value="Friendly">Friendly & Casual</option>
               <option value="Professional">Strictly Professional</option>
               <option value="Persuasive">Persuasive (Sales)</option>
             </select>
           </div>
           
           <div className="flex flex-col gap-2">
             <label className="text-sm font-medium leading-none">Language</label>
             <select 
               className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" 
               value={payload.callSettings?.language || 'English'}
               onChange={(e) => updateSettings('language', e.target.value)}
             >
               <option value="English">English</option>
               <option value="Hindi">Hindi</option>
               <option value="Hinglish">Hinglish</option>
               <option value="Spanish">Spanish</option>
             </select>
           </div>
        </div>

        <div className="flex flex-col gap-6">
           <div className="flex flex-col gap-2">
             <label className="text-sm font-medium leading-none">Max Call Duration (minutes)</label>
             <input 
               type="number" 
               className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" 
               value={payload.callSettings?.maxDuration || 10}
               onChange={(e) => updateSettings('maxDuration', parseInt(e.target.value))}
             />
           </div>

           <div className="flex flex-col gap-2">
             <label className="text-sm font-medium leading-none">Retry Attempts on Missed Call</label>
             <input 
               type="number" 
               className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" 
               value={payload.callSettings?.retryAttempts || 2}
               onChange={(e) => updateSettings('retryAttempts', parseInt(e.target.value))}
             />
           </div>
        </div>
      </div>
    </div>
  );
}
