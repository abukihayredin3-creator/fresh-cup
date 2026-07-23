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
  redemption/rewards-catalog flow are Phase 10
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
  `PushProvider` interface — currently `ConsolePushProvider`, see Phase 10)
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

## Phase 6 — AI & Business Intelligence Platform ✅

- New `apps/api/src/modules/intelligence` module, purely additive on top of
  Phases 1-5 — no existing endpoint, schema, or frontend page changed
  shape. No Python ML service or training pipeline anywhere in this
  stack: every "model" is a hand-rolled statistical method living
  directly in this module, consistent with the codebase's established
  preference for a dependency-light implementation over a heavy one
  (the self-written RFC 6238 TOTP from Phase 5, the dependency-free CSV
  export, the sandbox-fallback payment/SMS providers)
- **Recommendation Engine**: frequently-bought-together (order
  co-occurrence), similar products (category/tag content matching),
  trending (7-day sales velocity), seasonal/featured picks, upsell/
  cross-sell, and personalized picks — user-based collaborative
  filtering first, falling back to category-affinity and then trending
  when there isn't enough co-purchase signal, so it works for a
  first-time or anonymous customer, not just loyalty members. Public
  endpoints, surfaced in `apps/web` on the menu, product-detail, and
  cart pages
- **Customer Intelligence**: on-demand RFM segmentation (quantile-scored
  against the live customer population), churn risk, predicted LTV,
  purchase frequency, favorite categories, preferred order time/payment
  method, coupon effectiveness, and a read-only Bronze/Silver/Gold
  loyalty tier computed from the Phase 2 accrual ledger (distinct from
  the persisted `loyalty_tier`/redemption flow still deferred to Phase 10)
- **Sales Forecasting**: linear-regression + trailing-average blended
  forecasts for daily/weekly/monthly revenue and order count, hourly
  demand, and per-product demand, with day-of-week seasonal adjustment.
  The one part of Phase 6 that persists anything (`MlModelRun` +
  `ForecastSnapshot`) — versioned, with a nightly `@nestjs/schedule` job
  (the only scheduled infrastructure in the codebase) and an admin
  on-demand "regenerate now" trigger. `actualValue` backfills once a
  forecast period elapses, powering forecast-vs-actual
- **Inventory Intelligence**: extends the Phase 3 predicted-shortage
  logic with waste probability (from the `waste`-reason ledger), expiry
  risk (days-of-supply-on-hand vs. a new `InventoryItem.shelfLifeDays`
  column), and a concrete suggested-reorder quantity/cost
- **Marketing Intelligence**: campaign performance (estimated order-
  volume lift around a send), coupon optimization (redemption rate + AOV
  impact vs. baseline), referral/loyalty program health, and per-RFM-
  segment campaign targeting suggestions — analysis over the existing
  Phase 5 marketing tables, no new send pipeline
- **Executive BI**: one overview endpoint — revenue/profit trend (COGS
  estimated from `RecipeIngredient` costs), product profitability,
  branch comparison, customer growth, peak hours, repeat-customer rate,
  cart-to-order conversion, inventory costs, marketing ROI, and
  forecast-vs-actual — with interactive date-range/branch filtering and
  client-side CSV export, same pattern as Phase 5's analytics pages
- **AI Assistant**: natural-language Q&A over all of the above. Same
  dependency-inverted provider pattern as `ChapaPaymentProvider`: with
  `ANTHROPIC_API_KEY` configured, the Claude API (`claude-opus-4-8`)
  routes questions to tool calls against the real intelligence services
  and phrases the answer from their output; without a key, a
  deterministic keyword router picks the same tools directly. Either
  way it never fabricates a figure — every answer is grounded in a
  logged tool call (`AiAssistantQuery`), and the system prompt says so
  explicitly
- `apps/admin` gained an "Intelligence" nav section (Executive,
  Forecasting, Customer AI, Inventory AI, Marketing AI, Recommendations
  report, AI Assistant chat) built on the existing Phase 5 design system
  (`Card`/`DataTable`/`StatCard`/chart widgets)
- A new `pnpm --filter @fresh-cup/api prisma:demo-data` script (separate
  from `prisma/seed.ts`, which deliberately excludes transactional data)
  generates ~75 days of realistic historical orders so forecasting/RFM/
  recommendations have real signal to compute against in development
- 49 new unit tests across the intelligence services, following the
  existing plain-jest-with-mocked-`PrismaService` convention; full suite
  (197 tests) plus typecheck/lint clean
- **Exit criteria:** an owner or manager can see AI-powered forecasts,
  customer/inventory/marketing insights, and ask the AI assistant
  business questions — all from `apps/admin` alone — and a customer
  sees real, data-driven product recommendations while browsing/
  checking out on `apps/web`, without any of it depending on an
  external ML service or fabricating a number it can't back up

## Phase 7 — Inventory forecasting & multi-supplier sourcing

- Recipe-based auto-deduction and low-stock alerts shipped in Phase 3; the
  supplier/purchase-order workflow gained invoice attachment, partial
  payments, and per-supplier performance analytics in Phase 5. Demand
  forecasting also landed early, twice: Phase 5's
  `GET /admin/inventory/predicted-shortages` (days-until-stockout from a
  trailing-consumption window), then Phase 6's
  `GET /admin/inventory-intelligence` (the same predictor plus waste
  probability, expiry risk, and a concrete suggested-reorder quantity/
  cost) — so what's left is narrower than originally scoped:
  multi-supplier price comparison on a single purchase order, deliberately
  deferred out of Phase 3, 5, and 6 alike
- **Exit criteria:** a purchase order can compare unit cost across more
  than one supplier before it's submitted, instead of committing to a
  single supplier's price up front

## Phase 8 — Analytics at scale

- Phase 3 shipped an on-demand admin dashboard and sales/item/customer
  analytics; Phase 5 added kitchen/delivery analytics, a delivery heatmap
  endpoint, CSV export on every analytics page, and a Reports hub
  (including the audit-log viewer that had no frontend since Phase 3);
  Phase 6 added a further on-demand layer on top (executive BI, RFM
  customer segmentation, marketing analytics) plus the one exception to
  "no materialized data" — `forecast_snapshots`, because a forecast has
  to outlive the day it predicted. Everything else is still on-demand
  queries, no materialized views or cron jobs beyond Phase 6's nightly
  forecast-regeneration job. This phase is about what stops being viable
  once order history grows past what an on-demand query scans
  comfortably: nightly aggregation jobs materializing
  `daily_sales_summary` and `item_performance`, and cohort retention
  analysis
- `apps/admin` analytics views already exist (Phase 5) and Intelligence
  views (Phase 6) would both be extended here to consume the new
  materialized aggregates, not built from scratch
- **Exit criteria:** dashboard queries stay fast regardless of how many
  years of order history exist

## Phase 9 — Scale & hardening

- Load testing (k6) against checkout and menu-read paths
- Read-replica query routing for analytics, connection pooling tuning
- `orders`/`delivery_tracking_pings` partitioning if volume warrants it
- Third-party security audit / penetration test
- Multi-branch activation: onboard a second Fresh Cup location using the existing `branch_id` scoping — a data/config exercise, not a schema migration
- Observability maturity: defined SLOs, on-call alerting, quarterly DR restore drill

## Phase 10 — Loyalty rewards & promotions campaigns

- Loyalty tiers (calculated from the Phase 2 accrual ledger), rewards
  catalog, redemption flow (spend points for a discount/free item) —
  still entirely unbuilt; Phase 5's Marketing module added gift cards,
  referral codes, and generic push/email/SMS campaigns, but not a points
  tier system or a redemption flow. Phase 6 added a read-only
  Bronze/Silver/Gold tier computed on demand for admin-side customer
  intelligence — this phase is the persisted, customer-facing version
  with an actual redemption flow
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

## Phase 11 — Restaurant Intelligence Platform ✅

### Part 1: provider-agnostic LLM/RAG layer

- New `apps/api/src/intelligence/` — a second, sibling AI tree alongside
  Phase 6's `modules/intelligence`, not a replacement or rewrite of it.
  Phase 6 stays exactly as shipped; this phase wraps five of its six
  domains (executive, sales/forecasting, customer, inventory, marketing)
  with explanation + confidence-score framing and adds three domains
  Phase 6 never covered (kitchen, delivery, workforce), built directly
  from existing schema (`Order.preparingAt`/`readyAt`, `Delivery.distanceKm`/
  `pickedUpAt`/`deliveredAt`, `Shift`/`Attendance`/`PerformanceNote`) — no
  new columns needed for any of the three
- **Provider abstraction** — `LlmProvider`, `EmbeddingProvider`,
  `VectorProvider` interfaces, each with a factory reading
  `LLM_PROVIDER`/`EMBEDDING_PROVIDER`/`VECTOR_PROVIDER`:
  - LLM: Anthropic (reuses Phase 6's `@anthropic-ai/sdk` dependency),
    OpenAI/Azure OpenAI/OpenRouter/Ollama (one fetch-based
    OpenAI-compatible client, since all four speak the same
    `/chat/completions` wire format), Gemini (fetch-based), and a
    dependency-free `NullLlmProvider` default
  - Embeddings: OpenAI/Voyage/Cohere (fetch-based), and a dependency-free
    default `LocalEmbeddingProvider` (deterministic hashed bag-of-words
    vector — the embedding equivalent of Phase 6's hand-rolled statistics)
  - Vector: OpenSearch/Pinecone/Qdrant (fetch-based), and a dependency-free
    default `PgVectorProvider` (a new `vector_entries` table, cosine
    similarity computed in application code — no Postgres `pgvector`
    extension required)
  - Every default is zero-external-dependency, so the platform works out
    of the box in dev/CI; switching providers is a config change only,
    same "sandbox fallback" philosophy as `ChapaPaymentProvider`
- **AI Memory** — a new `ai_memory_entries` table records conversations,
  business decisions, recommendations, and accept/reject outcomes, scoped
  by domain; `AiMemoryService` is a no-op when `AI_MEMORY_ENABLED=false`.
  `RagService` embeds + indexes memory entries into the vector store when
  `AI_RAG_ENABLED=true` (off by default — retrieval needs something
  embedded first) and powers semantic recall
- **Guardrails** — `AiSecurityService` refuses questions that ask for API
  keys/passwords/secrets/JWTs/system prompts before they ever reach an
  LLM or tool, and redacts secret-shaped substrings (JWTs, vendor API key
  prefixes, credentialed connection strings, bearer tokens) from every AI
  response via `SecretRedactionInterceptor`. `AiAuthorizationGuard` +
  `@RequireAiAuthorization()` exist as the enforcement point for a future
  action-taking endpoint — no endpoint in this phase performs an
  irreversible action, since every domain method only forecasts,
  recommends, summarizes, or explains
- **`AgentRunnerService`** — a provider-agnostic version of Phase 6's
  hand-written Anthropic tool-use loop, driving any `LlmProvider` through
  a flattened, vendor-neutral message format each provider translates
  to/from its own wire shape
- **8 AI domains**, each returning `AiInsightDto` (title + explanation +
  confidence score + the raw data behind it, per this phase's Core
  Principles): Executive, Sales, Customer, Inventory, and Marketing AI
  wrap the matching Phase 6 service; Kitchen AI (prep bottlenecks, station
  workload, prep-time anomalies), Delivery AI (ETA prediction from fleet
  average speed, delay detection, zone/driver metrics), and Workforce AI
  (scheduling coverage vs. order volume, attendance no-show/late
  detection, performance trend, labor **coverage** efficiency — not a
  cost figure, since the schema has no wage column and Core Principle 1
  rules out inventing one) are net-new
- **`AssistantAiService`** — a second, provider-agnostic chat surface
  (`POST /admin/ai/assistant/ask`) proving the LLM abstraction end to end,
  routing through tools that delegate to the domain AI services above.
  Separate from, and doesn't touch, Phase 6's Claude-only
  `AiAssistantService`
- **`AiDailyDigestScheduler`** — nightly (3 AM, after Phase 6's 2 AM
  forecast-regeneration job) executive daily-summary per branch plus the
  embedding-backfill worker, which indexes any memory entries written
  before `AI_RAG_ENABLED` was turned on
- 123 new unit/provider-mocking/prompt-validation/confidence-scoring tests
  (26 suites) alongside Phase 6's 49 and the rest of the existing suite;
  323 tests total, plus typecheck/lint clean and a full Nest app boot
  (`app.init()`) verifying every new provider/service resolves in the DI
  graph
- Scaffolding only in this part — no `apps/admin` UI yet (Phase 6's
  "Intelligence" nav section is unchanged), and each of the 8 domains
  implements its headline methods rather than every bullet a full-featured
  version might eventually cover
- **Exit criteria (Part 1):** the intelligence module is scaffolded, the
  three provider abstractions are defined and swappable via config, the 8
  AI domains are organized and callable end-to-end against real Prisma
  data, configuration is documented, and the full existing test suite —
  Phases 1–6 included — still passes untouched

### Part 2: Predictive Intelligence Platform

- Nine new subtrees under `apps/api/src/intelligence/` — `features/`,
  `registry/`, `models/`, `evaluation/`, `calibration/`, `drift/`,
  `segmentation/`, `prediction/`, `training/` — plus a `forecasting/`
  facade, none of them touching Part 1's or Phase 6's files except two
  purely additive edits: `IntelligenceModule` already exported its
  services for Part 1 to consume, and `AiIntelligenceModule`'s
  controller/provider arrays gained new entries alongside the existing
  ones
- **Feature Store** (`features/FeatureStoreService`) — one place computes
  customer (visit frequency, AOV, days since last visit, favorite-category
  count, loyalty level), sales (weekday/month/holiday flag/a documented
  `weatherPlaceholder: null`/active-promotions count), inventory
  (consumption trend slope, supplier lead time, waste %), kitchen (avg
  prep time, station load), delivery (avg ETA, driver utilization), and
  marketing (coupon usage rate, referral conversion, campaign ROI)
  features — delegating to Phase 6/Part 1 services wherever they already
  compute the number, querying Prisma directly only for numbers no
  existing service exposes (e.g. the consumption-trend slope)
- **Model Registry v2** (`registry/ModelRegistryV2Service`, a new
  `predictive_model_runs` table) — distinct from Phase 6's
  forecast-only `MlModelRun`: auto-incrementing version per `modelKey`,
  a `PredictiveModelStage` lifecycle (Experimental → Staging →
  Production → Archived, promoting to Production auto-archives the
  previous one), and dataset lineage (hash/version/sample count/feature
  schema) every run records
- **Explainable predictions** (`prediction/CustomerPredictionService`) —
  8 models (lifetime value, repeat-purchase probability, churn, upsell,
  cross-sell, coupon response, referral probability, satisfaction), each
  returning a `PredictionResultDto` (`prediction`, calibrated
  `confidence`, `topReasons`, `contributingFactors`, `suggestedAction`) —
  never an unexplained number. Lifetime value reuses Phase 6's real LTV
  formula directly; the other 7 share one hand-tuned, documented
  weighted-feature scoring pipeline (`models/feature-scoring.util.ts`:
  dot product through a sigmoid — the same "no Python ML service"
  transparency as Phase 6's hand-rolled statistics, not a claim of
  gradient-descent-fit coefficients) so every "top reason" falls out of
  the same computation that produced the score
- **Forecasting facade** (`forecasting/ForecastingFacadeService`) — wraps
  Phase 6's `ForecastingService` and Part 1's `SalesAiService` into the
  same `PredictionResultDto` shape (hourly/daily/weekly/monthly sales,
  revenue, transactions, average ticket, best sellers); `categoryTrends`
  is the one genuinely new capability, grouping Phase 6's per-product
  demand forecast by menu category
- **Confidence calibration** (`calibration/ConfidenceCalibratorService`)
  — a reliability-diagram-based calibrator: `normalize()` clamps any raw
  score into [0.05, 0.95]; `calibrate()` replaces a raw score with its
  bin's empirical actual-rate once enough (predicted, actual) history
  exists (`evaluation/metrics.util.ts`'s `calibrationCurve`);
  `rejectLowConfidence()` filters recommendations below a threshold
  rather than ever pushing a low-confidence guess
- **Drift detection** (`drift/DriftDetectionService`, a new
  `drift_alerts` table) — Population Stability Index (hand-rolled,
  dependency-free) for feature drift and prediction drift; relative
  volume change for data drift; accuracy drop for concept drift.
  Persists an alert (with severity) only when a shift crosses the
  standard PSI significance thresholds — surfaced at `GET /admin/ai/drift`
- **Evaluation metrics** (`evaluation/metrics.util.ts`) — precision,
  recall, F1, ROC AUC (via the Mann-Whitney U statistic — no threshold
  sweep needed), MAPE, RMSE, MAE, confusion matrix, and the calibration
  curve calibration itself is built from — every metric hand-rolled and
  dependency-free, same convention as everything else in this module
- **Automatic retraining** (`training/RetrainingService` +
  `RetrainingScheduler`, nightly at 4 AM — after Phase 6's 2 AM forecast
  job and Part 1's 3 AM digest) — triggers on unresolved drift alerts, a
  new-orders-since-last-training threshold, or a manual request; for
  `sales-*` models it also calls Phase 6's
  `ForecastingService.regenerateAll()` (reused, not reimplemented); every
  retrain — including the hand-weighted customer models, which don't
  refit coefficients — records a new versioned registry row with a fresh
  dataset hash/version/sample count, so "what data was this validated
  against" is always answerable
- **Configurable customer segmentation** (`segmentation/`) — a
  `ClusteringStrategy` interface with two implementations: `rule-based`
  (default, deterministic RFM-threshold rules) and `kmeans` (a genuine,
  deterministically-seeded Lloyd's-algorithm implementation over
  normalized recency/frequency/monetary features — no RNG, so the same
  input always clusters the same way). Both map to a different 7-label
  taxonomy than Phase 6's own RFM segments (High Value/VIP/Occasional/
  New/Dormant/At Risk/Lost vs. Phase 6's Champions/Loyal/New/At Risk/Need
  Attention/Lost) since they answer a different question — this is
  additive, not a replacement
- **New AI API surfaces** — `/admin/ai/predictions`, `/admin/ai/forecast`,
  `/admin/ai/models`, `/admin/ai/retrain` (admin-only — it does real work
  and writes a registry version), `/admin/ai/drift`, and
  `/admin/ai/segmentation`, alongside Part 1's existing
  `/admin/ai/{executive,sales,customer,inventory,kitchen,delivery,
marketing,workforce,memory,assistant}` routes, all untouched — Part 2's
  spec also lists `/ai/customers`, `/ai/sales`, `/ai/inventory`,
  `/ai/workforce`, `/ai/delivery`, `/ai/marketing`, which Part 1 already
  built; Part 2 doesn't duplicate them
- 195 new tests (43 suites) covering the feature store, registry,
  scoring/evaluation utilities, calibration, drift detection, both
  clustering strategies, all 8 predictions, the forecast facade, and the
  retraining pipeline/scheduler — 419 tests total across the whole API
  suite, typecheck/lint clean, and a full Nest app boot verifying every
  new provider resolves in the DI graph
- No `apps/admin` UI changes in the backend checkpoint above — see the
  "Predictive Intelligence" admin dashboard tab shipped alongside this
  section
- **Exit criteria (Part 2):** the feature store, model registry, 8
  explainable predictions, unified forecasting facade, configurable
  segmentation, calibration, drift detection, and automatic retraining
  are all implemented and exercised by real Prisma data; every prediction
  is confidence-scored and explained; the admin dashboard surfaces model
  status/versions/drift alerts/predictions; the full test suite —
  Phases 1–6 and Phase 11 Part 1 included — still passes untouched

### Part 3: Autonomous Restaurant Intelligence Platform

- Ten new subtrees under `apps/api/src/intelligence/` —
  `approvals/`, `agents/`, `decision-engine/`, `copilot/`, `knowledge-base/`,
  `workflows/`, `simulator/`, `evaluation-tracker/`, `governance/`,
  `websockets/` — plus extensions to Part 1's `memory/`, `rag/`, `vector/`,
  and `scheduler/` directories. None of Part 1's or Part 2's files were
  rewritten; every addition either wraps an existing service or extends an
  existing interface with an optional parameter.
- **Human Approval Layer** (`approvals/`, new `ai_approval_requests` table)
  — every irreversible or high-risk AI-suggested action (refund, discount,
  promotion, coupon, price change, purchase order, staffing change) is
  written as a `PENDING` `AiApprovalRequest`, never executed directly.
  `ApprovalExecutorRegistry` maps action types to real service calls
  (`PurchaseOrdersService`, `CouponsService`, `CampaignsService`,
  `MenuItemsService`, `PaymentsService`) for the action types where a safe
  generic executor exists; `DELETE`/`STAFFING_CHANGE`/`OTHER` intentionally
  have no automatic executor — payload shapes vary too much to generalize
  safely, so approving those just records the human decision. Only
  `POST /admin/ai/approvals/:id/approve` (admin-only) executes anything.
- **AI Governance policy engine** (`governance/PolicyEngineService`) sits
  in front of every approval request — `blocked: true` throws before a
  request row is ever created; `escalateTo` can raise a request's risk
  level. `PromptRegistryService` fingerprints (FNV-1a, reusing Part 2's
  `hashDataset` utility) every domain's system prompt as it exists in code
  right now — prompts are static TypeScript, not rows in an editable CMS,
  so "prompt history" means "what's live plus a hash that changes the
  moment the code does," not a version-diff UI. "Model history" and
  "approval history" deliberately reuse Part 2's `/admin/ai/models` and
  this part's `/admin/ai/approvals` rather than duplicating read surfaces.
- **Multi-Agent AI** (`agents/`) — 8 `DomainAgent` implementations (Sales,
  Marketing, Inventory, Kitchen, Delivery, Finance, HR, Executive), each a
  thin wrapper over one or two existing Part 1 domain AI methods.
  `CoordinatorAgentService` routes a natural-language question to the
  agents whose keywords overlap it (falling back to the Executive agent),
  runs them in parallel, and synthesizes their insights into one ranked,
  confidence-averaged answer — surfaced at `POST /admin/ai/agents/ask`.
- **Autonomous Decision Engine** (`decision-engine/`) — `detectSalesDrop()`
  compares two trailing 7-day windows via Part 1's `ExecutiveService`;
  once a drop crosses a 10% threshold it builds `DecisionReason[]` from
  real signals only (revenue trend slope, order-count/foot-traffic drop,
  recently-expired coupons) — there is no weather signal anywhere in this
  platform, so "Rain" from the phase brief's worked example is never
  fabricated; an "Undetermined" reason with low confidence is used instead
  when no real signal explains the drop. `buildRecommendations()` can
  optionally draft the top two recommendations straight into the Approval
  Layer.
- **Executive Copilot** (`copilot/`) — `CopilotService.ask()` runs a real
  five-step trace (collect via the coordinator agents → analyze/compare
  via the decision engine → forecast via Part 2's forecasting facade →
  explain via Part 1's `ExplanationService` → recommend) and returns every
  step's timing and summary alongside the final answer, so "how did the
  AI get there" is always inspectable. Exports to real CSV (opens in
  Excel), a real Markdown briefing document, and a real JSON slide-outline
  structure — not rendered binary PDF/PPTX, a deliberate choice to avoid
  adding new heavy dependencies to a platform that has none.
- **Restaurant Memory + long-term learning** (`memory/` extensions,
  `scheduler/LearningDigestScheduler`) — nine new `AiMemoryKind`s (customer
  preferences, manager feedback, campaign history, supplier issues,
  inventory failures, holiday demand, branch behavior, staff performance,
  learning digests) and a `ConversationMemoryService` for recent-turn
  recall. Weekly/monthly/seasonal/yearly cron jobs write summarized
  `LEARNING_DIGEST` memory entries from real overview + explanation data —
  this is memory accumulation, not model retraining, which Part 2's
  `RetrainingService` already owns.
- **Vector search upgrade** (`rag/`, `vector/`) — `hybridRetrieve()` blends
  semantic retrieval with a Postgres `ILIKE` keyword match, weighted and
  re-ranked; this degrades gracefully to vector-only when a remote
  provider (OpenSearch/Pinecone/Qdrant) is configured, since those
  providers' own storage isn't visible to the local `VectorEntry` table.
  `VectorProvider.query()` gained an optional metadata `filter` parameter,
  genuinely implemented for the default `PgVectorProvider` (Prisma JSON-path
  filtering) and best-effort passed through to the three remote providers.
- **AI Knowledge Base** (`knowledge-base/`, new `ai_knowledge_documents`
  table) — stores and indexes plain-text/Markdown content for policies,
  recipes, training manuals, food safety, HR policy, supplier agreements,
  and architecture/API docs; a `sourceFormat` field records what the
  original document was (Markdown/plain text/PDF/DOCX/image) for a future
  binary-parsing pipeline this phase does not ship — no OCR or PDF/DOCX
  parsing, a documented scope boundary rather than a silent gap.
- **AI Workflow Engine + Automation** (`workflows/`) — rather than a
  generic if/then interpreter (a materially riskier project than the rest
  of this hand-rolled platform takes on), this phase ships one fully
  executed, real workflow: detect low stock → check for an active supplier
  → draft a purchase order into the Approval Layer → log a notify-manager
  step → log a track-approval step noting that receiving inventory and
  updating stock reuse the existing Phase 3 purchasing flow once approved,
  rather than reimplementing it. Every run persists as an `AiWorkflowRun`
  with a full step log. `AutomationService` drafts marketing
  campaign/coupon/promotion suggestions (with real executors) and kitchen/
  delivery/employee-staffing suggestions (`STAFFING_CHANGE`, no automatic
  executor — the draft's value is surfacing the suggestion in one inbox,
  not auto-editing a shift) from each domain AI service's top insight.
  Automatic forecast regeneration was already covered by Part 2's nightly
  retraining job — no new mechanism was needed for it.
- **Scenario Simulator + Digital Twin** (`simulator/`) — a documented
  heuristic elasticity model (named constants for price/promotion
  elasticity, staffing throughput, labor cost share, profit sensitivity —
  not fit from real price-change history, since none exists) projects
  "what if" outcomes with an intentionally low, hardcoded confidence and an
  `assumptions` array stating the exact formula used. `DigitalTwinService`
  layers a linear-ramp daily timeline on top of the same simulation;
  neither service ever writes to Prisma — "without touching production" is
  enforced by what the code never imports, not by a runtime guard.
- **Continuous Evaluation** (`evaluation-tracker/`, new
  `ai_evaluation_records` and `ai_recommendation_outcomes` tables) — logs
  accuracy/precision/recall/latency per model, computes recommendation
  acceptance rate and business impact (estimated vs. actual, summed over
  accepted outcomes). Hallucination flagging is a manual admin action, not
  an automatic detector — this platform has no ground-truth signal to
  detect a fabricated claim, a documented gap rather than an oversight.
- **WebSocket streaming** (`websockets/CopilotGateway`, `/ws/ai-copilot`)
  — mirrors the existing `OrdersGateway`'s JWT-in-handshake pattern and
  streams real per-step `copilot.step` events as the Copilot's five-step
  trace executes, followed by `copilot.done`. This is step-level
  streaming, not token-level LLM streaming — no `LlmProvider` in this
  platform exposes a streaming completion API yet.
- **New AI API surfaces** — `/admin/ai/approvals`, `/admin/ai/agents`,
  `/admin/ai/decision-engine`, `/admin/ai/copilot` (plus CSV/briefing/
  slides export routes), `/admin/ai/knowledge`, `/admin/ai/workflows`,
  `/admin/ai/automation`, `/admin/ai/simulator`, `/admin/ai/evaluations`,
  `/admin/ai/governance`, alongside every Part 1/Part 2 route, untouched.
- **`apps/admin` AI Studio** — a new `/ai-studio` section with six tabs
  (Agents & Copilot, Approvals, Knowledge, Workflows & Automation,
  Simulator, Evaluations & Governance) — a deliberate consolidation of the
  phase brief's longer list (Memory and Prompts folded into Evaluations &
  Governance; Models reuses Part 2's existing Predictive Intelligence tab
  rather than duplicating it).
- 120 new tests alongside Parts 1–2's 419, bringing the API suite to 539
  tests; typecheck/lint clean across the whole monorepo, a full Nest app
  boot verifying every new provider/service/gateway/worker resolves in the
  DI graph, and a clean `apps/admin` production build including all six
  new AI Studio routes.
- **Exit criteria (Part 3):** multi-agent AI is operational and routes
  real questions; the Executive Copilot produces a full, exportable action
  plan with an inspectable reasoning trace; AI memory and the knowledge
  base are queryable via hybrid search; workflow automation and the six
  automation drafts write into a single approval inbox; the scenario
  simulator and digital twin run without touching production; every
  prediction and recommendation across Parts 1–3 remains confidence-scored
  and explained; the human approval workflow is the only path to executing
  a high-risk action; AI Studio ships in `apps/admin`; the full test
  suite — Phases 1–6 and Phase 11 Parts 1–2 included — still passes
  untouched.

## Phase 12 — Enterprise & Global Restaurant Platform ✅

Numbered 12 (not 8) deliberately — "Phase 8 — Analytics at scale" above is
a distinct, still-unbuilt future phase (materialized aggregation views,
cohort retention) that this phase does not touch or supersede. This phase
was built under the working name "Phase 8" in its own planning session,
same as Phase 11 was originally scoped before Phases 7–10; see
Sequencing notes below for why it jumped the queue.

### Part 1: Enterprise Foundation

- New `apps/api/src/enterprise/` — a sibling tree to `modules/` and
  `intelligence/`, additive rather than a retrofit: `Organization` sits
  above the existing `Branch` model as the tenant root. `Branch.organizationId`
  is a required (non-nullable) FK — the migration hand-sequences a
  backfill (create a default org, assign every pre-existing branch to
  it, then add the NOT NULL constraint) so tenant scoping is real from
  row one, not an opt-in nullable column
- New models: `Organization`, `Region`, `Franchise`, `BranchGroup` +
  `BranchGroupMembership`, `OrganizationMembership` (a second,
  additive `OrgRole` axis — `ORG_OWNER`/`ORG_ADMIN`/`FRANCHISE_ADMIN`/
  `REGION_MANAGER` — layered on top of the existing branch-scoped
  `UserRole`, not a replacement), `FeatureFlagDefinition` +
  `FeatureFlagOverride` (percentage rollout via the same FNV-1a hash
  utility Phase 11 Part 2 built for dataset hashing — deterministic per
  entity, not randomized per request), `SubscriptionPlan` +
  `OrganizationSubscription`, `GlobalConfigEntry`
- `TenantContextService`/`TenantContextGuard` resolve `organizationId`
  from the caller's branch (the common case) or `OrganizationMembership`
  for branch-less org-level users, attaching it to `request.organizationId`
  for a `@CurrentOrganization()` decorator — the first real use of
  NestJS's `@UseGuards()` in this codebase (applied explicitly per
  controller, not globally like `JwtAuthGuard`/`RolesGuard`)
- A tenant onboarding wizard walks org creation → first branch → admin
  invite in one guided flow
- **Exit criteria (Part 1):** every branch belongs to exactly one
  organization; an org-level admin can manage regions/franchises/branch
  groups without branch-level access; feature flags support percentage
  rollouts; a new organization can complete onboarding end-to-end.

### Part 2: Enterprise Security

- **SSO** — one `SsoOidcProvider` drives all four OIDC-family providers
  (Google Workspace/Microsoft Entra ID/Okta/generic OIDC, since they
  differ only by issuer): real `.well-known/openid-configuration`
  discovery, real authorization-code exchange, and real RS256
  `id_token` verification via Node's native `crypto.createPublicKey`/
  `createVerify` — no hand-rolled RSA math. `SsoSamlProvider` builds a
  real SAML 2.0 AuthnRequest and parses a real Response's `NameID`/
  attributes, but **does not verify the XML-DSig signature** — a
  documented gap (hand-rolling XML canonicalization is a well-known way
  to introduce signature-wrapping vulnerabilities): every SAML identity
  carries `signatureVerified: false` and the callback throws unless
  `ENTERPRISE_SSO_SAML_ALLOW_UNVERIFIED=true` is explicitly set, with an
  exception message warning against production use. Stateless
  HMAC-signed SSO state (no DB row) binds connection+nonce+timestamp.
- **SCIM 2.0** — a functional subset, not the full RFC: static
  bearer-token auth (`ScimAuthGuard`, hashed token — the SCIM analogue
  of `JwtAuthGuard`), `PATCH` understands only `replace` on `active`
  (the overwhelmingly common real case — offboarding), `DELETE`
  deactivates rather than hard-deletes (FK dependencies).
- **WebAuthn** — genuine cryptographic verification built from scratch:
  a minimal CBOR decoder, a COSE_Key → Node `KeyObject` parser (EC2/P-256
  via a fixed DER SPKI prefix wrapping the raw point, verified against
  RFC 5480; RSA via Node's JWK importer), an `authenticatorData` parser,
  real registration + assertion verification
  (`crypto.verify("sha256", ...)`) with signCount-based clone/replay
  detection. Framed as step-up MFA for an already-authenticated session,
  not passwordless primary login — sidesteps needing a "who is this for"
  identity lookup before authentication exists. Does not verify the
  attestation statement/certificate chain — a commonly-skipped optional
  trust layer, documented rather than silently absent. Proven by a real
  end-to-end test using `generateKeyPairSync` + hand-written CBOR
  encoders mirroring the decoder.
- **IP allowlisting** (hand-rolled IPv4/IPv6 CIDR matching — safe to
  hand-roll since it's pure integer arithmetic, unlike XML/CBOR
  parsing) and **device trust** (`TrustedDevice.fingerprintHash` stores
  only a SHA-256 hash, never the raw fingerprint) enforced in
  `TenantContextGuard` — the natural single point every enterprise
  request already passes through.
- **Org-wide session oversight** reuses the existing `RefreshToken`
  table directly (a session IS a refresh token) rather than a parallel
  session table, adding the cross-user org-scoped view distinct from
  Phase 5's self-service `/security/sessions`.
- **Hash-chained enterprise audit trail** — each row's hash covers the
  previous row's hash, so `verifyChain()` can detect any row altered or
  deleted after the fact. Distinct from Phase 3's general `AuditLog`
  (admin CRUD mutations everywhere) — this one is scoped to
  SSO/SCIM/WebAuthn/security events.
- **Exit criteria (Part 2):** an org can configure Google Workspace/
  Entra ID/Okta/SAML SSO and SCIM-provision users; a user can register
  and assert a hardware security key as step-up MFA; IP allowlists and
  device trust are enforced at the tenant-context boundary; the
  enterprise audit trail is tamper-evident.

### Part 3: Global Operations

- **Multi-currency** — `Currency` (global ISO 4217 registry) +
  `ExchangeRate` (org-scoped, admin-maintained — explicitly not a live
  FX-feed integration); `CurrencyService.convert()` looks up a rate
  direct or inverted.
- **Tax engine** — `TaxRule` (country/region/menu-category scoped,
  explicitly not a live tax-jurisdiction API); `TaxEngineService.calculateTax()`
  picks the most specific matching rule (menu-category beats region
  beats country-wide default) and handles both VAT-style
  price-inclusive and US-style price-exclusive modes.
- **Locale/timezone resolution** — `LocalizationService` layers
  Part 1's existing `Organization.defaultLocale`/`timezone` and
  `Region.timezone`/`countryCode` fields rather than adding new
  translation content; `packages/i18n`'s en/am dictionaries (Phase 4)
  remain the source of translated strings.
- **Regional pricing** — `RegionalPriceOverride` overrides a
  `MenuItem.basePrice` per region; **local payment methods** —
  `LocalPaymentMethodConfig` is a per-country registry over the
  _existing_ `PaymentMethod` enum and `PaymentProvider` abstraction
  (Chapa/Cash), not a new payment-provider implementation.
- **Receipt templates** — `ReceiptTemplate` (legal footer, tax-breakdown
  visibility, VAT number, date format per country) with a built-in
  default fallback so a receipt can always render.
- **Exit criteria (Part 3):** an org can convert between currencies and
  compute tax using its own configured rates/rules without hard-coding
  Ethiopia-only assumptions; a region can carry its own menu pricing and
  offer country-appropriate payment methods; receipts render with
  country-appropriate formatting.

### Part 4: Enterprise Analytics

- **Corporate/franchise/region/branch-group revenue rollups** and a
  **cross-region breakdown** (with an "Unassigned" bucket) — all
  aggregate the existing `Order` table via a single `groupBy` query per
  rollup, using the same `PAID_STATUSES` "counts as revenue" convention
  as `modules/analytics/analytics.service.ts`. This is a genuinely new
  capability: Phase 5/6's `AnalyticsService`/`ExecutiveService` are
  actor-branch-scoped at most, nothing before this phase aggregates
  across an entire organization.
- **Branch benchmarking** (rank + percent vs. the org average) and an
  **executive scorecard** (current vs. the immediately prior period of
  equal length, revenue growth %, top/bottom branch).
- **Forecast aggregation** sums Phase 11 Part 2's per-branch
  `ForecastingFacadeService.revenue()` prediction across a branch set —
  never recomputes a forecast, only aggregates existing ones (confidence
  is averaged, not summed, since it's a 0–1 calibrated score).
- **CSV BI exports** for the corporate dashboard, benchmark, and
  scorecard — same hand-rolled CSV convention as Phase 11 Part 3's
  copilot exports (no PDF/XLSX library).
- **Exit criteria (Part 4):** a corporate admin can see revenue rolled
  up across the whole org, by franchise, by region, or by branch group;
  rank branches against the org average; see period-over-period growth;
  and export any of these as CSV.

### Part 5: Reliability & Infrastructure

- **App-level observability** — a new `common/observability/` module:
  `RequestContextService` (AsyncLocalStorage-based traceId, generated or
  propagated from an inbound `x-trace-id` header) reaches every log line
  and the response; `JsonLoggerService` emits JSON-lines to stdout (the
  format log aggregators expect, hand-rolled since it's a small,
  well-defined transform); `MetricsService`/`HttpMetricsInterceptor`
  expose `/metrics` via `prom-client` (a small, purpose-built new
  dependency — the Prometheus exposition format has real edge cases a
  hand-rolled writer doesn't cover well). Documented as correlation-ID
  tracing, not full OpenTelemetry span auto-instrumentation — wiring
  `@opentelemetry/sdk-node` is a large new dependency tree left as
  deliberate future work.
- **Kubernetes** (`infra/k8s/`) — `Deployment`/`Service`/
  `HorizontalPodAutoscaler`/`PodDisruptionBudget`/`Ingress` for
  `apps/api`, probes wired to the existing Phase 1 `/health`
  (liveness) and `/health/ready` (readiness, checks Postgres+Redis).
- **Blue/green** — two `Deployment`s (`api-blue`/`api-green`) + a
  `switch.sh` script flipping the `Service` selector — the standard
  vanilla-Kubernetes approach, not Argo Rollouts/Flagger. **Canary** —
  ingress-nginx's `canary-weight` annotation for real weighted traffic
  splitting, not a replica-count approximation.
- **CI/CD** (`.github/workflows/fresh-cup-deploy.yml`) — build/push →
  canary deploy → a manual soak-gate GitHub Environment → promote to
  stable, gated on a version tag or manual dispatch (no live cluster
  wired to this repo's secrets in this environment).
- **Disaster recovery** (`infra/backup/`) — nightly `pg_dump` to
  S3-compatible storage with retention pruning, and a **weekly automated
  restore test** that restores the latest archive into a disposable
  database and verifies it before dropping it — a backup nobody has
  restored is not a verified backup. RPO ≤24h, RTO ≤1h; full runbook in
  `infra/backup/README.md`.
- **Metrics, alerting, and log aggregation** (`infra/observability/`) —
  a Prometheus scrape config keyed off the Deployments'
  `prometheus.io/scrape` annotations, a `PrometheusRule` (error rate,
  p95 latency, crash-looping, degraded health dependencies, HPA
  saturation, failed restore test), an OpenTelemetry Collector config
  bridging the app's traceId-correlated JSON logs, and a Fluent Bit →
  Loki config.
- **Exit criteria (Part 5):** `apps/api` exposes `/metrics` and
  traceId-correlated structured logs; valid, reviewed Kubernetes
  manifests exist for steady-state, blue/green, and canary deployment;
  a documented, scriptable deploy pipeline exists; backups run nightly
  and are proven restorable weekly; alert rules exist for the failure
  modes that matter. None of the Kubernetes/CI-CD/backup infrastructure
  has a live cluster to run against in this environment — manifests and
  scripts are valid and reviewed, not exercised end-to-end.

### apps/admin: Enterprise section

- A new `/enterprise` nav section (Organization, Regions, Franchises,
  Feature Flags, Licensing, SSO & Security, Currency & Tax, Analytics) —
  `packages/types/admin/enterprise.ts` mirrors the backend DTOs, a new
  `AdminEnterpriseResource` in `packages/api-client` calls the
  `enterprise/*` routes (most need no explicit `organizationId` —
  `TenantContextGuard` resolves it from the caller), and eight pages
  follow the existing AI Studio section's layout+Tabs+TanStack-Query
  pattern.

179 new tests alongside the existing 539, bringing the API suite to 718
tests; typecheck/lint clean across the whole monorepo, a full Nest app
boot verifying every new provider/service/guard/interceptor resolves in
the DI graph (this is what caught a genuine circular-module-dependency
bug — `IpAllowlistModule` importing a controller that depended on
`TenancyModule`, which imported `IpAllowlistModule` back — that neither
`tsc` nor Jest could catch, since both only exercise classes with mocked
dependencies), and a clean `apps/admin` production build including all
eight new Enterprise routes.

- **Exit criteria (Phase 12):** a platform operator can create a new
  tenant organization, configure SSO/SCIM/WebAuthn for it, configure its
  currency/tax/regional-pricing rules, see revenue rolled up across its
  branches/regions/franchises, and deploy `apps/api` via a documented
  Kubernetes + blue/green/canary + CI/CD + disaster-recovery pipeline —
  all without touching any existing Phase 1–11 endpoint or table.

## Phase 13 — AI Restaurant Operating System ✅ (Tasks 1–2)

Numbered 13 (not 9) deliberately — "Phase 9 — Scale & hardening" above is a
distinct, still-unbuilt future phase (load testing, read replicas,
partitioning) that this phase does not touch or supersede. This phase was
scoped and built under the working name "Phase 9" in its own planning
session, same as Phase 12 was originally scoped as "Phase 8" before Phases
7–10; see Sequencing notes below for why it jumped the queue. This is Task
1 of a larger, still-open Phase 13 plan — later tasks are expected to add
real LLM/ML/agent capability behind the interfaces this task establishes.

### Task 1: AI Restaurant Brain Core

- New `apps/api/src/modules/ai-brain/` — a self-contained, org/branch-scoped
  memory -> reasoning -> prediction -> recommendation -> decision ->
  learning loop, deliberately separate from the existing intelligence trees
  (Phase 6's `modules/intelligence`, Phase 11 Parts 1–3's `intelligence/`,
  Phase 12 Part 4's `enterprise/analytics`) — those are untouched; this is a
  simpler, deliberately rule-based/statistical foundation, not a
  replacement
- New models: `AiInsight`, `AiMemory`, `AiRecommendation`, `AiDecision`,
  `AiLearningEvent` (+ `AiInsightType`/`AiRecommendationStatus`/`AiPriority`
  enums) — named with the codebase's established `Ai` prefix (matching
  Phase 11's `AiMemoryEntry`/`AiApprovalRequest`) rather than the literal
  `AI` casing from planning; `AiMemory` and `AiLearningEvent` are
  deliberately distinct from Phase 11's `AiMemoryEntry` (RAG-backed
  conversational memory) and `AiRecommendationOutcome` (the intelligence/
  tree's own outcome tracking) — same concept, different, non-overlapping
  data
- **Memory Engine** (`MemoryEngineService`): stores/retrieves business
  events and AI observations, org-scoped with optional branch scope, ranked
  by importance
- **Reasoning Engine** (`ReasoningEngineService`): analyzes real
  sales/inventory/customer/operational data into `{problem, causes[],
confidence, evidence[]}` — trailing-window revenue/order-count
  comparisons, low-stock counts against `InventoryItem.reorderThreshold`,
  distinct-customer/repeat-rate trends, and recall of the Memory Engine's
  own high-importance entries; every cause is computed from live Prisma
  aggregates, never hardcoded (see "AI design principles" below). Genuine
  anomalies get written back to the Memory Engine, closing the loop
- **Prediction Engine** (`PredictionEngineService` implementing
  `PredictionProvider`): trailing-average + linear-trend forecasting over
  real `Order`/`InventoryTransaction` data for sales, inventory demand, and
  customer demand — the same provider-interface-plus-swappable-
  implementation pattern as Phase 11 Part 1's `LlmProvider`, so a real ML
  model can replace it later without any caller changing
- **Recommendation Engine** (`RecommendationEngineService`): turns the
  Reasoning Engine's structured `signals` (not its prose `causes`, so a
  wording change can't silently break this) into ranked, explainable
  recommendations with title/impact/confidence/priority
- **Decision Engine** (`DecisionEngineService`): combines the Prediction
  Engine's next-day sales forecast with the Reasoning Engine's
  trailing-week baseline to flag genuine demand swings, folds in every
  ranked recommendation, and persists the combined, priority-sorted list as
  executive actions
- **Learning Engine** (`LearningEngineService`): records the outcome of a
  recommendation and advances its status (`PENDING` ->
  `ACCEPTED`/`REJECTED`/`IMPLEMENTED`) when the feedback names one — the
  feedback loop future ML/agent engines will train against
- `GET /ai-brain/status`, `GET /ai-brain/memory`, `POST /ai-brain/analyze`,
  `POST /ai-brain/recommend`, `POST /ai-brain/decision`,
  `POST /ai-brain/learning` — all behind `TenantContextGuard` (never a
  client-supplied organization id) and `@Roles(MANAGER, ADMIN)`; mutating
  endpoints are `@Auditable`
- **AI design principles:** Task 1 is rule-based intelligence and
  structured reasoning, not a trained model wearing an AI label — every
  number in a cause, recommendation, or decision comes from a real Prisma
  aggregate over this organization's own history. The Prediction Engine's
  provider-interface split is what leaves room for a real LLM/ML/agent
  phase later without rewriting the Reasoning/Recommendation/Decision
  engines that consume it
- **Exit criteria (Task 1):** an organization's own sales/inventory/customer
  data drives a real reasoning trace, a real forecast, and a ranked
  recommendation/decision list, end to end, with tenant isolation enforced
  at both the request-branch level (`AiBrainTenantScopeService` verifies a
  supplied `branchId` belongs to the caller's organization) and the query
  level (every read/write is scoped by `organizationId`)

46 new unit tests (memory/prediction/reasoning/recommendation/decision/
learning engines, the trend-statistics utility, and the status aggregator)
plus 8 e2e tests (tenant isolation across `x-organization-id` overrides,
cross-org branch/recommendation ids, and role gating) — bringing the API
suite to 764 unit + 146 e2e tests; typecheck/lint clean, a full Nest app
boot verifying the new module resolves in the DI graph (which caught a
real bug: `TenantContextGuard`'s `IpAllowlistService` dependency needs
`IpAllowlistModule` imported directly alongside `TenancyModule`, not just
transitively — the same class of DI-graph gap Phase 12's boot test caught
for `IpAllowlistModule` itself).

### Task 2: AI CEO Copilot

- New `apps/api/src/modules/ai-copilot/` — a thin aggregation/scoring
  layer over Task 1's AI Brain engines and the pre-existing
  `ExecutiveService`/`InventoryIntelligenceService` (Phase 8 Part 4).
  Every service docblocks exactly what it reuses vs. what it computes
  fresh; nothing here recomputes revenue, profit, COGS, marketing ROI, or
  stockout predictions — those numbers all come from the services that
  already own them
- New models: `ExecutiveBriefing`, `BusinessHealthSnapshot`,
  `ExecutiveAlert`, `ExecutiveSummary` (+ `HealthTrend`/
  `ExecutiveAlertStatus` enums, reusing Task 1's `AiPriority` rather than
  a duplicate priority enum) — historical snapshots, not upserted, so a
  past briefing or health check reads exactly as it did that day
- **`AiCopilotScopeService`**: the shared tenant/branch-scoping gate every
  other service in this module calls first. Combines the real tenant
  isolation `AiBrainTenantScopeService` (Task 1) already provides with
  the actor-role branch restriction `ExecutiveService`/
  `InventoryIntelligenceService` enforce internally (MANAGER/STAFF forced
  to their own branch) — replicated here so a resolved `branchId` is
  never silently re-scoped downstream, and an ADMIN actor never leaves
  `branchId` undefined against those pre-tenancy services (which have no
  native `organizationId` scoping of their own)
- **Morning Executive Briefing** (`ExecutiveBriefingService`): revenue/
  profit summary, top/bottom products, and inventory alerts assembled
  from `ExecutiveService.overview`/`InventoryIntelligenceService`; AI
  recommendations from the AI Brain's `RecommendationEngineService`; risk
  level from `AnomalyDetectionService`. Staffing alerts (demand vs. shift
  coverage, day by day) are the one genuinely new computation
- **Business Health Score** (`BusinessHealthService`): a weighted 0-100
  score across Revenue/Profit/Inventory/Customer/Operations/Staff, each
  category built from an existing signal (the Reasoning Engine's sales
  and customer trends, `ExecutiveService`'s inventory costs,
  `InventoryIntelligenceService`'s stockout predictions) except a new
  staff no-show ratio (`Shift.MISSED` count). Trend compares against the
  immediately preceding `BusinessHealthSnapshot`
- **Anomaly Detection** (`AnomalyDetectionService`): revenue drop and
  orders-unusually-low reuse the Reasoning Engine's sales signal; waste
  cost trend, inventory-mismatch frequency
  (`MANUAL_ADJUSTMENT`-transaction rate), and customer-complaint spike
  (`ProductReview` low-rating trend) are new trailing-window
  computations, each persisted as an `ExecutiveAlert` with
  severity/confidence/evidence/recommended action
- **Executive Dashboard** (`ExecutiveDashboardService`): the single
  "everything an executive needs" payload — every section pulled from an
  existing service's output (overview/KPIs, health score, active alerts,
  AI recommendations, AI Brain predictions, priority `AiDecision`s), read
  -only, nothing recomputed
- **Recommendation Prioritization** (`RecommendationPriorityService`):
  merges and ranks recommendations from four sources — the AI Brain's own
  `RecommendationEngineService`, the AI Brain's `DecisionEngineService`
  filtered to its `DEMAND_FORECAST` decisions only (deliberately
  excluding its `RECOMMENDATION_ACTION` decisions, since those are just
  `decide()`'s own re-wrap of `generate()`'s output, already pulled
  separately — avoiding a literal duplicate), `ExecutiveService`'s
  marketing-ROI/waste-ratio figures, and `InventoryIntelligenceService`'s
  suggested reorders
- **Natural Executive Summary** (`ExecutiveSummaryService`): a short,
  template/business-rule-generated paragraph — never an LLM, per this
  phase's "no fake AI" principle applied literally to a feature whose
  spec explicitly called for rule-based text. Every sentence reuses an
  existing signal (revenue change from the Reasoning Engine, the demand
  sentence from the AI Brain's `DEMAND_FORECAST` decision, the top action
  from `RecommendationPriorityService`); inventory-cost change (two
  `ExecutiveService.overview` calls, current vs. prior window) is the one
  new computation
- `GET /ai-copilot/dashboard`, `/briefing`, `/health`, `/alerts`,
  `/recommendations`, `/summary` — all behind `TenantContextGuard` +
  `@Roles(MANAGER, ADMIN)`; several are `@Auditable(entityType,
{ auditReads: true })`, a new opt-in extension to the `Auditable`
  decorator (originally GET-exempt) that lets a read endpoint with a real
  persisting side effect (a new snapshot row) get audited without
  changing the default behavior of any other `@Auditable(...)` call site
  in the codebase
- New `apps/admin` Executive Dashboard page (`/ai-copilot`) — health
  score, KPIs, active alerts, AI recommendations, forecasts, and recent
  AI decisions, all from the single `GET /ai-copilot/dashboard` payload,
  plus the natural-language executive summary as a banner; modeled on
  Phase 12 Part 4's `enterprise/analytics` single-page pattern
- **Bug found and fixed along the way:** `ExecutiveService.resolveRange`
  (Phase 8 Part 4, unmodified) parses a date-only `to` string to that
  day's UTC midnight, silently excluding same-day activity from a `<=`
  comparison. Every ai-copilot call site now passes full
  `.toISOString()` timestamps instead of date-only strings — a fix to
  how this module _calls_ `ExecutiveService`, not to `ExecutiveService`
  itself
- **Exit criteria (Task 2):** an executive can load one dashboard and see
  a real health score, real active alerts, a real ranked recommendation
  list drawing from four independent sources, real forecasts, and real
  priority actions — every number traceable to an existing service, nothing
  fabricated — with the same tenant isolation guarantees as every other
  Phase 12/13 endpoint.

49 new unit tests (scope service, business health, anomaly detection,
executive briefing, recommendation priority, executive dashboard,
executive summary) plus 9 e2e tests (all six endpoints, RBAC,
cross-tenant isolation, and the new `auditReads` GET-audit behavior) —
bringing the API suite to 815 unit + 155 e2e tests; typecheck/lint clean,
a full Nest app boot verifying `AiCopilotModule` resolves in the DI graph
against the newly-exported `AiBrainTenantScopeService`.

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
- Phase 5 (Admin Platform) came before the Phase 7/8/10 backend work it
  partially fulfilled (demand forecasting, aggregation-job analytics,
  loyalty redemption — Phase 5 itself shipped kitchen/delivery analytics
  directly) because the highest-leverage move at that point was giving
  staff a UI for everything Phases 1–3 had already built API-only — a
  purchase order, a kitchen station, or a marketing campaign is only
  useful to the business once someone can operate it without calling the
  API by hand. Building the forecasting/aggregation-job work first would
  have meant polishing features nobody at Fresh Cup could actually reach
  yet.
- Phase 6 (AI & Business Intelligence) came directly after Phase 5 rather
  than at the end of the roadmap because every one of its modules —
  forecasting, RFM segmentation, recommendations — depends on `apps/admin`
  already existing as a place to surface them; there would be nowhere to
  put an "Intelligence" nav section in a staff dashboard that was still a
  scaffold. It also deliberately jumped ahead of Phase 7's demand
  forecasting (superseding the narrower "predicted shortages only" scope
  originally planned there) and Phase 8's aggregation-job analytics
  (Phase 6's forecast/RFM logic already needed the same on-demand-query
  read paths Phase 8 would otherwise introduce materialized views for).
- Phase 11 (Restaurant Intelligence Platform) is numbered after Phase 10
  but was built immediately after Phase 6, for the same reason Phase 6
  jumped ahead of Phase 7-9: it extends Phase 6's intelligence services
  rather than anything a later phase would add, so there was no
  dependency reason to wait. It does not complete Phase 7 (multi-supplier
  price comparison remains open) or Phase 8 (still on-demand queries, no
  new materialized views) — those stay exactly as scoped above.
- Phase 11 Part 3 (Autonomous Restaurant Intelligence Platform) came
  directly after Part 2 for the same reason Part 2 followed Part 1: it
  builds on Part 1's domain AI services and Part 2's forecasting facade
  and model registry rather than anything outside this phase, so there
  was nothing to gain by sequencing other work in between. Its Human
  Approval Layer and policy engine are what let every later autonomous
  mechanism (the decision engine, automation drafts, the workflow engine)
  take real actions safely — building the approval layer first, before
  anything that drafts into it, avoided a chicken-and-egg ordering
  problem within the part itself.
- Phase 12 (Enterprise & Global Restaurant Platform) is numbered after
  Phase 11 for the same reason Phase 11 jumped Phases 7–9: it was scoped
  and built as its own self-contained unit (multi-tenancy, enterprise
  security, globalization, cross-branch analytics, deploy
  infrastructure) with no dependency on the still-open Phases 7–10, and
  waiting for those to land first would have gained nothing. It sits
  ABOVE every existing model as a new tenant root (`Organization` owns
  `Branch`, not the reverse) rather than reaching into Phases 1–11's
  schema, which is exactly what let it ship without touching a single
  existing endpoint, table, or test. It does not complete Phase 8
  (Analytics at scale — that phase's materialized aggregation views and
  cohort retention analysis remain open; Phase 12 Part 4's rollups are
  on-demand `groupBy` queries, the same "no materialized views" posture
  every prior analytics phase has kept) or any of Phases 7/9/10.
- Phase 13 (AI Restaurant Operating System) is numbered after Phase 12 for
  the same reason Phase 12 jumped Phases 7–10: it was scoped and built as
  its own self-contained unit with no dependency on the still-open Phases
  7/9/10, and waiting for those to land first would have gained nothing.
  Task 1 deliberately sits beside the existing intelligence trees (Phase 6,
  Phase 11 Parts 1–3, Phase 12 Part 4) rather than replacing any of them —
  a new, simpler rule-based loop that later Phase 13 tasks can graft real
  LLM/ML/agent capability onto, without any of the earlier intelligence
  work needing to move.
