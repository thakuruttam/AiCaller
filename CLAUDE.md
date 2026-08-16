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
- Backend: Node.js + Express + Prisma + PostgreSQL
- Frontend: React + Vite + Tailwind CSS
- Queue: BullMQ + Redis
- Telephony: Plivo
- Eval: OpenAI GPT

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
- If the API goes unresponsive but AWS status checks say the instance is "ok" (ports accept TCP but nothing responds — a known failure mode on this 1GB t3.micro under memory pressure), the fix is `aws ec2 reboot-instances --instance-ids i-029d54b7dcbd7a059 --region ap-south-1 --profile aicaller-migration`. No SSH needed to trigger it.
- To get an SSH session without the original `.pem`, use EC2 Instance Connect: `aws ec2-instance-connect send-ssh-public-key --instance-id i-029d54b7dcbd7a059 --instance-os-user ec2-user --ssh-public-key file://<pubkey> --region ap-south-1 --profile aicaller-migration`, then SSH in immediately with the matching private key (short-lived).

## Database
- Production: Neon PostgreSQL (connection string in `~/aicaller.env` on the EC2 instance)
- No `prisma migrate` / migrations folder — this project uses `prisma db push` to sync schema directly.
- Sync schema to prod: `cd api-service && DATABASE_URL="<prod-url>" npx prisma db push`
- After changing `schema.prisma`, always push to production before/with the deploy — schema drift silently breaks features (missing columns/tables throw Prisma `P2022` errors) rather than failing the deploy itself.

## Local Dev
```bash
# From project root
cp .env.bak .env
docker-compose up   # or run services individually
```

## Branch Strategy
- `main` → production (auto-deploys)
- feature branches → PR → merge to main
