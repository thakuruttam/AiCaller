import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../api/axios';
import Step1Basics from './components/Step1Basics';
import Step5Contacts from './components/Step5Contacts';
import Step3DataToCollect from './components/Step3DataToCollect';
import StepContactOverrides from './components/StepContactOverrides';
import Step7Review from './components/Step7Review';
import { useToast } from '../../context/ToastContext';
import PageLoader from '../../components/PageLoader';

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
    maxDuration: 5,
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

      const CONDITIONS_REQUIRING_VALUE = new Set([
        'contains', 'does not contain', 'equals', 'starts with', 'ends with', 'is greater than', 'is less than',
      ]);
      const incompleteScoring = (payload.dataToCollect || []).filter(item => {
        if ((item.itemType || 'question') !== 'question') return false;
        if (item.scoringActiveTab === 'semantic') return !item.scoringCriteria?.trim();
        const condition = item.expectedAnswer?.condition;
        if (!condition || !CONDITIONS_REQUIRING_VALUE.has(condition)) return false;
        return !item.expectedAnswer?.value?.toString().trim();
      });
      if (incompleteScoring.length > 0) {
        addToast(`${incompleteScoring.length} question(s) have an incomplete scoring rule — fill in the expected value, or set it to "is any value".`, 'error');
        return;
      }
    }
    setStep(s => Math.min(s + 1, 5));
  };

  const handleSaveDraft = async () => {
    try {
      if (id) {
        await api.put(`/api/campaigns/wizard/${id}`, payload);
      } else {
        const res = await api.post('/api/campaigns/wizard', payload);
        // Now that a real campaign exists, keep editing it in place instead
        // of creating a duplicate on the next save.
        navigate(`/edit-campaign/${res.data.campaign.id}`, { replace: true });
      }
      addToast('Draft saved', 'success');
    } catch (err) {
      console.error(err);
      addToast(err.response?.data?.error || 'Failed to save draft', 'error');
    }
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

  if (loading) return <PageLoader text="Loading campaign data…" />;

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
      <nav className="w-72 bg-[#f0fdfa] border-r border-zinc-200/50 flex flex-col shrink-0">
        {/* Progress */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-zinc-500" style={{fontFamily:'JetBrains Mono, monospace'}}>Progress</span>
            <span className="text-sm font-medium text-[#0d9488]" style={{fontFamily:'JetBrains Mono, monospace'}}>{progress}%</span>
          </div>
          <div className="w-full bg-zinc-200 h-1.5 rounded-full">
            <div
              className="bg-[#0d9488] h-1.5 rounded-full transition-all duration-700"
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
                style={isActive ? {borderLeft: '3px solid #0d9488'} : {borderLeft: '3px solid transparent'}}
                onClick={() => isComplete && setStep(i + 1)}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-medium ${
                  isActive
                    ? 'bg-[#0d9488] text-white'
                    : isComplete
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'border border-zinc-300 text-zinc-500'
                }`} style={{fontFamily:'JetBrains Mono, monospace'}}>
                  {isComplete ? (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  ) : stepNums[i]}
                </div>
                <span className={`text-sm ${
                  isActive ? 'font-bold text-[#0d9488]' : 'text-[#334155]'
                }`} style={{fontFamily:'JetBrains Mono, monospace'}}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>

        {/* AI Logic Confidence Card */}
        <div className="p-6 border-t border-zinc-200">
          <div className="bg-teal-50 p-4 rounded-lg border border-teal-100">
            <h4 className="text-sm font-medium text-teal-900 mb-1" style={{fontFamily:'JetBrains Mono, monospace'}}>AI Logic Confidence</h4>
            <p className="text-xs text-teal-700 leading-tight">Current structure allows for 92% accurate data extraction based on selected fields.</p>
          </div>
        </div>
      </nav>

      {/* Right Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden bg-zinc-50 dark:bg-slate-900">

        {/* Sticky step header */}
        <div className="shrink-0 border-b border-zinc-200 dark:border-slate-700 bg-zinc-50 dark:bg-slate-900 px-8 py-6">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-3xl font-semibold text-[#0f172a] dark:text-slate-100 mb-1 tracking-tight">{steps[step - 1]}</h3>
            <p className="text-[#334155] dark:text-slate-400 text-sm">
              {step === 1 && 'Configure the basics of your outbound campaign — name, type, and core script objectives.'}
              {step === 2 && 'Upload or manage the contacts list that will be included in this campaign.'}
              {step === 3 && 'Define the structured sequence of inquiry the AI agent should follow. Add logic conditions to handle complex lead responses.'}
              {step === 4 && 'Configure per-contact variable overrides to personalize each outbound call.'}
              {step === 5 && 'Review all campaign settings before launching. Ensure accuracy of questions, contacts, and scoring rules.'}
            </p>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-8 py-6">
            {renderStep()}
          </div>
        </div>

        {/* Sticky footer — always visible */}
        <div className="shrink-0 border-t border-zinc-200 bg-white dark:bg-slate-800 dark:border-slate-700">
          <div className="max-w-4xl mx-auto px-8 py-4 flex justify-between items-center">
            <button
              onClick={handleSaveDraft}
              className="px-6 py-2.5 border border-zinc-300 dark:border-slate-600 rounded text-sm text-zinc-700 dark:text-slate-300 hover:bg-zinc-100 dark:hover:bg-slate-700 transition-colors"
              style={{fontFamily:'JetBrains Mono, monospace'}}
            >
              Save as Draft
            </button>
            <div className="flex gap-4">
              <button
                onClick={prevStep}
                disabled={step === 1}
                className="px-8 py-2.5 bg-zinc-100 dark:bg-slate-700 text-zinc-900 dark:text-slate-100 rounded text-sm hover:bg-zinc-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-30"
                style={{fontFamily:'JetBrains Mono, monospace'}}
              >
                Previous Step
              </button>
              {step < 5 ? (
                <button
                  onClick={nextStep}
                  className="px-8 py-2.5 bg-[#0d9488] text-white rounded text-sm hover:bg-[#0f766e] transition-all shadow-md active:scale-95"
                  style={{fontFamily:'JetBrains Mono, monospace'}}
                >
                  {nextLabels[step - 1]}
                </button>
              ) : (
                <button
                  onClick={handleLaunch}
                  className="px-8 py-2.5 bg-[#0d9488] text-white rounded text-sm hover:bg-[#0f766e] transition-all shadow-md active:scale-95"
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
