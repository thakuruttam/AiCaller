# AI Calling Platform — Multi-Service Stack

A multi-service AI calling platform built with Node.js, Postgres, Redis, and BullMQ.

---

## Services

| Service | Port | Purpose |
|---|---|---|
| `api-service` | 3000 | Main REST API |
| `telephony-gateway` | 3001 | Plivo WebSocket handler (bidirectional audio stream) |
| `call-worker` | — | BullMQ call dispatch worker |
| `call-evaluation-api` | 4000 | Evaluation REST API |
| `call-evaluation-worker` | — | BullMQ evaluation worker |
| `nginx` | 8080 | Unified gateway — routes by path to the 3 services above |

All 5 processes run together under PM2 inside **one Docker container** (see root `Dockerfile` / `ecosystem.config.js` / `nginx-monolith.conf`). This is true both locally and in production — nginx is not local-only, it's the single entry point everywhere.

---

## 🖥️ Local Development

```bash
cp .env.example .env   # fill in real API keys
docker-compose up --build

# → All API traffic:  http://localhost:8080
# → Telephony WS:     ws://localhost:8080/plivo-streams
# → Evaluation API:   http://localhost:8080 (routed via nginx path rules)
```

```bash
git pull && docker-compose up --build   # pull + restart
docker-compose logs -f api-service      # logs for one service
docker-compose down                     # stop everything
docker-compose down -v && docker-compose up --build   # wipe DB, start fresh
```

---

## ☁️ Production Deployment (AWS EC2)

**Current stack, as of 2026-08-16:**

```
Internet
   │
   ▼
Elastic IP (65.2.193.150) — ap-south-1 (Mumbai)
   │
   ▼
EC2 instance (i-029d54b7dcbd7a059, t3.micro)
   │
   ├── Docker container "aicaller"  — the monolith (nginx + 5 PM2 processes), port 80→8080
   └── Docker container "redis"     — redis:7-alpine, maxmemory-policy=noeviction (BullMQ requirement)
         both on a shared Docker network "aicaller-net", Redis reachable at redis://redis:6379

External dependencies (unaffected by this migration):
  - Neon Postgres        — DATABASE_URL, us-east-1 (not moved — cheap to leave, not latency-critical for DB)
  - Plivo                — telephony
  - OpenAI (gpt-4.1-mini) — live conversation LLM
  - Groq (llama-3.1-8b)   — sandbox-only LLM
  - Deepgram / Sarvam     — STT/TTS
  - Vercel                — frontend (aicaller.store, apex domain via A record to Vercel)
```

### Domain / TLS

- `api.aicaller.store` → A record → `65.2.193.150` (this EC2 instance)
- `aicaller.store` (apex) → A record → Vercel (frontend)
- Domain purchased via Spaceship. DNS managed there — this repo/AWS account has no control over registrar-level DNS, only what's documented above needs to exist.
- TLS: free Let's Encrypt certificate for `api.aicaller.store`, obtained via `certbot --standalone` directly on the EC2 host (not through Docker — nginx runs inside the container, so the cert lives on the host at `/etc/letsencrypt` and is bind-mounted **read-only** into the container at the same path).
- nginx inside the container listens on `8080` (HTTP, redirects to HTTPS) and `8443` (HTTPS, actual routing) — mapped via Docker to host ports `80` and `443`. Config lives at `~/nginx-tls.conf` on the host (bind-mounted in, not baked into the image — see `deploy.sh`).
- **Auto-renewal**: certbot's own `certbot-renew.timer` (systemd) handles renewal before the Nov 2026 expiry; a deploy-hook at `/etc/letsencrypt/renewal-hooks/deploy/restart-aicaller.sh` restarts the `aicaller` container after each renewal so nginx picks up the fresh cert. Both are host-level systemd config — **not part of the Docker image or `deploy.sh`**, so a full instance replacement (not just a container redeploy) would need this redone. Worth automating into instance user-data if the instance ever gets rebuilt.

### Why this architecture (history, so it doesn't get re-litigated)

1. Started on Railway. Railway's auto-generated `*.up.railway.app` domains failed DNS resolution repeatedly (3 separate generated domains went dead) — a platform-side bug, not fixable from our side. See git history / conversation log around 2026-08-16 for the full incident.
2. First AWS attempt: **App Runner + ElastiCache**. Works, but ElastiCache requires a VPC Connector, and once App Runner uses a VPC Connector *all* egress traffic (Neon, Plivo, OpenAI, everything) must route through the VPC — which requires a NAT Gateway (~$32+/month minimum) just to reach the public internet. That cost is disproportionate to this app's actual traffic.
3. Landed on: **single EC2 instance running the app + Redis together**, no managed Redis, no VPC Connector, no NAT Gateway. Cheapest and simplest option that still meets "AWS-only." Redis data is ephemeral job-queue state (not business data — that's all in Neon), so co-locating it with the app instance is an acceptable tradeoff at current scale.
4. Initially ran on the bare Elastic IP over plain HTTP (no domain yet) — broke Google Sign-In, since Google requires HTTPS on OAuth redirect URIs and Let's Encrypt can't issue certs for a bare IP. Fixed once `aicaller.store` was purchased — see "Domain / TLS" above.

### AWS resources (ap-south-1 / Mumbai)

| Resource | ID / Name | Notes |
|---|---|---|
| EC2 instance | `i-029d54b7dcbd7a059` | t3.micro, Amazon Linux 2023 |
| Elastic IP | `65.2.193.150` (`eipalloc-006ba00af07410bf5`) | Stable address — survives instance stop/start |
| Security group | `sg-081906199c513c0ed` (`aicaller-ec2-sg`) | Inbound 22 (SSH), 80, 443 from anywhere |
| SSH key pair (original) | `aicaller-ec2-key` | Private `.pem` held outside repo entirely (not in GitHub either) — used only for manual `ssh -i aicaller-ec2-key.pem` access, see "Manual deploy" below |
| SSH key pair (CI) | `github-actions-aicaller-ci` (ed25519) | Dedicated key added to `~/.ssh/authorized_keys` on the instance for GitHub Actions only. Private half is GitHub Actions secret `EC2_SSH_KEY`; public half lives only on the box (not tracked in AWS as a named key pair) |
| IAM instance role | `AiCallerEC2Role` / `AiCallerEC2Profile` | ECR read-only — lets the instance pull images without embedded credentials |
| ECR repository | `486255624168.dkr.ecr.ap-south-1.amazonaws.com/aicaller` | Docker image registry |
| IAM CI user | `aicaller-ci-deploy` | Scoped to ECR push only — used by GitHub Actions |
| IAM admin user | `admin@neosharks.in` | Used for initial provisioning via CLI, and for ops (reboot, EC2 Instance Connect) via the local `aicaller-migration` AWS CLI profile. Has `AdministratorAccess` — broad on purpose for setup speed, **rotate or delete its access key once infra is stable** |

On the instance itself:
- `~/aicaller.env` — the real environment variables (not in git, not in GitHub Actions — lives only on the box). Edit this file directly via SSH to change a secret/config value, then re-run `~/deploy.sh` (or just `docker restart aicaller` if no image change is needed).
- `~/deploy.sh` — pulls the latest `:latest` image from ECR and recreates the `aicaller` container. This is exactly what GitHub Actions runs remotely on every deploy.

### Auto-deploy on push

`git push origin main` → GitHub Actions (`.github/workflows/deploy.yml`):
1. Builds the Docker image from the root `Dockerfile`
2. Pushes it to ECR (tag `:latest`)
3. SSHs into the EC2 instance and runs `~/deploy.sh` (pulls the new image, recreates the container with the existing `~/aicaller.env`)
4. Separately deploys the frontend to Vercel (unchanged from before)

**Status: verified working as of 2026-08-16** (commit `affc908`, run `31961426845` — both jobs green, ~2min total). Before this date the workflow existed but had *never once succeeded* — every run failed in under 30s because none of its required secrets were set; all prior deploys were manual SSH. All 8 secrets are now configured:

| Secret | Purpose |
|---|---|
| `AWS_CI_ACCESS_KEY_ID` / `AWS_CI_SECRET_ACCESS_KEY` | `aicaller-ci-deploy` IAM user, scoped to ECR push |
| `AWS_ACCOUNT_ID` | ECR registry URL construction |
| `EC2_HOST` | SSH target (`65.2.193.150`) |
| `EC2_SSH_KEY` | Private half of a **dedicated CI-only ed25519 keypair** (`github-actions-aicaller-ci`) — not the original `aicaller-ec2-key.pem`. Its public half was appended to `~/.ssh/authorized_keys` on the instance. |
| `VERCEL_TOKEN` | Personal token scoped to the `thakuruttams-projects` team — must be created via the Vercel dashboard (Account Settings → Tokens); the CLI's `vercel tokens add` returns 403 when run under a third-party OAuth client (e.g. an agent's Vercel plugin) |
| `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` | From `.vercel/project.json` (not secret, but kept alongside the others) |

Verify secret presence (not values) any time with `gh secret list`.

### Manual deploy (if needed)

```bash
ssh -i aicaller-ec2-key.pem ec2-user@65.2.193.150
bash ~/deploy.sh
```

### Manual DB schema sync

This project has **no `prisma migrate`** — no migrations folder exists. Schema changes go live via `prisma db push` directly against production, run from your own machine (not part of the deploy pipeline):

```bash
cd api-service
DATABASE_URL="<prod Neon URL>" npx prisma db push
```

Run this *before or alongside* any deploy that changes `schema.prisma` — schema drift fails silently in prod (Prisma `P2022`/`P2021` errors on the missing column/table) rather than failing the deploy itself.

---

## 📈 Scalability

**Current capacity is unbenchmarked.** The only concurrency control actually enforced in code is `MAX_CALLS_PER_TENANT=5` (per-tenant fairness in `call-worker/src/fairDispatcher.js`) — there's no global cap, no load test has been run, and the real ceiling is whatever this single t3.micro can handle. Most of the per-call work (STT/TTS/LLM calls) is I/O-bound waiting on external APIs, not CPU-heavy, so the instance can plausibly handle more concurrent calls than its size implies — but "plausibly" isn't "measured." Load-test before making capacity promises to customers.

**Scaling paths, roughly in the order you'd actually reach for them:**

1. **Vertical (cheapest, first move):** bump the EC2 instance type (t3.micro → t3.small → t3.medium, etc.) via the AWS Console or CLI. Requires a stop/start (brief downtime), no architecture change. Redis and the app both benefit since they share the box's resources.
2. **Separate Redis from the app instance:** once call volume is high enough that Redis and the app meaningfully compete for the same CPU/RAM, split them — either a second small EC2 running just Redis, or move to a managed option (ElastiCache — but see the NAT Gateway cost note above; only worth it once traffic justifies ~$32+/month extra).
3. **Horizontal (multiple app instances):** once vertical scaling on one box isn't enough, put an Application Load Balancer in front of multiple EC2 instances (or migrate to ECS Fargate + ALB for managed scaling). This *requires* Redis to already be externalized (step 2) — multiple app instances can't share a Redis that's co-located on just one of them.
4. **Region:** already on `ap-south-1` (Mumbai) specifically for latency to India-based Plivo calls and Sarvam STT — don't move this without a reason tied to where your traffic actually originates.
5. **Database:** Neon Postgres autoscales compute independently of this app's hosting — not a bottleneck tied to the AWS migration, scale it separately via the Neon dashboard if it becomes one.

**Cost shape at current size:** EC2 t3.micro (~$7-8/month on-demand in `ap-south-1`, free-tier eligible for new accounts) + ECR storage (negligible) + Elastic IP (free while attached to a running instance) + Neon/Plivo/OpenAI/etc. usage-based costs (see cost breakdown discussed earlier in the project history — those figures are unaffected by this hosting migration). Notably **no NAT Gateway, no managed Redis fee** — the two costs that would have made the App Runner + ElastiCache path meaningfully more expensive for no real benefit at this traffic level.

---

## 🩹 Runbook: EC2 unresponsive but AWS says it's healthy

Seen on 2026-08-16: `api.aicaller.store` stopped responding — ports 80/443/22 all accepted the TCP handshake but nothing ever replied (not even the SSH banner), while `aws ec2 describe-instance-status` reported reachability "ok" and CPUUtilization sat flat at ~54% for 20+ minutes. This is OS-level resource exhaustion (nginx master alive, workers/OS wedged) on the 1GB t3.micro with no swap — not an instance-down or app-config problem, and not something `docker restart` from inside a hung box can fix since you can't get a shell in.

Fix:
```bash
export AWS_PROFILE=aicaller-migration   # the `default` local profile is broken/expired
aws ec2 reboot-instances --instance-ids i-029d54b7dcbd7a059 --region ap-south-1
```
No SSH required to trigger this. Both containers (`aicaller`, `redis`) restart cleanly on boot with no manual intervention. Confirm recovery with `curl https://api.aicaller.store/health`.

If you need a shell and don't have `aicaller-ec2-key.pem` handy, use EC2 Instance Connect instead of hunting for the file:
```bash
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-029d54b7dcbd7a059 --instance-os-user ec2-user \
  --ssh-public-key file://<path-to-a-throwaway-pubkey> --region ap-south-1
ssh -i <matching-private-key> ec2-user@65.2.193.150   # works for ~60s after the send call
```

If this recurs frequently, it's a sign the box needs the t3.micro → t3.small bump described under "Scalability" above rather than repeat reboots.

## ⚠️ Known issues / TODO

- **TLS/renewal automation lives on the host, not in the image** — if the EC2 instance is ever replaced (not just the Docker container redeployed), the certbot install + systemd timer + renewal hook need to be redone manually. Worth folding into instance user-data at some point so a fresh instance self-configures.
- **Single point of failure** — one EC2 instance, no redundancy. Instance failure = downtime until manually replaced. Acceptable at current scale; revisit under "Horizontal" scaling above once it isn't.
- **`admin@neosharks.in` IAM user has `AdministratorAccess`** — granted broad during initial AWS provisioning to avoid repeated permission round-trips. Rotate its access key or scope it down now that infra is stable; it shouldn't be used for routine operations going forward (use `aicaller-ci-deploy`, which is properly scoped to ECR push only, for anything automated).
- **Redis has no persistence/backup** — it's pure job-queue/ephemeral state (BullMQ queues, live-call conversation state), not business data, so losing it on container replacement just means in-flight jobs need re-triggering, not data loss. Business data all lives in Neon Postgres, which has its own backup story.

---

## 📁 Repository Structure

```
.
├── .env.example
├── .env                       ← NOT committed
├── Dockerfile                 ← Root monolith image, deployed to EC2 via ECR
├── nginx-monolith.conf        ← nginx config baked into the deployed image
├── ecosystem.config.js        ← PM2 config running all 5 processes
├── docker-compose.yml         ← Local dev only
├── .github/workflows/deploy.yml
├── api-service/
├── telephony-gateway/
├── call-worker/
├── call-evaluation-service/
└── frontend/
```

---

## 🔑 Environment Variables Reference

Real values live in `.env` locally and in `~/aicaller.env` on the EC2 instance — never commit real secrets. See `.env.example` for the full list of variable names and what each is for.

Key ones worth knowing at a glance: `DATABASE_URL` (Neon), `REDIS_URL` (`redis://redis:6379` in prod — the sibling container, not external), `BASE_URL=https://api.aicaller.store` (must exactly match the domain in "Domain / TLS" above), `TELEPHONY_PROVIDER=plivo`, `GOOGLE_CALLBACK_URL` (must exactly match what's registered in Google Cloud Console), `FRONTEND_URL=https://aicaller.store`.
