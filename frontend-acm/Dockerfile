# syntax=docker/dockerfile:1.7
# ACM v1.0a frontend — Vite SPA served by nginx.
#
# Build args:
#   - VITE_API_BASE_URL: baked into the bundle if Vite reads it at build time.
#     For runtime proxying, leave unset and rely on nginx /api → backend.
#
# Multi-stage:
#   1. deps    — install npm packages with cache mount
#   2. build   — tsc -b && vite build → /app/dist
#   3. runtime — copy dist into nginx:alpine, serve on :80

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
LABEL org.opencontainers.image.title="acm-frontend"
LABEL org.opencontainers.image.description="ACM v1.0a Vite SPA"
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN apk add --no-cache tini
EXPOSE 80
ENTRYPOINT ["/sbin/tini","--"]
CMD ["nginx","-g","daemon off;"]
