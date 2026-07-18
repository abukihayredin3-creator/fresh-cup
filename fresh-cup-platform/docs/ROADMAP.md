# Phased Implementation Roadmap

Each phase ships something usable, in dependency order — the database and
API contracts get their shape right in Phase 0 specifically so nothing
downstream forces a breaking migration once real orders/customers exist.

## Phase 0 — Foundations

- Monorepo scaffolding (Turborepo, pnpm, shared configs)
- `apps/api`: NestJS skeleton, Prisma schema for Identity/Catalog/Ordering,
  auth (OTP + staff login), RBAC guards
- Infra: Docker Compose for local dev, Terraform for staging AWS resources, CI pipeline (lint/test/build)
- `packages/ui`: design tokens from `DESIGN_SYSTEM.md`, base component set
- OpenAPI spec + generated `packages/api-client`

## Phase 1 — MVP online ordering

- `apps/web`: public menu browse, cart, checkout
- QR dine-in flow: scan → resolve table → order-ahead
- Chapa payment integration (initiate + webhook)
- `apps/admin`: menu CRUD, live order list (polling first, WebSocket next), basic kitchen view
- Customer order-status page (WebSocket)
- **Exit criteria:** a real customer can scan a QR code or visit the site, order, pay via Chapa, and staff can see and fulfill the order

## Phase 2 — Delivery & real-time

- Delivery module: zones, fee quoting, rider assignment
- `apps/delivery`: PWA for riders — assignments, status updates, live location ping
- WebSocket rider-tracking surfaced to the customer's order-status page
- SMS notifications (AfroMessage): order confirmed, out for delivery, delivered
- **Exit criteria:** delivery orders can be assigned to a rider and tracked live end-to-end

## Phase 3 — Loyalty & promotions

- Points ledger, tier calculation, rewards catalog, redemption flow
- Coupons/promo codes, checkout-time validation
- Customer portal: loyalty balance/history, saved addresses
- **Exit criteria:** repeat customers earn and redeem points; marketing can run a coupon campaign without engineering involvement

## Phase 4 — Inventory management

- Ingredients, recipes (menu item → ingredient mapping), auto-deduction on paid orders
- Low-stock alerts, manual adjustments, supplier + purchase-order workflow
- `apps/admin`: inventory dashboard
- **Exit criteria:** stock levels stay accurate without manual recounts, and low-stock alerts fire before a menu item has to be pulled mid-service

## Phase 5 — Native mobile apps

- `apps/mobile` (Expo/React Native): full ordering flow, push notifications (FCM), biometric login, offline cart persistence
- Play Store + App Store submission, EAS OTA pipeline
- **Exit criteria:** feature parity with the web ordering flow, published on both stores

## Phase 6 — Analytics dashboard

- Nightly aggregation jobs → `daily_sales_summary`, `item_performance`, cohort retention
- `apps/admin` analytics views: sales trends, best/worst sellers, customer retention, exportable reports
- **Exit criteria:** the owner can answer "how did we do this week, and why" without a database query

## Phase 7 — Scale & hardening

- Load testing (k6) against checkout and menu-read paths
- Read-replica query routing for analytics, connection pooling tuning
- `orders`/`delivery_tracking_pings` partitioning if volume warrants it
- Third-party security audit / penetration test
- Multi-branch activation: onboard a second Fresh Cup location using the existing `branch_id` scoping — a data/config exercise, not a schema migration
- Observability maturity: defined SLOs, on-call alerting, quarterly DR restore drill

## Sequencing notes

- Payments and order-status transitions are the highest-blast-radius code
  in the system — they're built and tested first (Phase 1), not bolted on
  later, because every subsequent phase (loyalty accrual, inventory
  deduction, delivery assignment) hooks off `order.paid`/`order.status_changed` events.
- The Delivery Dashboard ships as a PWA in Phase 2 rather than a native app;
  revisit native only if riders need background location tracking beyond
  what mobile-web geolocation permissions reliably provide in practice.
- Native mobile apps are deliberately Phase 5, after the web ordering flow
  and API are proven with real orders — building three clients (web, iOS,
  Android) against an unvalidated API multiplies the cost of any early
  design mistake.
