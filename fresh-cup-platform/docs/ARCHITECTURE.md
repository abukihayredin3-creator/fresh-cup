# Fresh Cup Juice House — System Architecture

## 1. Executive summary

Fresh Cup is one backend domain (menu, ordering, payments, delivery, loyalty,
inventory, analytics) exposed through a single versioned API, consumed by
six client surfaces (marketing site, customer portal, QR dine-in menu, admin
dashboard, delivery dashboard, Android/iOS apps). The design goal is: **one
source of truth for data and business rules, many thin clients**. No client
is ever allowed to embed business logic (price calculation, loyalty accrual,
inventory deduction) — that logic lives in the API only, so a bug fixed once
is fixed everywhere.

The system is built to run a single premium juice bar in Merkato today, and
to expand to multiple branches, catering, and a delivery fleet without a
rewrite. That means: branch-scoped data model from day one, stateless
services that scale horizontally, and infrastructure that costs little at
low volume but doesn't fall over at high volume.

## 2. Who uses this system

| Actor                      | Surface                                | Core needs                                                                             |
| -------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| Walk-in / dine-in customer | QR Menu (web)                          | Scan table QR → browse menu → order-ahead or pay-at-counter, no login required         |
| Delivery/pickup customer   | Website, Customer Portal, Android, iOS | Browse menu, order, pay online (Chapa/TeleBirr/card), track order, earn loyalty points |
| Kitchen staff              | Kitchen Display (part of Admin)        | See incoming orders in real time, mark items in-progress/ready                         |
| Branch manager / admin     | Admin Dashboard                        | Manage menu, prices, inventory, promotions, staff, view analytics                      |
| Delivery rider             | Delivery Dashboard (PWA)               | See assigned deliveries, update status, navigate, go online/offline                    |
| Owner / HQ                 | Admin Dashboard → Analytics            | Cross-branch sales, inventory cost, customer retention                                 |

## 3. High-level architecture

```mermaid
flowchart TB
    subgraph Clients
        WEB[Website + Customer Portal + QR Menu\nNext.js]
        ADMIN[Admin Dashboard\nNext.js]
        DELIVERY[Delivery Dashboard\nNext.js PWA]
        MOBILE[Android + iOS\nReact Native / Expo]
    end

    subgraph Edge
        CF[Cloudflare\nCDN + WAF + DDoS protection]
    end

    subgraph Backend["Core API — NestJS (TypeScript)"]
        REST[REST API v1\nOpenAPI 3.1]
        WS[WebSocket Gateway\nOrder status, KDS, rider tracking]
        WORKER[Background Workers\nBullMQ queues]
    end

    subgraph Data
        PG[(PostgreSQL\nprimary + read replica)]
        REDIS[(Redis\ncache, sessions, queues)]
        S3[(Object Storage\nmenu images, receipts)]
    end

    subgraph External
        CHAPA[Chapa / TeleBirr\npayment gateways]
        SMS[AfroMessage\nSMS OTP + notifications]
        FCM[Firebase Cloud Messaging\npush notifications]
        MAPS[Google Maps Platform\ndelivery routing/geocoding]
    end

    WEB --> CF
    ADMIN --> CF
    DELIVERY --> CF
    MOBILE --> CF
    CF --> REST
    CF --> WS

    REST --> PG
    REST --> REDIS
    REST --> S3
    WS --> REDIS
    WORKER --> PG
    WORKER --> REDIS
    WORKER --> SMS
    WORKER --> FCM

    REST --> CHAPA
    REST --> MAPS
    CHAPA -. webhook .-> REST
```

Every client talks to the **same API**. There is no "admin API" vs "customer
API" split — endpoints are shared and gated by role-based authorization, so
the data model and validation logic can never drift between surfaces.

## 4. Applications and boundaries

| App             | Framework                                         | Deploys as                       | Talks to                                          |
| --------------- | ------------------------------------------------- | -------------------------------- | ------------------------------------------------- |
| `apps/api`      | NestJS (TypeScript)                               | Container (ECS Fargate)          | PostgreSQL, Redis, S3, payment/SMS/maps providers |
| `apps/web`      | Next.js (App Router)                              | Vercel or container              | `apps/api` REST + WS, public, SEO-critical        |
| `apps/admin`    | Next.js                                           | Vercel or container              | `apps/api` REST + WS, behind staff auth           |
| `apps/delivery` | Next.js (PWA, installable)                        | Vercel or container              | `apps/api` REST + WS, geolocation                 |
| `apps/mobile`   | React Native (Expo, one codebase → Android + iOS) | App Store / Play Store + EAS OTA | `apps/api` REST + WS                              |

**Boundary rule:** frontend code may format, cache, and optimistically
render data — it may never _decide_ a price, a loyalty point value, a stock
deduction, or an order-status transition. Those are API-only concerns,
enforced by code review and by the fact that clients never get direct DB
access.

## 5. Tech stack and rationale

| Layer                           | Choice                                                                                             | Why                                                                                                                                                                                                                      | Alternatives considered                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend framework               | **NestJS + TypeScript**                                                                            | Opinionated modular structure maps 1:1 onto domain modules (Catalog, Ordering, Delivery, Loyalty...); built-in DI, guards, pipes give consistent auth/validation; same language as every frontend, enabling shared types | Django (great ORM, but splits language from the TS frontends); Go (excellent perf, but slower iteration for a small team standing up many domains at once) |
| ORM / migrations                | **Prisma**                                                                                         | Type-safe queries generated from schema, first-class migrations, works cleanly with NestJS                                                                                                                               | TypeORM (more footguns with relations at this schema size)                                                                                                 |
| Primary database                | **PostgreSQL**                                                                                     | Strong relational integrity for orders/payments/inventory; JSONB for flexible fields (modifier options); mature, cheap to run managed                                                                                    | MySQL (fine, but Postgres's constraints/enums/partial indexes fit this domain better)                                                                      |
| Cache / queues / sessions       | **Redis**                                                                                          | One piece of infra for three jobs: hot-path cache (menu, session tokens), pub/sub backing for the WebSocket gateway across multiple API instances, and BullMQ job queues                                                 | Memcached (no pub/sub, no queue support)                                                                                                                   |
| Async jobs                      | **BullMQ (Redis-backed)**                                                                          | Notifications, receipt generation, loyalty point accrual, and inventory deduction happen _after_ the order response, not blocking checkout latency                                                                       | AWS SQS (viable later; BullMQ is zero extra infra now)                                                                                                     |
| Web / Admin / Delivery frontend | **Next.js (React)**                                                                                | SSR/SSG for the SEO-critical marketing site and QR menu (fast first paint on cheap Android phones over 3G/4G), same React model reused for Admin and Delivery, App Router for streaming and layouts                      | Plain SPA (Vite) — loses SSR needed for marketing/SEO and QR-menu cold loads                                                                               |
| Mobile                          | **React Native + Expo**                                                                            | One codebase for Android and iOS, shared business logic and API client with the web apps, EAS lets us ship JS-only fixes as OTA updates without a store review cycle                                                     | Fully native Swift/Kotlin (best perf/platform fit, but ~2x team and 2x the surface for a first release; revisit once volume justifies it)                  |
| Design system                   | **Tailwind CSS + shadcn/ui (web) / NativeWind (mobile)**                                           | One token source (`packages/ui`) drives color/spacing/type on both web and native via Tailwind-compatible syntax                                                                                                         | Separate component libraries per platform (drifts visually over time)                                                                                      |
| API contract                    | **OpenAPI 3.1, contract-first**                                                                    | Single spec generates the TypeScript client used by web, admin, delivery, and mobile — no hand-maintained API client, no drift between backend and frontend types                                                        | GraphQL (adds a query layer/complexity this domain doesn't need; REST + typed client covers it)                                                            |
| Real-time                       | **WebSocket (Socket.IO) via NestJS Gateway, Redis adapter**                                        | Order-status pushes, kitchen display live updates, rider location — polling would be both slower and heavier at scale                                                                                                    | Server-Sent Events (one-directional only; rider location and KDS need bidirectional)                                                                       |
| Auth                            | **JWT (short-lived access + rotating refresh), phone OTP for customers, email+password for staff** | Phone number is the primary identifier Ethiopian customers actually use; OTP avoids forgotten passwords for a low-friction checkout                                                                                      | Session cookies only (harder to share across native mobile + multiple web subdomains)                                                                      |
| Payments                        | **Chapa** (aggregator: TeleBirr, CBE Birr, HelloCash, Amole, cards)                                | Chapa is the standard Ethiopian payment aggregator — one integration covers the wallets customers actually have; Stripe/PayPal don't support ETB payouts locally                                                         | Direct TeleBirr integration only (narrower coverage, more integration work for the same result)                                                            |
| SMS / OTP                       | **AfroMessage (or similar Ethiopian SMS gateway)**                                                 | Local delivery reliability and cost; Twilio has poor/expensive coverage into Ethiopian carriers                                                                                                                          | Twilio                                                                                                                                                     |
| Push notifications              | **Firebase Cloud Messaging**                                                                       | Single API for both Android and iOS (APNs via FCM)                                                                                                                                                                       | Native APNs + FCM separately (more moving parts, no benefit)                                                                                               |
| Object storage                  | **S3-compatible storage** (AWS S3 or DigitalOcean Spaces)                                          | Menu photos, generated receipts, exported reports                                                                                                                                                                        | —                                                                                                                                                          |
| Maps / geocoding                | **Google Maps Platform**                                                                           | Best road/address coverage for Addis Ababa for delivery routing and address autocomplete                                                                                                                                 | Mapbox (weaker local geocoding in this region)                                                                                                             |
| Monorepo tooling                | **Turborepo + pnpm workspaces**                                                                    | Shared `packages/*` (types, UI, API client, config) across five apps with cached, parallel builds                                                                                                                        | Nx (more powerful, more ceremony than this team needs at this stage)                                                                                       |

## 6. Domain modules (bounded contexts inside `apps/api`)

Each is a NestJS module with its own controllers, services, and Prisma
models — internal boundaries even though they share one database and one
deployable, so they can be split into separate services later if a specific
module (e.g., Notifications) becomes a bottleneck.

- **Identity** — customers, staff, roles/permissions, auth, OTP
- **Catalog** — categories, menu items, variants, modifiers, availability
- **Ordering** — cart, order lifecycle, order-type (dine-in/pickup/delivery), tables/QR sessions
- **Payments** — payment intents, Chapa webhook handling, refunds
- **Delivery** — riders, zones, fee calculation, assignment, live tracking
- **Loyalty** — points ledger, tiers, rewards catalog, redemptions
- **Promotions** — coupons, discount rules, campaigns
- **Inventory** — ingredients, recipes (menu item → ingredient mapping), stock levels, purchase orders, low-stock alerts
- **Notifications** — SMS, push, email dispatch (consumes events from other modules via the queue)
- **Analytics** — read-optimized reporting views, scheduled aggregation jobs
- **Branches** — restaurant locations (one today, extensible)

Modules communicate in-process via an internal event bus (Nest
`EventEmitter`) for cross-cutting concerns — e.g., `order.paid` triggers
Loyalty to accrue points and Inventory to deduct stock, without Ordering
importing either module directly. This keeps modules decoupled while
staying in one deployable for now.

## 7. API architecture

Full detail in [`API_DESIGN.md`](API_DESIGN.md). Summary:

- REST, versioned at `/api/v1`, OpenAPI 3.1 as the source of truth
- Bearer JWT auth; role-based guards (`customer`, `kitchen`, `manager`, `rider`, `admin`, `super_admin`)
- Idempotency keys required on order-creation and payment endpoints
- Cursor-based pagination on all list endpoints
- RFC 7807 `problem+json` error format
- WebSocket namespaces: `/ws/orders` (customer + KDS), `/ws/delivery` (rider location + assignment)
- Signed webhook endpoint for Chapa payment callbacks

## 8. Data architecture

Full schema in [`DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md). Summary:

- PostgreSQL as system of record; every table branch-scoped via `branch_id`
- Redis caches menu reads (short TTL, invalidated on write) and holds refresh-token/session state
- Nightly ETL job materializes analytics-friendly aggregate tables (`daily_sales_summary`, `item_performance`) so dashboard queries never hit live OLTP tables directly
- S3 for images/receipts; database stores URLs, not blobs

## 9. Real-time architecture

- Customer app subscribes to `/ws/orders/{orderId}` after checkout → receives `pending → confirmed → preparing → ready → out_for_delivery → delivered` transitions
- Kitchen Display subscribes to `/ws/orders/branch/{branchId}` → sees every new order the instant it's paid/confirmed
- Delivery Dashboard subscribes to `/ws/delivery/branch/{branchId}` for new assignments; rider's app pushes location pings every ~10s while a delivery is active, fanned out to the customer tracking the order
- Socket.IO's Redis adapter keeps this consistent across multiple API instances behind the load balancer — a ping delivered to instance A can reach a client connected to instance B

## 10. Security architecture

- **Transport:** HTTPS everywhere (TLS termination at Cloudflare + origin), HSTS
- **AuthN:** short-lived JWT access tokens (~15 min) + rotating refresh tokens (stored httpOnly, revocable); phone OTP for customers (rate-limited, expiring codes); argon2 password hashing for staff accounts
- **AuthZ:** RBAC guards on every endpoint; branch-scoping enforced at the query layer, not just the controller, so a manager token for Branch A can never read Branch B's orders
- **Input validation:** class-validator DTOs on every request; Prisma parameterizes all queries (no raw SQL string interpolation)
- **Payments:** card/wallet data never touches our servers — Chapa's hosted checkout handles it; we store only payment references and status, keeping us outside PCI-DSS scope
- **Webhooks:** Chapa callback signature verified before any order/payment state changes; replay protection via idempotency keys
- **Secrets:** environment-injected via AWS Secrets Manager, never committed; separate secrets per environment
- **Rate limiting:** per-IP and per-account limits on auth, OTP request, and checkout endpoints (Redis-backed)
- **Headers:** `helmet` defaults (CSP, X-Frame-Options, etc.) on every web-facing response
- **Uploads:** menu-image uploads validated by content-type/magic-bytes and size, re-encoded server-side before storage (blocks malicious file uploads)
- **Audit log:** every admin mutation (price change, refund, stock adjustment, role change) written to an append-only `audit_log` table with actor, before/after, timestamp
- **Dependency hygiene:** Dependabot/Renovate + `npm audit` in CI, blocking merges on high/critical vulnerabilities
- **Data protection:** aligned with Ethiopia's Personal Data Protection Proclamation — explicit consent on signup, data export/delete endpoints for customers, minimal retention on OTP codes and raw payment logs

## 11. Scalability and performance

- Stateless API containers behind a load balancer → horizontal auto-scaling (ECS Fargate service auto-scaling on CPU + request count)
- Postgres read replica for analytics/reporting traffic, keeping heavy queries off the primary that checkout depends on
- Redis caches the menu (read-heavy, write-rare) with short TTL + explicit invalidation on admin edits
- CDN (Cloudflare) in front of all static assets and Next.js static output; images served via an image-optimization pipeline (resize/WebP) so a customer on a slow Addis Ababa mobile connection isn't downloading full-resolution photos
- Async work (SMS, push, receipts, loyalty accrual, inventory deduction) offloaded to BullMQ workers so checkout latency isn't gated on third-party API calls
- Database: indexes on all foreign keys and common filters (`orders.status`, `orders.branch_id, created_at`), `orders` table partitioned by month once volume warrants it
- Connection pooling via PgBouncer between API containers and Postgres
- Designed for one branch today, `branch_id` on every relevant table means adding branch #2 is a data-entry operation, not a migration

## 12. Localization and regional considerations

- **Bilingual from the start:** English + Amharic (i18n via `next-intl` on web, `i18n-js` on mobile); all customer-facing copy and menu content stored with locale variants
- **Currency:** ETB as the only currency; prices stored as integer cents-equivalent (lowest denomination) to avoid float rounding bugs
- **Phone numbers:** normalized to `+251` E.164 format; phone is the primary customer identifier (OTP login), matching how most customers actually authenticate day to day
- **Payments:** Chapa covers TeleBirr, CBE Birr, HelloCash, Amole, and cards in one integration — no customer is forced onto a payment method they don't have
- **Bandwidth:** aggressive image compression, code-splitting, and a "data saver" mode on mobile (lower-res images, fewer background polls) since mobile data cost/coverage varies across Addis Ababa
- **Addresses:** Addis Ababa doesn't use a formal postal-address system the way many markets do; delivery addresses are captured as free-text + pinned map location (lat/lng) rather than structured street/postal fields

## 13. Observability

- **Errors:** Sentry across API, web, admin, delivery, and mobile
- **Logs:** structured JSON logs from the API, shipped to a managed log store (CloudWatch Logs, or Grafana Loki if self-hosting)
- **Metrics/dashboards:** Grafana Cloud (free/low tier is enough at this scale) tracking request latency, error rate, queue depth, DB connection saturation
- **Uptime/alerts:** synthetic checks on checkout and order-status endpoints; PagerDuty/Slack alert on error-rate or latency SLO breach
- **Business metrics:** order volume, GMV, average prep time, and delivery SLA surfaced directly in the Admin Analytics module (not just infra dashboards)

## 14. Testing strategy

- **Unit tests:** service-layer logic per domain module (pricing, loyalty accrual, inventory deduction) — these are the rules that must never silently break
- **Integration tests:** API endpoints against a real Postgres test database (Testcontainers), covering auth, ordering, and payment-webhook flows
- **Contract tests:** generated OpenAPI client is type-checked against each frontend app in CI — a breaking API change fails the build before it ships
- **E2E tests:** Playwright for web/admin critical paths (browse → cart → checkout), Detox or Maestro for the mobile app's order flow
- **Load testing:** k6 scripted against checkout and menu-read endpoints before major promotions/launches

## 15. Deployment architecture

See [`DEPLOYMENT.md`](DEPLOYMENT.md) for environments, infra-as-code, and the CI/CD pipeline.

## 16. Roadmap

See [`ROADMAP.md`](ROADMAP.md) for the phased build-out from foundations through multi-branch scale.
