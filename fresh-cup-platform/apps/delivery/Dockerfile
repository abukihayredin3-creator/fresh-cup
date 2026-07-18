# Build from the monorepo root: docker build -f apps/delivery/Dockerfile -t fresh-cup-delivery .
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
RUN npm install -g turbo

FROM base AS pruner
WORKDIR /app
COPY . .
RUN turbo prune @fresh-cup/delivery --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@fresh-cup/delivery

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=installer --chown=nextjs:nodejs /app/apps/delivery/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/delivery/.next/static ./apps/delivery/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/delivery/public ./apps/delivery/public

USER nextjs
EXPOSE 3002
ENV PORT=3002
CMD ["node", "apps/delivery/server.js"]
