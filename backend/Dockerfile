FROM node:20 AS base

FROM base AS deps
WORKDIR /app
# standard images use glibc and have openssl

COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build shared
WORKDIR /app/packages/shared
RUN npm run build

# Build backend (bump heap — tsc on the full graph needs > 2 GB)
WORKDIR /app/backend
RUN npx prisma generate
ENV NODE_OPTIONS="--max-old-space-size=6144"
RUN node --max-old-space-size=6144 /app/node_modules/typescript/bin/tsc

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 expressjs

# Copy node_modules and shared package
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared

# Copy backend artifacts
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/templates ./templates

WORKDIR /app/backend
USER expressjs

EXPOSE 4000

CMD ["node", "dist/server.js"]
