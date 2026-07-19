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
  redemption/rewards-catalog flow are Phase 6
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
  `PushProvider` interface — currently `ConsolePushProvider`, see Phase 6)
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

## Phase 5 — Admin Platform ✅

- Backend: extended Inventory (waste report, predicted shortages via
  trailing-consumption analysis, per-item transaction history), Purchasing
  (supplier analytics, invoice attachment, partial payments), and Analytics
  (kitchen/delivery performance, delivery heatmap) — plus three brand-new
  modules: Employees (departments, shift scheduling, clock-in/out
  attendance, performance notes, fine-grained `PermissionKey` grants),
  Marketing (banners, gift cards, referral codes, push/email/SMS
  campaigns targeting customer segments — reusing the Phase 2 notification
  provider interfaces rather than a separate send pipeline), and Security
  (self-service session listing/revocation, admin-forced session
  revocation, API keys, and a self-written RFC 6238 TOTP implementation for
  two-factor auth — no external dependency)
- Branches gained a weekly open/close-hours sub-resource
- `packages/types` + `packages/api-client` grew a dedicated `admin.*`
  resource namespace (12 resources) mirroring every endpoint above, kept
  separate from the Phase 1-4 customer-facing resources so neither surface
  leaks the other's concerns
- `packages/ui` gained admin-specific primitives: `DataTable`, `Select`,
  `DateRangePicker`, `StatCard`, `Sidebar`, and a `recharts`-based chart
  wrapper
- `apps/admin` (previously a scaffold) is now a complete, English-only
  staff/owner dashboard: staff email/password auth with role-gated
  navigation, a live KPI dashboard, five analytics sections (sales,
  products, customers, kitchen, delivery) with CSV export, branch
  management (including hours), employee management (roles, departments,
  shifts, attendance, performance notes, permissions), a menu CMS
  (categories, items, images, modifier groups), inventory + purchasing
  dashboards (including the new waste-report and predicted-shortages
  views), kitchen station management, a delivery dashboard (drivers,
  zones, live deliveries), a marketing dashboard, customer management, a
  reports page (quick links into the exportable analytics plus an
  admin-only audit-log viewer — the audit-log endpoint shipped in Phase 3
  but had no frontend until now), and settings/security pages
- English-only by deliberate scope decision, unlike `apps/web`'s
  next-intl-driven i18n — an internal staff tool doesn't carry the same
  localization requirement as the public site
- A recurring correctness fix worth naming: several `DELETE` endpoints
  (`menu-categories`, `kitchen-stations`, `delivery-zones`,
  `modifier-groups`) are soft deletes that just flip `isActive` — pairing
  that with a separate "Remove" action in the UI was redundant and, once a
  row was already inactive, silently misleading (clicking it appeared to
  do nothing). Caught during this phase's own smoke testing and fixed by
  using a single Activate/Deactivate toggle everywhere the backend behaves
  this way, and by adding the missing Active/Inactive indicator where a
  page had only ever exposed the (equally silent) "Remove" action.
- Every section verified with `tsc`/`eslint` plus a live Playwright smoke
  test against the running API and seeded dev data (not the customer-facing
  `apps/web` e2e suite — a separate, admin-specific pass per checkpoint)
- **Exit criteria:** an owner or manager can run the entire business —
  menu, inventory, purchasing, staff, marketing, customers, reporting, and
  account security — from `apps/admin` alone, without touching the
  database or the API directly; `apps/delivery` remains the one
  still-unbuilt frontend (its own PWA, not part of this phase's scope)

## Phase 6 — Loyalty rewards & promotions campaigns

- Loyalty tiers (calculated from the Phase 2 accrual ledger), rewards
  catalog, redemption flow (spend points for a discount/free item) —
  still entirely unbuilt; Phase 5's Marketing module added gift cards,
  referral codes, and generic push/email/SMS campaigns, but not a points
  tier system or a redemption flow
- Coupon-specific campaigns: scheduling/targeting layered on the Phase 2
  coupon engine itself (validation, limits, redemption). Phase 5 shipped a
  general-purpose Marketing campaign engine (push/email/SMS, segment
  targeting, `apps/admin` CRUD) that covers the "reach customers with a
  promotion" need in spirit, but it sends a message — it doesn't generate
  or attach a coupon code, so a dedicated coupon-campaign layer is still
  open if that specific mechanic is wanted
- Customer portal: loyalty balance/history (already served by the Phase 2
  API, and already surfaced read-only in Phase 4's `apps/web`/`apps/mobile`)
  gets a redemption flow added alongside the balance/history view
- Real push delivery: an `ExpoPushProvider`/FCM implementation behind the
  Phase 2 `PushProvider` interface, replacing `ConsolePushProvider` now
  that Phase 4 shipped a client that actually registers device tokens
- **Exit criteria:** repeat customers can redeem points for a reward; marketing can run a scheduled coupon campaign without engineering involvement

## Phase 7 — Inventory forecasting & multi-supplier sourcing

- Recipe-based auto-deduction and low-stock alerts shipped in Phase 3; the
  supplier/purchase-order workflow gained invoice attachment, partial
  payments, and per-supplier performance analytics in Phase 5. Demand
  forecasting also landed in Phase 5, earlier than planned here —
  `GET /admin/inventory/predicted-shortages` computes days-until-stockout
  per item from a trailing-consumption window, surfaced in `apps/admin`'s
  inventory dashboard — so what's left is narrower than originally scoped:
  multi-supplier price comparison on a single purchase order, deliberately
  deferred out of both Phase 3 and Phase 5
- **Exit criteria:** a purchase order can compare unit cost across more
  than one supplier before it's submitted, instead of committing to a
  single supplier's price up front

## Phase 8 — Analytics at scale

- Phase 3 shipped an on-demand admin dashboard and sales/item/customer
  analytics; Phase 5 added kitchen/delivery analytics, a delivery heatmap
  endpoint, CSV export on every analytics page, and a Reports hub
  (including the audit-log viewer that had no frontend since Phase 3) —
  all still on-demand queries, no materialized views or cron jobs. This
  phase is about what stops being viable once order history grows past
  what an on-demand query scans comfortably: nightly aggregation jobs
  materializing `daily_sales_summary` and `item_performance`, and cohort
  retention analysis
- `apps/admin` analytics views already exist (Phase 5) and would be
  extended here to consume the new materialized aggregates, not built
  from scratch
- **Exit criteria:** dashboard queries stay fast regardless of how many
  years of order history exist

## Phase 9 — Scale & hardening

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
  PWA and `apps/admin`'s dashboard UI consume those APIs but were their own
  frontend work, not built until later (Phase 4 built the _customer_-facing
  frontends first; Phase 5 built `apps/admin`). When the driver PWA is
  built, it ships as a PWA rather than a native app; revisit native only if
  drivers need background location tracking beyond what mobile-web
  geolocation permissions reliably provide in practice.
- Phase 4 shipped `apps/web` and `apps/mobile` together rather than
  sequencing native after web, since both consume the same Phase 1–3 APIs
  and shared `packages/ui`/`packages/api-client`/`packages/types` — there
  was no unvalidated-API risk left to de-risk by staggering them.
- Phase 5 (Admin Platform) came before the Phase 6–8 backend/analytics work
  it partially fulfilled (loyalty redemption, demand forecasting, kitchen/
  delivery analytics) because the highest-leverage move at that point was
  giving staff a UI for everything Phases 1–3 had already built
  API-only — a purchase order, a kitchen station, or a marketing campaign
  is only useful to the business once someone can operate it without
  calling the API by hand. Building the forecasting/aggregation-job work
  in Phases 6–8 first would have meant polishing features nobody at Fresh
  Cup could actually reach yet.
