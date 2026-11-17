# syntax=docker/dockerfile:1
# Backend images. Build from the repository root:
#   docker build -f backend/Dockerfile --target runtime --build-arg GIT_SHA=$(git rev-parse HEAD) -t sukamenak-backend .
#   docker build -f backend/Dockerfile --target tools -t sukamenak-backend-tools .
#
# runtime: API (node dist/server.js), worker (node dist/worker.js), migrations (node dist/db/migrate.js up).
# tools:   one-off commands that need tsx and the sources: seed, create-admin, models:smoke, benchmark.
# bookworm-slim, not alpine: sharp ships glibc prebuilds and needs no compiler here.

FROM node:22-bookworm-slim AS deps
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM deps AS build
COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN npm run build

FROM deps AS tools
ENV NODE_ENV=production
COPY backend/ ./
# The seed copies gallery images from frontend/public.
COPY frontend/public /app/frontend/public
RUN mkdir -p storage && chown node:node storage
USER node
CMD ["npm", "run", "seed"]

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/backend/dist ./dist
COPY backend/migrations ./migrations
COPY backend/assets ./assets
# Owned by the unprivileged user, so a fresh named volume mounted here is writable too.
RUN mkdir -p storage && chown node:node storage
ARG GIT_SHA=unknown
ENV GIT_SHA=${GIT_SHA}
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
