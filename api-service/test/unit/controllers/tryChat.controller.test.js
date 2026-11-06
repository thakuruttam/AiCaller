import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

vi.mock('../../../src/services/aiUsage.service.js', () => ({ recordAiUsage: vi.fn() }));

import { tryChat, readTryChatBody, buildTryChatRequest, readTryChatReply, readCapturedDetails } from '../../../src/controllers/tryChat.controller.js';
import { recordAiUsage } from '../../../src/services/aiUsage.service.js';

const PAYLOAD = {
  goals: { goal: 'Book a 15-minute demo.', callIntro: 'Hi [Name], this is Priya from Acme.', callSignOff: 'Thanks, talk soon!' },
  conversation: { knowledge: 'Acme CRM costs ₹999 per user per month.', rules: { never: ['Offer discounts'] }, detailsToCollect: ['Email'] },
  endCallIf: '',
  callSettings: { maxDuration: 5 },
};
const MESSAGES = [
  { role: 'user', text: 'Yes, speaking.' },
  { role: 'assistant', text: 'Great! Quick question — how does your team track leads today?' },
  { role: 'user', text: 'Spreadsheets. How much does it cost?' },
];

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}
const gemini = (parts, { status = 200 } = {}) => ({
  ok: status < 400, status,
  json: async () => ({ candidates: [{ content: { parts } }], usageMetadata: { promptTokenCount: 800, candidatesTokenCount: 40 } }),
  text: async () => 'error body',
});
const USER = { id: 'user-1', workspaceId: 'tenant-1' };

describe('the shared conversation prompt', () => {
  it('is byte-identical in api-service and telephony-gateway, so the test chat matches real calls', () => {
    const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
    expect(read('../../../src/utils/conversationPrompt.js'))
      .toBe(read('../../../../telephony-gateway/src/utils/conversationPrompt.js'));
  });
});

describe('readTryChatBody', () => {
  it('accepts a campaign and a chat that ends with the caller', () => {
    const r = readTryChatBody({ payload: PAYLOAD, messages: MESSAGES });
    expect(r.error).toBeUndefined();
    expect(r.contactName).toBe('Alex');
  });
  it.each([
    [{ messages: MESSAGES }, /payload/],
    [{ payload: PAYLOAD }, /messages/],
    [{ payload: PAYLOAD, messages: [{ role: 'system', text: 'hi' }] }, /role/],
    [{ payload: PAYLOAD, messages: MESSAGES.slice(0, 2) }, /last message/],
    [{ payload: PAYLOAD, messages: Array.from({ length: 41 }, () => ({ role: 'user', text: 'x' })) }, /limited to 40/],
  ])('rejects %#', (body, msg) => {
    expect(readTryChatBody(body).error).toMatch(msg);
  });
});

describe('buildTryChatRequest', () => {
  it('sends the live-call instructions, the greeting, the chat and the end_call tool', () => {
    const req = buildTryChatRequest({ payload: PAYLOAD, messages: MESSAGES, contactName: 'Uttam' });
    const system = req.systemInstruction.parts[0].text;
    expect(system).toContain('OBJECTIVE: Book a 15-minute demo.');
    expect(system).toContain('₹999 per user per month');
    expect(system).toContain('Hi Uttam, this is Priya from Acme.');
    expect(req.contents.map(c => c.role)).toEqual(['user', 'model', 'user']);
    const tools = Object.fromEntries(req.tools[0].functionDeclarations.map(t => [t.name, t]));
    expect(Object.keys(tools)).toEqual(['capture_detail', 'end_call']);
    expect(tools.end_call.parameters.properties.reason.enum).toContain('no_progress');
  });
});

describe('buildTryChatRequest in Hinglish', () => {
  it('tells the agent to speak Hinglish, with the Hinglish fallback answer', () => {
    const req = buildTryChatRequest({ payload: { ...PAYLOAD, callSettings: { language: 'Hinglish' } }, messages: MESSAGES, contactName: 'Uttam' });
    const system = req.systemInstruction.parts[0].text;
    expect(system).toMatch(/^LANGUAGE — speak natural Hinglish/);
    expect(system).toContain('team aapko iske baare mein bata degi');
    expect(system).toContain('(said in Hinglish)');
  });
});

describe('readTryChatReply', () => {
  it('returns the spoken reply and skips thoughts', () => {
    const r = readTryChatReply({ candidates: [{ content: { parts: [{ text: 'thinking…', thought: true }, { text: 'It is ₹999 per user.' }] } }] }, PAYLOAD);
    expect(r).toEqual({ reply: 'It is ₹999 per user.', endCall: null });
  });
  it('on end_call, plays only the closing line, like a live call', () => {
    const r = readTryChatReply({ candidates: [{ content: { parts: [{ text: 'We will not move forward.' }, { functionCall: { name: 'end_call', args: { reason: 'not_interested' } } }] } }] }, PAYLOAD);
    expect(r).toEqual({ reply: '', endCall: { reason: 'not_interested', closingLine: 'Thanks, talk soon!' } });
  });
  it('uses the apology for a wrong person', () => {
    const r = readTryChatReply({ candidates: [{ content: { parts: [{ functionCall: { name: 'end_call', args: { reason: 'wrong_person' } } }] } }] }, PAYLOAD);
    expect(r.endCall.closingLine).toMatch(/apologize/);
  });
});

describe('readCapturedDetails', () => {
  it('keeps only details the campaign asked for, under their configured names', () => {
    const parts = [
      { functionCall: { name: 'capture_detail', args: { name: 'EMAIL', value: ' u@x.com ' } } },
      { functionCall: { name: 'capture_detail', args: { name: 'Home address', value: '12 Main St' } } },
      { text: 'ok' },
    ];
    expect(readCapturedDetails(parts, PAYLOAD)).toEqual({ Email: 'u@x.com' });
  });
});

describe('tryChat', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn());
    recordAiUsage.mockClear();
  });
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    vi.unstubAllGlobals();
  });

  it('answers a test message and records the model usage', async () => {
    fetch.mockResolvedValueOnce(gemini([{ text: 'It is ₹999 per user per month.' }]));
    const res = makeRes();
    await tryChat({ body: { payload: PAYLOAD, messages: MESSAGES }, user: USER }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ reply: 'It is ₹999 per user per month.', endCall: null, captured: {} });
    expect(recordAiUsage).toHaveBeenCalledWith(expect.objectContaining({ feature: 'campaign_try_chat', tenantId: 'tenant-1', inputTokens: 800 }));
  });

  it('tries gemini-3.8-flash first', async () => {
    fetch.mockResolvedValueOnce(gemini([{ text: 'Hi.' }]));
    await tryChat({ body: { payload: PAYLOAD, messages: MESSAGES }, user: USER }, makeRes());
    expect(fetch.mock.calls[0][0]).toContain('gemini-3.8-flash');
  });

  it('asks again when the model returns an empty answer', async () => {
    fetch.mockResolvedValueOnce(gemini([])).mockResolvedValueOnce(gemini([{ text: 'Hello again.' }]));
    const res = makeRes();
    await tryChat({ body: { payload: PAYLOAD, messages: MESSAGES }, user: USER }, res);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(res.body.reply).toBe('Hello again.');
  });

  it('when the model only captures a detail, answers the tool call and returns what it says next', async () => {
    fetch
      .mockResolvedValueOnce(gemini([{ functionCall: { name: 'capture_detail', args: { name: 'email', value: 'u@x.com' } } }]))
      .mockResolvedValueOnce(gemini([{ text: 'Thanks! The team will be in touch.' }]));
    const res = makeRes();
    await tryChat({ body: { payload: PAYLOAD, messages: MESSAGES }, user: USER }, res);
    expect(res.body).toEqual({ reply: 'Thanks! The team will be in touch.', endCall: null, captured: { Email: 'u@x.com' } });
    const second = JSON.parse(fetch.mock.calls[1][1].body);
    expect(second.contents.at(-1).parts[0].functionResponse.name).toBe('capture_detail');
    expect(recordAiUsage).toHaveBeenCalledTimes(2);
  });

  it('falls through to the next model when one is overloaded', async () => {
    fetch.mockResolvedValueOnce(gemini([], { status: 503 })).mockResolvedValueOnce(gemini([{ text: 'Hello again.' }]));
    const res = makeRes();
    await tryChat({ body: { payload: PAYLOAD, messages: MESSAGES }, user: USER }, res);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(res.body.reply).toBe('Hello again.');
  });

  it('400s on a bad body without calling the model', async () => {
    const res = makeRes();
    await tryChat({ body: { payload: PAYLOAD }, user: USER }, res);
    expect(res.statusCode).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('503s when the server has no Gemini key', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = makeRes();
    await tryChat({ body: { payload: PAYLOAD, messages: MESSAGES }, user: USER }, res);
    expect(res.statusCode).toBe(503);
  });
});

describe('try chat with a person from the list', () => {
  const variables = [
    { id: 'v_amt001', key: 'amount', label: 'Amount owed', type: 'money' },
    { id: 'v_due001', key: 'due_date', label: 'Last date', type: 'date' },
  ];
  const payload = {
    goals: { goal: 'Collect {{amount}} by {{due_date}}.', callIntro: 'Hi {{name}}, about {{amount}}.', callSignOff: 'Thanks {{name}}!' },
    conversation: { knowledge: 'Pay at any branch.', callPlan: '1. Remind them of {{amount}}.' },
    callSettings: { maxDuration: 3 },
    variables,
  };
  const body = { payload, person: { name: 'Rakesh', vars: { v_amt001: '₹1,250', v_due001: '46338' } }, messages: [{ role: 'user', text: 'Yes' }] };

  it('fills every text with the person\'s values and gives the agent their facts', () => {
    const parsed = readTryChatBody(body);
    expect(parsed.contactName).toBe('Rakesh');
    const system = buildTryChatRequest(parsed).systemInstruction.parts[0].text;
    expect(system).toContain('OBJECTIVE: Collect ₹1,250 by 12 November.');
    expect(system).toContain('1. Remind them of ₹1,250.');
    expect(system).toContain('"Hi Rakesh, about ₹1,250. Am I speaking with Rakesh?"');
    expect(system).toContain('- Amount owed: ₹1,250');
    expect(system).not.toMatch(/\{\{/);
  });

  it('fills the closing line too', () => {
    const parsed = readTryChatBody(body);
    const reply = readTryChatReply({ candidates: [{ content: { parts: [{ functionCall: { name: 'end_call', args: { reason: 'objective_met' } } }] } }] }, parsed.payload,
      (t) => t.replace('{{name}}', 'Rakesh'));
    expect(reply.endCall.closingLine).toBe('Thanks Rakesh!');
  });

  it('refuses a malformed variable list', () => {
    expect(readTryChatBody({ ...body, payload: { ...payload, variables: [{ id: 'bad' }] } }).error).toMatch(/valid id/);
  });
});
