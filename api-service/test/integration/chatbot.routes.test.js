import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const evalMock = vi.fn();
vi.mock('../../src/redis.js', () => ({
  redis: { eval: evalMock, on: vi.fn() },
}));

const runChatMock = vi.fn();
const hasCredentialsMock = vi.fn();
vi.mock('../../src/services/chatbot.service.js', () => ({
  runChat: (...args) => runChatMock(...args),
  hasCredentials: () => hasCredentialsMock(),
}));

const app = (await import('../../src/app.js')).default;
const { prisma } = await import('../../src/db.js');

async function makeTenant() {
  return prisma.tenant.create({
    data: { name: 'Chatbot Tenant', slug: 'chatbot-' + Date.now() + '-' + Math.random().toString(36).slice(2) },
  });
}

function authHeaderFor(tenant, overrides = {}) {
  const token = jwt.sign(
    { id: 'user-1', email: 'a@b.com', role: 'ADMIN', workspaceId: tenant.id, workspaceRole: 'ADMIN', ...overrides },
    process.env.JWT_SECRET
  );
  return `Bearer ${token}`;
}

beforeEach(() => {
  evalMock.mockReset().mockResolvedValue([1, 'ok', 1, 1, 1]); // allowed by default
  runChatMock.mockReset();
  hasCredentialsMock.mockReset().mockReturnValue(true);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/chatbot/faq', () => {
  it('returns 401 with no auth header', async () => {
    const res = await request(app).get('/api/chatbot/faq');
    expect(res.status).toBe(401);
  });

  it('returns the FAQ list for an authenticated user', async () => {
    const tenant = await makeTenant();
    const res = await request(app).get('/api/chatbot/faq').set('Authorization', authHeaderFor(tenant));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('q');
    expect(res.body[0]).toHaveProperty('a');
  });
});

describe('POST /api/chatbot/message', () => {
  it('returns 401 with no auth header', async () => {
    const res = await request(app).post('/api/chatbot/message').send({ message: 'hi' });
    expect(res.status).toBe(401);
  });

  it('returns 400 for an empty message', async () => {
    const tenant = await makeTenant();
    const res = await request(app).post('/api/chatbot/message').set('Authorization', authHeaderFor(tenant)).send({ message: '  ' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an excessively long message', async () => {
    const tenant = await makeTenant();
    const res = await request(app).post('/api/chatbot/message').set('Authorization', authHeaderFor(tenant))
      .send({ message: 'a'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  it('returns 503 CHATBOT_UNAVAILABLE when no credentials are configured, without calling runChat', async () => {
    hasCredentialsMock.mockReturnValue(false);
    const tenant = await makeTenant();
    const res = await request(app).post('/api/chatbot/message').set('Authorization', authHeaderFor(tenant)).send({ message: 'hi' });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('CHATBOT_UNAVAILABLE');
    expect(runChatMock).not.toHaveBeenCalled();
  });

  it('returns the reply and remaining quota on success', async () => {
    runChatMock.mockResolvedValue('Here is your answer.');
    const tenant = await makeTenant();
    const res = await request(app).post('/api/chatbot/message').set('Authorization', authHeaderFor(tenant)).send({ message: 'How do I create a campaign?' });

    expect(res.status).toBe(200);
    expect(res.body.reply).toBe('Here is your answer.');
    expect(res.body.remaining).toEqual({ hour: 5, day: 19 });
    expect(runChatMock).toHaveBeenCalledWith(expect.objectContaining({ message: 'How do I create a campaign?' }));
  });

  it('returns 429 with the rate-limit code before ever calling runChat, once the limit middleware rejects', async () => {
    evalMock.mockResolvedValue([0, 'user_hour', 6, 3, 10]);
    const tenant = await makeTenant();
    const res = await request(app).post('/api/chatbot/message').set('Authorization', authHeaderFor(tenant)).send({ message: 'hi' });

    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMIT_USER_HOUR');
    expect(runChatMock).not.toHaveBeenCalled();
  });

  it('returns 502 when the chat service throws an unexpected error', async () => {
    runChatMock.mockRejectedValue(new Error('upstream exploded'));
    const tenant = await makeTenant();
    const res = await request(app).post('/api/chatbot/message').set('Authorization', authHeaderFor(tenant)).send({ message: 'hi' });
    expect(res.status).toBe(502);
  });
});
