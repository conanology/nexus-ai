FROM node:22-bookworm-slim

# Install Chrome dependencies for Remotion + fonts for rendering
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
    fonts-inter \
    fontconfig \
    curl \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install JetBrains Mono font (not in apt repos)
RUN mkdir -p /usr/share/fonts/jetbrains-mono \
    && curl -fsSL https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip -o /tmp/jbmono.zip \
    && unzip -q /tmp/jbmono.zip -d /tmp/jbmono \
    && cp /tmp/jbmono/fonts/ttf/*.ttf /usr/share/fonts/jetbrains-mono/ \
    && fc-cache -f \
    && rm -rf /tmp/jbmono /tmp/jbmono.zip

# Enable corepack
RUN corepack enable

WORKDIR /app

# Copy configuration
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./

# Copy packages (includes director-agent, asset-library, and all workspace deps)
COPY packages ./packages
COPY apps/video-studio ./apps/video-studio
COPY apps/render-service ./apps/render-service

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Build all TypeScript packages (required for @nexus-ai/core, @nexus-ai/director-agent, etc.)
RUN pnpm -r build

WORKDIR /app/apps/render-service

# Install Chrome for Remotion (run from package directory where remotion is available)
RUN pnpm exec remotion browser ensure

# GEMINI_API_KEY is injected at runtime via Cloud Run secret/env var
# If not set, the render service falls back to legacy SceneMapper mode
ENV GEMINI_API_KEY=""

# Use tsx to run the TypeScript directly (packages are now built)
CMD ["pnpm", "start"]
