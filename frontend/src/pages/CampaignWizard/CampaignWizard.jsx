import React, { useState, useEffect } from 'react';
import { Button, IconButton } from '../../components/ui';
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
    // marin is OpenAI's newest, most natural-sounding Realtime API voice —
    // used as the default rather than the older 'alloy' for that reason.
    voice: 'marin',
    maxDuration: 5,
    retryAttempts: 2
  },
  contacts: [],
  // null = launch immediately; an ISO string = fire automatically at that
  // UTC instant instead of waiting for a manual Start click.
  scheduledAt: null
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
        })),
        scheduledAt: c.scheduledAt || null
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
      const launchMsg = payload.scheduledAt
        ? `Campaign scheduled for ${new Date(payload.scheduledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })} IST`
        : (id ? "Campaign updated successfully!" : "Campaign created successfully!");
      addToast(launchMsg, "success");
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
    <div className="flex gap-7 h-[calc(100vh-4rem)] overflow-hidden page-gutter pt-5 pb-7">
      {/* Left Step Panel */}
      <nav className="hidden lg:flex w-72 bg-card dark:bg-muted rounded-2xl shadow-primary flex-col shrink-0 overflow-hidden">
        {/* Progress */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-medium text-muted-foreground">Progress</span>
            <span className="text-sm font-medium text-brand-500 dark:text-brand-300">{progress}%</span>
          </div>
          <div className="w-full bg-paper-500 dark:bg-ink-300 h-1.5 rounded-full">
            <div
              className="bg-brand-500 h-1.5 rounded-full transition-all duration-700"
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
                className={`px-6 py-4 flex items-center gap-4 transition-colors border-l-[3px] ${
                  isActive
                    ? 'border-brand-500 bg-paper-200 dark:bg-ink-300/60'
                    : isComplete
                      ? 'border-transparent opacity-60 cursor-pointer hover:bg-paper-200 dark:hover:bg-ink-300/60'
                      : 'border-transparent opacity-60 cursor-pointer hover:bg-paper-200 dark:hover:bg-ink-300/60'
                }`}
                onClick={() => isComplete && setStep(i + 1)}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-medium ${
                  isActive
                    ? 'bg-brand-500 text-white'
                    : isComplete
                      ? 'bg-positive/10 text-positive-dim dark:text-positive border border-positive/25'
                      : 'border border-paper-600 dark:border-ink-400 text-muted-foreground'
                }`}>
                  {isComplete ? (
                    <span className="material-symbols-outlined text-[16px]">check</span>
                  ) : stepNums[i]}
                </div>
                <span className={`text-sm ${
                  isActive ? 'font-semibold text-brand-500 dark:text-brand-300' : 'text-muted-foreground'
                }`}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>

        {/* AI Logic Confidence Card */}
        <div className="p-6 border-t border-border">
          <div className="bg-brand-500/10 p-4 rounded-control border border-brand-500/25">
            <h4 className="text-sm font-semibold text-brand-600 dark:text-brand-300 mb-1">AI Logic Confidence</h4>
            <p className="text-xs text-brand-600 dark:text-brand-300 leading-tight">Current structure allows for 92% accurate data extraction based on selected fields.</p>
          </div>
        </div>
      </nav>

      {/* Right Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Sticky step header */}
        <div className="shrink-0 border-b border-border pb-5 md:pb-6">
          <div className="max-w-4xl mx-auto">
            {/* Stands in for the step rail, which is hidden below `lg`. */}
            <div className="lg:hidden mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Step {step} of {steps.length}
                </span>
                <span className="text-xs font-medium text-brand-500 dark:text-brand-300">{progress}%</span>
              </div>
              <div className="w-full bg-paper-500 dark:bg-ink-300 h-1.5 rounded-full">
                <div className="bg-brand-500 h-1.5 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
              </div>
            </div>
            <h3 className="text-[22px] font-semibold text-foreground mb-1 tracking-tight">{steps[step - 1]}</h3>
            <p className="text-muted-foreground text-sm">
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
          <div className="max-w-4xl mx-auto py-6">
            {renderStep()}
          </div>
        </div>

        {/* Sticky footer — always visible */}
        <div className="shrink-0 border-t border-border">
          <div className="max-w-4xl mx-auto pt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between sm:items-center">
            <Button variant="secondary" size="md" onClick={handleSaveDraft} icon="save" className="w-full sm:!w-auto">Save as Draft</Button>
            <div className="flex gap-3 sm:gap-4">
              <Button variant="ghost" size="md" onClick={prevStep} disabled={step === 1} icon="arrow_back" className="flex-1 sm:flex-none">Previous</Button>
              {step < 5 ? (
                <Button variant="primary" size="md" onClick={nextStep} className="flex-1 sm:flex-none">{nextLabels[step - 1]}</Button>
              ) : (
                <Button variant="primary" size="md" onClick={handleLaunch} className="flex-1 sm:flex-none">{payload.scheduledAt ? 'Schedule Campaign' : (id ? 'Save Changes' : 'Create Campaign')}</Button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
