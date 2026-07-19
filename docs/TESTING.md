# Testing

Godebonner uses a testing pyramid. Day-to-day app development still talks to the **remote** Supabase project. Local Supabase (Docker) is used **only** for automated DB/RLS/RPC tests and hermetic E2E in CI.

## Pyramid

| Layer | Tool | What belongs here |
|-------|------|-------------------|
| Unit | Vitest | Pure TS: phone, CSV import, auth redirects, game engines, icon helpers |
| Component | Vitest + Testing Library | UI behavior with **mocked** Supabase |
| DB / RLS / RPC | Vitest (`tests/db`) + local Supabase | Policies, SECURITY DEFINER RPCs, phone parity with SQL |
| E2E | Playwright | A few critical journeys (lookup, login, register coupon) |

Prefer unit tests for new pure logic. Prefer DB tests when changing migrations/RLS/RPCs. Prefer E2E only for P0 user journeys.

## Commands

```bash
npm run test           # Unit + component (src/**/*.test.*)
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report (thresholds on pure modules)
npm run test:db        # Requires local Supabase — see below
npm run test:e2e       # Playwright (needs app + env)
npm run test:all       # unit/component + db + e2e
npm run typecheck      # tsc --noEmit
```

## File layout

- Colocate unit/component tests: `src/**/foo.test.ts` next to `foo.ts`
- Shared harness: [`src/test/`](../src/test/) (`setup.ts`, `test-utils.tsx`, `mock-supabase.ts`)
- Fixtures: `src/test/fixtures/`
- DB suite: `tests/db/**/*.test.ts`
- E2E: `e2e/**/*.spec.ts`

## Mocking Supabase

- Component tests: mock `#/shared/api/supabase` (`getSupabase` / `supabase`) with [`createRpcMock`](../src/test/mock-supabase.ts)
- Do **not** mock away the behavior under test
- Do **not** point automated tests at the remote production project

## Local Supabase (test/CI only)

Not part of day-to-day development. For `test:db` / hermetic E2E:

```bash
npx supabase start
npx supabase db reset   # applies migrations + seed.sql
# Export keys, then:
npm run test:db
```

`supabase/seed.sql` creates deterministic members, a live menu, and auth users for admin / non-admin roles (see seed comments for passwords).

## What must be tested when changing coupons / RLS

- TS `normalizeMemberPhone` parity with SQL `normalize_member_phone` (DB suite)
- `get_coupons_by_phone` for anon (not found / unpaid / paid slots / multiple shared phones)
- Admin-only RPCs: use / unuse / set paid / yearly refresh
- RLS: anon and non-admin cannot mutate members/coupons

## Coverage

- Phase A/B: enforce ~80% lines on listed pure modules via `vitest.config.ts` `coverage.thresholds`
- Do not chase global % on large Win95 page components

## Playwright E2E notes

- E2E boots a dedicated Vite server on port **3001** with env from `supabase status` (never reuse the day-to-day `npm run dev` that points at remote).
- React95 forms need a short client interaction first (tests click **Start** then Escape) so hydration is ready before typing.
- Coupon lookup uses a native `<form>` submit (Enter / submit button) so Playwright does not depend on React95 `onClick` quirks.

## PR checklist

**UI-only change**

- [ ] Unit or component test for new pure logic / critical UI behavior
- [ ] `npm run test` passes

**Migration / RPC / RLS change**

- [ ] Matching `tests/db` case in the same PR
- [ ] Seed updated if fixtures need new rows
- [ ] `npm run test:db` against local stack

**New P0 user journey**

- [ ] Playwright spec under `e2e/`
