# ReLivR backend — single Express monolith (replaces the retired gateway + 7
# microservices). Pure-JS deps (pg, bcryptjs) → no native build toolchain needed.
FROM node:24-alpine

WORKDIR /app

# Install production deps only (skips vitest/supertest/nodemon).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
# No EXPOSE: the app listens on Railway's injected $PORT (e.g. 8080). A hardcoded
# EXPOSE (3001) made Railway's port auto-detection route to the wrong port → 502.

# Drop root for runtime.
USER node

CMD ["node", "index.js"]
