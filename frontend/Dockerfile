FROM node:20 AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

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

# Runner - optimized multi-stage
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy production dependencies and built assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/frontend/public ./frontend/public
COPY --from=builder /app/frontend/package.json ./frontend/
COPY --from=builder /app/frontend/next.config.ts ./frontend/

WORKDIR /app/frontend
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["npm", "start"]
