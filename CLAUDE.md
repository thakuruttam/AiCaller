# AiCaller / neocampaign.ai — Claude Instructions

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
Deploy takes ~1-2 minutes. See README.md "☁️ Production Deployment (AWS EC2)" for full architecture.

## Live URLs
- Frontend: https://aicaller.store
- API: https://api.aicaller.store
- Plivo webhook: https://api.aicaller.store/call/answer

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
