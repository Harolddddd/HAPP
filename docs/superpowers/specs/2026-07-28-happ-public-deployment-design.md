# HAPP Public Deployment — Design Spec

## Context

HAPP currently runs only in local development: backend (Node/Express + Prisma +
PostgreSQL) and Postgres itself live on a personal Windows laptop, reachable
only over the local WiFi network via a hardcoded LAN IP
(`mobile/src/api/client.ts` → `API_BASE_URL`). The mobile app is used through
Expo Go, requiring the phone and laptop to be on the same network.

Goal: make HAPP reachable via a public HTTPS link that anyone can open, usable
as an installable web app ("Add to Home Screen" on Android/iOS), backed by a
real always-on server instead of the developer's laptop.

HAPP is a personal chronic-disease health tracking app: user accounts hold
health data (blood pressure, glucose, medications, chronic conditions). Going
public changes the stakes around auth, data protection, and abuse-resistance
compared to the current local-only setup.

## Scope decisions (from stakeholder discussion)

- **Audience**: truly public. Anyone may register and use the app under the
  `patient` or `doctor` role. The `admin` (manager) role must remain
  non-self-registrable — this is already enforced server-side today
  (`VALID_ROLES = ['patient', 'doctor']` in `backend/src/routes/auth.ts`;
  `/auth/register` rejects any other role). No backend change is needed for
  this constraint; it is called out here so the deployment doesn't
  accidentally loosen it.
- **Hosting**: a rented VPS from Tencent Cloud or Alibaba Cloud, **mainland
  China region**, chosen by the stakeholder with the following known
  trade-off explicitly accepted: mainland-region hosting requires ICP filing
  (real-name registration + government review, typically weeks) before a
  domain name will resolve to the server from within China. Ports 80/443 are
  commonly gated by the provider on unfiled instances. This is an external,
  legal/administrative prerequisite — it is not something this project's
  tooling can perform, and is **not** part of the implementation plan's
  automatable steps.
- **Domain**: not yet owned. Needed for a trusted HTTPS certificate (a bare
  IP cannot get a browser-trusted cert, and PWA installability requires a
  secure context). Acquisition and ICP filing of the domain are stakeholder
  prerequisites.
- **PWA / "Add to Home Screen"**: in scope. Expo's current (Metro-based) web
  export does not auto-generate a PWA manifest or service worker the way the
  legacy Expo CLI web build did, so this is added by hand.

## Architecture

Single VPS running:

- **Nginx** — TLS termination (Let's Encrypt via certbot, auto-renewing),
  routes by subdomain:
  - `app.<domain>` → static files (Expo web export build output)
  - `api.<domain>` → reverse proxy to the Node backend on `localhost:3000`
- **Backend** (Node/Express, existing code), managed by **pm2**, restarted
  on boot.
- **PostgreSQL**, running locally on the VPS, bound to `localhost` only —
  never exposed on a public interface or port.

Subdomain-based routing was chosen over path-based routing (e.g. `/api/*`)
because the existing Express routes are mounted at the application root
(`/auth`, `/profile`, `/records`, `/reminders`, `/adherence`, `/doctor`,
`/usage-events`, `/admin`, `/health` — see `backend/src/app.ts`), not under an
`/api` prefix. A subdomain split avoids having to enumerate and keep an Nginx
path allowlist in sync with backend routes.

Deployment target is a single small VPS (not split across managed DB / CDN /
multiple services). This matches the app's actual scale (personal project,
single admin, expected small public user base) and avoids multiple
provider accounts and bills for capabilities that aren't needed yet.

Docker was considered and explicitly rejected for v1: pulling images from
Docker Hub from a mainland China server is frequently slow or blocked,
requiring a mirror registry to be usable at all. A native (non-containerized)
install avoids that dependency entirely, at the cost of losing some
portability — acceptable for this project's current scope.

## Components

1. **Server bootstrap** (stakeholder-run prerequisite, once VPS + domain +
   ICP filing exist): install Node, PostgreSQL, Nginx, certbot, pm2;
   configure `ufw` to allow only ports 22, 80, 443; create the `happ`
   database and a dedicated Postgres role, bound to `localhost`.
2. **App deploy**: clone the repo onto the VPS, `npm install` + `npm run
   build` for the backend, write a production `.env` with a **freshly
   generated** `JWT_SECRET` (distinct from the local dev secret) and the
   production `DATABASE_URL`, run `prisma migrate deploy`, start the backend
   under `pm2`, and persist it across reboots (`pm2 save` + `pm2 startup`).
3. **Web build + PWA manifest**:
   - `expo export --platform web` produces the static bundle to serve from
     `app.<domain>`.
   - Add a hand-written `manifest.json` (app name, icons sourced from the
     existing `mobile/assets/` icon set, theme color, `display: standalone`,
     `start_url`) plus the corresponding `<link rel="manifest">` and
     Apple touch-icon meta tags injected into the exported `index.html`, so
     Chrome/Android offer an install prompt and iOS Safari's manual "Add to
     Home Screen" picks up the right name/icon.
   - `mobile/src/api/client.ts`'s `API_BASE_URL` needs an environment-based
     value: the existing hardcoded LAN IP remains correct for local dev via
     Expo Go, while the production web export must point at
     `https://api.<domain>`. Exact mechanism (Expo env config / build-time
     define) is an implementation-plan-level decision, not fixed here.
4. **Nginx config**: two server blocks (the subdomains above), certbot-issued
   certificates for both, relying on certbot's default auto-renew (systemd
   timer).
5. **Backend hardening for public exposure** (new work, not in the repo
   today):
   - `backend/src/app.ts` currently calls `cors()` with no options (wide
     open). Restrict it to the deployed web origin (`https://app.<domain>`).
   - Add rate-limiting to `/auth/register` and `/auth/login` to blunt
     brute-force / credential-stuffing attempts now that these endpoints are
     reachable by anyone on the internet, not just LAN devices.
6. **Backups**: a daily cron job running `pg_dump` to local disk on the VPS.
   Explicitly v1-scope only — not encrypted, not shipped off-server. Noted
   as a known limitation rather than solved now, in keeping with the
   project's actual current needs.

## Data flow

Browser or phone → HTTPS (443) → Nginx → either static files (`app.` host)
or reverse proxy (`api.` host) → Express → Prisma → PostgreSQL (localhost
only, never reachable from outside the VPS).

Authentication is unchanged from the current implementation: JWT in the
`Authorization` header, `requireAuth` / `requireRole('admin')` middleware as
today. The public `/auth/register` endpoint continues to reject any role
other than `patient`/`doctor` — this spec does not change that logic.

## Security notes

- TLS via Let's Encrypt, auto-renewing.
- `ufw` firewall: only 22 (SSH), 80, 443 open. PostgreSQL's 5432 is not
  exposed externally at all.
- Production `JWT_SECRET` is newly generated for the server, never reused
  from local dev, and lives only in the server's `.env` (not committed).
- Rate-limiting added to the two auth endpoints (see Components #5).
- CORS restricted to the actual deployed web origin instead of wildcard.
- Admin/manager account creation stays server-enforced and non-public — no
  change from current behavior, verified as part of rollout testing below.
- Backups are basic (local daily `pg_dump`) — explicitly flagged as a gap,
  not solved in this pass.

## Testing / rollout plan

1. Before DNS/ICP resolves: smoke-test against the VPS's bare IP address
   (using an alternate port if 80/443 turn out to be gated pre-filing) to
   confirm Nginx, the backend, and Postgres all work end to end.
2. Once ICP filing completes and DNS resolves: confirm certbot issues valid
   certificates for both subdomains; load `app.<domain>` on a phone browser
   and confirm the install prompt appears (Android) or manual "Add to Home
   Screen" picks up the correct icon/name (iOS).
3. Register a real account through the public registration flow, log in,
   and confirm `/admin/stats` still returns 403 for a non-admin token.
   Confirm CORS rejects a request from a bogus `Origin` header but allows
   `app.<domain>`.
4. No CI/CD is in scope for this pass. Future code changes ship via manual
   `git pull` + rebuild + `pm2 restart` on the server — consistent with the
   project's current scale.

## Explicit non-goals / out of scope

- Automating VPS purchase, ICP filing, or domain registration — these
  require the stakeholder's real-name identity/payment and cannot be done
  by tooling.
- Managed/off-server database backups.
- CI/CD or automated deployment pipelines.
- Multi-region or high-availability hosting.
- Containerization (Docker) — deliberately rejected for v1 (see
  Architecture).
