# Phased Implementation Roadmap

Each phase ships something usable, in dependency order — the database and
API contracts get their shape right early so nothing downstream forces a
breaking migration once real orders/customers exist.

## Phase 0 — Foundations ✅

- Monorepo scaffolding (Turborepo, pnpm, shared configs)
- `apps/api`: NestJS skeleton, Prisma + Postgres + Redis wiring, health checks
- Infra: Docker Compose for local dev, CI pipeline (lint/typecheck/build)
- `packages/ui`: design tokens from `DESIGN_SYSTEM.md`, base component set
- Every app (web, admin, delivery, mobile, API) scaffolded and verified to boot

## Phase 1 — Core business foundation ✅

- Auth: phone OTP (customers) + email/password (staff), JWT access tokens,
  hashed/rotating opaque refresh tokens, logout
- RBAC: `customer`/`staff`/`manager`/`admin` roles, branch-scoping enforced
  at the service layer (a manager token can't touch another branch's data)
- User profile management + admin user management (branch-scoped for managers)
- Address management (CRUD, ownership-checked, single default enforced)
- Menu categories + products (menu items) CRUD, soft delete, dedicated
  availability toggle, URL-based product image gallery
- Inventory base models: `inventory_items` + append-only
  `inventory_transactions` ledger, manual stock adjustment API
- OpenAPI/Swagger docs at `/docs`, RFC 7807 error format, Prisma migration +
  seed data (branch, categories, sample products, dev accounts)
- 82 automated tests (unit + e2e against real Postgres/Redis) covering every
  endpoint's happy path plus RBAC/validation/ownership rejection cases
- **Exit criteria:** every actor (customer, staff, manager, admin) can
  authenticate, and the full menu + inventory data model is manageable
  through documented, tested, RBAC-protected APIs — with no cart, order, or
  payment logic yet

## Phase 2 — Online ordering

- `apps/web`: public menu browse, cart, checkout
- QR dine-in flow: scan → resolve table → order-ahead
- Chapa payment integration (initiate + webhook)
- `apps/admin`: live order list (polling first, WebSocket next), basic kitchen view
- Customer order-status page (WebSocket)
- Menu item variants and modifier groups (deferred from Phase 1 — these are
  ordering-flow concerns: variant/modifier selection only matters once a
  cart exists to select them into)
- **Exit criteria:** a real customer can scan a QR code or visit the site, order, pay via Chapa, and staff can see and fulfill the order

## Phase 3 — Delivery & real-time

- Delivery module: zones, fee quoting, rider assignment
- `apps/delivery`: PWA for riders — assignments, status updates, live location ping
- WebSocket rider-tracking surfaced to the customer's order-status page
- SMS notifications (AfroMessage): order confirmed, out for delivery, delivered
- **Exit criteria:** delivery orders can be assigned to a rider and tracked live end-to-end

## Phase 4 — Loyalty & promotions

- Points ledger, tier calculation, rewards catalog, redemption flow
- Coupons/promo codes, checkout-time validation
- Customer portal: loyalty balance/history surfaced alongside the addresses built in Phase 1
- **Exit criteria:** repeat customers earn and redeem points; marketing can run a coupon campaign without engineering involvement

## Phase 5 — Full inventory management

- Recipes (menu item → ingredient mapping) on top of the Phase 1 ledger, auto-deduction on paid orders
- Low-stock alerts, supplier + purchase-order workflow
- `apps/admin`: inventory dashboard (stock levels, low-stock flags already served by the Phase 1 API)
- **Exit criteria:** stock levels stay accurate without manual recounts, and low-stock alerts fire before a menu item has to be pulled mid-service

## Phase 6 — Native mobile apps

- `apps/mobile` (Expo/React Native): full ordering flow, push notifications (FCM), biometric login, offline cart persistence
- Play Store + App Store submission, EAS OTA pipeline
- **Exit criteria:** feature parity with the web ordering flow, published on both stores

## Phase 7 — Analytics dashboard

- Nightly aggregation jobs → `daily_sales_summary`, `item_performance`, cohort retention
- `apps/admin` analytics views: sales trends, best/worst sellers, customer retention, exportable reports
- **Exit criteria:** the owner can answer "how did we do this week, and why" without a database query

## Phase 8 — Scale & hardening

- Load testing (k6) against checkout and menu-read paths
- Read-replica query routing for analytics, connection pooling tuning
- `orders`/`delivery_tracking_pings` partitioning if volume warrants it
- Third-party security audit / penetration test
- Multi-branch activation: onboard a second Fresh Cup location using the existing `branch_id` scoping — a data/config exercise, not a schema migration
- Observability maturity: defined SLOs, on-call alerting, quarterly DR restore drill

## Sequencing notes

- Auth and RBAC came first (Phase 1) because every other phase's endpoints
  depend on knowing who's calling and what branch they belong to — building
  ordering against unauthenticated/unscoped access would mean redoing every
  endpoint's authorization once auth landed.
- Payments and order-status transitions are the highest-blast-radius code
  in the system — they're built and tested first within ordering (Phase 2),
  not bolted on later, because every subsequent phase (loyalty accrual,
  inventory deduction, delivery assignment) hooks off
  `order.paid`/`order.status_changed` events.
- The Delivery Dashboard ships as a PWA in Phase 3 rather than a native app;
  revisit native only if riders need background location tracking beyond
  what mobile-web geolocation permissions reliably provide in practice.
- Native mobile apps are deliberately Phase 6, after the web ordering flow
  and API are proven with real orders — building three clients (web, iOS,
  Android) against an unvalidated API multiplies the cost of any early
  design mistake.
