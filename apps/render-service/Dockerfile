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
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./

# Copy packages and apps
COPY packages ./packages
COPY apps/video-studio ./apps/video-studio
COPY apps/render-service ./apps/render-service

# Install dependencies
RUN pnpm install --frozen-lockfile

# Install Chrome
RUN npx remotion browser ensure

WORKDIR /app/apps/render-service

CMD ["pnpm", "start"]
