# Architecture Review — Cost, Speed, Scalability

**Date:** 2026-08-17 (Finding #1 resolved 2026-08-17, same day — see update note below; document otherwise left as originally written since it's a point-in-time audit, not a living reference — see `README.md` for current state)
**Scope:** full-stack review of the production architecture (AWS EC2 backend, Vercel frontend, Neon Postgres, Redis, CI/CD) following a same-week production incident and CI/CD hardening pass. Findings below are evidence-based — measured directly against the live system, not inferred from docs alone.

> **Update, later the same day:** Finding #1 (DB region mismatch) below is now **resolved** — the production database was migrated from Neon Postgres (`us-east-1`) to MongoDB Atlas (`ap-south-1`, same region as the app server), cutting measured DB latency from ~185-190ms to ~13ms. This was driven by an unrelated request (moving to MongoDB), not by this review directly, but it happens to fix exactly the problem flagged here. The rest of this document's findings (telephony on a burstable instance, SPOF, unmeasured capacity) are still current as written. See `README.md`'s "Database" section for the live setup.

---

## Current architecture (as of this review)

```
Internet
   │
   ├── aicaller.store (apex)         → Vercel (frontend, auto-scaling)
   │
   └── api.aicaller.store            → Elastic IP 65.2.193.150 (ap-south-1 / Mumbai)
                                           │
                                           ▼
                                    EC2 instance i-029d54b7dcbd7a059 (t3.small)
                                           │
                                           ├── Docker container "aicaller"
                                           │     nginx + 5 processes under PM2:
                                           │       api-service (3000)
                                           │       telephony-gateway (3001, Plivo WS audio)
                                           │       call-worker (BullMQ)
                                           │       call-evaluation-api (4000)
                                           │       call-evaluation-worker (BullMQ)
                                           └── Docker container "redis" (co-located, ephemeral state)

External, decoupled from the above:
  - MongoDB Atlas — ap-south-1 (AWS)  ← was Neon Postgres/us-east-1 at review time, see Finding #1 (now resolved)
  - Plivo (telephony), OpenAI (gpt-4.1-mini), Groq (sandbox LLM), Deepgram/Sarvam (STT/TTS)
```

CI/CD: GitHub Actions on push to `main` → builds/pushes Docker image to ECR → SSHs into the EC2 box to redeploy the container; separately deploys the frontend to Vercel. Verified working end-to-end as of 2026-08-16 (four consecutive green runs).

---

## Findings, ranked by impact

### 1. DB region mismatch — the single biggest speed problem — ✅ RESOLVED 2026-08-17

*Original finding, as measured at review time:*

The app runs in `ap-south-1` (Mumbai). Neon Postgres runs in `us-east-1` (Virginia). Measured directly from the EC2 instance itself:

```
TCP connect to Neon DB host: ~185-190ms, consistent across 5 attempts
```

That's paid on every DB round trip. An endpoint that issues 3-5 sequential Prisma queries — normal in an ORM-based app — loses close to a full second to pure network latency alone, before any query execution or business logic runs. This dwarfs the CPU-sizing issue that was fixed the same week (t3.micro → t3.small).

*Resolution:* the database was migrated to **MongoDB Atlas in `ap-south-1`** the same day (driven by a separate request to move off Postgres, not by this review — but it happened to land exactly the right region). Re-measured post-migration, directly from the EC2 box: **~13ms** TCP connect to the Atlas cluster — roughly a 15x improvement. No further region action needed on the database side.

**The pooled-connection point below is now moot** (MongoDB doesn't have a PgBouncer-style pooler distinction the same way) — leaving the original text for the record, but it no longer applies:

~~Secondary, lower-urgency finding on the same axis: `DATABASE_URL` points at Neon's **direct** connection endpoint, not the pooled (PgBouncer) one — no `-pooler` in the hostname. Fine at current scale, but 5 separate Node processes each running their own Prisma connection pool adds up as call volume grows, and pooled connections matter more as concurrent DB load increases. Cheap fix, no urgency yet.~~

### 2. Telephony runs on a shared, burstable instance

`telephony-gateway` (the real-time bidirectional audio WebSocket handler for live calls) is one of 5 PM2-managed processes sharing a single `t3.small`'s 2 vCPUs — and `t3.small` is still a *burstable* instance type. We already saw this instance class throttle to its CPU baseline once this week (see incident below). For a real-time audio path, that failure mode isn't "slow API response" — it's dropped words or audio glitches mid-call, a qualitatively worse failure than a slow REST endpoint.

**Recommendation:** watch call audio quality specifically under load, not just aggregate CPU/API latency metrics. If it degrades, the next lever is isolating telephony onto dedicated (non-shared, ideally non-burstable) resources — not another blanket instance-size bump.

### 3. Scalability: single point of failure, unmeasured capacity

- **No redundancy.** One EC2 instance, one AZ. This is not theoretical — it caused a real production outage this week (see incident log below). Reasonable to accept at current stage, but be clear-eyed: any instance-level failure is full downtime until manual intervention. No load balancer, no autoscaling group.
- **No global concurrency cap.** `MAX_CALLS_PER_TENANT=5` (`call-worker/src/fairDispatcher.js`) is the *only* concurrency control enforced anywhere in the code. Nothing stops many tenants collectively overwhelming the single instance — no backpressure, no circuit breaker.
- **Capacity is genuinely unmeasured.** No load test has ever been run against this stack. This week's incidents (CPU credit exhaustion, a full instance hang) are the first real signal of a ceiling, and that wasn't necessarily peak load.
- **Redis is co-located with the app** — shares CPU/RAM, and is a shared-fate SPOF (app dies, in-flight queue state dies with it). This is a *correctly reasoned* tradeoff already documented in the main README (Redis holds only ephemeral job-queue/call state, not business data) — no change needed now, but it does block horizontal scaling later: multiple app instances can't share a Redis that lives on only one of them, so externalizing Redis is a prerequisite for the "add more instances" scaling path, not something to defer indefinitely.

### 4. Cost — already well-optimized, no action needed

The current shape (single small EC2 instance, no managed Redis, no NAT Gateway/VPC Connector, serverless-autoscaling database, edge-hosted frontend) reflects a deliberate, sound cost decision already made and documented in the main README's "why this architecture" section — an earlier AWS App Runner + ElastiCache design was correctly rejected because it would have forced a NAT Gateway (~$32+/mo) purely for otherwise-plain internet egress, for no real benefit at current traffic.

Current run-rate: EC2 `t3.small` ~$15-16/mo (up from ~$7-8/mo on `t3.micro` after the 2026-08-16 resize) + ECR storage (negligible) + Elastic IP (free while attached) + MongoDB Atlas/Plivo/OpenAI/Groq/Deepgram/Sarvam usage-based costs + Vercel (frontend hosting). No cost bloat identified — this is not the axis worth spending effort on right now.

---

## What's already right — don't change these

- **MongoDB Atlas** (serverless-ish, autoscaling compute, correct region as of the 2026-08-17 migration) — no findings here anymore. (Was Neon Postgres at review time — structurally fine, the problem was region, which is now moot since the DB itself changed.)
- **Vercel for the frontend** — auto-scaling, not a bottleneck, no findings here.
- **Avoiding NAT Gateway / managed Redis** — correctly optimized for current traffic level; revisit only if/when scale actually forces it, not preemptively.
- **Monolith-in-one-container (PM2 + nginx, 5 processes)** — a reasonable simplicity tradeoff for this stage of the product. It has a known ceiling (see Finding #3), but "has a ceiling" and "wrong" are different things — this isn't premature to keep as-is.

---

## Priority order for follow-up work

1. ~~Fix the Neon region mismatch~~ — **done 2026-08-17** (MongoDB Atlas migration landed in `ap-south-1`).
2. **Run an actual load test** before making any capacity promises to customers — there are currently zero real numbers behind "how much traffic can this handle." Still the top open item.
3. **Watch telephony call quality specifically** under load, not just aggregate CPU/API metrics — a different failure mode than general slowness.
4. ~~Switch to Neon's pooled connection endpoint~~ — moot, no longer on Postgres.
5. **SPOF / no autoscaling** — leave as-is until traffic genuinely demands the ALB + multi-instance step already documented in the main README's scaling section; don't build it ahead of need.
6. **New, not in the original review:** a real automated test suite has since been added (Vitest, ~196 tests across all 5 packages, CI-wired but not deploy-blocking as of 2026-08-17) — this reduces regression risk generally but wasn't a finding here originally; see `README.md`'s "🧪 Testing" section for current coverage scope.

---

## Reference: incident log this week (context for the findings above)

**2026-08-16 — EC2 hang.** `api.aicaller.store` stopped responding entirely — ports accepted TCP but nothing replied, even though AWS's own status checks reported "ok." Root cause: OS-level resource exhaustion on the (then) `t3.micro`, 1GB RAM, no swap. Fixed via `aws ec2 reboot-instances` (no SSH needed to trigger). Full detail and recovery commands are in the main `README.md` under "🩹 Runbook: EC2 unresponsive but AWS says it's healthy."

**2026-08-16 — CI/CD found to have never worked.** `.github/workflows/deploy.yml` existed and triggered on every push but had a 100% failure rate historically — zero required GitHub Actions secrets were ever configured. All 8 secrets were filled in and the pipeline verified with real deploys (now 4-for-4 successful runs). Detail in `README.md`'s CI/CD section.

**2026-08-16 — API slowness, traced to CPU credit exhaustion.** Reported by a user in Delhi; region routing (Mumbai) was already correct and not the cause. `CPUCreditBalance` was pinned at `0.0` for hours — `t3.micro` throttles to a 10% CPU baseline once burst credits are exhausted — compounded by memory down to ~33MB available out of 916MB total. Resized `t3.micro → t3.small`; confirmed available memory jumped to 1245MB and app container memory usage dropped from 64% to 17% of the container limit. Full procedure in `README.md`'s runbook section.

These three incidents, taken together, are what motivated this review — the pattern across all of them is that the single-instance architecture has been running with very little headroom, and this document exists so the next scaling decision is made from measured evidence rather than guesswork.

**2026-08-17 — Database migrated from Neon Postgres to MongoDB Atlas.** Unrelated to this review directly (a separate request), but resolved Finding #1 above as a side effect — new cluster landed in `ap-south-1`, matching the app's region. Two non-obvious blockers hit along the way: Prisma 7 cannot connect to MongoDB at all (driver adapters became mandatory in 7.x, no `@prisma/adapter-mongodb` exists — had to pin all 4 services to Prisma `^6.19.0`), and MongoDB's unique indexes aren't sparse by default (broke `User.googleId` and `TopUp.razorpayPaymentId`, both optional+unique fields, after the 2nd null value — fixed by dropping `@unique` on both). Old Postgres data was intentionally not migrated. Full detail in `README.md`'s "Database" section.

**2026-08-17 — Automated test suite added.** Vitest set up from zero across all 5 packages, ~196 tests focused on auth/billing/campaign flows plus the evaluation-scoring pipeline. Wired into CI (`test-backend`/`test-frontend` jobs) but not deploy-blocking yet. Doesn't change any finding above, but is relevant context for future architecture decisions — there's now a regression safety net for the highest-risk code paths that didn't exist when this review was written. See `README.md`'s "🧪 Testing" section.
