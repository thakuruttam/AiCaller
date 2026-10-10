import { describe, it, expect } from 'vitest';
import {
  TEMPLATES, defaultScheduleIso, emptyPayload, findPlaceholders, formatPhone, fromCampaign,
  fromTemplate, getReadiness, guessColumns, isoToPickerDate, mergeContacts, moveItem, newItem,
  normalizeItems, normalizePhone, parsePastedContacts, pickerDateToIso, rowsToContacts,
  scoringMode, setScoringMode, totalWeight,
} from './campaignModel';

const question = (text, extra = {}) => ({ ...newItem('question', text), ...extra });

/** A campaign that should be launchable, to break one thing at a time. */
function ready(overrides = {}) {
  return {
    ...emptyPayload(),
    name: 'Screening',
    dataToCollect: normalizeItems([question('Are you interested?')]),
    contacts: [{ name: 'Priya', phone: '+919876543210', overrides: {} }],
    ...overrides,
  };
}

describe('normalizeItems — weights', () => {
  it('splits 100 evenly across questions nobody weighted by hand', () => {
    const items = normalizeItems([question('a'), question('b'), question('c')]);
    expect(items.map(i => i.weight)).toEqual([34, 33, 33]);
    expect(totalWeight(items)).toBe(100);
  });

  it('gives hand-weighted questions their weight and shares out the rest', () => {
    const items = normalizeItems([question('a', { weight: 50, isWeightManuallySet: true }), question('b'), question('c')]);
    expect(items.map(i => i.weight)).toEqual([50, 25, 25]);
  });

  it('never weights a statement', () => {
    const items = normalizeItems([newItem('information', 'hello'), question('a')]);
    expect(items.map(i => i.weight)).toEqual([0, 100]);
  });

  it('fills in ids and order', () => {
    const items = normalizeItems([{ itemType: 'question', text: 'x' }, { itemType: 'question', text: 'y' }]);
    expect(items.every(i => i.id)).toBe(true);
    expect(items.map(i => i.order)).toEqual([1, 2]);
  });

  it('splits a question\'s weight across its extracted values', () => {
    const [item] = normalizeItems([question('a', {
      fieldsToExtract: [{ id: 'f1', field: 'x' }, { id: 'f2', field: 'y' }, { id: 'f3', field: 'z' }],
    })]);
    expect(item.fieldsToExtract.map(f => f.weight)).toEqual([34, 33, 33]);
  });
});

describe('moving lines', () => {
  it('drops a skip target that no longer points forward', () => {
    const a = question('a');
    const b = question('b');
    a.onAnswer = { ...a.onAnswer, action: 'skip_question', skipToId: b.id };
    const moved = moveItem(normalizeItems([a, b]), 1, 0); // b now before a
    const movedA = moved.find(i => i.id === a.id);
    expect(movedA.onAnswer.action).toBe('skip_question');
    expect(movedA.onAnswer.skipToId).toBe('');
  });

  it('ignores a move past either end', () => {
    const items = normalizeItems([question('a'), question('b')]);
    expect(moveItem(items, 0, -1)).toBe(items);
    expect(moveItem(items, 1, 2)).toBe(items);
  });
});

describe('scoring modes', () => {
  it('maps the three choices onto the fields the evaluator reads', () => {
    const item = question('a');
    expect(scoringMode(item)).toBe('any');
    const match = setScoringMode(item, 'match');
    expect(match.expectedAnswer.condition).toBe('contains');
    expect(scoringMode(match)).toBe('match');
    const ai = setScoringMode(match, 'ai');
    expect(ai.scoringActiveTab).toBe('semantic');
    expect(scoringMode(setScoringMode(ai, 'any'))).toBe('any');
  });
});

describe('getReadiness', () => {
  const texts = (p) => getReadiness(p).blockers.map(b => b.text).join(' | ');

  it('has nothing to fix for a complete campaign', () => {
    const r = getReadiness(ready());
    expect(r.blockers).toEqual([]);
    expect(r.questions).toBe(1);
    expect(r.contacts).toBe(1);
    expect(r.estCost).toBe(25);
  });

  it('asks for a name, a question and people, each on the right step', () => {
    const r = getReadiness(emptyPayload());
    expect(r.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ step: 'script', text: 'Give the campaign a name.' }),
      expect.objectContaining({ step: 'script', text: 'Add at least one question.' }),
      expect.objectContaining({ step: 'contacts', text: 'Add the people you want to call.' }),
    ]));
  });

  it('points at an empty line', () => {
    const p = ready({ dataToCollect: normalizeItems([question('ok'), question('  ')]) });
    const b = getReadiness(p).blockers.find(x => x.text.startsWith('Line 2'));
    expect(b.itemId).toBe(p.dataToCollect[1].id);
  });

  it('flags unfilled [placeholders] where they are, but not [Name]', () => {
    const p = ready({
      goals: { goal: '', callIntro: 'Hi [Name], this is [Company].', callSignOff: '' },
      dataToCollect: normalizeItems([question('Your EMI of [Amount] is due.')]),
    });
    const gaps = getReadiness(p).blockers.filter(b => b.gap);
    expect(gaps).toHaveLength(2);
    expect(gaps[0]).toMatchObject({ field: 'callIntro' });
    expect(gaps[0].text).toContain('[Company]');
    expect(gaps[1]).toMatchObject({ itemId: p.dataToCollect[0].id });
    expect(findPlaceholders(p)).toEqual(['[Company]', '[Amount]']);
  });

  it('wants a value for "must match" and a description for "AI judges"', () => {
    const p = ready({
      dataToCollect: normalizeItems([
        setScoringMode(question('a'), 'match'),
        setScoringMode(question('b'), 'ai'),
      ]),
    });
    expect(texts(p)).toContain('Question 1: enter the answer to match.');
    expect(texts(p)).toContain('Question 2: describe what a good answer is.');
  });

  it('wants a condition and a target for a skip', () => {
    const a = question('a');
    a.onAnswer = { ...a.onAnswer, action: 'skip_question', skipConditionActiveTab: 'semantic', skipSemanticCondition: '' };
    const t = texts(ready({ dataToCollect: normalizeItems([a, question('b')]) }));
    expect(t).toContain('Question 1: say when to skip ahead.');
    expect(t).toContain('Question 1: choose where to skip to.');
  });

  it('allows "always end the call" (match anything)', () => {
    const a = question('a');
    a.onAnswer = { ...a.onAnswer, action: 'end_call', skipConditionActiveTab: 'condition', skipCondition: { condition: 'is any value', value: '' } };
    expect(getReadiness(ready({ dataToCollect: normalizeItems([a]) })).blockers).toEqual([]);
  });

  it('blocks weights over 100 and warns under 100', () => {
    const over = normalizeItems([question('a', { weight: 70, isWeightManuallySet: true }), question('b', { weight: 70, isWeightManuallySet: true })]);
    expect(texts(ready({ dataToCollect: over }))).toContain('add up to 140%');
    const under = normalizeItems([question('a', { weight: 40, isWeightManuallySet: true })]);
    expect(getReadiness(ready({ dataToCollect: under })).warnings[0]).toContain('40%');
  });

  it('refuses a schedule in the past', () => {
    const now = Date.parse('2026-10-11T12:00:00Z');
    const r = getReadiness(ready({ scheduledAt: '2026-10-11T11:00:00Z' }), now);
    expect(r.blockers[0]).toMatchObject({ step: 'contacts' });
  });

  it('prices per-contact length overrides', () => {
    const r = getReadiness(ready({
      contacts: [
        { name: 'A', phone: '+911', overrides: {} },
        { name: 'B', phone: '+912', overrides: { maxCallDurationSec: 600 } },
      ],
    }));
    expect(r.estMinutes).toBe(15);
    expect(r.estCost).toBe(75);
  });
});

describe('templates', () => {
  it.each(TEMPLATES.map(t => [t.type]))('%s is complete once its gaps are filled', (type) => {
    const p = { ...emptyPayload(), ...fromTemplate(type), contacts: [{ name: 'A', phone: '+919876543210' }] };
    expect(p.type).toBe(type);
    expect(p.name).toBeTruthy();
    expect(totalWeight(p.dataToCollect)).toBe(100);
    // Only the deliberate [gaps] stand between a template and dialling.
    expect(getReadiness(p).blockers.filter(b => !b.gap)).toEqual([]);
  });

  it('opening lines greet by [Name] and leave the identity question to the system', () => {
    for (const t of TEMPLATES) {
      const intro = t.build().goals.callIntro;
      expect(intro).toContain('[Name]');
      expect(intro.toLowerCase()).not.toMatch(/speaking with|is this|are you/);
    }
  });

  it('builds fresh ids every time', () => {
    expect(fromTemplate('HR').dataToCollect[0].id).not.toBe(fromTemplate('HR').dataToCollect[0].id);
  });
});

describe('fromCampaign', () => {
  it('maps the API shape and keeps saved weights as they were', () => {
    const p = fromCampaign({
      name: 'Existing', type: 'SALES', endCallIf: 'x',
      dataToCollect: [{ itemType: 'question', text: 'Q', weight: 40 }, { itemType: 'question', text: 'R', weight: 60 }],
      callModule: { goal: 'g', callIntro: 'i', callSignOff: 's' },
      campaignContacts: [{ contact: { name: 'C', phone: '+9111' }, overrides: { tag: 'VIP' } }],
      callSettings: { language: 'Hindi' },
      scheduledAt: '2027-01-01T05:30:00.000Z',
    });
    expect(p).toMatchObject({ name: 'Existing', type: 'SALES', endCallIf: 'x', scheduledAt: '2027-01-01T05:30:00.000Z' });
    expect(p.goals).toEqual({ goal: 'g', callIntro: 'i', callSignOff: 's' });
    expect(p.dataToCollect.map(i => i.weight)).toEqual([40, 60]);
    expect(p.callSettings).toMatchObject({ language: 'Hindi', maxDuration: 5, geminiVoice: 'Kore' });
    expect(p.contacts[0]).toMatchObject({ name: 'C', phone: '+9111', tag: 'VIP' });
  });
});

describe('phone numbers', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['098765-43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['+91 (98765) 43210', '+919876543210'],
    ['0091 98765 43210', '+919876543210'],
    ['+1 415 555 0100', '+14155550100'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizePhone(raw, '+91')).toBe(expected);
  });

  it('uses the chosen default code', () => {
    expect(normalizePhone('4155550100', '+1')).toBe('+14155550100');
  });

  it('rejects what cannot be a number', () => {
    expect(normalizePhone('', '+91')).toBeNull();
    expect(normalizePhone('12', '+91')).toBeNull();
    expect(normalizePhone('call me', '+91')).toBeNull();
  });

  it('formats Indian numbers for reading', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
    expect(formatPhone('+14155550100')).toBe('+14155550100');
  });
});

describe('pasted lists', () => {
  it('reads commas, tabs, plain spaces and an optional tag', () => {
    const { contacts, skipped } = parsePastedContacts([
      'Priya Sharma, 98765 43210, Batch A',
      'Rahul Verma\t+91 98123 45678',
      'Anita Desai 99887 76655',
    ].join('\n'));
    expect(skipped).toBe(0);
    expect(contacts).toEqual([
      { name: 'Priya Sharma', phone: '+919876543210', tag: 'Batch A' },
      { name: 'Rahul Verma', phone: '+919812345678', tag: '' },
      { name: 'Anita Desai', phone: '+919988776655', tag: '' },
    ]);
  });

  it('ignores a header line and counts lines it cannot read', () => {
    const { contacts, skipped } = parsePastedContacts('Name, Phone\nPriya, 9876543210\njust a name\n98765 43210');
    expect(contacts).toHaveLength(1);
    expect(skipped).toBe(2);
  });
});

describe('spreadsheets', () => {
  it('guesses the usual column names', () => {
    expect(guessColumns(['Full Name', 'Mobile No', 'Batch'])).toEqual({ nameCol: 'Full Name', phoneCol: 'Mobile No', tagCol: 'Batch' });
    expect(guessColumns(['A', 'B'])).toEqual({ nameCol: '', phoneCol: '', tagCol: '' });
  });

  it('turns rows into contacts and counts the unusable ones', () => {
    const rows = [
      { Name: 'Priya', Phone: 9876543210 },
      { Name: '', Phone: '9876543211' },
      { Name: 'Rahul', Phone: 'n/a' },
    ];
    const { contacts, skipped } = rowsToContacts(rows, { nameCol: 'Name', phoneCol: 'Phone', tagCol: '' });
    expect(contacts).toEqual([{ name: 'Priya', phone: '+919876543210', tag: '' }]);
    expect(skipped).toBe(2);
  });

  it('adds each phone number once', () => {
    const existing = [{ name: 'Priya', phone: '+911', overrides: {} }];
    const { contacts, added, duplicates } = mergeContacts(existing, [
      { name: 'Priya again', phone: '+911', tag: '' },
      { name: 'Rahul', phone: '+912', tag: 'B' },
      { name: 'Rahul twice', phone: '+912', tag: '' },
    ]);
    expect(added).toBe(1);
    expect(duplicates).toBe(2);
    expect(contacts[1]).toEqual({ name: 'Rahul', phone: '+912', tag: 'B', overrides: { name: 'Rahul', tag: 'B' } });
  });
});

describe('scheduling in IST', () => {
  it('round-trips through the picker whatever the local timezone', () => {
    const iso = '2026-10-12T04:30:00.000Z'; // 10:00 IST
    const picker = isoToPickerDate(iso);
    expect([picker.getHours(), picker.getMinutes()]).toEqual([10, 0]);
    expect(pickerDateToIso(picker)).toBe(iso);
  });

  it('suggests tomorrow at 10:00 IST', () => {
    expect(defaultScheduleIso(Date.parse('2026-10-11T20:00:00Z'))).toBe('2026-10-13T04:30:00.000Z'); // already the 12th in IST
    expect(defaultScheduleIso(Date.parse('2026-10-11T06:00:00Z'))).toBe('2026-10-12T04:30:00.000Z');
  });
});
