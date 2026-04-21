# TaskFinder Platform

Peer-to-peer service marketplace. Creators post tasks, Earners bid and fulfil them.

## Stack
- Frontend: React + Vite — Vercel
- Backend: Node.js microservices — Railway
- Database: PostgreSQL + Redis — Railway
- Queue: RabbitMQ — CloudAMQP
- Payments: Stripe Connect

## Local Development

Prerequisites: Node.js 18+, Docker Desktop

### Run everything
cp .env.example .env
docker compose up --build

Frontend:    http://localhost:3000
Gateway:     http://localhost:8080
RabbitMQ UI: http://localhost:15672
