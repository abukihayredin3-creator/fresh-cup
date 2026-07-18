# @fresh-cup/api

Fresh Cup core API (NestJS). Part of the Fresh Cup Juice House monorepo —
see the root [`README.md`](../../README.md) and [`docs/`](../../docs) for
architecture and full setup instructions.

```bash
pnpm install                     # from the monorepo root
cp apps/api/.env.example apps/api/.env.local
pnpm --filter @fresh-cup/api prisma:generate
pnpm --filter @fresh-cup/api prisma:migrate   # local dev only; CI/prod use prisma:deploy
pnpm --filter @fresh-cup/api prisma:seed      # branch, categories, sample products, dev accounts
pnpm --filter @fresh-cup/api dev
```

- API: `http://localhost:4000/api/v1`
- Health: `http://localhost:4000/health`, `http://localhost:4000/health/ready`
- Swagger/OpenAPI docs: `http://localhost:4000/docs`

## What's implemented (Phase 1)

- **Auth** (`/auth/*`): phone OTP (customers), email+password (staff),
  JWT access tokens, hashed/rotating refresh tokens, logout
- **Users** (`/users/me`, `/admin/users`): profile management, admin user
  management (branch-scoped for managers)
- **Addresses** (`/addresses`): CRUD, ownership-checked
- **Branches** (`/branches`): public read, admin-managed
- **Catalog** (`/branches/:id/menu-categories`, `/branches/:id/menu-items`,
  `/admin/menu-*`): categories + products CRUD, availability toggle, image gallery
- **Inventory** (`/admin/inventory`): base stock ledger, manual adjustments

No cart, ordering, or payment logic yet — that's Phase 2. See
[`../../docs/ROADMAP.md`](../../docs/ROADMAP.md).

## Testing

```bash
pnpm --filter @fresh-cup/api test       # unit tests (mocked Prisma)
pnpm --filter @fresh-cup/api test:e2e   # e2e tests against a real Postgres/Redis
```

e2e tests need `DATABASE_URL`, `REDIS_URL`, and `JWT_ACCESS_SECRET` set (see
`.env.example`) and a migrated database (`prisma:deploy` or `prisma:migrate`).
