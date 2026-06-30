# syntax=docker/dockerfile:1.7
# Trinity Academy backend (NestJS) — multi-stage production image.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --legacy-peer-deps: dependabot bumped @eslint/js to 10.x while leaving
# eslint at ^9.18.0, creating a peer-dep conflict. Eslint is dev-only and
# only used during `npm run build` here, so accepting the loose resolution
# is safe for image build.
RUN --mount=type=cache,target=/root/.npm npm ci --legacy-peer-deps

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
# font-nanum: CJK font required by LevelTestPdfService to render Korean
# student / parent / teacher names + Korean labels in the unified level
# test PDF. Installs into /usr/share/fonts/nanum/NanumGothic.ttf — the
# PDF service registers it on first use and falls back to Helvetica with
# a warning when the path is missing (dev / local hosts).
RUN apk add --no-cache tini font-nanum && addgroup -S app && adduser -S app -G app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --legacy-peer-deps
COPY --from=build /app/dist ./dist
USER app
EXPOSE 4000
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","dist/main.js"]
