# ReLivR backend — single Express monolith (replaces the retired gateway + 7
# microservices). Pure-JS deps (pg, bcryptjs) → no native build toolchain needed.
FROM node:24-alpine

WORKDIR /app

# Install production deps only (skips vitest/supertest/nodemon).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3001

# Drop root for runtime.
USER node

CMD ["node", "index.js"]
