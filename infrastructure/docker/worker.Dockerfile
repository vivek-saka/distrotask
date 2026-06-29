# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /repo
COPY package.json package-lock.json* turbo.json tsconfig.json ./
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/rabbitmq/package.json ./packages/rabbitmq/package.json
RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

FROM node:20-alpine AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/package.json ./package.json
COPY . .
RUN npm run build --workspace=@distrotask/shared
RUN npm run build --workspace=@distrotask/rabbitmq
RUN npm run build --workspace=@distrotask/worker

FROM node:20-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/dist ./node_modules/@distrotask/shared/dist
COPY --from=build /repo/packages/shared/package.json ./node_modules/@distrotask/shared/package.json
COPY --from=build /repo/packages/rabbitmq/dist ./node_modules/@distrotask/rabbitmq/dist
COPY --from=build /repo/packages/rabbitmq/package.json ./node_modules/@distrotask/rabbitmq/package.json
COPY --from=build /repo/apps/worker/dist ./dist
COPY --from=build /repo/apps/worker/package.json ./package.json

EXPOSE 9100
USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
