# @fresh-cup/api

Fresh Cup core API (NestJS). Part of the Fresh Cup Juice House monorepo —
see the root [`README.md`](../../README.md) and [`docs/`](../../docs) for
architecture and full setup instructions.

```bash
pnpm install                     # from the monorepo root
cp apps/api/.env.example apps/api/.env.local
pnpm --filter @fresh-cup/api prisma:generate
pnpm --filter @fresh-cup/api prisma:migrate   # local dev only; CI/prod use prisma:deploy
pnpm --filter @fresh-cup/api prisma:seed      # branch, categories, sample products, dev accounts
pnpm --filter @fresh-cup/api dev
```

- API: `http://localhost:4000/api/v1`
- Health: `http://localhost:4000/health`, `http://localhost:4000/health/ready`
- Swagger/OpenAPI docs: `http://localhost:4000/docs`

## What's implemented (Phases 1–3)

**Phase 1 — core business foundation**

- **Auth** (`/auth/*`): phone OTP (customers), email+password (staff),
  JWT access tokens, hashed/rotating refresh tokens, logout
- **Users** (`/users/me`, `/admin/users`): profile management, admin user
  management (branch-scoped for managers)
- **Addresses** (`/addresses`): CRUD, ownership-checked
- **Branches** (`/branches`): public read, admin-managed
- **Catalog** (`/branches/:id/menu-categories`, `/branches/:id/menu-items`,
  `/admin/menu-*`): categories + products CRUD, availability toggle, image gallery
- **Inventory** (`/admin/inventory`): base stock ledger, manual adjustments

**Phase 2 — ordering engine**

- **Modifiers/tables/cart** (`/admin/modifier-groups`, `/admin/tables`, `/cart/*`)
- **Orders** (`/orders`, `/admin/orders/kitchen-queue`): checkout, status
  workflow, timeline
- **Coupons/loyalty** (`/coupons/validate`, `/admin/coupons`, `/loyalty/me`)
- **Payments** (`/payments/*`): Chapa + cash, webhooks, refunds
- **Notifications** (`/notifications/push-tokens`) + `/ws/orders` real-time gateway

**Phase 3 — restaurant operations platform**

- **Kitchen** (`/admin/kitchen-stations`, `/admin/orders/kitchen-queue`):
  stations, per-item prep time, station-filterable queue with lateness
- **Delivery** (`/admin/delivery-zones`, `/admin/drivers`,
  `/admin/deliveries`, `/delivery/driver/*`): zone-based fee quoting,
  driver management, dispatch, GPS tracking, `/ws/delivery` real-time gateway
- **Inventory automation** (`/admin/recipe-ingredients`,
  `/admin/inventory/low-stock`): recipe-based auto-deduction on
  `order.paid`, low-stock alerts
- **Purchasing** (`/admin/suppliers`, `/admin/purchase-orders`):
  supplier management, draft → submit → receive workflow with automatic restock
- **Audit logging** (`/admin/audit-logs`): every admin mutation logged
  (actor, action, entity, after-state)
- **Admin dashboard & analytics** (`/admin/dashboard`,
  `/admin/analytics/*`, `/admin/customers/:id`): on-demand KPIs, sales/
  item/customer analytics, customer-360

See [`../../docs/ROADMAP.md`](../../docs/ROADMAP.md) and
[`../../docs/API_DESIGN.md`](../../docs/API_DESIGN.md) for the full
endpoint reference and what's still ahead (Phase 4+).

## Testing

```bash
pnpm --filter @fresh-cup/api test       # unit tests (mocked Prisma)
pnpm --filter @fresh-cup/api test:e2e   # e2e tests against a real Postgres/Redis
```

e2e tests need `DATABASE_URL`, `REDIS_URL`, and `JWT_ACCESS_SECRET` set (see
`.env.example`) and a migrated database (`prisma:deploy` or `prisma:migrate`).
