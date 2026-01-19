# Multi-stage Dockerfile for NEXUS-AI Orchestrator Service
# Optimized for Cloud Run deployment following 2026 best practices

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./

# Copy all package.json files for workspace dependencies
COPY packages/*/package.json ./packages/
COPY apps/orchestrator/package.json ./apps/orchestrator/

# Install pnpm
RUN npm install -g pnpm@10

# Install dependencies (including workspace packages)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY packages ./packages
COPY apps/orchestrator ./apps/orchestrator
COPY tsconfig.base.json ./

# Build the orchestrator and required packages
RUN pnpm --filter @nexus-ai/orchestrator build

# Production stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install pnpm in production stage
RUN npm install -g pnpm@10

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/*/package.json ./packages/
COPY apps/orchestrator/package.json ./apps/orchestrator/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder /app/apps/orchestrator/dist ./apps/orchestrator/dist
COPY --from=builder /app/packages/*/dist ./packages/

# Run as non-root user for security
USER node

# Expose port (Cloud Run will set PORT env var)
ENV PORT=8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Start server using node directly (not npm start) for faster startup
CMD ["node", "apps/orchestrator/dist/index.js"]
