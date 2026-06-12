# TaskFinder Unified Server

Single Express app serving auth, tasks, bids, messages, notifications, and
reviews. Replaces the gateway + 4 microservices for MVP deployment.

## Local dev (two terminals)
    cd server   && cp .env.example .env   # fill in values
    cd server   && npm install && npm run dev    # port 3001
    cd frontend && npm run dev                    # port 3000, proxies to 3001

## Route map
    /auth/*           login, register, me, logout, Google OAuth
    /tasks/*          CRUD, bids, accept, complete   (JWT required for writes)
    /messages/*       send, threads, conversation    (JWT required)
    /notifications/*  list, mark read                (JWT required)
    /reviews/*        post review, user summary
    /health           liveness + DB check

## What changed vs the microservices
    • RabbitMQ events  → direct createNotification() calls (notify.js)
    • Socket.io        → frontend polls every ~10s (re-add sockets post-launch)
    • x-user-id header → JWT verified in middleware.js (security fix)
    • bcrypt           → bcryptjs (no native build; deploys anywhere)
    • NEW: PATCH /tasks/:id/complete (escrow deferred to post-launch)

The old services/ directory is kept for reference; payments/disputes/matching
logic returns from there when those features launch.
