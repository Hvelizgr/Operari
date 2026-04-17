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

# Install dependencies including devDependencies for the build
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

RUN npm ci --ignore-scripts

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
