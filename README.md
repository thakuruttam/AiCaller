# AI Calling Platform — Multi-Service Stack

A multi-service AI calling platform built with Node.js, Postgres, Redis, and BullMQ.

---

## Services

| Service | Port | Purpose |
|---|---|---|
| `api-service` | 3000 | Main REST API |
| `telephony-gateway` | 3001 | Twilio WebSocket handler |
| `call-worker` | — | BullMQ call processing worker |
| `call-evaluation-api` | 4000 | Evaluation REST API |
| `call-evaluation-worker` | — | BullMQ evaluation worker |
| `postgres` | 5432 | Primary database |
| `redis` | 6379 | Queue + state store |
| `nginx` | 8080 | **Local only** — unified gateway |

> **Note on nginx**: nginx is only used locally to unify all services behind `localhost:8080`
> (so ngrok needs only one tunnel). In production, each service gets its own URL — nginx is not deployed.

---

## 🖥️ Local Development (after git pull)

### First-time setup

```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO

# 2. Create your local .env from the template
cp .env.example .env
# Open .env and fill in your real API keys
```

### Running the stack

```bash
# Start everything (postgres + redis + all services + nginx)
docker-compose up --build

# Access:
# → All API traffic:  http://localhost:8080
# → API service only: http://localhost:3000
# → Telephony WS:     ws://localhost:8080/streams
# → Evaluation API:   http://localhost:4000
```

### Day-to-day commands

```bash
# Pull latest changes and restart
git pull && docker-compose up --build

# Start in background
docker-compose up -d

# View logs for one service
docker-compose logs -f api-service
docker-compose logs -f call-worker

# Stop everything
docker-compose down

# Wipe database and start fresh
docker-compose down -v && docker-compose up --build
```

---

## ☁️ Production Deployment (Railway)

In production **nginx is NOT deployed**. Each service has its own Railway URL.

```
LOCAL (nginx bundles everything on :8080)
  localhost:8080  →  nginx  →  api-service:3000
                           →  telephony-gateway:3001

PRODUCTION (each service has its own URL — no nginx)
  https://api-service.railway.app           ← api-service
  https://telephony-gateway.railway.app     ← telephony-gateway (WebSocket)
  https://call-evaluation.railway.app       ← call-evaluation-api
```

### First deployment to Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
2. Select this repository
3. Railway creates one service per `docker-compose.yml` entry (skip the nginx service)
4. Add environment variables per service (copy from `.env.example`, fill real values)
5. For `DATABASE_URL` and `REDIS_URL` — use Railway's managed add-ons:
   - Add **Postgres** plugin → Railway injects `DATABASE_URL` automatically
   - Add **Redis** plugin → Railway injects `REDIS_URL` automatically
6. Set `BASE_URL` to the Railway-generated URL for `api-service`

### Auto-deploy on push

Every `git push origin main` → Railway automatically redeploys changed services.

```bash
git add .
git commit -m "feat: your change"
git push origin main
# ↑ This is all you need — Railway handles the rest
```

---

## 📁 Repository Structure

```
.
├── .env.example              ← ✅ Committed — template with placeholders
├── .env                      ← ❌ NOT committed — your real secrets
├── .gitignore
├── docker-compose.yml        ← Local dev (includes nginx, postgres, redis)
├── nginx.conf                ← Local dev only
├── api-service/
│   ├── Dockerfile
│   ├── src/
│   └── prisma/
├── telephony-gateway/
│   ├── Dockerfile
│   └── src/
├── call-worker/
│   ├── Dockerfile
│   └── src/
├── call-evaluation-service/
│   ├── Dockerfile
│   └── src/
└── frontend/
```

---

## 🔑 Environment Variables Reference

Copy `.env.example` → `.env` and fill in values:

| Variable | Local value | Production value |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/aicalling` | Railway Postgres URL |
| `REDIS_URL` | `redis://localhost:6379` | Railway Redis URL |
| `BASE_URL` | Your ngrok URL | Your Railway service URL |
| `PORT` | `3000` | Set per service in Railway |
| All API keys | Same as production | Same as production |

---

## 🗄️ Database Migrations

```bash
# Run migrations (do this after first pull or schema changes)
cd api-service && npx prisma migrate deploy

# On Railway — add this as the start command in Railway dashboard:
# npx prisma migrate deploy && npm start
```

---

## ⚡ Scaling (when you're ready)

See [Deployment Guide](docs/deployment-guide.md) for:
- Phase 2: Render / Fly.io (slider-based scaling)
- Phase 3: Kubernetes with autoscaling based on Redis queue depth
