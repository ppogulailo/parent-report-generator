# syntax=docker/dockerfile:1.7

# ---- Build stage ----
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

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

EXPOSE 8080

CMD ["node", "dist/main.js"]
