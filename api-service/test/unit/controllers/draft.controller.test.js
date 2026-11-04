import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../../src/services/aiUsage.service.js', () => ({ recordAiUsage: vi.fn() }));
// Draft jobs live in Redis; an in-memory map stands in for it.
const jobStore = new Map();
vi.mock('../../../src/redis.js', () => ({
  redis: {
    set: vi.fn(async (key, value) => { jobStore.set(key, value); return 'OK'; }),
    get: vi.fn(async (key) => jobStore.get(key) ?? null),
  },
}));

import { draftCampaign, getDraftJob } from '../../../src/controllers/draft.controller.js';
import { recordAiUsage } from '../../../src/services/aiUsage.service.js';

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

const USAGE = { promptTokenCount: 1200, candidatesTokenCount: 900, thoughtsTokenCount: 300 };

function geminiDraft(draft) {
  return geminiReply({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(draft) }] } }], usageMetadata: USAGE });
}

function makeRes() {
  const res = { statusCode: 200, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

const USER = { id: 'user-1', workspaceId: 'tenant-1' };

async function poll(jobId, user = USER) {
  const res = makeRes();
  await getDraftJob({ params: { jobId }, user }, res);
  return res;
}

/** Start a draft, let its background job finish, and return the outcome the page would see. */
async function draft(brief = BRIEF) {
  const res = makeRes();
  await draftCampaign({ body: { brief }, user: USER }, res);
  if (res.statusCode !== 202) return res;
  let job;
  for (let i = 0; i < 100; i++) {
    job = await poll(res.body.jobId);
    if (job.body.status !== 'pending') break;
    await new Promise(r => setTimeout(r, 0));
  }
  if (job.body.status === 'done') return { statusCode: 200, body: job.body, jobId: res.body.jobId };
  return { statusCode: JSON.parse(jobStore.get(`campaign-draft-job:${res.body.jobId}`)).httpStatus, body: job.body };
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
    recordAiUsage.mockClear();
    jobStore.clear();
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
    const limited = vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiReply({}, { status: 429 }));
    expect((await draft()).statusCode).toBe(429);
    limited.mockRestore();

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

  it('records each draft for the Usage page, counting thinking tokens as output', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiDraft(DRAFT));
    await draft();
    expect(recordAiUsage).toHaveBeenCalledTimes(1);
    expect(recordAiUsage).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1', userId: 'user-1', feature: 'campaign_draft', provider: 'gemini',
      inputTokens: 1200, outputTokens: 1200, success: true,
    }));
  });

  it('records a rejected draft as unsuccessful, since the tokens were still billed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiDraft({ name: 'only a name' }));
    await draft();
    expect(recordAiUsage).toHaveBeenCalledWith(expect.objectContaining({ success: false, inputTokens: 1200 }));
  });

  it('records nothing when no model was called', async () => {
    delete process.env.GEMINI_API_KEY;
    await draft();
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNRESET'));
    process.env.GEMINI_API_KEY = 'test-gemini-key';
    await draft();
    expect(recordAiUsage).not.toHaveBeenCalled();
  });

  it('falls back to the next model when the first is overloaded or retired, and records the one that answered', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(geminiReply({ error: { code: 503, message: 'high demand' } }, { status: 503 }))
      .mockResolvedValueOnce(geminiDraft(DRAFT));
    const res = await draft();
    expect(res.statusCode).toBe(200);
    expect(fetchMock.mock.calls.map(([url]) => url.match(/models\/([^:]+):/)[1])).toEqual(['gemini-3.8-flash', 'gemini-3.5-flash']);
    expect(recordAiUsage).toHaveBeenCalledWith(expect.objectContaining({ model: 'gemini-3.5-flash', success: true }));
  });

  it('does not try another model for a request Gemini rejects outright', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiReply({ error: { code: 400 } }, { status: 400 }));
    const res = await draft();
    expect(res.statusCode).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('answers at once with a job id, and the job reports pending until the draft is ready', async () => {
    let finish;
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const res = makeRes();
    await draftCampaign({ body: { brief: BRIEF }, user: USER }, res);
    expect(res.statusCode).toBe(202);
    expect(res.body.jobId).toMatch(/^[0-9a-f-]{36}$/);
    expect((await poll(res.body.jobId)).body).toEqual({ status: 'pending' });

    finish(geminiDraft(DRAFT));
    await vi.waitFor(async () => expect((await poll(res.body.jobId)).body.status).toBe('done'));
    expect((await poll(res.body.jobId)).body.payload.name).toBe('Diploma applicant screening');
  });

  it("does not show one person's draft to anyone else", async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiDraft(DRAFT));
    const { jobId } = await draft();
    expect((await poll(jobId, { id: 'user-2', workspaceId: 'tenant-1' })).statusCode).toBe(404);
    expect((await poll(jobId, { id: 'user-1', workspaceId: 'tenant-2' })).statusCode).toBe(404);
    expect((await poll('no-such-job')).statusCode).toBe(404);
  });

  it('moves on to the next model when one does not answer in time', async () => {
    const timeout = Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(timeout).mockResolvedValueOnce(geminiDraft(DRAFT));
    const res = await draft();
    expect(res.statusCode).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
