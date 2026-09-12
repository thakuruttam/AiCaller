import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pruneEmptyTenants } from '../src/tenantRegistry.js';

function fakeRedis({ wait = 0, delayed = 0, active = 0 } = {}) {
  return {
    smembers: vi.fn().mockResolvedValue(['tenant-1']),
    llen: vi.fn((key) => {
      if (key.endsWith(':wait')) return Promise.resolve(wait);
      if (key.endsWith(':active')) return Promise.resolve(active);
      return Promise.resolve(0);
    }),
    zcard: vi.fn().mockResolvedValue(delayed),
    srem: vi.fn().mockResolvedValue(1),
  };
}

describe('pruneEmptyTenants', () => {
  let tenantQueues;

  beforeEach(() => {
    tenantQueues = new Map([['tenant-1', {}]]);
  });

  it('prunes a tenant with no waiting, delayed, or active jobs', async () => {
    const redis = fakeRedis({ wait: 0, delayed: 0, active: 0 });
    await pruneEmptyTenants(redis, tenantQueues);
    expect(redis.srem).toHaveBeenCalledWith('active:telephony:tenants', 'tenant-1');
    expect(tenantQueues.has('tenant-1')).toBe(false);
  });

  it('does NOT prune a tenant whose only job is delayed (a scheduled call)', async () => {
    const redis = fakeRedis({ wait: 0, delayed: 1, active: 0 });
    await pruneEmptyTenants(redis, tenantQueues);
    expect(redis.srem).not.toHaveBeenCalled();
    expect(tenantQueues.has('tenant-1')).toBe(true);
  });

  it('does not prune a tenant with an active (in-flight) call', async () => {
    const redis = fakeRedis({ wait: 0, delayed: 0, active: 1 });
    await pruneEmptyTenants(redis, tenantQueues);
    expect(redis.srem).not.toHaveBeenCalled();
    expect(tenantQueues.has('tenant-1')).toBe(true);
  });

  it('does not prune a tenant with waiting jobs', async () => {
    const redis = fakeRedis({ wait: 2, delayed: 0, active: 0 });
    await pruneEmptyTenants(redis, tenantQueues);
    expect(redis.srem).not.toHaveBeenCalled();
  });
});
