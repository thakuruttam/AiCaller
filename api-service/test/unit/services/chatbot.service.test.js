import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const findManyMock = vi.fn();
vi.mock('../../../src/db.js', () => ({
  prisma: { campaign: { findMany: findManyMock } },
}));

const computeUsageSummaryMock = vi.fn();
const computeBillingSummaryMock = vi.fn();
vi.mock('../../../src/controllers/billing.controller.js', () => ({
  computeUsageSummary: computeUsageSummaryMock,
  computeBillingSummary: computeBillingSummaryMock,
}));

const { runChat, hasCredentials } = await import('../../../src/services/chatbot.service.js');

const ADMIN_USER = { id: 'u1', role: 'ADMIN', workspaceId: 'workspace-1' };
const SUPER_ADMIN_USER = { id: 'u2', role: 'SUPER_ADMIN', workspaceId: 'workspace-1' };

function textResponse(text) {
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

function functionCallResponse(name, args = {}) {
  return { candidates: [{ content: { parts: [{ functionCall: { name, args } }] } }] };
}

function mockFetchOnce(body, ok = true, status = 200) {
  global.fetch.mockResolvedValueOnce({ ok, status, json: async () => body, text: async () => JSON.stringify(body) });
}

beforeEach(() => {
  findManyMock.mockReset();
  computeUsageSummaryMock.mockReset();
  computeBillingSummaryMock.mockReset();
  global.fetch = vi.fn();
  process.env.GEMINI_API_KEY = 'test-key';
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

describe('hasCredentials', () => {
  it('is false without GEMINI_API_KEY', () => {
    delete process.env.GEMINI_API_KEY;
    expect(hasCredentials()).toBe(false);
  });

  it('is true with GEMINI_API_KEY set', () => {
    process.env.GEMINI_API_KEY = 'key';
    expect(hasCredentials()).toBe(true);
  });
});

describe('runChat', () => {
  it('throws a CHATBOT_UNAVAILABLE error when no API key is configured', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(runChat({ message: 'hi', history: [], user: ADMIN_USER })).rejects.toMatchObject({ code: 'CHATBOT_UNAVAILABLE' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns the plain text reply when Gemini answers without a tool call', async () => {
    mockFetchOnce(textResponse('You can create a campaign from the sidebar.'));
    const reply = await runChat({ message: 'How do I create a campaign?', history: [], user: ADMIN_USER });
    expect(reply).toBe('You can create a campaign from the sidebar.');
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it('sends the system prompt via systemInstruction, not duplicated into contents', async () => {
    mockFetchOnce(textResponse('ok'));
    await runChat({ message: 'hello', history: [], user: ADMIN_USER });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.systemInstruction.parts[0].text).toContain('AI Caller Pro assistant');
    expect(body.contents.every(c => !c.parts.some(p => p.text?.includes('AI Caller Pro assistant')))).toBe(true);
  });

  it('truncates client-supplied history to the last 8 turns regardless of how much is sent', async () => {
    mockFetchOnce(textResponse('ok'));
    const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 === 0 ? 'user' : 'assistant', content: `turn ${i}` }));
    await runChat({ message: 'latest', history, user: ADMIN_USER });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    // 8 history turns + the new message = 9 content entries
    expect(body.contents).toHaveLength(9);
    expect(body.contents[body.contents.length - 1].parts[0].text).toBe('latest');
  });

  it('omits get_billing_summary from the tool list for a non-SUPER_ADMIN user', async () => {
    mockFetchOnce(textResponse('ok'));
    await runChat({ message: 'hi', history: [], user: ADMIN_USER });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    const names = body.tools[0].functionDeclarations.map(f => f.name);
    expect(names).toEqual(['get_campaign_summary', 'get_usage_summary']);
  });

  it('includes get_billing_summary in the tool list for a SUPER_ADMIN user', async () => {
    mockFetchOnce(textResponse('ok'));
    await runChat({ message: 'hi', history: [], user: SUPER_ADMIN_USER });
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    const names = body.tools[0].functionDeclarations.map(f => f.name);
    expect(names).toContain('get_billing_summary');
  });

  it('executes a tool round-trip and feeds the result back, scoped by the caller\'s own workspace regardless of any args', async () => {
    mockFetchOnce(functionCallResponse('get_campaign_summary', { campaignName: 'anything' }));
    mockFetchOnce(textResponse('You have 2 campaigns.'));
    findManyMock.mockResolvedValue([
      { name: 'Campaign A', type: 'HR', createdAt: new Date(), _count: { campaignContacts: 3, callLogs: 5 } },
    ]);

    const reply = await runChat({ message: 'how many campaigns do I have', history: [], user: ADMIN_USER });

    expect(reply).toBe('You have 2 campaigns.');
    expect(findManyMock).toHaveBeenCalledOnce();
    const callArgs = findManyMock.mock.calls[0][0];
    expect(callArgs.where.tenantId).toBe(ADMIN_USER.workspaceId);

    const secondBody = JSON.parse(global.fetch.mock.calls[1][1].body);
    const functionResponseTurn = secondBody.contents.find(c => c.parts.some(p => p.functionResponse));
    expect(functionResponseTurn.role).toBe('user');
  });

  it('rejects a get_billing_summary call at the handler level even if a non-SUPER_ADMIN somehow triggers it (defense in depth)', async () => {
    mockFetchOnce(functionCallResponse('get_billing_summary', {}));
    mockFetchOnce(textResponse('Billing is restricted.'));

    await runChat({ message: 'what is my balance', history: [], user: ADMIN_USER });

    expect(computeBillingSummaryMock).not.toHaveBeenCalled();
    const secondBody = JSON.parse(global.fetch.mock.calls[1][1].body);
    const functionResponseTurn = secondBody.contents.find(c => c.parts.some(p => p.functionResponse));
    expect(functionResponseTurn.parts[0].functionResponse.response.error).toMatch(/restricted/i);
  });

  it('returns a real billing summary for a SUPER_ADMIN caller', async () => {
    mockFetchOnce(functionCallResponse('get_billing_summary', {}));
    mockFetchOnce(textResponse('Balance: 100 minutes.'));
    computeBillingSummaryMock.mockResolvedValue({ minuteBalance: 100, billingTier: 'TRIAL', limits: {}, packs: [] });

    const reply = await runChat({ message: 'what is my balance', history: [], user: SUPER_ADMIN_USER });

    expect(reply).toBe('Balance: 100 minutes.');
    expect(computeBillingSummaryMock).toHaveBeenCalledWith(SUPER_ADMIN_USER.workspaceId);
  });

  it('stops after MAX_TOOL_ITERATIONS and returns a fallback message instead of looping forever', async () => {
    mockFetchOnce(functionCallResponse('get_usage_summary'));
    mockFetchOnce(functionCallResponse('get_usage_summary'));
    mockFetchOnce(functionCallResponse('get_usage_summary'));
    computeUsageSummaryMock.mockResolvedValue({ totalMinutes: 0, totalCalls: 0, campaigns: [] });

    const reply = await runChat({ message: 'loop', history: [], user: ADMIN_USER });

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(reply).toMatch(/trouble/i);
  });

  it('throws when Gemini responds with a non-ok status', async () => {
    mockFetchOnce({ error: 'boom' }, false, 500);
    await expect(runChat({ message: 'hi', history: [], user: ADMIN_USER })).rejects.toThrow(/Gemini request failed/);
  });
});
