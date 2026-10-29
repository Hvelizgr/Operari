FROM node:20 AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED 1

# next.config.ts evaluates `rewrites()` at build time and bakes the
# resolved proxy target into .next/routes-manifest.json. Setting
# API_URL at runtime is too late — the manifest already points at the
# default (localhost:4000), which inside the frontend container points
# to the frontend itself, causing every /api/* fetch to 500.
# Default to the docker-compose service name so a plain `docker compose
# up --build` produces a working image; override via --build-arg for
# non-compose deployments.
ARG API_URL=http://backend:4000
ENV API_URL=$API_URL

# Bakes into the client bundle because NEXT_PUBLIC_* inlines at
# `next build`. When "true", the auth context seeds an anonymous
# session on mount so self-host deployments reach the editor +
# runs UI without wiring a real login. Off by default; override
# via --build-arg for a single-tenant dev stack.
ARG NEXT_PUBLIC_OPERARI_ANONYMOUS_MODE=false
ENV NEXT_PUBLIC_OPERARI_ANONYMOUS_MODE=$NEXT_PUBLIC_OPERARI_ANONYMOUS_MODE

# Bakes into the client bundle. When "true", the login page renders a
# "Continue as dev" button that hits /api/auth/dev-login (a backend
# route gated by OPERARI_DEV_LOGIN_ENABLED=true). Off by default —
# override only for local single-tenant dev stacks.
ARG NEXT_PUBLIC_DEV_LOGIN_ENABLED=false
ENV NEXT_PUBLIC_DEV_LOGIN_ENABLED=$NEXT_PUBLIC_DEV_LOGIN_ENABLED

# Public origin the browser calls for /api and links back to. Like every
# NEXT_PUBLIC_* value it is inlined at `next build`, so setting it only
# as a runtime env does nothing: the bundle kept the localhost:4000
# fallback and every visitor's browser called its own machine. Empty
# keeps that fallback for the local compose stack.
ARG NEXT_PUBLIC_API_URL=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# Install dependencies including devDependencies for the build
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# The cache mount keeps fetched tarballs across builds, so a build
# that dies on a flaky connection resumes instead of starting over.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --prefer-offline --fetch-retries=10 --fetch-retry-maxtimeout=180000

# Copy source
COPY . .

# Build shared
WORKDIR /app/packages/shared
RUN npm run build

# Build frontend
WORKDIR /app/frontend
RUN npm run build

# Runner
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Copy everything from builder (including all node_modules to be safe)
COPY --from=builder /app ./

WORKDIR /app/frontend
EXPOSE 3000
CMD ["npm", "start"]
