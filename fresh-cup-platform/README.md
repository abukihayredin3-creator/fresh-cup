# Fresh Cup Juice House — Digital Platform

Premium juice bar & healthy-food ordering ecosystem for **Fresh Cup Juice House**
(Merkato, American Gibi, Addis Ababa, Ethiopia).

This directory contains the full monorepo: website, Android app, iOS app,
admin dashboard, customer portal, delivery dashboard, loyalty system, QR
menu, inventory management, and analytics — built as one coherent system
rather than disconnected projects.

> **Status:** Phase 0 — Foundation. The monorepo, every app, and every
> shared package are scaffolded, wired together, and verified to build,
> lint, typecheck, and boot with placeholder pages. No restaurant business
> logic (auth, ordering, payments) exists yet — that starts in Phase 1. See
> [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Start here

| Doc                                                    | Contents                                                                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)         | System overview, tech stack + rationale, domain boundaries, security, scalability, real-time architecture, observability |
| [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md)   | Full entity-relationship design and DDL sketch                                                                           |
| [`docs/API_DESIGN.md`](docs/API_DESIGN.md)             | REST + WebSocket API conventions and endpoint catalog                                                                    |
| [`docs/FOLDER_STRUCTURE.md`](docs/FOLDER_STRUCTURE.md) | Monorepo layout for every app and shared package                                                                         |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)       | Brand identity, color system, typography, component tokens                                                               |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)             | Infrastructure, environments, CI/CD pipeline                                                                             |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)                   | Phased implementation plan, phase 0 → phase 7                                                                            |

## What's here

- **`apps/api`** — NestJS backend. Health checks at `/health` (liveness) and
  `/health/ready` (Postgres + Redis connectivity), env validation on boot,
  Prisma + Redis wired up with no domain models yet.
- **`apps/web`** — Next.js marketing site / customer portal / QR menu (port 3000).
- **`apps/admin`** — Next.js staff/owner dashboard (port 3001).
- **`apps/delivery`** — Next.js rider dashboard, installable as a PWA (port 3002).
- **`apps/mobile`** — Expo (React Native) app for Android + iOS, using expo-router.
- **`packages/ui`** — Shared brand components (web) built on the Tailwind preset.
- **`packages/types`**, **`packages/utils`**, **`packages/api-client`** — Shared
  TypeScript types, helpers, and the (currently transport-only) API client.
- **`packages/config`** — Shared TypeScript/ESLint/Tailwind configuration every
  app and package extends from.
- **`infra/docker`** — `docker-compose.yml` for local Postgres/Redis/MinIO, plus
  a production Dockerfile per app.

## Prerequisites

- Node.js 22+ (`.nvmrc` pins the version)
- pnpm 10+ (`corepack enable` will pick up the pinned version automatically)
- Docker, for local Postgres/Redis/MinIO

## Getting started

```bash
# From this directory (fresh-cup-platform/)
pnpm install

# Start local infrastructure (Postgres, Redis, MinIO)
docker compose -f infra/docker/docker-compose.yml up -d

# Copy env files and fill in values (defaults match docker-compose)
cp apps/api/.env.example apps/api/.env.local
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
cp apps/delivery/.env.example apps/delivery/.env.local
cp apps/mobile/.env.example apps/mobile/.env.local

# Generate the Prisma client (no models yet, but the client + tooling work)
pnpm --filter @fresh-cup/api prisma:generate

# Run everything in parallel (Turborepo)
pnpm dev
```

Or run a single app: `pnpm --filter @fresh-cup/web dev`, `pnpm --filter
@fresh-cup/api dev`, `pnpm --filter @fresh-cup/mobile dev`, etc.

## Common commands

```bash
pnpm lint         # ESLint across every app/package
pnpm typecheck    # tsc --noEmit across every app/package
pnpm build        # production build of every app/package
pnpm test         # unit + e2e tests (apps/api today)
pnpm format       # Prettier, whole repo
```

All of the above run through Turborepo (`turbo.json`), so only what changed
gets re-run/re-built on subsequent runs.

## Why a separate directory

This repository's existing history (`ai_brain/`, trading tests, etc.) belongs
to an unrelated forex/trading project. Fresh Cup lives entirely under
`fresh-cup-platform/` so the two are never entangled — nothing here imports
from, or is imported by, the trading codebase. The GitHub Actions workflow
(`.github/workflows/fresh-cup-ci.yml`, at the repo root since that's where
GitHub requires workflow files to live) is path-filtered to only run on
changes under `fresh-cup-platform/`.
