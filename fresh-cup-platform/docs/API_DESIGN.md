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

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/otp/request` | body: `{ phone }`; rate-limited per phone + per IP |
| POST | `/auth/otp/verify` | body: `{ phone, code }` → `{ access_token, refresh_token, user }` |
| POST | `/auth/staff/login` | email + password, staff/admin only |
| POST | `/auth/refresh` | rotates refresh token |
| POST | `/auth/logout` | revokes refresh token |

## Catalog (public read, admin write)

| Method | Path | Notes |
|---|---|---|
| GET | `/branches/{branchId}/menu` | full menu tree: categories → items → variants/modifiers; cached |
| GET | `/menu-items/{id}` | single item detail |
| POST/PATCH/DELETE | `/admin/menu-items` | `manager`/`admin` role required |
| POST/PATCH | `/admin/menu-categories` | |

## Ordering

| Method | Path | Notes |
|---|---|---|
| POST | `/orders` | creates order in `pending_payment`; requires `Idempotency-Key` |
| GET | `/orders/{id}` | owner, assigned rider, or staff of the branch only |
| GET | `/orders` | customer's own order history (paginated); staff variant filters by `branch_id`+`status` |
| PATCH | `/orders/{id}/status` | staff/kitchen only, enforces valid transitions |
| POST | `/orders/{id}/cancel` | customer (only while `pending_payment`/`confirmed`) or staff |
| GET | `/tables/{qrToken}` | resolves a scanned QR to branch + table for dine-in ordering |

## Payments

| Method | Path | Notes |
|---|---|---|
| POST | `/payments/initiate` | body: `{ order_id, method }` → returns Chapa checkout URL/reference |
| POST | `/payments/webhooks/chapa` | signature-verified server callback; transitions `payments.status` and `orders.status` |
| POST | `/payments/{id}/refund` | admin only |

## Delivery

| Method | Path | Notes |
|---|---|---|
| GET | `/delivery/zones/{branchId}` | zone polygons + fee rules, used for checkout fee calculation |
| POST | `/delivery/quote` | body: `{ branch_id, lat, lng }` → `{ fee, eta_minutes, in_zone }` |
| GET | `/rider/deliveries` | rider's assigned deliveries (`rider` role) |
| PATCH | `/rider/deliveries/{id}/status` | `picked_up`, `delivered`, `failed` |
| POST | `/rider/location` | high-frequency location ping while online |
| PATCH | `/rider/availability` | go online/offline |

## Loyalty & promotions

| Method | Path | Notes |
|---|---|---|
| GET | `/loyalty/me` | balance, tier, history (own account) |
| GET | `/loyalty/rewards` | redeemable rewards catalog |
| POST | `/loyalty/redeem` | body: `{ reward_id }` |
| POST | `/coupons/validate` | body: `{ code, order_subtotal }` → discount preview before checkout |

## Inventory (staff only)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/inventory` | stock levels, low-stock flagged |
| POST | `/admin/inventory/{id}/adjust` | manual adjustment, writes `inventory_transactions` |
| POST/GET | `/admin/purchase-orders` | supplier restocking workflow |

## Analytics (admin only)

| Method | Path | Notes |
|---|---|---|
| GET | `/admin/analytics/sales?from=&to=&branch_id=` | reads from materialized `daily_sales_summary` |
| GET | `/admin/analytics/items?from=&to=` | best/worst sellers |
| GET | `/admin/analytics/retention` | cohort retention |

## WebSocket namespaces

| Namespace | Who connects | Events |
|---|---|---|
| `/ws/orders` | customer (own order room `order:{id}`), kitchen (`branch:{id}` room) | `order.status_changed`, `order.item_ready` |
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
