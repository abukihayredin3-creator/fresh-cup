# Fresh Cup Juice House — Digital Platform

Premium juice bar & healthy-food ordering ecosystem for **Fresh Cup Juice House**
(Merkato, American Gibi, Addis Ababa, Ethiopia).

This directory contains the full monorepo: website, Android app, iOS app,
admin dashboard, customer portal, delivery dashboard, loyalty system, QR
menu, inventory management, and analytics — built as one coherent system
rather than disconnected projects.

> **Status:** Phase 4 complete — `apps/api` implements auth/RBAC, catalog,
> inventory (Phase 1), the full ordering engine — cart, checkout, payments,
> coupons, loyalty, real-time order updates (Phase 2) — the restaurant
> operations platform — kitchen display, delivery/driver management,
> inventory automation, purchasing, audit logging, and an admin
> dashboard/analytics (Phase 3) — and the customer experience platform:
> `apps/web` (full site, i18n, dark mode, PWA) and `apps/mobile` (Expo/React
> Native) both consume those APIs end to end, with e2e/component test
> coverage. `apps/admin` and `apps/delivery` are still scaffolds — their
> frontends are Phase 6/Phase 3-driver-PWA work, not yet built. See
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
| [`docs/ROADMAP.md`](docs/ROADMAP.md)                   | Phased implementation plan, phase 0 → phase 8                                                                            |

## What's here

- **`apps/api`** — NestJS backend implementing Phases 1–3 (see
  [`apps/api/README.md`](apps/api/README.md) for the endpoint summary, or
  [`docs/API_DESIGN.md`](docs/API_DESIGN.md) for the full catalog). Health
  checks at `/health` (liveness) and `/health/ready` (Postgres + Redis
  connectivity), env validation on boot.
- **`apps/web`** — Next.js customer site: marketing/menu/cart/checkout/live
  order tracking/account area, i18n (English/Amharic), dark mode, PWA
  (installable + offline caching), WCAG 2 AA (port 3000). See
  [`apps/web/e2e`](apps/web/e2e) for the Playwright suite.
- **`apps/admin`** — Next.js staff/owner dashboard (port 3001, scaffold only).
- **`apps/delivery`** — Next.js driver dashboard, installable as a PWA (port 3002, scaffold only).
- **`apps/mobile`** — Expo (React Native, SDK 57) app for Android + iOS,
  using expo-router: the same customer journeys as `apps/web`, natively —
  theming, i18n, menu/cart/checkout/order-tracking/profile, push
  notifications. Jest + React Native Testing Library component tests.
- **`packages/ui`** — Shared brand components (web) built on the Tailwind preset.
- **`packages/types`**, **`packages/utils`**, **`packages/api-client`** — Shared
  TypeScript types, helpers, and API client consumed by `apps/web` and
  `apps/mobile`.
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

# Generate the Prisma client, then apply migrations and seed dev data
pnpm --filter @fresh-cup/api prisma:generate
pnpm --filter @fresh-cup/api prisma:migrate
pnpm --filter @fresh-cup/api prisma:seed

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
pnpm test         # unit tests: apps/api (Jest), apps/mobile (Jest + RTL)
pnpm test:e2e     # e2e tests: apps/api (Jest), apps/web (Playwright)
pnpm format       # Prettier, whole repo
```

`apps/web`'s Playwright suite needs the API running separately (it's not
started by Playwright) — see [`apps/web/e2e/README.md`](apps/web/e2e/README.md)
for how to also cover the login journey, which needs a way to read the
dev API's logged OTP codes since there's no real SMS provider.

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
