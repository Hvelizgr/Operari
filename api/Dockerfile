# Build stage
FROM node:18-slim AS builder

WORKDIR /app

# Install openssl for Prisma and build tools for native modules
RUN apt-get update -y && apt-get install -y openssl python3 make g++

# Install dependencies including dev dependencies for building
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install openssl for Prisma and build tools for native module rebuild
RUN apt-get update -y && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy built artifacts and necessary files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

# Rebuild isolated-vm for this specific environment
RUN npm rebuild isolated-vm

EXPOSE 4000

CMD ["npm", "start"]
