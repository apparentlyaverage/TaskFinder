# TaskFinder Platform

Peer-to-peer service marketplace for Rhodes University students.
Creators post tasks, Earners bid and fulfil them.

## Stack
- **Frontend:** React 18 + Vite → Vercel
- **Backend:** Node.js microservices → Oracle Cloud / Hetzner VPS
- **Database:** PostgreSQL 16 → Neon.tech
- **Cache:** Redis → VPS
- **Queue:** RabbitMQ → CloudAMQP
- **Payments:** Stripe Connect

## Quick Start (Demo — no backend needed)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

Use the demo login presets: Creator / Earner / Admin

## Full Stack (with backend)

```bash
cp .env.example .env
# Fill in your values
docker compose up --build
```

Frontend:    http://localhost:3000
Gateway:     http://localhost:8080
RabbitMQ UI: http://localhost:15672

## Deployment

1. **Database:** Run db/init/*.sql on Neon.tech in order (01 → 06)
2. **Backend:** Clone repo on VPS, fill .env, run `docker compose up -d --build`
3. **Frontend:** Import repo to Vercel, set root directory to `frontend`, add `VITE_API_URL`

## Repository
https://github.com/apparentlyaverage/TaskFinder
