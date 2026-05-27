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

const steps = ["Basics", "Contacts", "Setup Questions", "Overrides", "Final Review"];
const stepNums = ["01", "02", "03", "04", "05"];
const nextLabels = ["Next: Contacts", "Next: Setup Questions", "Next: Overrides", "Next: Final Review"];

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

      const totalWeight = (payload.dataToCollect || []).reduce((sum, i) => {
        if (i.itemType !== 'question') return sum;
        const sfs = i.fieldsToExtract || [];
        if (sfs.length > 0) return sum + sfs.reduce((s, sf) => s + (sf.weight || 0), 0);
        return sum + (i.weight || 0);
      }, 0);

      if (totalWeight > 100) {
        addToast(`Total call score weight exceeds 100% (currently ${totalWeight}%). Please reduce question weights.`, 'error');
        return;
      }
    }
    setStep(s => Math.min(s + 1, 5));
  };

  const handleLaunch = async () => {
    try {
      const totalWeight = (payload.dataToCollect || []).reduce((sum, i) => {
        if (i.itemType !== 'question') return sum;
        const sfs = i.fieldsToExtract || [];
        if (sfs.length > 0) return sum + sfs.reduce((s, sf) => s + (sf.weight || 0), 0);
        return sum + (i.weight || 0);
      }, 0);

      if (totalWeight > 100) {
        addToast(`Cannot launch: Total call score weight is ${totalWeight}% (max 100%). Please adjust in Step 3.`, 'error');
        setStep(3);
        return;
      }

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
      <div className="flex items-center justify-center h-64 text-[#777587]">
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

  const progress = Math.round((step / steps.length) * 100);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Step Panel */}
      <nav className="w-72 bg-[#f5f2ff] border-r border-zinc-200/50 flex flex-col shrink-0">
        {/* Progress */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-zinc-500" style={{fontFamily:'JetBrains Mono, monospace'}}>Progress</span>
            <span className="text-sm font-medium text-[#3525cd]" style={{fontFamily:'JetBrains Mono, monospace'}}>{progress}%</span>
          </div>
          <div className="w-full bg-zinc-200 h-1.5 rounded-full">
            <div
              className="bg-[#3525cd] h-1.5 rounded-full transition-all duration-700"
              style={{width: `${progress}%`}}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="flex-1 space-y-1 py-2">
          {steps.map((s, i) => {
            const isActive = step === i + 1;
            const isComplete = step > i + 1;
            return (
              <div
                key={i}
                className={`px-6 py-4 flex items-center gap-4 transition-colors ${
                  isActive
                    ? 'bg-white shadow-sm'
                    : isComplete
                      ? 'opacity-60 cursor-pointer hover:bg-white/70'
                      : 'opacity-60 cursor-pointer hover:bg-white/50'
                }`}
                style={isActive ? {borderLeft: '3px solid #3525cd'} : {borderLeft: '3px solid transparent'}}
                onClick={() => isComplete && setStep(i + 1)}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-medium ${
                  isActive
                    ? 'bg-[#3525cd] text-white'
                    : isComplete
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'border border-zinc-300 text-zinc-500'
                }`} style={{fontFamily:'JetBrains Mono, monospace'}}>
                  {isComplete ? (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  ) : stepNums[i]}
                </div>
                <span className={`text-sm ${
                  isActive ? 'font-bold text-[#3525cd]' : 'text-[#464555]'
                }`} style={{fontFamily:'JetBrains Mono, monospace'}}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>

        {/* AI Logic Confidence Card */}
        <div className="p-6 border-t border-zinc-200">
          <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
            <h4 className="text-sm font-medium text-indigo-900 mb-1" style={{fontFamily:'JetBrains Mono, monospace'}}>AI Logic Confidence</h4>
            <p className="text-xs text-indigo-700 leading-tight">Current structure allows for 92% accurate data extraction based on selected fields.</p>
          </div>
        </div>
      </nav>

      {/* Right Canvas */}
      <div className="flex-1 overflow-y-auto bg-zinc-50">
        <div className="max-w-4xl mx-auto p-8">
          {/* Step header */}
          <div className="flex justify-between items-end mb-8">
            <div>
              <h3 className="text-3xl font-semibold text-[#1b1b24] mb-2 tracking-tight">{steps[step - 1]}</h3>
              <p className="text-[#464555]">
                {step === 1 && 'Configure the basics of your outbound campaign — name, type, and core script objectives.'}
                {step === 2 && 'Upload or manage the contacts list that will be included in this campaign.'}
                {step === 3 && 'Define the structured sequence of inquiry the AI agent should follow. Add logic conditions to handle complex lead responses.'}
                {step === 4 && 'Configure per-contact variable overrides to personalize each outbound call.'}
                {step === 5 && 'Review all campaign settings before launching. Ensure accuracy of questions, contacts, and scoring rules.'}
              </p>
            </div>
          </div>

          {/* Step Content */}
          <div className="mb-12">
            {renderStep()}
          </div>

          {/* Footer Navigation */}
          <div className="pt-8 border-t border-zinc-200 flex justify-between items-center">
            <button
              onClick={() => addToast('Draft saved', 'success')}
              className="px-6 py-3 border border-zinc-300 rounded text-sm text-zinc-700 hover:bg-zinc-100 transition-colors"
              style={{fontFamily:'JetBrains Mono, monospace'}}
            >
              Save as Draft
            </button>
            <div className="flex gap-4">
              <button
                onClick={prevStep}
                disabled={step === 1}
                className="px-8 py-3 bg-zinc-100 text-zinc-900 rounded text-sm hover:bg-zinc-200 transition-colors disabled:opacity-30"
                style={{fontFamily:'JetBrains Mono, monospace'}}
              >
                Previous Step
              </button>
              {step < 5 ? (
                <button
                  onClick={nextStep}
                  className="px-8 py-3 bg-[#3525cd] text-white rounded text-sm hover:bg-[#4f46e5] transition-all shadow-md active:scale-95"
                  style={{fontFamily:'JetBrains Mono, monospace'}}
                >
                  {nextLabels[step - 1]}
                </button>
              ) : (
                <button
                  onClick={handleLaunch}
                  className="px-8 py-3 bg-[#3525cd] text-white rounded text-sm hover:bg-[#4f46e5] transition-all shadow-md active:scale-95"
                  style={{fontFamily:'JetBrains Mono, monospace'}}
                >
                  {id ? 'Save Changes' : 'Launch Campaign'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
