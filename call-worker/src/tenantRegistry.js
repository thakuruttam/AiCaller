// call-worker/src/tenantRegistry.js
export async function pruneEmptyTenants(redis, tenantQueues) {
  const tenants = await redis.smembers('active:telephony:tenants');
  for (const tenantId of tenants) {
    const count = await redis.llen(`bull:call-queue-${tenantId}:wait`);
    if (count === 0) {
      // Remove from active list if no calls waiting
      await redis.srem('active:telephony:tenants', tenantId);
      // Optional: cleanup Queue instance if it exists
      tenantQueues.delete(tenantId);
    }
  }
}
