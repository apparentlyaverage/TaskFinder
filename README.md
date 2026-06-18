# ReLivR Platform

Peer-to-peer service marketplace for South African students. Launching at
Rhodes University and built to expand campus-by-campus (locations are
data-driven, not hard-coded). Creators post tasks; Earners bid and fulfil them.

## Stack
- **Frontend:** React 18 + Vite → Vercel
- **Backend:** Node.js — a single Express service in `server/` → Railway
  - (The former gateway + 7 microservices are retired; see `legacy/`.)
- **Database:** PostgreSQL 16 → Neon.tech
- **Payments:** Paystack (primary; Ozow via Paystack), ZAR — escrow in progress
- **Auth:** JWT (with server-side revocation) + Google OAuth

## Quick Start (Demo — no backend needed)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

Use the demo login presets: Creator / Earner / Admin (falls back to mock data
when the backend is unreachable).

## Full Stack (with backend)

```bash
cp .env.example .env
# Fill in your values (JWT_SECRET ≥ 32 chars, DATABASE_URL, GOOGLE_* — the
# server validates these at boot and refuses to start if any are missing)

# Backend
cd server
npm install
npm run migrate        # apply db/init/*.sql to DATABASE_URL
npm run dev            # http://localhost:3001

# Frontend (separate terminal)
cd frontend
npm install
npm run dev            # http://localhost:3000 (proxies /api to :3001)
```

### Docker

```bash
docker compose up --build   # postgres + the server monolith
```

## Tests

```bash
cd server && npm test       # Vitest + Supertest (API, auth, validation)
cd frontend && npm test     # Vitest + React Testing Library
```

## Deployment

1. **Database:** Run the schema with `npm run migrate` (applies `db/init/01..08`
   in order; idempotent migrations are safe to re-run).
2. **Backend:** Clone on the host, fill `.env`, then `docker compose up -d --build`
   (or `cd server && npm ci && npm start`).
3. **Frontend:** Import the repo to Vercel, set root directory to `frontend`,
   add `VITE_API_URL`.

## Repository
https://github.com/apparentlyaverage/TaskFinder
