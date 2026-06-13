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
- Telephony: Twilio
- Eval: OpenAI GPT

## How to Deploy
When user says "deploy", "push", or "ship it" — run:
```bash
bash deploy.sh "describe what changed"
```
This commits all changes and pushes to main.
GitHub Actions auto-deploys Railway (backend) + Vercel (frontend).
Deploy takes 3–5 minutes.

## Live URLs
- Frontend: https://app.neocampaign.ai
- API: https://api.neocampaign.ai
- Twilio webhook: https://api.neocampaign.ai/streams

## Database
- Production: Neon PostgreSQL (connection string in Railway env vars)
- Run migrations: `cd api-service && npx prisma migrate deploy`

## Local Dev
```bash
# From project root
cp .env.bak .env
docker-compose up   # or run services individually
```

## Branch Strategy
- `main` → production (auto-deploys)
- feature branches → PR → merge to main
