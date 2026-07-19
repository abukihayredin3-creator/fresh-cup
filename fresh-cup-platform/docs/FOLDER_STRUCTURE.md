# Monorepo Folder Structure

Turborepo + pnpm workspaces. Rationale: five apps share types, an API
client, a design system, and lint/config — a monorepo keeps those in sync
by construction instead of via published-package version drift.

```
fresh-cup-platform/
├── apps/
│   ├── api/                        # NestJS backend — the only app with DB access
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── identity/       # users, staff, auth, OTP
│   │   │   │   ├── catalog/        # categories, items, variants, modifiers
│   │   │   │   ├── ordering/       # cart, orders, tables/QR
│   │   │   │   ├── payments/       # Chapa integration, webhooks
│   │   │   │   ├── delivery/       # zones, riders, assignment, tracking
│   │   │   │   ├── loyalty/        # points ledger, rewards
│   │   │   │   ├── promotions/     # coupons, campaigns
│   │   │   │   ├── inventory/      # ingredients, recipes, purchase orders
│   │   │   │   ├── notifications/  # SMS/push/email dispatch (queue consumers)
│   │   │   │   ├── analytics/      # reporting endpoints, aggregation jobs
│   │   │   │   ├── intelligence/   # Phase 6 — recommendations, customer/inventory/
│   │   │   │   │                   #   marketing intelligence, forecasting, executive BI, AI assistant
│   │   │   │   └── branches/       # branch/location management
│   │   │   ├── common/             # guards, interceptors, pipes, decorators
│   │   │   ├── websockets/         # /ws/orders, /ws/delivery gateways
│   │   │   ├── queue/              # BullMQ processors
│   │   │   ├── config/             # env schema/validation
│   │   │   └── main.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   ├── test/                   # integration tests (Testcontainers)
│   │   └── openapi.yaml            # generated + committed contract
│   │
│   ├── web/                        # Next.js — marketing site, customer portal, QR menu
│   │   ├── app/
│   │   │   ├── (marketing)/        # public site: home, story, locations
│   │   │   ├── (menu)/menu/        # browsable + QR-scanned menu, cart, checkout
│   │   │   ├── (account)/account/  # order history, addresses, loyalty
│   │   │   └── api/                # Next.js route handlers only for BFF concerns (e.g. image proxy)
│   │   └── components/
│   │
│   ├── admin/                      # Next.js — staff/owner dashboard
│   │   ├── app/
│   │   │   ├── orders/             # kitchen display + order management
│   │   │   ├── menu/               # catalog CRUD
│   │   │   ├── inventory/
│   │   │   ├── promotions/
│   │   │   ├── staff/
│   │   │   └── analytics/
│   │   └── components/
│   │
│   ├── delivery/                   # Next.js PWA — rider app
│   │   ├── app/
│   │   │   ├── assignments/
│   │   │   ├── active-delivery/    # live map, status updates
│   │   │   └── history/
│   │   └── components/
│   │
│   └── mobile/                     # React Native (Expo) — Android + iOS, one codebase
│       ├── app/                    # expo-router screens
│       ├── components/
│       └── native/                 # platform-specific modules (push, biometrics)
│
├── packages/
│   ├── ui/                         # shared design system: tokens + components (web via Tailwind, mobile via NativeWind)
│   ├── api-client/                 # typed client generated from apps/api/openapi.yaml
│   ├── types/                      # shared domain types/enums not tied to the generated client
│   ├── config/                     # shared eslint, tsconfig, tailwind config
│   └── utils/                      # currency formatting, date/locale helpers, validation schemas
│
├── infra/
│   ├── terraform/                  # AWS resources: VPC, RDS, ElastiCache, ECS, S3, CloudFront
│   ├── docker/                     # Dockerfiles per app, docker-compose for local dev
│   └── github-actions/             # reusable workflow fragments
│
├── docs/                           # this directory
│   ├── ARCHITECTURE.md
│   ├── DATABASE_SCHEMA.md
│   ├── API_DESIGN.md
│   ├── FOLDER_STRUCTURE.md
│   ├── DESIGN_SYSTEM.md
│   ├── DEPLOYMENT.md
│   ├── ROADMAP.md
│   └── adr/                        # Architecture Decision Records, one file per significant decision
│
├── .github/workflows/              # lint/test/build/deploy pipelines
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## Ownership rules

- Only `apps/api` talks to PostgreSQL/Redis directly. No frontend app ever
  gets a database credential.
- `packages/api-client` is generated, not hand-edited — regenerating it is
  part of the API's CI pipeline whenever `openapi.yaml` changes.
- `packages/ui` has no app-specific business logic — it's pure
  presentation (buttons, cards, form fields, the brand's color/type tokens).
- Each `apps/*` package owns its routing, state, and page composition; cross-app
  reuse always goes through `packages/*`, never by importing across `apps/*`.
