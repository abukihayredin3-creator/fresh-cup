# apps/web e2e (Playwright)

```
pnpm --filter @fresh-cup/web test:e2e         # headless
pnpm --filter @fresh-cup/web test:e2e:ui       # Playwright UI mode
```

Playwright starts the Next.js app itself (`webServer` in `playwright.config.ts`), but it
does **not** start the API, Postgres, or Redis — those need to already be running (same as
local dev: `pnpm --filter @fresh-cup/api start:dev` with a migrated + seeded database).

## Suites

- `guest-browsing.spec.ts` — home, menu search/filter/quick-add, locale switch, dark mode.
  Runs with no extra setup.
- `accessibility.spec.ts` — axe-core WCAG 2 AA scan of the key pages, light and dark.
  Runs with no extra setup.
- `order-journey.spec.ts` — logs in with a fresh phone number, adds an item, and places a
  pickup/cash order end to end. **Requires `E2E_API_LOG_PATH`** (see below) and is skipped
  otherwise, since the dev API has no real SMS provider and logs the OTP to stdout instead
  of sending it.

## Running the full suite, including the login journey

The dev API's `ConsoleSmsProvider` logs `[SMS -> <phone>] ... verification code is XXXXXX`
to stdout. Redirect that output to a file and point `E2E_API_LOG_PATH` at it:

```
cd apps/api
node dist/main > /tmp/fresh-cup-api.log 2>&1 &

cd ../web
E2E_API_LOG_PATH=/tmp/fresh-cup-api.log pnpm test:e2e
```

Each login uses a freshly generated phone number (`support/otp.ts#uniqueTestPhone`) so
repeated runs don't collide with the API's 60s OTP-resend cooldown.
