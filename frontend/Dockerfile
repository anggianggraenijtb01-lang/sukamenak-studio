# syntax=docker/dockerfile:1
# Web image: the built SPA served by Nginx, which also proxies /api to the API container (same origin, so the
# httpOnly refresh cookie needs no CORS). Build from the repository root:
#   docker build -f frontend/Dockerfile --build-arg GIT_SHA=$(git rev-parse HEAD) -t sukamenak-web .

FROM node:22-bookworm-slim AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# deploy/verify-deploy.mjs compares this with the commit it deployed.
ARG GIT_SHA=unknown
RUN printf '{"commit":"%s"}\n' "$GIT_SHA" > dist/version.json

FROM nginx:1.27-alpine AS runtime
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
