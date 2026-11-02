import { redis } from '../redis.js';

// Chatbot abuse guard — two layers:
//   1. Per-user: HOURLY_LIMIT per rolling hour-bucket, DAILY_LIMIT per UTC day.
//      Generous enough that normal use never trips it.
//   2. Per-workspace: WORKSPACE_DAILY_LIMIT per UTC day, flat regardless of
//      team size. This is the real backstop — a per-user limit alone can be
//      dodged by creating new accounts, but every account in a workspace
//      still shares this one ceiling.
// Fixed-window counters (INCR+EXPIRE), not sliding-window — simple, and the
// known edge case (up to ~2x the stated rate across a window boundary) is an
// accepted tradeoff for "normal use should never be blocked."
const HOURLY_LIMIT = 6;
const DAILY_LIMIT = 20;
const WORKSPACE_DAILY_LIMIT = 60;

const HOUR_TTL_SECONDS = 3700; // a little over an hour, just for Redis memory hygiene
const DAY_TTL_SECONDS = 93000; // a little over a day

// Single Lua script = atomic check-and-increment. Redis executes it as one
// unit, so concurrent requests from the same user/workspace can't race past
// the limit — the increment happens *before* the Gemini call, not after a
// successful reply, so quota is reserved up front.
const RATE_LIMIT_SCRIPT = `
local uh = tonumber(redis.call('GET', KEYS[1]) or '0')
local ud = tonumber(redis.call('GET', KEYS[2]) or '0')
local wd = tonumber(redis.call('GET', KEYS[3]) or '0')
if uh >= tonumber(ARGV[1]) then return {0, 'user_hour', uh, ud, wd} end
if ud >= tonumber(ARGV[2]) then return {0, 'user_day', uh, ud, wd} end
if wd >= tonumber(ARGV[3]) then return {0, 'workspace_day', uh, ud, wd} end
uh = redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], ARGV[4])
ud = redis.call('INCR', KEYS[2]); redis.call('EXPIRE', KEYS[2], ARGV[5])
wd = redis.call('INCR', KEYS[3]); redis.call('EXPIRE', KEYS[3], ARGV[5])
return {1, 'ok', uh, ud, wd}
`;

const CODE_BY_REASON = {
  user_hour: 'RATE_LIMIT_USER_HOUR',
  user_day: 'RATE_LIMIT_USER_DAY',
  workspace_day: 'RATE_LIMIT_WORKSPACE_DAY',
};

const MESSAGE_BY_REASON = {
  user_hour: `You've reached the hourly limit (${HOURLY_LIMIT} questions). Try again in a bit.`,
  user_day: `You've reached today's limit (${DAILY_LIMIT} questions). Try again tomorrow.`,
  workspace_day: 'Your workspace has reached its daily limit for the assistant. Ask an admin, or try again tomorrow.',
};

function utcDateString(d) {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// Seconds remaining until the relevant window resets, for the `Retry-After`
// header — the hour window resets on the hour, the day window at UTC midnight.
function retryAfterSeconds(reason, now) {
  if (reason === 'user_hour') {
    return 3600 - (Math.floor(now.getTime() / 1000) % 3600);
  }
  const msUntilMidnightUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
  return Math.ceil(msUntilMidnightUtc / 1000);
}

// Mounted only on the chat POST route — not a global limiter, matching the
// codebase's existing style of narrowly-applied middleware (authorize(),
// verifyCampaignAccess()) rather than app-wide rate limiting nobody asked for.
export async function chatRateLimit(req, res, next) {
  const now = new Date();
  const hourBucket = Math.floor(now.getTime() / 3_600_000);
  const dayString = utcDateString(now);

  const userHourKey = `chat:rl:u:${req.user.id}:h:${hourBucket}`;
  const userDayKey = `chat:rl:u:${req.user.id}:d:${dayString}`;
  const workspaceDayKey = `chat:rl:w:${req.user.workspaceId}:d:${dayString}`;

  try {
    const [allowed, reason, uh, ud] = await redis.eval(
      RATE_LIMIT_SCRIPT,
      3,
      userHourKey, userDayKey, workspaceDayKey,
      HOURLY_LIMIT, DAILY_LIMIT, WORKSPACE_DAILY_LIMIT,
      HOUR_TTL_SECONDS, DAY_TTL_SECONDS,
    );

    if (!allowed) {
      const retrySeconds = retryAfterSeconds(reason, now);
      res.set('Retry-After', String(retrySeconds));
      return res.status(429).json({
        error: MESSAGE_BY_REASON[reason],
        code: CODE_BY_REASON[reason],
        retryAfterSeconds: retrySeconds,
      });
    }

    req.chatRateLimitRemaining = {
      hour: Math.max(0, HOURLY_LIMIT - uh),
      day: Math.max(0, DAILY_LIMIT - ud),
    };
    next();
  } catch (err) {
    console.error('[chatRateLimit] Redis error:', err);
    res.status(503).json({ error: 'The assistant is temporarily unavailable. Try again shortly.', code: 'CHATBOT_UNAVAILABLE' });
  }
}
