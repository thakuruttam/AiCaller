import { describe, it, expect, vi, beforeEach } from 'vitest';

const evalMock = vi.fn();
vi.mock('../../../src/redis.js', () => ({
  redis: { eval: evalMock },
}));

const { chatRateLimit } = await import('../../../src/middleware/chatRateLimit.js');

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.set = vi.fn().mockReturnValue(res);
  return res;
}

function mockReq() {
  return { user: { id: 'user-1', workspaceId: 'workspace-1' } };
}

beforeEach(() => {
  evalMock.mockReset();
});

describe('chatRateLimit', () => {
  it('allows the request and records remaining counts when under every limit', async () => {
    evalMock.mockResolvedValue([1, 'ok', 2, 5, 10]);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await chatRateLimit(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(req.chatRateLimitRemaining).toEqual({ hour: 6 - 2, day: 20 - 5 });
  });

  it('checks a single Lua script atomically against 3 keys scoped to the user and workspace', async () => {
    evalMock.mockResolvedValue([1, 'ok', 1, 1, 1]);
    const req = mockReq();
    await chatRateLimit(req, mockRes(), vi.fn());

    expect(evalMock).toHaveBeenCalledOnce();
    const [script, numKeys, userHourKey, userDayKey, workspaceDayKey] = evalMock.mock.calls[0];
    expect(typeof script).toBe('string');
    expect(numKeys).toBe(3);
    expect(userHourKey).toContain('user-1');
    expect(userDayKey).toContain('user-1');
    expect(workspaceDayKey).toContain('workspace-1');
  });

  it('rejects with 429 RATE_LIMIT_USER_HOUR when the hourly limit is hit', async () => {
    evalMock.mockResolvedValue([0, 'user_hour', 6, 3, 10]);
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await chatRateLimit(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'RATE_LIMIT_USER_HOUR' }));
    expect(res.set).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('rejects with 429 RATE_LIMIT_USER_DAY when the daily limit is hit', async () => {
    evalMock.mockResolvedValue([0, 'user_day', 2, 20, 10]);
    const res = mockRes();
    await chatRateLimit(mockReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'RATE_LIMIT_USER_DAY' }));
  });

  it('rejects with 429 RATE_LIMIT_WORKSPACE_DAY when the workspace cap is hit, even for a user under their own limit', async () => {
    evalMock.mockResolvedValue([0, 'workspace_day', 1, 1, 60]);
    const res = mockRes();
    await chatRateLimit(mockReq(), res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'RATE_LIMIT_WORKSPACE_DAY' }));
  });

  it('returns a soft 503 if Redis itself is unavailable, rather than letting the request hang', async () => {
    evalMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await chatRateLimit(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CHATBOT_UNAVAILABLE' }));
  });
});
