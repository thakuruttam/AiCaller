import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import Step1Basics from './components/Step1Basics';
import Step5Contacts from './components/Step5Contacts';
import Step3DataToCollect from './components/Step3DataToCollect';
import StepContactOverrides from './components/StepContactOverrides';
import Step7Review from './components/Step7Review';
import { useToast } from '../../context/ToastContext';

import './CampaignWizard.css';

const initialPayload = {
  name: '',
  type: '',
  prompt: '',
  goals: {
    goal: '',
    callIntro: '',
    callSignOff: ''
  },
  dataToCollect: [],
  endCallIf: '',
  rules: {
    successScore: 50,
    list: [],
    fieldsToExtract: [],
    scoringRules: []
  },
  callSettings: {
    tone: 'Professional',
    language: 'English',
    maxDuration: 10,
    retryAttempts: 2
  },
  contacts: []
};
const steps = ["Basics", "Contacts", "Setup Questions", "Per-Contact", "Review"];
export default function CampaignWizard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [step, setStep] = useState(1);
  const [payload, setPayload] = useState(initialPayload);
  const [loading, setLoading] = useState(!!id);

  useEffect(() => {
    if (id) {
       fetchCampaign();
    }
  }, [id]);

  const fetchCampaign = async () => {
    try {
      const res = await api.get(`/api/campaigns/${id}`);
      const c = res.data;
      
      // Map backend model to wizard payload
      const mappedPayload = {
        name: c.name || '',
        type: c.type || '',
        endCallIf: c.endCallIf || '',
        dataToCollect: (c.dataToCollect || []).map(q => ({
          ...q,
          isWeightManuallySet: q.isWeightManuallySet ?? true
        })),
        rules: c.rules || initialPayload.rules,
        callSettings: c.callSettings || initialPayload.callSettings,
        goals: {
          goal: c.callModule?.goal || '',
          callIntro: c.callModule?.callIntro || '',
          callSignOff: c.callModule?.callSignOff || ''
        },
        contacts: (c.campaignContacts || []).map(cc => ({
          name: cc.overrides?.name || cc.contact?.name || '',
          phone: cc.contact?.phone || '',
          overrides: cc.overrides || {}
        }))
      };
      
      setPayload(mappedPayload);
    } catch (err) {
      console.error(err);
      addToast("Error loading campaign data", "error");
    } finally {
      setLoading(false);
    }
  };

  const updatePayload = (data) => setPayload(p => ({ ...p, ...data }));
  const nextStep = () => setStep(s => Math.min(s + 1, 5));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleLaunch = async () => {
    try {
      if (id) {
        await api.put(`/api/campaigns/wizard/${id}`, payload);
      } else {
        await api.post('/api/campaigns/wizard', payload);
      }
      setStep(1);
      setPayload(initialPayload);
      addToast(id ? "Campaign updated successfully!" : "Campaign launched successfully! 🚀", "success");
      navigate('/');
    } catch(err) {
      console.error(err);
      addToast(err.response?.data?.error || "Error calling API", "error");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading campaign data...</div>;
  const renderStep = () => {
    switch (step) {
      case 1: return <Step1Basics payload={payload} updatePayload={updatePayload} />;
      case 2: return <Step5Contacts payload={payload} updatePayload={updatePayload} />;
      case 3: return <Step3DataToCollect payload={payload} updatePayload={updatePayload} />;
      case 4: return <StepContactOverrides payload={payload} updatePayload={updatePayload} />;
      case 5: return <Step7Review payload={payload} updatePayload={updatePayload} onLaunch={handleLaunch} />;
      default: return null;
    }
  };

  return (
    <div className="flex min-h-[600px] h-[calc(100vh-8rem)] rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <div className="w-64 border-r bg-muted/20 p-6 flex flex-col gap-6">
        <h2 className="font-semibold text-lg tracking-tight">Campaign Setup</h2>
        <div className="flex flex-col gap-1">
          {steps.map((s, i) => (
            <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${step === i + 1 ? 'bg-background shadow-sm border font-medium text-foreground' : step > i + 1 ? 'text-muted-foreground' : 'text-muted-foreground/50'}`}>
              <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold ${step === i + 1 ? 'bg-primary text-primary-foreground' : step > i + 1 ? 'bg-muted text-muted-foreground' : 'border border-muted-foreground/30'}`}>
                {i + 1}
              </div>
              <span className="text-sm">{s}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex-1 flex flex-col pt-8 pb-6 px-10 overflow-y-auto">
        <div className="flex-1">
           {renderStep()}
        </div>
        
        <div className="flex justify-between mt-8 pt-6 border-t border-border">
          <button 
             className={`inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors ${step === 1 ? 'invisible' : ''}`}
             onClick={prevStep}>
             Back
          </button>
          
          {step < 5 && (
            <button className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" onClick={nextStep}>
              Next Step
            </button>
          )}
          {step === 5 && (
            <button className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors" onClick={handleLaunch}>
              Launch Campaign 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
