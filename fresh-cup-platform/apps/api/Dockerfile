# Build from the monorepo root: docker build -f apps/api/Dockerfile -t fresh-cup-api .
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN npm install -g turbo

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune @fresh-cup/api --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@fresh-cup/api
RUN pnpm --filter @fresh-cup/api exec prisma generate

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=installer --chown=nestjs:nodejs /app .
USER nestjs
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
