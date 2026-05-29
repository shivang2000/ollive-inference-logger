# Single multi-stage Dockerfile with two runtime targets (web, ingestion) that share one
# build stage — BuildKit caches the shared stage so compose builds both images quickly.

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

# ---- shared build: install + turbo build the whole monorepo ----
FROM base AS build
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml .npmrc turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile
RUN pnpm build

# ---- ingestion runtime: API, worker, and migrate all run from this image ----
FROM base AS ingestion
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app ./
CMD ["node", "apps/ingestion/dist/index.js"]

# ---- web runtime: Next.js standalone server ----
FROM base AS web
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
