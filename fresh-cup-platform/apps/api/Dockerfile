# Build from the monorepo root: docker build -f apps/api/Dockerfile -t fresh-cup-api .
#
# No turbo prune here — this builds directly from the full monorepo
# rather than a pruned subset. The trade-off is a larger builder-stage
# node_modules (every workspace app's dependencies, not just apps/api's),
# but avoids depending on prune's workspace-detection matching this
# repo's layout (fresh-cup-platform/ nested inside a git repo whose root
# also holds an unrelated ai_brain/ project).
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

FROM base AS builder
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @fresh-cup/api prisma:generate
RUN pnpm turbo run build --filter=@fresh-cup/api...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder --chown=nestjs:nodejs /app .
USER nestjs
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
