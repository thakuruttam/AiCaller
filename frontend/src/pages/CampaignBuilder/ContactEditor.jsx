import React, { useState } from 'react';
import { Alert, Button, Checkbox, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import { CALL_LENGTHS, normalizePhone } from './campaignModel';

/**
 * One person: fix a typo in their name or number, and optionally give their
 * call its own opening, sign-off, goal or length. Anything left blank falls
 * back to the campaign's own.
 */
export default function ContactEditor({ contact, campaign, isTaken, onSave, onClose }) {
  const o = contact.overrides || {};
  const [name, setName] = useState(contact.name || '');
  const [phone, setPhone] = useState(contact.phone || '');
  const [tag, setTag] = useState(contact.tag || o.tag || '');
  const [goals, setGoals] = useState({ goal: '', callIntro: '', callSignOff: '', ...(o.goals || {}) });
  const [minutes, setMinutes] = useState(o.maxCallDurationSec ? String(Math.round(o.maxCallDurationSec / 60)) : '');
  const [dropQuestions, setDropQuestions] = useState(false);
  const [personalise, setPersonalise] = useState(!!(o.goals || o.maxCallDurationSec));
  const [error, setError] = useState('');

  const save = () => {
    const normalized = normalizePhone(phone, '+91');
    if (!name.trim()) { setError('Add a name.'); return; }
    if (!normalized) { setError("That doesn't look like a phone number."); return; }
    if (normalized !== contact.phone && isTaken(normalized)) { setError('Someone else in this list already has that number.'); return; }

    const custom = Object.fromEntries(Object.entries(goals).filter(([, v]) => v?.trim()));
    const overrides = { ...o, name: name.trim(), tag: tag.trim() };
    if (personalise && Object.keys(custom).length) overrides.goals = custom; else delete overrides.goals;
    if (personalise && minutes) overrides.maxCallDurationSec = Number(minutes) * 60; else delete overrides.maxCallDurationSec;
    if (dropQuestions) delete overrides.dataToCollect;

    onSave({ ...contact, name: name.trim(), phone: normalized, tag: tag.trim(), overrides });
    onClose();
  };

  const setGoal = (key) => (e) => setGoals(g => ({ ...g, [key]: e.target.value }));

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={`Edit ${contact.name || 'contact'}`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Save</Button>
      </>}
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Field label="Name"><Input value={name} onChange={(e) => { setName(e.target.value); setError(''); }} /></Field>
          <Field label="Phone"><Input value={phone} onChange={(e) => { setPhone(e.target.value); setError(''); }} className="tabular-nums" /></Field>
          <Field label="Tag"><Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Optional" /></Field>
        </div>
        {error && <Alert tone="negative" title={error} />}

        {o.dataToCollect && (
          <Alert
            tone="info"
            title="This person has their own question list"
            action={!dropQuestions && (
              <Button variant="secondary" size="sm" onClick={() => setDropQuestions(true)}>Use the campaign's questions</Button>
            )}
          >
            {dropQuestions
              ? "They'll be asked the campaign's questions once you save."
              : `It was set up earlier and has ${o.dataToCollect.length} questions.`}
          </Alert>
        )}

        <div className="border-t border-border pt-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox
              checked={personalise}
              onChange={(e) => setPersonalise(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-[13px] font-medium text-foreground">Personalise this person's call</span>
              <span className="block text-xs text-muted-foreground mt-0.5">Leave any box empty to use the campaign's version.</span>
            </span>
          </label>

          {personalise && (
            <div className="flex flex-col gap-4 mt-5 animate-fade-in">
              <Field label="Opening line">
                <Textarea rows={2} value={goals.callIntro} onChange={setGoal('callIntro')} placeholder={campaign.goals?.callIntro || 'Hi [Name], …'} />
              </Field>
              <Field label="Goal">
                <Input value={goals.goal} onChange={setGoal('goal')} placeholder={campaign.goals?.goal || ''} />
              </Field>
              <Field label="Closing line">
                <Textarea rows={2} value={goals.callSignOff} onChange={setGoal('callSignOff')} placeholder={campaign.goals?.callSignOff || ''} />
              </Field>
              <Field label="Longest call" className="max-w-[200px]">
                <Select value={minutes} onChange={(e) => setMinutes(e.target.value)} className="text-xs">
                  <option value="">Same as campaign ({campaign.callSettings?.maxDuration || 5} min)</option>
                  {CALL_LENGTHS.map(m => <option key={m} value={m}>{m} min</option>)}
                </Select>
              </Field>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
