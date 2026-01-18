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

# Runner
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy everything from builder (including all node_modules to be safe)
COPY --from=builder /app ./

WORKDIR /app/frontend
EXPOSE 3000
CMD ["npm", "start"]
