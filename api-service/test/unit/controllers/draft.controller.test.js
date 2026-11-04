import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { draftCampaign } from '../../../src/controllers/draft.controller.js';

// Gemini drafting with the network mocked: a real draft needs GEMINI_API_KEY.

const BRIEF = "Call the 48 diploma applicants. Check they're still interested, their notice period and expected salary.";

function question(text, weight) {
  return {
    itemType: 'question', text, is_mandatory: true, weight,
    expectedAnswer: { condition: 'is any value', value: '' },
    scoringCriteria: '', scoringActiveTab: 'condition', onAnswerAction: 'continue', skipToIndex: 0,
    skipCondition: { condition: 'contains', value: '' }, skipSemanticCondition: '', skipConditionActiveTab: 'condition',
  };
}

const DRAFT = {
  name: 'Diploma applicant screening', type: 'RECRUITER', language: 'English',
  goal: 'Check interest, notice period and salary', callIntro: 'Hi [Name], this is Priya from Acme.',
  callSignOff: 'Thanks for your time.', endCallIf: '', maxDurationMinutes: 5, retryAttempts: 2,
  items: [question('Are you still interested in the role?', 40), question('What is your notice period?', 30), question('What salary do you expect?', 30)],
  assumptions: ['Weighted interest highest'],
};

function geminiReply(body, { status = 200 } = {}) {
  return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function geminiDraft(draft) {
  return geminiReply({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(draft) }] } }] });
}

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

async function draft(brief = BRIEF) {
  const res = makeRes();
  await draftCampaign({ body: { brief } }, res);
  return res;
}

describe('draftCampaign with Gemini', () => {
  const env = { ...process.env };

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it('drafts a campaign through Gemini structured output, with the key in a header', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiDraft(DRAFT));
    const res = await draft();

    expect(res.statusCode).toBe(200);
    expect(res.body.payload.name).toBe('Diploma applicant screening');
    expect(res.body.payload.dataToCollect.filter(i => i.itemType === 'question')).toHaveLength(3);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-[^/:]+:generateContent$/);
    expect(url).not.toMatch(/key=/);
    expect(init.headers['x-goog-api-key']).toBe('test-gemini-key');
    const sent = JSON.parse(init.body);
    expect(sent.contents[0].parts[0].text).toBe(BRIEF);
    expect(sent.generationConfig.responseMimeType).toBe('application/json');
    expect(sent.generationConfig.responseJsonSchema.properties.items.type).toBe('array');
    expect(sent.generationConfig.responseJsonSchema.$schema).toBeUndefined();
  });

  it('prefers Gemini when both Gemini and Anthropic keys are set', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiDraft(DRAFT));
    const res = await draft();
    expect(res.statusCode).toBe(200);
    expect(fetchMock.mock.calls[0][0]).toMatch(/generativelanguage/);
  });

  it('reports drafting unavailable when no provider key is set', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await draft();
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('DRAFTING_UNAVAILABLE');
    expect(res.body.error).toMatch(/GEMINI_API_KEY/);
  });

  it('rejects a draft that does not match the schema instead of half-filling a campaign', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiDraft({ name: 'only a name' }));
    const res = await draft();
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toMatch(/unreadable/);
  });

  it('maps a rejected key to drafting unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiReply({ error: { message: 'API key not valid' } }, { status: 403 }));
    const res = await draft();
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('DRAFTING_UNAVAILABLE');
  });

  it('maps rate limiting, safety blocks and network failures to clear errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(geminiReply({}, { status: 429 }));
    expect((await draft()).statusCode).toBe(429);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(geminiReply({ promptFeedback: { blockReason: 'SAFETY' } }));
    expect((await draft()).statusCode).toBe(422);

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNRESET'));
    expect((await draft()).statusCode).toBe(504);
  });

  it('still asks for more detail on a too-short brief without calling Gemini', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    const res = await draft('call people');
    expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
