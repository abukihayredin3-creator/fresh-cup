# API Design

REST, versioned, contract-first via OpenAPI 3.1. The spec (once
implementation begins) lives at `apps/api/openapi.yaml` and is the single
source every typed client (`packages/api-client`) is generated from — web,
admin, delivery, and mobile never hand-write request/response types.

## Conventions

- Base path: `/api/v1`
- Auth: `Authorization: Bearer <jwt>`; unauthenticated only for public menu reads and the OTP request/verify pair
- Content type: `application/json`, except file uploads (`multipart/form-data`)
- Errors: RFC 7807 `application/problem+json` — `{ type, title, status, detail, instance }`
- Pagination: cursor-based — `?cursor=<opaque>&limit=20`, response includes `next_cursor`
- Idempotency: `Idempotency-Key` header required on `POST /orders`; a retried
  request with the same key replays the original order instead of creating
  a duplicate (deduped indefinitely on the unique `orders.idempotency_key`
  column, not a 24h window). `POST /payments/initiate` is not yet
  idempotency-keyed — calling it twice for the same still-pending order
  creates two payment attempts; only one can settle the order, but this is
  a known gap worth closing before a real Chapa key is live in production.
- Money: always integer minor units in request/response bodies (e.g. `4550` = 45.50 ETB), never floats
- Timestamps: ISO 8601 UTC

## Auth

Implemented in Phase 1. Response bodies use camelCase (`accessToken`, not
`access_token`) — every client in this monorepo is TypeScript, so camelCase
is the idiomatic choice throughout, not just a convention on paper.

| Method | Path                | Notes                                                                      |
| ------ | ------------------- | -------------------------------------------------------------------------- |
| POST   | `/auth/otp/request` | body: `{ phone }`; rate-limited per phone (60s cooldown) + per IP          |
| POST   | `/auth/otp/verify`  | body: `{ phone, code }` → `{ accessToken, refreshToken, expiresIn, user }` |
| POST   | `/auth/staff/login` | body: `{ email, password }`, staff/manager/admin only                      |
| POST   | `/auth/refresh`     | body: `{ refreshToken }`; rotates — the old token is revoked immediately   |
| POST   | `/auth/logout`      | body: `{ refreshToken }`; revokes it                                       |

## Users & addresses

Implemented in Phase 1.

| Method | Path                | Notes                                                         |
| ------ | ------------------- | ------------------------------------------------------------- |
| GET    | `/users/me`         | own profile                                                   |
| PATCH  | `/users/me`         | update `fullName`/`email`/`locale`                            |
| GET    | `/admin/users`      | `staff`/`manager`/`admin`; managers see only their own branch |
| GET    | `/admin/users/{id}` | `staff`/`manager`/`admin`                                     |
| POST   | `/admin/users`      | `admin` only — creates a staff/manager/admin account          |
| PATCH  | `/admin/users/{id}` | `manager`/`admin`; only `admin` can change `role`             |
| GET    | `/addresses`        | own addresses                                                 |
| POST   | `/addresses`        | create; `isDefault: true` unsets any other default            |
| PATCH  | `/addresses/{id}`   | ownership-checked                                             |
| DELETE | `/addresses/{id}`   | ownership-checked                                             |

## Branches

Implemented in Phase 1 — minimal, since multi-branch activation is Phase 9.
Phase 5 added the admin listing and weekly-hours endpoints below for
`apps/admin`'s branch management UI.

| Method | Path                   | Notes                                                                             |
| ------ | ---------------------- | --------------------------------------------------------------------------------- |
| GET    | `/branches`            | public, active branches only                                                      |
| GET    | `/branches/admin/all`  | `manager`/`admin`; includes inactive branches                                     |
| GET    | `/branches/{id}`       | public                                                                            |
| GET    | `/branches/{id}/hours` | public; weekly open/close schedule                                                |
| PATCH  | `/branches/{id}/hours` | `manager`/`admin`; body: `{ days: [{ dayOfWeek, opensAt, closesAt, isClosed }] }` |
| POST   | `/branches`            | `admin` only                                                                      |
| PATCH  | `/branches/{id}`       | `admin` only                                                                      |

## Catalog (public read, staff+ write)

Implemented in Phase 1 as two resources rather than one combined "menu"
endpoint, so the public site can page items independently of categories.

| Method            | Path                                                                       | Notes                                                              |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| GET               | `/branches/{branchId}/menu-categories`                                     | public, active only                                                |
| GET               | `/branches/{branchId}/menu-items`                                          | public, available only, paginated, optional `categoryId`           |
| GET               | `/menu-items/{id}`                                                         | public; 404 if unavailable                                         |
| GET               | `/admin/menu-categories`, `/admin/menu-items`, `/admin/menu-items/{id}`    | `staff`+; includes inactive/unavailable                            |
| POST/PATCH/DELETE | `/admin/menu-categories`                                                   | `manager`/`admin`; DELETE soft-deletes (`isActive: false`)         |
| POST/PATCH/DELETE | `/admin/menu-items`                                                        | `manager`/`admin`; DELETE soft-deletes (`isAvailable: false`)      |
| PATCH             | `/admin/menu-items/{id}/availability`                                      | `staff`+ — frontline staff can 86 an item without full edit rights |
| POST/PATCH/DELETE | `/admin/menu-items/{id}/images`, `/admin/menu-items/{id}/images/{imageId}` | `manager`/`admin`; URL-based, no upload pipeline yet               |

### Product modifiers

Implemented in Phase 2. A modifier group (e.g. "Size", SINGLE-select; "Add-ons",
MULTIPLE-select) is reusable across menu items; the attachment carries a
per-item `isRequired`/`sortOrder` override. Every menu item response embeds
its currently-orderable groups/options — that embedded shape is the
cart/checkout customization contract, not an admin management view.

| Method            | Path                                                                                        | Notes                                                        |
| ----------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| GET/POST          | `/admin/modifier-groups`                                                                    | `staff`+ read, `manager`/`admin` write                       |
| GET/PATCH/DELETE  | `/admin/modifier-groups/{id}`                                                               | `manager`/`admin`; DELETE soft-deletes (`isActive: false`)   |
| POST/PATCH/DELETE | `/admin/modifier-groups/{id}/options`, `/admin/modifier-groups/{id}/options/{optionId}`     | `manager`/`admin`                                            |
| POST/PATCH/DELETE | `/admin/menu-items/{id}/modifier-groups`, `/admin/menu-items/{id}/modifier-groups/{linkId}` | `manager`/`admin`; attach/update/detach a group from an item |

## Inventory

Base ledger implemented in Phase 1; recipe-based auto-deduction and
low-stock alerting implemented in Phase 3; the waste report, predicted
shortages, and per-item transaction history below were added in Phase 5 for
`apps/admin`'s inventory dashboard.

| Method | Path                                   | Notes                                                                                                            |
| ------ | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/inventory`                     | `staff`+, paginated, optional `branchId`                                                                         |
| GET    | `/admin/inventory/low-stock`           | `staff`+; items where `currentStock <= reorderThreshold`, optional `branchId`                                    |
| GET    | `/admin/inventory/waste-report`        | `manager`/`admin`; optional `branchId`/`dateFrom`/`dateTo`; aggregates `WASTE`-reason ledger rows by item + cost |
| GET    | `/admin/inventory/predicted-shortages` | `manager`/`admin`; optional `branchId`; trailing-consumption-based days-until-stockout per item                  |
| GET    | `/admin/inventory/{id}`                | `staff`+                                                                                                         |
| GET    | `/admin/inventory/{id}/history`        | `staff`+, paginated, optional `reason`; the item's transaction ledger, most recent first                         |
| POST   | `/admin/inventory`                     | `manager`/`admin`                                                                                                |
| PATCH  | `/admin/inventory/{id}`                | `manager`/`admin`; stock itself isn't editable here — only `/adjust` changes it                                  |
| POST   | `/admin/inventory/{id}/adjust`         | `staff`+; body: `{ delta, reason, note? }`; writes a ledger row, rejects if it would go negative                 |

### Recipe ingredients (Phase 3)

Maps a menu item to the inventory items (and quantities) it consumes per
unit sold. A menu item with no rows here simply doesn't deduct anything —
recipes can be filled in incrementally without breaking existing items.
Deduction itself isn't a standalone endpoint: it's an internal `order.paid`
event listener in `InventoryService` (see Events below).

| Method       | Path                             | Notes                                                                       |
| ------------ | -------------------------------- | --------------------------------------------------------------------------- |
| GET          | `/admin/recipe-ingredients`      | `staff`+; optional `menuItemId`/`inventoryItemId` filters                   |
| POST         | `/admin/recipe-ingredients`      | `manager`/`admin`; body: `{ menuItemId, inventoryItemId, quantityPerUnit }` |
| PATCH/DELETE | `/admin/recipe-ingredients/{id}` | `manager`/`admin`                                                           |

## Tables (QR dine-in)

Implemented in Phase 2.

| Method   | Path                               | Notes                                                                |
| -------- | ---------------------------------- | -------------------------------------------------------------------- |
| GET      | `/tables/{qrToken}`                | public; resolves a scanned QR to branch + table for dine-in ordering |
| GET/POST | `/admin/tables`                    | `staff`+ read, `manager`/`admin` write                               |
| PATCH    | `/admin/tables/{id}`               | `manager`/`admin`                                                    |
| POST     | `/admin/tables/{id}/regenerate-qr` | `manager`/`admin`; invalidates the previously-printed QR code        |

## Cart

Implemented in Phase 2 — server-persisted so it survives across devices;
one cart per (user, branch). Any authenticated user manages only their own,
no role restriction. Checkout consumes and clears it.

| Method | Path               | Notes                                                                                                           |
| ------ | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| GET    | `/cart?branchId=`  | returns an empty virtual cart (not persisted) if nothing's been added yet                                       |
| POST   | `/cart/items`      | body: `{ branchId, menuItemId, quantity?, notes?, modifierOptionIds? }`; merges into an identical existing line |
| PATCH  | `/cart/items/{id}` | body: `{ quantity }`                                                                                            |
| DELETE | `/cart/items/{id}` |                                                                                                                 |
| DELETE | `/cart?branchId=`  | clears the whole cart for that branch                                                                           |

## Ordering

Implemented in Phase 2. `POST /orders` is "checkout" — it sources line
items from the caller's persisted cart (not a body-provided item list),
re-validating availability/modifiers/pricing against the live catalog
before creating anything and clearing the cart in the same transaction.

| Method | Path                          | Notes                                                                                                                                                              |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST   | `/orders`                     | checkout from the cart; creates order in `pending_payment`; requires `Idempotency-Key`; body: `{ branchId, orderType, tableId?, addressId?, couponCode?, notes? }` |
| GET    | `/orders/{id}`                | owner or staff of the branch only                                                                                                                                  |
| GET    | `/orders`                     | customer's own order history (paginated); staff/manager auto-scoped to their own branch, admin filters by `branchId`+`status`                                      |
| PATCH  | `/orders/{id}/status`         | staff+ only, enforces the valid-transition graph below; rejects `cancelled` (use `/cancel`)                                                                        |
| POST   | `/orders/{id}/cancel`         | customer (only while `pending_payment`/`confirmed`) or staff+ (any non-terminal state)                                                                             |
| GET    | `/orders/{id}/timeline`       | append-only status-change history, owner or staff of the branch                                                                                                    |
| GET    | `/admin/orders/kitchen-queue` | staff+; `confirmed`+`preparing` orders for `branchId`, oldest first                                                                                                |

## Payments

Implemented in Phase 2. `PaymentProvider` is a dependency-inverted
interface (mirrors the Phase 1 `SmsProvider` pattern) with two
implementations selected by `method`: Chapa (TeleBirr/CBE Birr/HelloCash/
Amole/cards — one aggregator integration, see docs/ARCHITECTURE.md for why
direct TeleBirr integration was rejected) and cash (pay-at-counter/on-
delivery). With no `CHAPA_SECRET_KEY` configured, the Chapa provider
fabricates a sandbox checkout reference instead of calling the real API.

| Method | Path                          | Notes                                                                                                                                                                           |
| ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/payments/initiate`          | body: `{ orderId, method }`; owner or staff+ of the order's branch; Chapa returns a checkout URL, cash confirms the order immediately (kitchen starts without waiting for cash) |
| POST   | `/payments/webhooks/chapa`    | public, HMAC-signature-verified (unverified in sandbox mode with no `CHAPA_WEBHOOK_SECRET`); idempotent against retries; settles the payment and confirms the order             |
| POST   | `/payments/{id}/confirm-cash` | staff+ of the order's branch; settles a cash payment once physically received — this, not order confirmation, is what triggers loyalty accrual                                  |
| POST   | `/payments/{id}/refund`       | admin only; only a `succeeded` payment can be refunded                                                                                                                          |

Loyalty accrual and the `order.paid` notification both fire off a payment
reaching `succeeded`, never off order confirmation alone — a cash order is
confirmed (kitchen starts) before the cash is actually collected, so tying
accrual to confirmation would reward orders that are later no-shows.

## Delivery

Phase 2 added `orderType: DELIVERY` as a checkout option with a flat-rate
MVP fee. Phase 3 replaced the flat fee with zone-based quoting (falling
back to the flat rate when no zone covers the point) and added driver
management, dispatch, and live tracking.

### Zones & fee quoting

Zones are circular (center lat/lng + radius km, not GeoJSON polygons — a
deliberate simplification avoiding a PostGIS dependency). The smallest
zone covering a point wins; `checkout` calls the same matcher internally.

| Method           | Path                          | Notes                                                                                             |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| GET              | `/admin/delivery-zones`       | `staff`+, paginated, optional `branchId`                                                          |
| POST             | `/admin/delivery-zones`       | `manager`/`admin`; body: `{ branchId, name, centerLat, centerLng, radiusKm, baseFee, perKmFee? }` |
| GET/PATCH/DELETE | `/admin/delivery-zones/{id}`  | `staff`+ read, `manager`/`admin` write; DELETE soft-deletes (`isActive: false`)                   |
| POST             | `/admin/delivery-zones/quote` | `staff`+; body: `{ branchId, lat, lng }` → `{ fee, etaMinutes, inZone, zoneId, distanceKm }`      |

### Driver management (admin)

`DRIVER` is a `User` role with a 1:1 `DriverProfile` extension (vehicle
type, license plate, online status, last-known location).

| Method | Path                  | Notes                                                                                          |
| ------ | --------------------- | ---------------------------------------------------------------------------------------------- |
| GET    | `/admin/drivers`      | `staff`+, paginated; managers auto-scoped to their own branch                                  |
| GET    | `/admin/drivers/{id}` | `staff`+                                                                                       |
| POST   | `/admin/drivers`      | `manager`/`admin`; body: `{ branchId, email, password, fullName, vehicleType, licensePlate? }` |
| PATCH  | `/admin/drivers/{id}` | `manager`/`admin`                                                                              |

### Dispatch dashboard (staff)

A `Delivery` row is created automatically at checkout for every
`orderType: DELIVERY` order — there's no separate "create a delivery"
endpoint.

| Method | Path                              | Notes                                                                                                |
| ------ | --------------------------------- | ---------------------------------------------------------------------------------------------------- |
| GET    | `/admin/deliveries`               | `staff`+, paginated; optional `branchId`/`status`/`driverId`; managers branch-scoped                 |
| GET    | `/admin/deliveries/{id}`          | `staff`+                                                                                             |
| GET    | `/admin/deliveries/{id}/tracking` | `staff`+; ordered GPS pings for that delivery                                                        |
| POST   | `/admin/deliveries/{id}/assign`   | `staff`+; body: `{ driverId }`; rejects an already-assigned delivery or a driver from another branch |

### Driver self-service (driver role only)

A driver can only ever act on their own availability, location, and the
deliveries assigned to them.

| Method | Path                                      | Notes                                                                                                                                                         |
| ------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PATCH  | `/delivery/driver/availability`           | body: `{ isOnline }`                                                                                                                                          |
| POST   | `/delivery/driver/location`               | body: `{ lat, lng }`; attaches a tracking ping to the driver's active delivery, if any                                                                        |
| GET    | `/delivery/driver/deliveries`             | own current + past deliveries, paginated                                                                                                                      |
| PATCH  | `/delivery/driver/deliveries/{id}/status` | body: `{ status }`, one of `PICKED_UP`/`EN_ROUTE`/`DELIVERED`/`FAILED`; `PICKED_UP` drives the parent order to `out_for_delivery`, `DELIVERED` to `delivered` |

## Promotions (coupons)

Implemented in Phase 2.

| Method    | Path                  | Notes                                                                        |
| --------- | --------------------- | ---------------------------------------------------------------------------- |
| POST      | `/coupons/validate`   | authenticated; body: `{ code, subtotal }` → discount preview before checkout |
| GET/POST  | `/admin/coupons`      | `manager`/`admin`                                                            |
| GET/PATCH | `/admin/coupons/{id}` | `manager`/`admin`; code is immutable once created                            |

Redemption itself isn't a standalone endpoint — a coupon is redeemed by
including `couponCode` at checkout (`POST /orders`), atomically with order
creation, enforcing `minOrderTotal`/active-window/global and per-user
redemption limits.

## Loyalty

Implemented in Phase 2 as accrual only — tiers, a rewards catalog, and a
redemption flow are Phase 10.

| Method | Path          | Notes                                                                                                                                   |
| ------ | ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/loyalty/me` | own balance + paginated accrual history; 1 point per `LOYALTY_MINOR_UNITS_PER_POINT` (default 1000 = 10 ETB) spent on a settled payment |

## Notifications

Implemented in Phase 2. SMS/email/push are each a dependency-inverted
provider interface with a console (log-only) implementation pending real
gateways (AfroMessage, an ESP, FCM). Every dispatch attempt — success or
failure — is logged to `notification_logs`.

| Method | Path                              | Notes                                           |
| ------ | --------------------------------- | ----------------------------------------------- |
| POST   | `/notifications/push-tokens`      | registers/updates a device token for the caller |
| DELETE | `/notifications/push-tokens/{id}` | ownership-checked                               |

## Kitchen (Phase 3)

Kitchen stations are optional — a menu item with no `stationId` just
doesn't route to a specific station in the queue. `prepTimeSeconds` and
`stationId` are snapshotted onto each `OrderItem` at checkout, so editing a
menu item later never rewrites the history of orders already placed.

| Method           | Path                           | Notes                                                                                                                                                                                  |
| ---------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET              | `/admin/kitchen-stations`      | `staff`+, paginated, optional `branchId`                                                                                                                                               |
| POST             | `/admin/kitchen-stations`      | `manager`/`admin`; body: `{ branchId, name }`                                                                                                                                          |
| GET/PATCH/DELETE | `/admin/kitchen-stations/{id}` | `staff`+ read, `manager`/`admin` write; DELETE soft-deletes (`isActive: false`)                                                                                                        |
| GET              | `/admin/orders/kitchen-queue`  | `staff`+; extended in Phase 3 with optional `stationId` filter and, per order, `elapsedSeconds`/`isLate` (elapsed time since `preparingAt` vs. the order's max item `prepTimeSeconds`) |

## Purchasing (Phase 3)

Suppliers and purchase orders are both branch-scoped. A purchase order
moves `draft → submitted → received` (or `cancelled` from either
non-terminal state); receiving is what actually restocks inventory — it
writes a `RESTOCK` ledger transaction per line and increments
`InventoryItem.currentStock` atomically with closing the order.

| Method           | Path                                   | Notes                                                                                                                                                             |
| ---------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET              | `/admin/suppliers`                     | `staff`+, paginated, optional `branchId`                                                                                                                          |
| POST             | `/admin/suppliers`                     | `manager`/`admin`                                                                                                                                                 |
| GET/PATCH/DELETE | `/admin/suppliers/{id}`                | `staff`+ read, `manager`/`admin` write; DELETE soft-deletes (`isActive: false`)                                                                                   |
| GET              | `/admin/suppliers/{id}/analytics`      | `staff`+; order counts by outcome, total spend/paid, average lead time, fulfillment rate                                                                          |
| GET              | `/admin/purchase-orders`               | `staff`+, paginated; optional `branchId`/`status`/`supplierId`; managers branch-scoped                                                                            |
| POST             | `/admin/purchase-orders`               | `manager`/`admin`; body: `{ branchId, supplierId, notes?, lines: [{ inventoryItemId, quantityOrdered, unitCost }] }`                                              |
| GET              | `/admin/purchase-orders/{id}`          | `staff`+                                                                                                                                                          |
| POST             | `/admin/purchase-orders/{id}/submit`   | `manager`/`admin`; `draft` → `submitted`                                                                                                                          |
| POST             | `/admin/purchase-orders/{id}/receive`  | `staff`+; `submitted` → `received`; body: `{ lines? }` — omit to receive every line in full, or override specific lines' `quantityReceived` for a partial receive |
| POST             | `/admin/purchase-orders/{id}/cancel`   | `manager`/`admin`; only from `draft`/`submitted`                                                                                                                  |
| PATCH            | `/admin/purchase-orders/{id}/invoice`  | `manager`/`admin`; body: `{ invoiceNumber?, invoiceUrl? }`                                                                                                        |
| POST             | `/admin/purchase-orders/{id}/payments` | `manager`/`admin`; body: `{ amount, method, note? }`; a purchase order can have multiple partial payments                                                         |

## Admin dashboard & analytics (Phase 3, extended Phase 5)

`manager`/`admin` only. All on-demand aggregate queries against live order
data — no materialized views or nightly aggregation jobs (that's Phase 8,
once order-history volume actually makes on-demand queries too slow).
"Revenue" throughout means orders past the payment gate (any status except
`pending_payment`/`cancelled`), the closest proxy for "paid" without
joining `Payment`. Phase 5 added the kitchen/delivery analytics and
delivery heatmap rows below; the heatmap endpoint has no `apps/admin` UI
yet (rendering it needs a mapping library this monorepo doesn't otherwise
depend on) — everything else in this table is consumed by the Analytics
and Reports sections of `apps/admin`.

| Method | Path                                                    | Notes                                                                                                                                                   |
| ------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/dashboard?branchId=`                            | today's revenue/order count, active orders, pending deliveries, low-stock item count, rolling 7-day revenue                                             |
| GET    | `/admin/analytics/sales?branchId=&from=&to=`            | revenue/order count by day over the range (defaults to the last 30 days)                                                                                |
| GET    | `/admin/analytics/items?branchId=&from=&to=&limit=`     | top-selling menu items by revenue                                                                                                                       |
| GET    | `/admin/analytics/customers?branchId=&from=&to=&limit=` | top customers by spend                                                                                                                                  |
| GET    | `/admin/analytics/kitchen?branchId=&from=&to=`          | prep-time performance by station over the range                                                                                                         |
| GET    | `/admin/analytics/delivery?branchId=&from=&to=`         | delivery time and zone performance over the range                                                                                                       |
| GET    | `/admin/analytics/delivery/heatmap?branchId=&from=&to=` | delivered-order coordinates for a heat-map view                                                                                                         |
| GET    | `/admin/customers/{id}`                                 | customer-360: profile, paid order count/total spend, last order, loyalty balance; a manager gets 403 for a customer who's never ordered at their branch |

Branch and customer _management_ (as opposed to analytics) needed no new
endpoints — `/admin/branches` (Phase 1, extended in Phase 5 with hours) and
`/admin/users` (Phase 1, also serves customer listing/detail via
`?role=CUSTOMER`) already cover it. Employee management got a real new
surface in Phase 5 — see Employees below.

## Employees (Phase 5)

`/admin/users`/`/admin/users/{id}` (Phase 1) already cover the account
itself (role, branch, `isActive`, and — `admin` only — `isOwner`/`salary`).
Phase 5 added everything below: departments, shift scheduling, clock-in/out
attendance, freeform performance notes, and the fine-grained permission
grants that let a `MANAGER`/`STAFF` account do one specific `admin`-gated
thing (e.g. `MENU_EDIT`) without a full role change.

| Method       | Path                                             | Notes                                                                                                                                                                                |
| ------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET          | `/admin/departments`                             | `manager`/`admin`, optional `branchId`                                                                                                                                               |
| POST         | `/admin/departments`                             | `admin` only                                                                                                                                                                         |
| PATCH/DELETE | `/admin/departments/{id}`                        | `admin` only; DELETE is a hard delete (no `isActive` concept for departments)                                                                                                        |
| GET          | `/admin/shifts`                                  | `manager`/`admin`, paginated, optional `userId`/`branchId`/`from`/`to`                                                                                                               |
| POST         | `/admin/shifts`                                  | `admin` only; body: `{ userId, branchId, startsAt, endsAt }`                                                                                                                         |
| PATCH/DELETE | `/admin/shifts/{id}`                             | `admin` only                                                                                                                                                                         |
| POST         | `/admin/attendance/clock-in`                     | any staff role; body: `{ branchId }`                                                                                                                                                 |
| POST         | `/admin/attendance/clock-out`                    | any staff role; closes the caller's open clock-in                                                                                                                                    |
| GET          | `/admin/attendance`                              | `manager`/`admin`, paginated, optional `userId`/`branchId`/`from`/`to`                                                                                                               |
| GET          | `/admin/users/{userId}/performance-notes`        | `manager`/`admin`                                                                                                                                                                    |
| POST         | `/admin/users/{userId}/performance-notes`        | `manager`/`admin`; body: `{ note, rating? }`                                                                                                                                         |
| GET          | `/admin/users/{userId}/permissions`              | `admin` only                                                                                                                                                                         |
| POST         | `/admin/users/{userId}/permissions`              | `admin` only; body: `{ permission }`, one of `MENU_EDIT`/`INVENTORY_MANAGE`/`PURCHASING_MANAGE`/`EMPLOYEE_MANAGE`/`MARKETING_MANAGE`/`SETTINGS_MANAGE`/`REPORTS_VIEW`/`FINANCE_VIEW` |
| DELETE       | `/admin/users/{userId}/permissions/{permission}` | `admin` only                                                                                                                                                                         |

## Marketing (Phase 5)

Banners, gift cards, referral codes, and outbound marketing campaigns —
all new in Phase 5. Campaigns reuse the Phase 2 SMS/email/push provider
interfaces (currently the console implementations) rather than a
dedicated marketing-send pipeline.

| Method   | Path                                     | Notes                                                                                                                                             |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET      | `/banners/active`                        | public; active banners for the current branch/date window                                                                                         |
| GET      | `/admin/banners`                         | `marketing_staff`/`manager`/`admin`, paginated, optional `branchId`                                                                               |
| POST     | `/admin/banners`                         | `marketing_staff`/`manager`/`admin`; body: `{ title, imageUrl, linkUrl?, branchId?, startsAt?, endsAt?, sortOrder? }`                             |
| PATCH    | `/admin/banners/{id}`                    | `marketing_staff`/`manager`/`admin`                                                                                                               |
| DELETE   | `/admin/banners/{id}`                    | `marketing_staff`/`manager`/`admin`; hard delete                                                                                                  |
| GET/POST | `/admin/gift-cards`                      | `marketing_staff`/`manager`/`admin`; POST body: `{ initialBalance, issuedToUserId?, expiresAt? }`                                                 |
| POST     | `/admin/gift-cards/{id}/adjust`          | `marketing_staff`/`manager`/`admin`; body: `{ amount, orderId?, note? }` — positive tops up, negative deducts                                     |
| GET/POST | `/admin/referral-codes`                  | `marketing_staff`/`manager`/`admin`; POST body: `{ userId, rewardAmount }`                                                                        |
| GET      | `/admin/referral-codes/{id}/redemptions` | `marketing_staff`/`manager`/`admin`                                                                                                               |
| PATCH    | `/admin/referral-codes/{id}`             | `marketing_staff`/`manager`/`admin`; body: `{ rewardAmount?, isActive? }`                                                                         |
| GET/POST | `/admin/campaigns`                       | `marketing_staff`/`manager`/`admin`; POST body: `{ name, channel, message, targetSegment?, scheduledAt? }`, `channel` one of `PUSH`/`EMAIL`/`SMS` |
| PATCH    | `/admin/campaigns/{id}`                  | `marketing_staff`/`manager`/`admin`; only editable while `DRAFT`/`SCHEDULED`                                                                      |
| POST     | `/admin/campaigns/{id}/send`             | `marketing_staff`/`manager`/`admin`; dispatches to every matching user via the campaign's channel, `DRAFT`/`SCHEDULED` → `SENT`                   |
| POST     | `/admin/campaigns/{id}/cancel`           | `marketing_staff`/`manager`/`admin`; `DRAFT`/`SCHEDULED` → `CANCELLED`                                                                            |

## Reviews (Phase 5)

Customer-facing product reviews plus admin moderation, new in Phase 5.

| Method | Path                               | Notes                                                                         |
| ------ | ---------------------------------- | ----------------------------------------------------------------------------- |
| GET    | `/menu-items/{menuItemId}/reviews` | public, paginated                                                             |
| POST   | `/menu-items/{menuItemId}/reviews` | `customer` only; body: `{ rating, comment? }`                                 |
| GET    | `/admin/reviews`                   | `staff`+ (incl. `marketing_staff`), paginated, optional `menuItemId`/`userId` |
| DELETE | `/admin/reviews/{id}`              | `manager`/`admin`; moderation removal                                         |

## Security (Phase 5)

Session/API-key/2FA management, new in Phase 5. Sessions and 2FA are
self-service — any authenticated user manages their own; the
`/admin/security/*` routes are `admin`-only actions on _another_ account or
on API keys.

| Method   | Path                                                 | Notes                                                                                   |
| -------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| GET      | `/security/sessions`                                 | any authenticated user; their own active refresh-token sessions                         |
| DELETE   | `/security/sessions/{id}`                            | any authenticated user; ownership-checked                                               |
| GET      | `/admin/security/users/{userId}/sessions`            | `admin` only                                                                            |
| POST     | `/admin/security/users/{userId}/sessions/revoke-all` | `admin` only; forces sign-out everywhere for that account                               |
| GET/POST | `/admin/security/api-keys`                           | `admin` only; POST body: `{ name }` → the raw key, shown once, never retrievable again  |
| POST     | `/admin/security/api-keys/{id}/revoke`               | `admin` only                                                                            |
| GET      | `/security/2fa`                                      | any authenticated user; `{ enabled }`                                                   |
| POST     | `/security/2fa/enroll`                               | any authenticated user; returns a fresh RFC 6238 secret + `otpauthUrl` (not yet active) |
| POST     | `/security/2fa/verify`                               | body: `{ code }`; confirms the enrolled secret and turns 2FA on                         |
| POST     | `/security/2fa/disable`                              | body: `{ code }`; requires a currently-valid code, not just being logged in             |

## Settings (Phase 5)

Restaurant-wide configuration — name, locale/currency/tax defaults,
timezone, branding, support contacts, and notification-channel toggles.
Singleton: there's exactly one settings row, no `{id}` in the path.

| Method | Path              | Notes                                              |
| ------ | ----------------- | -------------------------------------------------- |
| GET    | `/admin/settings` | `manager`/`admin`                                  |
| PATCH  | `/admin/settings` | `admin` only; partial update, any subset of fields |

## Recommendations (Phase 6)

Public — recommendations work for anonymous browsing, not just logged-in
customers (`personalized` is the one exception, since it's meaningless
without a customer to personalize for). All computed on demand from
Order/OrderItem history and catalog metadata, no persisted model.
`personalized` tries user-based collaborative filtering first (what did
customers who bought the same things also buy), falling back to
category-affinity and then plain `trending` when there isn't enough
co-purchase signal — this is what makes it work for a first-time customer,
not just loyalty members with deep order history.

| Method | Path                                               | Notes                                                          |
| ------ | -------------------------------------------------- | -------------------------------------------------------------- |
| GET    | `/recommendations/frequently-bought-together/{id}` | co-occurrence within the same order                            |
| GET    | `/recommendations/similar/{id}`                    | same category / overlapping tags                               |
| GET    | `/recommendations/upsell-cross-sell/{id}`          | pricier same-category items + cross-sell from other categories |
| GET    | `/recommendations/cart`                            | `?menuItemIds=a,b,c`; cross-sell anchored on the whole cart    |
| GET    | `/recommendations/trending`                        | trailing 7-day sales velocity, optional `branchId`             |
| GET    | `/recommendations/seasonal`                        | `isSeasonal`/`isFeatured` items                                |
| GET    | `/recommendations/personalized`                    | authenticated; collaborative filtering + fallback              |

## AI & Business Intelligence (Phase 6)

`manager`/`admin` only (Inventory Intelligence also allows
`INVENTORY_STAFF`, Marketing Intelligence also allows `MARKETING_STAFF`).
Customer/inventory/marketing intelligence are on-demand aggregate queries,
same approach as the Phase 3 admin dashboard. Sales forecasting is the one
persisted exception — see `docs/DATABASE_SCHEMA.md` for `MlModelRun`/
`ForecastSnapshot` — because "forecast vs. actual" requires a prediction to
outlive the day it was made, and "replaceable/versioned models" requires a
registry row to version against. There is no Python ML service or training
pipeline anywhere in this stack: every model is a hand-rolled statistical
method (moving-average/linear-regression blend, RFM quantile scoring,
co-occurrence-matrix collaborative filtering) living directly in
`apps/api/src/modules/intelligence`.

| Method | Path                                                  | Notes                                                                                                                                                                                                       |
| ------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/customer-intelligence/segments`               | RFM-scored customer list with churn risk + predicted LTV; optional `branchId`/`segment`/`limit`                                                                                                             |
| GET    | `/admin/customer-intelligence/segment-summary`        | customer counts + spend per RFM segment                                                                                                                                                                     |
| GET    | `/admin/customer-intelligence/customers/{id}`         | full profile: RFM, LTV, churn, favorite categories, preferred order time/payment, coupon effectiveness, loyalty tier                                                                                        |
| GET    | `/admin/forecasting/sales`                            | `?metric=SALES_REVENUE\|SALES_ORDERS&granularity=DAILY\|WEEKLY\|MONTHLY&branchId=`                                                                                                                          |
| GET    | `/admin/forecasting/hourly-demand`                    | predicted order volume per hour-of-day for tomorrow                                                                                                                                                         |
| GET    | `/admin/forecasting/product-demand`                   | 7-day demand forecast for the top-selling menu items                                                                                                                                                        |
| GET    | `/admin/forecasting/model-runs`                       | model registry — every forecast-generation run, versioned                                                                                                                                                   |
| POST   | `/admin/forecasting/regenerate`                       | `admin` only; force-regenerate every forecast now instead of waiting for the nightly job                                                                                                                    |
| GET    | `/admin/inventory-intelligence`                       | waste probability, expiry risk, suggested reorder quantity on top of the Phase 3 shortage predictor                                                                                                         |
| GET    | `/admin/marketing-intelligence/campaign-performance`  | estimated order-volume lift around each campaign's send time                                                                                                                                                |
| GET    | `/admin/marketing-intelligence/coupon-optimization`   | per-coupon redemption rate + AOV impact vs. baseline, with a usage recommendation                                                                                                                           |
| GET    | `/admin/marketing-intelligence/referral-optimization` | referral conversion rate, cost per acquisition, top referrers                                                                                                                                               |
| GET    | `/admin/marketing-intelligence/loyalty-optimization`  | active members, average balance, near-tier-upgrade members                                                                                                                                                  |
| GET    | `/admin/marketing-intelligence/target-suggestions`    | per-RFM-segment campaign suggestion + recommended channel                                                                                                                                                   |
| GET    | `/admin/executive/overview`                           | revenue/profit trend, product profitability, branch comparison, customer growth, peak hours, repeat/conversion rates, inventory costs, marketing ROI; `DateRangeQueryDto` params, CSV export is client-side |
| GET    | `/admin/executive/forecast-vs-actual`                 | predicted vs. actual daily revenue                                                                                                                                                                          |
| POST   | `/admin/ai-assistant/ask`                             | body: `{ question, branchId? }`; natural-language Q&A over the endpoints above — see below                                                                                                                  |

### AI Assistant

Same dependency-inverted provider pattern as `ChapaPaymentProvider`/
`ConsoleSmsProvider`: with `ANTHROPIC_API_KEY` configured, the Claude API
(`@anthropic-ai/sdk`, model `claude-opus-4-8`) routes the question to
tool calls against the services above and phrases the answer from their
real output — never estimates or invents a figure, and the system prompt
says so explicitly. Without a key (the local/CI default), a deterministic
keyword router picks the same tools directly, so behavior is identical
either way, just without natural-language phrasing. Every query is logged
to `AiAssistantQuery` (question, answer, which tools were called with what
result, and an `outcome` of `ANSWERED`/`FALLBACK`/`ERROR`) so every answer
is traceable back to the real data it cites.

## Audit logs (Phase 3)

An `@Auditable(entityType)` decorator + a global interceptor write one
`AuditLog` row per mutating request (`POST`/`PATCH`/`PUT`/`DELETE`) on any
tagged controller — actor, `"METHOD path"` as the action, entity type,
entity id (from the response body's `id`, falling back to the route
param), and the response body as `after`-state. Fire-and-forget: a failed
audit write is logged but never fails the real request. Deliberately
captures only after-state, not a before/after diff — avoids an extra read
on every mutation. `OrdersController` is deliberately not tagged:
`OrderStatusHistory` already gives order transitions a purpose-built,
more precise audit trail.

| Method | Path                | Notes                                                                           |
| ------ | ------------------- | ------------------------------------------------------------------------------- |
| GET    | `/admin/audit-logs` | `admin` only, paginated; optional `entityType`/`actorUserId`/`entityId` filters |

## WebSocket namespaces

`/ws/orders` is implemented in Phase 2, `/ws/delivery` in Phase 3 (both
single Nest instance only — the Socket.IO Redis adapter for horizontal
scaling is deferred until a second API instance actually exists to justify
it).

| Namespace      | Who connects                                                                                                                                                                              | Events                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `/ws/orders`   | customer (`order:{id}` room, joined explicitly via a `subscribeOrder` message after checkout), staff/manager (auto-joined to `branch:{id}` on connect), admin (`subscribeBranch` message) | `order.created`, `order.status_changed`                                     |
| `/ws/delivery` | customer/driver/admin (`delivery:{id}` room, joined explicitly via a `subscribeDelivery` message), staff/manager (auto-joined to `branch:{id}` on connect)                                | `delivery.assigned`, `delivery.status_changed`, `delivery.location_updated` |

Auth on connect via the same JWT, passed as `{ auth: { token } }` in the
Socket.IO client's connect options (the standard socket.io-client
credential mechanism) — an `Authorization` header or `?token=` query param
also work as fallbacks. An invalid or missing token gets the socket
connected then immediately disconnected by the server, rather than
rejecting the handshake itself. `subscribeOrder`/`subscribeBranch`/
`subscribeDelivery` ack with
`{ ok: false, error: "forbidden" | "not_found" | "unauthenticated" }` when
the caller isn't allowed to join that room.

## Valid order status transitions

```
pending_payment → confirmed → preparing → ready ┬→ completed        (pickup / dine-in)
                                                  └→ out_for_delivery → delivered → completed
any non-terminal state → cancelled
```

Enforced server-side in `OrdersService`; `PATCH /orders/{id}/status`
rejects any transition not in this graph, plus two order-type-aware rules
`OrderStatus` alone can't express: `out_for_delivery`/`delivered` only
apply to `orderType: DELIVERY`, and a delivery order can't skip straight
from `ready` to `completed` — it must pass through both. `cancelled` is
rejected on this endpoint entirely; use `POST /orders/{id}/cancel`, which
additionally restricts customers (not staff) to cancelling only from
`pending_payment`/`confirmed`. A cash payment's `POST /payments/initiate`
drives `pending_payment → confirmed` directly (see Payments above) — the
only status transition triggered outside these two endpoints.
