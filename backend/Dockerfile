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
# Korean CJK font required by LevelTestPdfService to render Hangul in
# the unified level-test PDF (REQ-260630). Downloaded at build time from
# the Naver-maintained Nanum Gothic OFL release so the image build does
# not depend on Alpine community repo availability (a previous attempt
# with `apk add font-nanum` failed with "no such package" on node:20-alpine
# whose default repo is `main` only). PDF service searches a couple of
# common paths and falls back to Helvetica with a warning when missing.
RUN apk add --no-cache tini curl ca-certificates && \
    mkdir -p /usr/share/fonts/korean && \
    curl -fsSL -o /usr/share/fonts/korean/NanumGothic.ttf \
      "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/nanumgothic/NanumGothic-Regular.ttf" && \
    apk del curl && \
    addgroup -S app && adduser -S app -G app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev --legacy-peer-deps
COPY --from=build /app/dist ./dist
USER app
EXPOSE 4000
ENTRYPOINT ["/sbin/tini","--"]
CMD ["node","dist/main.js"]
