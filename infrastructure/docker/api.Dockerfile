# syntax=docker/dockerfile:1

# ── Stage 1: deps — install full monorepo deps once, cached across builds ──
FROM node:20-alpine AS deps
WORKDIR /repo
RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json* turbo.json tsconfig.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/rabbitmq/package.json ./packages/rabbitmq/package.json
COPY prisma ./prisma

RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

# ── Stage 2: build — compile shared -> rabbitmq -> generate prisma -> build api ──
FROM node:20-alpine AS build
WORKDIR /repo
RUN apk add --no-cache openssl libc6-compat

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/package.json ./package.json
COPY . .

RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build --workspace=@distrotask/shared
RUN npm run build --workspace=@distrotask/rabbitmq
RUN npm run build --workspace=@distrotask/api

# ── Stage 3: runtime — minimal image, only what's needed to run ──
FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache openssl dumb-init
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/dist ./node_modules/@distrotask/shared/dist
COPY --from=build /repo/packages/shared/package.json ./node_modules/@distrotask/shared/package.json
COPY --from=build /repo/packages/rabbitmq/dist ./node_modules/@distrotask/rabbitmq/dist
COPY --from=build /repo/packages/rabbitmq/package.json ./node_modules/@distrotask/rabbitmq/package.json
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /repo/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /repo/prisma ./prisma
COPY --from=build /repo/apps/api/package.json ./package.json
COPY infrastructure/docker/api-entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && chown -R node:node /app

EXPOSE 3001
USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["./entrypoint.sh"]
