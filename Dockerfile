# syntax=docker/dockerfile:1.7

# ---------- Base image ----------
FROM node:22-bookworm-slim AS base

# Install system packages needed by Prisma/Node binaries
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------- Dependency installation & Prisma client generation ----------
FROM base AS deps

COPY package.json package-lock.json ./
COPY prisma ./prisma

# Install all dependencies (dev included) and generate Prisma client artifacts
RUN npm ci --ignore-scripts \
	&& npx prisma generate

# ---------- Build SvelteKit app ----------
FROM base AS build

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/package-lock.json ./package-lock.json
COPY --from=deps /app/prisma ./prisma
COPY . .

RUN npm run build

# ---------- Production runtime image ----------
FROM base AS production
ENV NODE_ENV=production

# Copy runtime files and prebuilt artifacts
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY package.json package-lock.json ./
COPY prisma ./prisma

EXPOSE 3000

# Adapter-node entrypoint
CMD ["node", "build"]
