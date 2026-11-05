import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

vi.mock('../../../src/services/aiUsage.service.js', () => ({ recordAiUsage: vi.fn() }));

import { tryChat, readTryChatBody, buildTryChatRequest, readTryChatReply } from '../../../src/controllers/tryChat.controller.js';
import { recordAiUsage } from '../../../src/services/aiUsage.service.js';

const PAYLOAD = {
  goals: { goal: 'Book a 15-minute demo.', callIntro: 'Hi [Name], this is Priya from Acme.', callSignOff: 'Thanks, talk soon!' },
  conversation: { knowledge: 'Acme CRM costs ₹999 per user per month.', rules: { never: ['Offer discounts'] } },
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
    expect(req.tools[0].functionDeclarations[0].name).toBe('end_call');
    expect(req.tools[0].functionDeclarations[0].parameters.properties.reason.enum).toContain('objective_met');
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
    expect(res.body).toEqual({ reply: 'It is ₹999 per user per month.', endCall: null });
    expect(recordAiUsage).toHaveBeenCalledWith(expect.objectContaining({ feature: 'campaign_try_chat', tenantId: 'tenant-1', inputTokens: 800 }));
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
