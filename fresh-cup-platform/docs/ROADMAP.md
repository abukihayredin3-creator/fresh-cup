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

## Phase 2 — Ordering engine ✅

- Product modifiers: reusable groups (SINGLE/MULTIPLE-select) with per-item
  required/sort overrides, priced options, embedded in the public menu-item
  response as the cart/checkout customization contract
- QR dine-in tables: admin CRUD + QR-token generation/regeneration, public
  resolve-by-token endpoint
- Server-persisted cart (one per user+branch), quantity management, live
  modifier validation and pricing against the current catalog
- Checkout: idempotency-key-deduped order creation from the cart, order
  types (dine-in/pickup/delivery) with type-specific validation, flat-rate
  MVP delivery fee (zone/distance-based quoting is Phase 3)
- Order status workflow (`pending_payment → confirmed → preparing → ready →
{completed | out_for_delivery → delivered → completed}`, any non-terminal
  → `cancelled`) enforced server-side, with an append-only timeline and a
  branch-scoped kitchen queue
- Coupon engine: percent/amount/free-delivery discounts, redemption limits
  (global + per-user), applied atomically at checkout
- Loyalty points: accrual ledger tied to a _settled_ payment (not just order
  placement), `GET /loyalty/me` for balance + history — tiers and a
  redemption/rewards-catalog flow are Phase 4
- Payments: dependency-inverted provider interface, Chapa (TeleBirr/CBE
  Birr/HelloCash/Amole/cards, sandbox fallback with no API key configured)
  - cash (pay-at-counter/on-delivery, staff-confirmed settlement), signed
    webhook handling, admin refunds
- Real-time: Socket.IO `/ws/orders` gateway — JWT-authenticated on connect,
  customer order-room + staff branch-room broadcasts on every status change
- Notifications: SMS/email/push provider abstraction (console
  implementations pending real gateways), dispatched on order lifecycle
  events, every attempt logged to `notification_logs`
- In-process domain events (`order.created`/`order.status_changed`/
  `order.paid`, awaited via `emitAsync`) decouple ordering from
  loyalty/notifications — see `common/events/order-events.ts`
- 176 automated tests (unit + e2e against real Postgres/Redis, including a
  live Socket.IO client) covering checkout, the full status graph, RBAC,
  payments, coupon redemption limits, and loyalty accrual
- **Exit criteria:** a customer can build a cart, check out via dine-in/
  pickup/delivery, pay by Chapa or cash, and see live order-status updates;
  staff can run the kitchen queue end-to-end — all without touching
  rider logistics or analytics

## Phase 3 — Delivery & real-time

- Delivery module: zones, distance/zone-based fee quoting (replacing the
  Phase 2 flat rate), rider assignment
- `apps/delivery`: PWA for riders — assignments, status updates, live location ping
- Rider-tracking extends the existing `/ws/orders` gateway (or a sibling
  `/ws/delivery` namespace) built in Phase 2 — the socket auth/room pattern
  doesn't change, only who joins which room
- SMS notifications (AfroMessage): swaps in for the Phase 2 console SMS
  provider behind the same `SmsProvider` interface — no call-site changes
- **Exit criteria:** delivery orders can be assigned to a rider and tracked live end-to-end

## Phase 4 — Loyalty rewards & promotions campaigns

- Loyalty tiers (calculated from the Phase 2 accrual ledger), rewards
  catalog, redemption flow (spend points for a discount/free item)
- Coupon campaigns: scheduled/targeted promotions on top of the Phase 2
  coupon engine (which already handles validation, limits, and redemption)
- Customer portal: loyalty balance/history (already served by the Phase 2
  API) surfaced in the UI alongside rewards redemption
- **Exit criteria:** repeat customers can redeem points for a reward; marketing can run a scheduled coupon campaign without engineering involvement

## Phase 5 — Full inventory management

- Recipes (menu item → ingredient mapping) on top of the Phase 1 ledger, auto-deduction hooked off the Phase 2 `order.paid` event
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
