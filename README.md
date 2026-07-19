# Godebonner

Lightweight progressive web app built with TanStack Start, React95, and Supabase.

## Backend (Supabase)

This app talks to the **remote Godebonner Supabase project** (`inkuubqwtzutaxaimjoc`). We do **not** run a local Supabase/Postgres stack for day-to-day development.

This project and its database are **entirely separate from the Subb project** — different Supabase project, different credentials, different schema. Do not reuse Subb env vars, project refs, or migrations here.

| | Godebonner (this repo) | Subb |
|---|------------------------|------|
| Supabase | Remote project `godebonner` / `inkuubqwtzutaxaimjoc` | Separate project — do not use here |
| Local DB | Not used | N/A for this repo |

Point `.env.local` at the Godebonner project URL and publishable key from the [Supabase dashboard](https://supabase.com/dashboard) (Settings → API).

## Stack

- **UI:** [React95](https://react95.io/)
- **Routing / SSR:** [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router)
- **Data:** [TanStack Query](https://tanstack.com/query)
- **State / lists:** [TanStack Store](https://tanstack.com/store), [TanStack Virtual](https://tanstack.com/virtual)
- **Backend:** [Supabase](https://supabase.com/) — **remote Godebonner project only** (auth, database, realtime-ready)

## Project structure

```
src/
  app/           # Global providers and layouts
  shared/        # Supabase client, auth guards, shared UI
  features/      # Business screens (home, auth, admin)
  routes/        # Thin TanStack file routes
supabase/
  migrations/    # Database schema (pushed to the remote Godebonner project)
```

## Getting started

```bash
npm install
cp .env.example .env.local
# Fill VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from the Godebonner Supabase project
# (optional legacy: VITE_SUPABASE_ANON_KEY). Do not copy values from Subb.
npm run dev
```

App runs at [http://localhost:3000](http://localhost:3000). The Vite app is local; the database is always the remote Godebonner Supabase project.

## Environment variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Godebonner Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Godebonner publishable (public) API key |
| `VITE_SUPABASE_ANON_KEY` | *(optional legacy)* Same role as publishable key; used if `VITE_SUPABASE_PUBLISHABLE_KEY` is unset |
| `SUPABASE_PROJECT_REF` | Godebonner project ref (`inkuubqwtzutaxaimjoc`) for `supabase link` / `db:push` |
| `VITE_ADMIN_STATUS_URLS` | Optional comma-separated HTTPS URLs for the admin **System status** page (GET only, no credentials) |

Copy `.env.example` to `.env.local` (gitignored). Never commit secrets. Never use Subb project credentials in this repo.

## Database migrations (CLI)

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli). Schema changes are applied to the **linked remote Godebonner project**. We do not use `supabase start` / a local Docker database for this app.

### Link and push to Godebonner

One-time setup:

```bash
supabase login
npm run supabase:link
# Use project ref inkuubqwtzutaxaimjoc (Godebonner — not Subb)
# Or set SUPABASE_PROJECT_REF=inkuubqwtzutaxaimjoc in .env.local
```

Apply all migrations in `supabase/migrations/` to the linked remote database:

```bash
npm run db:push
```

Create a new migration file, edit it, then push to Godebonner:

```bash
npm run db:migrate -- add_orders_table
# Edit supabase/migrations/<timestamp>_add_orders_table.sql
npm run db:push
```

Regenerate TypeScript types from the remote Godebonner schema:

```bash
npm run db:types:remote
```

### Useful commands

| Command | Description |
|---------|-------------|
| `npm run supabase:link` | Link CLI to the Godebonner remote project |
| `npm run db:push` | Apply migrations to the linked Godebonner project |
| `npm run db:migrate -- <name>` | Create a new migration file |
| `npm run db:pull` | Pull remote schema into migrations (use with care) |
| `npm run db:types:remote` | Generate types from the linked remote Godebonner DB |

Local-only scripts (`supabase:start`, `db:reset`, `db:types`, `db:status`, etc.) may still exist in `package.json` but are **not part of the supported workflow** for this repo.

## Members and coupons

Migrations add `public.members` (name, normalized `phone` and `email` — neither unique; identity is `external_id` / PK — `paid`, `coupons_remaining` 0–3, `last_allocation_at`) plus:

- `public.get_coupons_by_phone(p_phone text, p_member_id uuid default null)` — `SECURITY DEFINER` RPC returning only lookup fields for the public home page (no broad anonymous `SELECT` on `members`). When several members share a phone it returns `multiple` with name candidates; pass `p_member_id` to load coupons for one of them.
- `public.admin_refresh_yearly_coupons()` — sets `coupons_remaining = 3` and `last_allocation_at = now()` for every **paid** member; callable only by authenticated admins (checked inside the definer function).

**Allocation model:** Coupons do **not** reset on a calendar. Only the admin **“Oppfrisk årskuponger”** action applies a new yearly allocation (all members paid this year → 3 coupons, timestamp updated). Members who have not paid this year always have 0 coupons (enforced by a trigger and a check constraint).

### How to test

1. Apply migrations to Godebonner: `npm run db:push`.
2. Regenerate types: `npm run db:types:remote`.
3. **Public lookup:** Open `/`, enter a phone number. Unknown numbers → “not found” style message; several members sharing the number → pick which member; not paid this year → no coupons message; paid with balance → count.
4. **Admin:** Sign in as an admin, open `/admin/members`, add a member who has paid this year (toggle paid on), confirm coupons default to 3, then run **Oppfrisk årskuponger** and confirm paid rows show 3 and `last_allocation_at` updates.

If you skip migrations in the dashboard, run the SQL file under `supabase/migrations/` that starts with `20260519140000` so PostgREST exposes the new table and RPCs.

## Database and first admin

After migrations are applied on the Godebonner project (CLI or SQL editor):

1. Create a user in Supabase Auth (dashboard → Authentication for the **Godebonner** project).
2. Promote that user to admin:

```sql
update public.profiles
set is_admin = true
where id = '<your-user-uuid>';
```

Only users with `profiles.is_admin = true` can access `/admin` after signing in at `/login`. The app checks admin access using the authenticated session and the `public.is_current_user_admin()` RPC (falls back to a direct `profiles` read if the RPC is not deployed yet).

Apply migrations (`npm run db:push`) so the RPC exists; without it, admin detection still works when RLS allows each user to read their own `profiles` row.

### Admin system status (`health_check` RPC)

The **System status** page (`/admin/status`) calls a small RPC `public.health_check()` so PostgREST and the database are verified beyond auth alone. It is included in migrations (`supabase/migrations/`). Apply with `npm run db:push` to the Godebonner project.

If you maintain the schema only in the SQL editor, run:

```sql
create or replace function public.health_check()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('ok', true);
$$;

revoke all on function public.health_check() from public;
grant execute on function public.health_check() to authenticated;
```

The status UI falls back to a read on `public.profiles` (allowed by existing RLS for admins) when the RPC is missing.

## Routes

| Path | Access | Description |
|------|--------|-------------|
| `/` | Public | Phone lookup for remaining free-drink coupons |
| `/login` | Public | Administrator sign in |
| `/admin` | Admin only | Administration overview |
| `/admin/status` | Admin only | System status (Supabase + optional URL checks) |
| `/admin/members` | Admin only | Members table, add/edit/delete, yearly coupon refresh |
| `/admin/users` | Admin only | Manage administrator access |

## PWA

The app is a Progressive Web App (installable on phone/tablet home screens).

### What you get

- Correct square / maskable icons and Apple touch icon
- Service worker that precaches the app shell (JS/CSS) for offline launch
- Coupon lookup, menu, and admin stay **network-required** (never stale coupon counts)
- Offline banner when the device has no connectivity
- Soft install hint after the second visit, plus **Start → Installer app…**
- Update dialog when a new shell version is available

### Generate icons

Requires [ImageMagick](https://imagemagick.org/) (`magick` or `convert`):

```bash
npm run icons:pwa
```

Source logo: `public/godebonner_sirkel_v3.png`.

### Test install locally

PWAs need HTTPS (or `localhost`). After a production build:

```bash
npm run build
npm run preview
```

Then:

1. **Android Chrome:** open the preview URL → browser menu → Install app / Add to Home screen.
2. **iOS Safari:** Share → Legg til på Hjem-skjerm.
3. Confirm the app opens fullscreen (teal desktop, no browser chrome).
4. Toggle airplane mode → shell still loads with the offline banner; turn network back on → coupon lookup works.

For a real device against your laptop, use a tunnel (e.g. Cloudflare Tunnel / ngrok) so the phone gets HTTPS.

`npm run build` fails if `sw.js` is missing (TanStack Start historically skipped SW generation).

## Testing

Automated tests use Vitest (unit/component), a local Supabase stack for DB/RLS/RPC only in CI/test, and Playwright for a few critical journeys. Day-to-day development still uses the **remote** Godebonner project.

See **[docs/TESTING.md](docs/TESTING.md)** for the pyramid, commands, mocking rules, and PR checklists. Manual coupon smoke steps in [Members and coupons](#members-and-coupons) remain useful for exploratory QA.

## Scripts

```bash
npm run dev           # Development server (port 3000)
npm run build         # Production build (+ SW generate + verify)
npm run preview       # Preview production build
npm run icons:pwa     # Regenerate PWA / Apple touch icons
npm run test          # Vitest unit + component
npm run test:coverage # Coverage on pure modules
npm run test:db       # DB/RLS suite (local Supabase)
npm run test:e2e      # Playwright
npm run typecheck     # TypeScript
npm run lint          # ESLint
```

See [Database migrations (CLI)](#database-migrations-cli) for `db:*` and `supabase:*` commands against the remote Godebonner project.
