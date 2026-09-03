# syntax=docker/dockerfile:1.7

# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

# `npm run build` runs `prisma generate` first — the client must exist before tsc.
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
ARG INCLUDE_CHROMIUM=true
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

# Chromium from the distro rather than Playwright's own download: roughly half
# the size, and the version tracks Alpine's security updates. Build with
# --build-arg INCLUDE_CHROMIUM=false to omit it; set PDF_ENABLED=false to match,
# and the API reports the PDF capability as unavailable instead of failing.
RUN if [ "$INCLUDE_CHROMIUM" = "true" ]; then \
      apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont; \
    fi

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate && npm cache clean --force

COPY --from=builder /app/dist ./dist

# The methodology itself. `ContentService` reads it from the working directory at
# boot and THROWS if it is missing, so an image without this does not start —
# which, on a running service, is an outage rather than a failed deploy. It is
# copied into the runtime stage rather than the builder because it is read at
# run time, not compiled.
COPY content ./content

RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp \
    && chown -R nodeapp:nodeapp /app
USER nodeapp

ENV CHROMIUM_PATH=/usr/bin/chromium-browser

EXPOSE 8080

# `migrate deploy` only applies committed migrations — it never generates or
# resets anything. Running it at start means a deploy carrying a migration
# cannot serve traffic against the old schema.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
