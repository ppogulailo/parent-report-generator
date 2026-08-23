# syntax=docker/dockerfile:1.7

# ---- Install deps ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Build ----
FROM node:20-alpine AS builder
WORKDIR /app
# Inlined at build time by Next. Needs the matching [build.args] entry in
# fly.toml; without this ARG the value is silently dropped and every canonical
# URL falls back to the pre-launch hostname.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_V1_DEFAULT
ENV NEXT_PUBLIC_V1_DEFAULT=$NEXT_PUBLIC_V1_DEFAULT
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- Runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp

COPY --from=builder --chown=nodeapp:nodeapp /app/.next/standalone ./
COPY --from=builder --chown=nodeapp:nodeapp /app/.next/static ./.next/static

USER nodeapp

EXPOSE 8080

CMD ["node", "server.js"]
