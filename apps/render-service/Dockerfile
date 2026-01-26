FROM node:22-bookworm-slim

# Install Chrome dependencies for Remotion
RUN apt-get update && apt-get install -y \
    libnss3 \
    libdbus-1-3 \
    libatk1.0-0 \
    libgbm-dev \
    libasound2 \
    libxrandr2 \
    libxkbcommon-dev \
    libxfixes3 \
    libxcomposite1 \
    libxdamage1 \
    libatk-bridge2.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libcups2 \
    && rm -rf /var/lib/apt/lists/*

# Enable corepack
RUN corepack enable

WORKDIR /app

# Copy configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./

# Copy packages and apps
COPY packages ./packages
COPY apps/video-studio ./apps/video-studio
COPY apps/render-service ./apps/render-service

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Build all TypeScript packages (required for @nexus-ai/core)
RUN pnpm -r build

WORKDIR /app/apps/render-service

# Install Chrome for Remotion (run from package directory where remotion is available)
RUN pnpm exec remotion browser ensure

# Use tsx to run the TypeScript directly (packages are now built)
CMD ["pnpm", "start"]
