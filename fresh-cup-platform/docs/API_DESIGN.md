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
- Idempotency: `Idempotency-Key` header required on `POST /orders` and `POST /payments/*`; server deduplicates on that key for 24h
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

Implemented in Phase 1 — minimal, since multi-branch activation is Phase 8.

| Method | Path             | Notes                        |
| ------ | ---------------- | ---------------------------- |
| GET    | `/branches`      | public, active branches only |
| GET    | `/branches/{id}` | public                       |
| POST   | `/branches`      | `admin` only                 |
| PATCH  | `/branches/{id}` | `admin` only                 |

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

## Inventory (base ledger — recipe deduction is Phase 5)

Implemented in Phase 1.

| Method | Path                           | Notes                                                                                            |
| ------ | ------------------------------ | ------------------------------------------------------------------------------------------------ |
| GET    | `/admin/inventory`             | `staff`+, paginated, optional `branchId`                                                         |
| GET    | `/admin/inventory/{id}`        | `staff`+                                                                                         |
| POST   | `/admin/inventory`             | `manager`/`admin`                                                                                |
| PATCH  | `/admin/inventory/{id}`        | `manager`/`admin`; stock itself isn't editable here — only `/adjust` changes it                  |
| POST   | `/admin/inventory/{id}/adjust` | `staff`+; body: `{ delta, reason, note? }`; writes a ledger row, rejects if it would go negative |

## Ordering

| Method | Path                  | Notes                                                                                   |
| ------ | --------------------- | --------------------------------------------------------------------------------------- |
| POST   | `/orders`             | creates order in `pending_payment`; requires `Idempotency-Key`                          |
| GET    | `/orders/{id}`        | owner, assigned rider, or staff of the branch only                                      |
| GET    | `/orders`             | customer's own order history (paginated); staff variant filters by `branch_id`+`status` |
| PATCH  | `/orders/{id}/status` | staff/kitchen only, enforces valid transitions                                          |
| POST   | `/orders/{id}/cancel` | customer (only while `pending_payment`/`confirmed`) or staff                            |
| GET    | `/tables/{qrToken}`   | resolves a scanned QR to branch + table for dine-in ordering                            |

## Payments

| Method | Path                       | Notes                                                                                 |
| ------ | -------------------------- | ------------------------------------------------------------------------------------- |
| POST   | `/payments/initiate`       | body: `{ order_id, method }` → returns Chapa checkout URL/reference                   |
| POST   | `/payments/webhooks/chapa` | signature-verified server callback; transitions `payments.status` and `orders.status` |
| POST   | `/payments/{id}/refund`    | admin only                                                                            |

## Delivery

| Method | Path                            | Notes                                                             |
| ------ | ------------------------------- | ----------------------------------------------------------------- |
| GET    | `/delivery/zones/{branchId}`    | zone polygons + fee rules, used for checkout fee calculation      |
| POST   | `/delivery/quote`               | body: `{ branch_id, lat, lng }` → `{ fee, eta_minutes, in_zone }` |
| GET    | `/rider/deliveries`             | rider's assigned deliveries (`rider` role)                        |
| PATCH  | `/rider/deliveries/{id}/status` | `picked_up`, `delivered`, `failed`                                |
| POST   | `/rider/location`               | high-frequency location ping while online                         |
| PATCH  | `/rider/availability`           | go online/offline                                                 |

## Loyalty & promotions

| Method | Path                | Notes                                                               |
| ------ | ------------------- | ------------------------------------------------------------------- |
| GET    | `/loyalty/me`       | balance, tier, history (own account)                                |
| GET    | `/loyalty/rewards`  | redeemable rewards catalog                                          |
| POST   | `/loyalty/redeem`   | body: `{ reward_id }`                                               |
| POST   | `/coupons/validate` | body: `{ code, order_subtotal }` → discount preview before checkout |

## Inventory (staff only)

| Method   | Path                           | Notes                                              |
| -------- | ------------------------------ | -------------------------------------------------- |
| GET      | `/admin/inventory`             | stock levels, low-stock flagged                    |
| POST     | `/admin/inventory/{id}/adjust` | manual adjustment, writes `inventory_transactions` |
| POST/GET | `/admin/purchase-orders`       | supplier restocking workflow                       |

## Analytics (admin only)

| Method | Path                                          | Notes                                         |
| ------ | --------------------------------------------- | --------------------------------------------- |
| GET    | `/admin/analytics/sales?from=&to=&branch_id=` | reads from materialized `daily_sales_summary` |
| GET    | `/admin/analytics/items?from=&to=`            | best/worst sellers                            |
| GET    | `/admin/analytics/retention`                  | cohort retention                              |

## WebSocket namespaces

| Namespace      | Who connects                                                          | Events                                                                      |
| -------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `/ws/orders`   | customer (own order room `order:{id}`), kitchen (`branch:{id}` room)  | `order.status_changed`, `order.item_ready`                                  |
| `/ws/delivery` | rider, customer tracking an active delivery, delivery-dashboard staff | `delivery.assigned`, `delivery.location_updated`, `delivery.status_changed` |

Auth on connect via the same JWT (passed as a query param or in the
`Authorization` header during the socket handshake); server joins the
socket to rooms based on the token's user/branch/role, so a client only
ever receives events it's authorized to see.

## Valid order status transitions

```
pending_payment → confirmed → preparing → ready ┬→ completed        (pickup / dine-in)
                                                  └→ out_for_delivery → delivered → completed
any non-terminal state → cancelled
```

Enforced server-side in the Ordering module; `PATCH /orders/{id}/status`
rejects any transition not in this graph.
