FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat

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

# Build backend
WORKDIR /app/backend
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

# Copy node_modules and shared package (needed for symlinks to work)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared

# Copy backend artifacts
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/dist ./backend/dist
# Prisma might need schema
COPY --from=builder /app/backend/prisma ./backend/prisma

WORKDIR /app/backend
USER expressjs

EXPOSE 4000

CMD ["node", "dist/server.js"]
