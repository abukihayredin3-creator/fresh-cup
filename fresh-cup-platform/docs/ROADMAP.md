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
  redemption/rewards-catalog flow are Phase 5
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
  delivery/driver logistics or analytics

## Phase 3 — Restaurant operations platform ✅

- Kitchen Display System: kitchen stations, per-menu-item prep time/station
  (snapshotted onto each order item at checkout so later menu edits don't
  rewrite history), a `preparingAt` timestamp on `Order`, and an enhanced
  kitchen queue reporting `elapsedSeconds`/`isLate` per order, filterable by
  station
- Delivery module: `DRIVER` role + driver account management, circular
  delivery zones (center + radius, no PostGIS dependency) with
  haversine-based fee quoting that replaces the Phase 2 flat rate when a
  zone covers the drop-off point (falls back to the flat rate otherwise —
  fully backward compatible), a `Delivery`/`DeliveryTrackingPing` model
  auto-created at checkout for delivery orders, a staff dispatch dashboard
  with manual driver assignment, and driver-facing self-service endpoints
  (availability toggle, GPS pings, delivery status updates that drive the
  parent order's status: picked-up → `out_for_delivery`, delivered →
  `delivered`)
- Real-time: `/ws/delivery` namespace (same JWT-auth/room pattern as the
  Phase 2 `/ws/orders` gateway) broadcasting assignment, status, and
  location-ping events to the customer, the assigned driver, and branch staff
- Inventory automation: recipe mapping (menu item → ingredient quantities)
  drives automatic stock deduction on `order.paid` — allowed to go negative
  since an already-paid order can't be rolled back — plus a low-stock event
  that notifies branch managers/admins and a `GET
/admin/inventory/low-stock` dashboard endpoint
- Purchasing: supplier management and a purchase-order workflow (draft →
  submit → receive), where receiving writes `RESTOCK` inventory-ledger
  transactions and updates stock atomically
- Audit logging: an `@Auditable(entityType)` decorator + a global
  interceptor that writes one `AuditLog` row (actor, action, entity,
  after-state) per mutating request on every tagged admin controller,
  readable via `GET /admin/audit-logs`
- Admin dashboard & analytics: on-demand (not materialized-view/cron-backed)
  KPI summary, sales-by-day, top-selling items, top customers by spend, and
  a customer-360 detail view — branch management, employee management, and
  customer listing were already served by the Phase 1 branches/users APIs
  and needed no new endpoints here
- 70 new automated tests (44 unit + 26 e2e against real Postgres), covering
  zone matching/fallback, the delivery status state machine and its
  order-status sync, recipe-based deduction (including idempotency against
  a duplicate `order.paid`), the purchase-order workflow, the audit
  interceptor, and analytics RBAC/branch-scoping — 246 total on top of the
  176 from Phase 2
- **Exit criteria:** kitchen staff run prep off a live, station-filterable
  queue; delivery orders are zone-priced, assigned, and tracked end-to-end;
  stock deducts itself as orders are paid and restocks itself as purchase
  orders are received; every admin mutation is attributable after the fact;
  and a manager can answer "how are we doing today" from one endpoint —
  all without AI-driven recommendations or demand forecasting

## Phase 4 — Customer experience platform ✅

- `apps/web` (Next.js): the full customer-facing site — locale-prefixed
  i18n routing (English/Amharic, shared `packages/i18n` message catalogs),
  light/dark theming, menu browse/search/category filter, product detail
  with modifier selection, server-persisted cart, checkout (order type,
  coupon, payment method), live order tracking over the Phase 2
  `/ws/orders` gateway, and an account area (profile, address book, order
  history, favorites, loyalty balance)
- `apps/mobile` (Expo SDK 57/React Native): the same customer journeys
  natively — theming/i18n/navigation shell, menu/cart/checkout/order-
  tracking/profile screens, and Expo push-token registration against the
  existing Phase 2 `POST /notifications/push-tokens` endpoint (delivery
  itself still needs a real Expo/FCM provider behind the Phase 2
  `PushProvider` interface — currently `ConsolePushProvider`, see Phase 5)
- Progressive Web App: installable manifest, an offline-caching service
  worker (cache-first app shell, stale-while-revalidate for menu/branch/
  category reads), and an offline banner
- Accessibility: WCAG 2 AA, verified with an automated axe-core scan (see
  below) across the key pages in both themes — caught and fixed a real
  insufficient-contrast bug in the home page hero
- Shared foundation grown for this phase: `packages/types` domain DTOs,
  `packages/api-client` resource methods, and an expanded `packages/ui`
  component library (+ dark-mode tokens) consumed by `apps/web` and, via
  native equivalents, `apps/mobile` — neither app duplicates backend logic
- Automated tests: a Playwright e2e suite (`apps/web/e2e`) covering guest
  browsing, a full login-to-order-completion journey, and the WCAG AA
  scan; Jest + React Native Testing Library component tests for
  `apps/mobile`
- **Exit criteria:** a customer can complete the entire browsing-to-order-
  completion journey on either the responsive web app or the native
  mobile app, in either language, in either theme, meeting WCAG 2 AA —
  without any backend changes beyond what Phases 1–3 already shipped

## Phase 5 — Loyalty rewards & promotions campaigns

- Loyalty tiers (calculated from the Phase 2 accrual ledger), rewards
  catalog, redemption flow (spend points for a discount/free item)
- Coupon campaigns: scheduled/targeted promotions on top of the Phase 2
  coupon engine (which already handles validation, limits, and redemption)
- Customer portal: loyalty balance/history (already served by the Phase 2
  API, and already surfaced read-only in Phase 4's `apps/web`/`apps/mobile`)
  gets a redemption flow added alongside the balance/history view
- Real push delivery: an `ExpoPushProvider`/FCM implementation behind the
  Phase 2 `PushProvider` interface, replacing `ConsolePushProvider` now
  that Phase 4 shipped a client that actually registers device tokens
- **Exit criteria:** repeat customers can redeem points for a reward; marketing can run a scheduled coupon campaign without engineering involvement

## Phase 6 — Inventory forecasting & multi-supplier sourcing

- Recipe-based auto-deduction, low-stock alerts, and the supplier/
  purchase-order workflow already shipped in Phase 3 — this phase covers
  what's still missing: demand forecasting (predicting reorder timing from
  historical consumption) and multi-supplier price comparison on a single
  purchase order, both deliberately deferred out of Phase 3's scope
- `apps/admin`: inventory dashboard UI consuming the Phase 3
  `/admin/inventory/low-stock` and `/admin/dashboard` APIs
- **Exit criteria:** the system suggests a reorder (quantity + supplier)
  before an item actually runs out, instead of only alerting once it's
  already at/below threshold

## Phase 7 — Analytics at scale

- Phase 3 already shipped an on-demand admin dashboard, sales/item/customer
  analytics, and a customer-360 view — this phase is about what stops
  being viable once order history grows past what an on-demand query scans
  comfortably: nightly aggregation jobs materializing `daily_sales_summary`
  and `item_performance`, cohort retention analysis, and exportable reports
- `apps/admin` analytics views built against the (already-shipped) Phase 3
  APIs, extended to consume the new materialized aggregates
- **Exit criteria:** dashboard queries stay fast regardless of how many
  years of order history exist, and the owner can export a report instead
  of only viewing it in-app

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
- Phase 3 built the delivery/kitchen/inventory/purchasing/audit/analytics
  APIs backend-first, same as Phases 1–2 — `apps/delivery`'s driver-facing
  PWA and `apps/admin`'s dashboard UI consume those APIs but are their own
  frontend work, not yet built (Phase 4 built the _customer_-facing
  frontends only). When the driver PWA is built, it ships as a PWA rather
  than a native app; revisit native only if drivers need background
  location tracking beyond what mobile-web geolocation permissions
  reliably provide in practice.
- Phase 4 shipped `apps/web` and `apps/mobile` together rather than
  sequencing native after web, since both consume the same Phase 1–3 APIs
  and shared `packages/ui`/`packages/api-client`/`packages/types` — there
  was no unvalidated-API risk left to de-risk by staggering them.
