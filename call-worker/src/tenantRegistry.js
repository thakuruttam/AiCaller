// call-worker/src/tenantRegistry.js
export async function pruneEmptyTenants(redis, tenantQueues) {
  const tenants = await redis.smembers('active:telephony:tenants');
  for (const tenantId of tenants) {
    // Must also check 'delayed' (scheduled-for-later calls) and 'active'
    // (currently dialing) — checking only 'wait' would prune a tenant whose
    // only job is a future-scheduled call, tearing down its Worker before
    // the job is ever ready and leaving it stuck unprocessed once it fires.
    const [waiting, delayed, active] = await Promise.all([
      redis.llen(`bull:call-queue-${tenantId}:wait`),
      redis.zcard(`bull:call-queue-${tenantId}:delayed`),
      redis.llen(`bull:call-queue-${tenantId}:active`)
    ]);
    if (waiting === 0 && delayed === 0 && active === 0) {
      // Remove from active list if no calls waiting, delayed, or in-flight
      await redis.srem('active:telephony:tenants', tenantId);
      // Optional: cleanup Queue instance if it exists
      tenantQueues.delete(tenantId);
    }
  }
}
