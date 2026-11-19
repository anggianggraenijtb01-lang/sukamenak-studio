# Video worker image: the backend's dist/ plus the Remotion renderer, Chrome Headless Shell and FFmpeg.
# Build from the repository root:
#   docker build -f video/Dockerfile --build-arg GIT_SHA=$(git rev-parse HEAD) -t sukamenak-video-worker .
#
# It is a separate image from the API on purpose: ~300 MB of Chrome plus a browser process per render
# does not belong in the container that answers HTTP requests.

# --- 1. backend build (same sources as backend/Dockerfile) -------------------------------------
FROM node:22-bookworm-slim AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM backend-deps AS backend-build
COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN npm run build

# --- 2. renderer dependencies, with the browser baked in ---------------------------------------
# Downloading Chrome at runtime would need internet on the VPS and would add ~20 s to the first job.
FROM node:22-bookworm-slim AS video-deps
WORKDIR /app/video
# Chrome Headless Shell links against these; the list is Remotion's documented Debian set.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev \
      libxfixes3 libxcomposite1 libxdamage1 libcairo2 libpango-1.0-0 libatk-bridge2.0-0 libcups2 \
    && rm -rf /var/lib/apt/lists/*
COPY video/package.json video/package-lock.json ./
RUN npm ci
COPY video/ ./
RUN npx remotion browser ensure

# --- 3. runtime --------------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev \
      libxfixes3 libxcomposite1 libxdamage1 libcairo2 libpango-1.0-0 libatk-bridge2.0-0 libcups2 \
      fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# backend: production dependencies + compiled output + migrations + fonts
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev && npm cache clean --force
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY backend/migrations ./backend/migrations
COPY backend/assets ./backend/assets
RUN mkdir -p backend/storage && chown node:node backend/storage

# renderer: sources plus the node_modules that already contain Chrome Headless Shell and FFmpeg
COPY --from=video-deps /app/video ./video

# The backend spawns `node ../video/render.mjs`; VIDEO_RENDER_COMMAND can override it.
ENV VIDEO_RENDER_COMMAND=/app/video/render.mjs
ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}

USER node
# No HTTP server: the image has no health check, docker-compose disables it explicitly.
CMD ["node", "backend/dist/videoWorker.js"]
