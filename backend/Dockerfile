# syntax=docker/dockerfile:1.7
# Trinity Academy backend (NestJS) — multi-stage production image.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev
COPY --from=build /app/dist ./dist
USER app
EXPOSE 4000
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","dist/main.js"]
