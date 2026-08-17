# AiCaller (aicaller.store) — Claude Instructions

## Project Overview
AI-powered calling platform. Monorepo with 4 services + frontend.

## Services
| Service | Port | Entry point |
|---------|------|-------------|
| api-service | 3000 | `src/server.js` |
| telephony-gateway | 3001 | `src/server.js` |
| call-evaluation-service API | 4000 | `src/server.js` |
| call-evaluation-service workers | — | `src/consumer.js` |
| frontend | — | Vite/React |

## Tech Stack
- Backend: Node.js + Express + Prisma (pinned to `^6.19.0` — Prisma 7 cannot connect to MongoDB, see Database) + MongoDB
- Frontend: React + Vite + Tailwind CSS
- Queue: BullMQ + Redis
- Telephony: Plivo
- Eval: OpenAI GPT
- Testing: Vitest across all 5 packages (backend + frontend), runs in CI on every push (informational only, doesn't block deploy) — see README's "🧪 Testing" section

## How to Deploy
When user says "deploy", "push", or "ship it" — run:
```bash
bash deploy.sh "describe what changed"
```
This commits all changes and pushes to main.
GitHub Actions auto-deploys: backend to AWS EC2 (via ECR + SSH), frontend to Vercel.
Deploy takes ~1-2 minutes. CI/CD is verified working as of 2026-08-16 (all 8 required
GitHub Actions secrets are set — see `gh secret list`). See README.md
"☁️ Production Deployment (AWS EC2)" for full architecture and the CI/CD section for
the secrets list.

## Live URLs
- Frontend: https://aicaller.store
- API: https://api.aicaller.store
- Plivo webhook: https://api.aicaller.store/call/answer

## Cloud / Infra Quick Reference
- Backend: single AWS EC2 instance (`i-029d54b7dcbd7a059`, ap-south-1), Docker + PM2, behind nginx. Frontend: Vercel.
- **Local AWS CLI**: use `--profile aicaller-migration` (or `export AWS_PROFILE=aicaller-migration`) — the `default` profile is broken/expired. See README's "AWS resources" table for what this profile can access.
- If the API goes unresponsive but AWS status checks say the instance is "ok" (ports accept TCP but nothing responds — a known failure mode under memory/CPU-credit pressure, seen once on the original 1GB t3.micro before the 2026-08-16 resize to t3.small/2GB), the fix is `aws ec2 reboot-instances --instance-ids i-029d54b7dcbd7a059 --region ap-south-1 --profile aicaller-migration`. No SSH needed to trigger it.
- To get an SSH session without the original `.pem`, use EC2 Instance Connect: `aws ec2-instance-connect send-ssh-public-key --instance-id i-029d54b7dcbd7a059 --instance-os-user ec2-user --ssh-public-key file://<pubkey> --region ap-south-1 --profile aicaller-migration`, then SSH in immediately with the matching private key (short-lived).

## Database
- Production: **MongoDB Atlas** (`aicaller.thg4lch.mongodb.net`, ap-south-1 — same AWS region as the EC2 app server, ~13ms DB latency; connection string in `~/aicaller.env` on the EC2 instance). Migrated off Neon Postgres on 2026-08-17 — the old Postgres data was intentionally **not** migrated (fresh start on Mongo, per explicit decision); Neon still exists untouched if ever needed.
- **Prisma is pinned to `^6.19.0` on all 4 backend services — do not bump to 7.x.** Prisma 7 made driver adapters mandatory for every provider, and no `@prisma/adapter-mongodb` package exists, so Prisma 7 cannot connect to MongoDB at all. This was discovered the hard way; don't re-attempt the upgrade without solving that first.
- No `prisma migrate` / migrations folder — this project uses `prisma db push` to sync schema directly (Mongo has no SQL DDL anyway; `db push` syncs `@@unique`/`@@index` as real Mongo indexes).
- Sync schema to prod: `cd api-service && DATABASE_URL="<prod-mongo-url>" npx prisma db push`
- After changing `schema.prisma`, always push to production before/with the deploy — schema drift silently breaks features rather than failing the deploy itself. Same across all 4 services' schema.prisma files (they've drifted from each other before; keep shared model fields in sync when editing).
- **MongoDB gotcha worth remembering:** its unique indexes are NOT sparse by default — `@unique` on an optional field breaks after the *second* document that leaves it null/absent (Postgres tolerates unlimited nulls on a unique column, Mongo doesn't). Audit this before adding any new `@unique` to an optional field.
- Local dev: `docker-compose.yml` runs a single-node MongoDB replica set (`mongo:7`, required by Prisma's Mongo connector even for one node) — `docker compose up -d mongo` and wait for the healthcheck before running services outside Docker.

## Local Dev
```bash
# From project root
cp .env.bak .env
docker-compose up   # or run services individually
```

## Branch Strategy
- `main` → production (auto-deploys)
- feature branches → PR → merge to main
