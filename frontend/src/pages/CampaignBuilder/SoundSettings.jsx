import React from 'react';
import { Card, Field, Select, Tabs } from '../../components/ui';
import VoicePicker from './VoicePicker';
import IssueText from './IssueText';
import { CALL_LENGTHS, CAMPAIGN_TYPES, LANGUAGES, RATE_PER_MINUTE, RETRY_OPTIONS } from './campaignModel';

/**
 * How the call sounds — language, voice, length, retries, type. Shared by
 * both kinds of campaign; conversation calls run in English only, so they
 * pass `languages={['English']}`.
 */
export default function SoundSettings({ payload, update, languages = LANGUAGES, languageHint, languageIssue, className = '' }) {
  const goals = payload.goals || {};
  const settings = payload.callSettings || {};
  const setSetting = (key, value) => update({ callSettings: { ...settings, [key]: value } });
  const lengths = CALL_LENGTHS.includes(settings.maxDuration) ? CALL_LENGTHS : [...CALL_LENGTHS, settings.maxDuration].sort((a, b) => a - b);

  return (
    <Card className={`flex flex-col gap-5 ${className}`}>
      <h2 className="text-sm font-semibold text-foreground">How it sounds</h2>

      <div>
        <p className="text-[13px] font-medium text-foreground mb-1.5">Language</p>
        <Tabs
          size="sm"
          value={settings.language || 'English'}
          onChange={(v) => setSetting('language', v)}
          items={languages.map(l => ({ value: l, label: l }))}
        />
        {languageIssue
          ? <IssueText issue={languageIssue} />
          : languageHint && <p className="mt-1.5 text-xs text-muted-foreground">{languageHint}</p>}
      </div>

      <div>
        <p className="text-[13px] font-medium text-foreground mb-1.5">Voice</p>
        <VoicePicker
          value={settings.geminiVoice}
          onChange={(v) => setSetting('geminiVoice', v)}
          sampleText={goals.callIntro}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Longest call" hint={`Up to ₹${(settings.maxDuration || 5) * RATE_PER_MINUTE} each`}>
          <Select
            value={settings.maxDuration || 5}
            onChange={(e) => setSetting('maxDuration', Number(e.target.value))}
            className="text-xs"
          >
            {lengths.map(m => <option key={m} value={m}>{m} min</option>)}
          </Select>
        </Field>
        <Field label="No answer?" hint="Retries 20 min later">
          <Select
            value={settings.retryAttempts ?? 2}
            onChange={(e) => setSetting('retryAttempts', Number(e.target.value))}
            className="text-xs"
          >
            {RETRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Field>
      </div>

      <Field label="Campaign type" hint="Groups this campaign in reports.">
        <Select value={payload.type || 'HR'} onChange={(e) => update({ type: e.target.value })} className="text-xs">
          {CAMPAIGN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
      </Field>
    </Card>
  );
}
