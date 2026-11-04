FROM node:20 AS base

FROM base AS deps
WORKDIR /app
# standard images use glibc and have openssl

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# The cache mount keeps fetched tarballs across builds, so a build
# that dies on a flaky connection resumes instead of starting over.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --fetch-retries=10 --fetch-retry-maxtimeout=180000

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# npm nests version-conflicting deps (e.g. mongodb) under the workspace instead of hoisting them
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY . .

# Build shared
WORKDIR /app/packages/shared
RUN npm run build

# Build backend (bump heap — tsc on the full graph needs > 2 GB)
WORKDIR /app/backend
RUN npx prisma generate
ENV NODE_OPTIONS="--max-old-space-size=6144"
RUN node --max-old-space-size=6144 /app/node_modules/typescript/bin/tsc

# sandbox-runner: the only process that talks to the (rootless) Docker
# daemon. Build with --target sandbox; see deploy/sandbox/README.md.
FROM docker:27-cli AS docker-cli

FROM base AS sandbox
WORKDIR /app
ENV NODE_ENV production
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
WORKDIR /app/backend
USER node
EXPOSE 4100
CMD ["node", "dist/sandbox/main.js"]

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 expressjs
# pip/venv so terminal users can install Python SDKs into their workspace.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Owned by the runtime user so fresh named volumes mounted here inherit it.
RUN mkdir -p /var/lib/operari/terminal /var/lib/operari/workspaces /var/lib/operari/files \
    && chown -R 1001:1001 /var/lib/operari

# Copy node_modules and shared package
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared

# Copy backend artifacts
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/templates ./templates

WORKDIR /app/backend
USER expressjs

EXPOSE 4000

CMD ["node", "dist/server.js"]
