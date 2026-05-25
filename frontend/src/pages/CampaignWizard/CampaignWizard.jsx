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
    if (id) fetchCampaign();
  }, [id]);

  const fetchCampaign = async () => {
    try {
      const res = await api.get(`/api/campaigns/${id}`);
      const c = res.data;
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
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const nextStep = () => {
    if (step === 3) {
      const emptyQuestions = (payload.dataToCollect || []).filter(
        item => (item.itemType || 'question') === 'question' && !item.text?.trim()
      );
      if (emptyQuestions.length > 0) {
        addToast(`${emptyQuestions.length} question(s) have no text. Fill them in or remove them.`, 'error');
        return;
      }
    }
    setStep(s => Math.min(s + 1, 5));
  };

  const handleLaunch = async () => {
    try {
      if (id) {
        await api.put(`/api/campaigns/wizard/${id}`, payload);
      } else {
        await api.post('/api/campaigns/wizard', payload);
      }
      setStep(1);
      setPayload(initialPayload);
      addToast(id ? "Campaign updated successfully!" : "Campaign launched successfully!", "success");
      navigate('/');
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || "Error calling API", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 dark:text-slate-400">
        Loading campaign data...
      </div>
    );
  }

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
    <div className="flex min-h-[600px] h-[calc(100vh-8rem)] rounded-2xl border border-zinc-200/80 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.05] overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 border-r border-zinc-100 dark:border-slate-700/50 bg-zinc-50/60 dark:bg-slate-800/60 p-5 flex flex-col gap-5 shrink-0">
        <div>
          <h2 className="font-semibold text-sm text-zinc-900 dark:text-slate-100 tracking-tight">Campaign Setup</h2>
          <p className="text-xs text-zinc-500 dark:text-slate-400 mt-0.5">Step {step} of {steps.length}</p>
        </div>
        <div className="flex flex-col gap-0.5">
          {steps.map((s, i) => {
            const isActive   = step === i + 1;
            const isComplete = step > i + 1;
            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                  isActive   ? 'bg-white dark:bg-slate-700 shadow-sm border border-zinc-200/80 dark:border-slate-600 ring-1 ring-black/[0.03] dark:ring-white/[0.05]'
                  : isComplete ? 'text-zinc-500 dark:text-slate-400'
                  : 'text-zinc-400 dark:text-slate-500'
                }`}
              >
                <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold shrink-0 transition-colors ${
                  isActive   ? 'bg-indigo-600 text-white'
                  : isComplete ? 'bg-emerald-100 text-emerald-700'
                  : 'border border-zinc-300 dark:border-slate-600 text-zinc-400 dark:text-slate-500'
                }`}>
                  {isComplete ? '✓' : i + 1}
                </div>
                <span className={`text-sm ${isActive ? 'font-semibold text-zinc-900 dark:text-slate-100' : isComplete ? 'text-zinc-500 dark:text-slate-400' : 'text-zinc-400 dark:text-slate-500'}`}>{s}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col pt-8 pb-6 px-10 overflow-y-auto">
        <div className="flex-1">
          {renderStep()}
        </div>

        <div className="flex justify-between mt-8 pt-6 border-t border-zinc-100 dark:border-slate-700/50">
          <button
            className={`inline-flex items-center justify-center rounded-lg text-sm font-medium h-9 px-4 border border-zinc-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-zinc-50 dark:hover:bg-slate-700/50 active:bg-zinc-100 dark:active:bg-slate-700 text-zinc-700 dark:text-slate-300 transition-colors ${step === 1 ? 'invisible' : ''}`}
            onClick={prevStep}
          >
            Back
          </button>

          {step < 5 && (
            <button
              className="inline-flex items-center justify-center rounded-lg text-sm font-semibold h-9 px-5 bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
              onClick={nextStep}
            >
              Continue
            </button>
          )}
          {step === 5 && (
            <button
              className="inline-flex items-center justify-center rounded-lg text-sm font-semibold h-9 px-5 bg-indigo-600 text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors"
              onClick={handleLaunch}
            >
              {id ? 'Save Changes' : 'Launch Campaign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
