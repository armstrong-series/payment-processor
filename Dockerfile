
# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        make \
        g++ \
    && rm -rf /var/lib/apt/lists/*


# Shared development dependencies and build stage
FROM base AS builder

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build


# Development stage: runs TypeScript with automatic restarts
FROM base AS development

ENV NODE_ENV=development

COPY package*.json ./
RUN npm ci \
    && npm install --no-save tsx

COPY tsconfig.json ./

EXPOSE 3000

CMD ["npx", "tsx", "watch", "src/server.ts"]


# Production dependencies only
FROM base AS production-dependencies

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force



FROM node:24-bookworm-slim AS production

ENV NODE_ENV=production

WORKDIR /app

COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

RUN mkdir -p /app/data \
    && chown -R node:node /app

USER node

EXPOSE 3000

CMD ["node", "dist/server.js"]
