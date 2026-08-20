# HAPP Public Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the automatable, testable pieces of HAPP's public deployment real — restricted CORS, auth rate-limiting, an environment-driven API base URL for the web build, a working PWA manifest, and committed deployment artifacts (Nginx configs, pm2 config, server bootstrap script, runbook) — so the app is ready to go live the moment the VPS, domain, and ICP filing (external, stakeholder-run prerequisites) are in place.

**Architecture:** Backend gains an env-driven CORS allowlist (open by default for local dev, restricted when `CORS_ORIGIN` is set) and a shared rate limiter on the two auth endpoints. Mobile gains an env-driven `API_BASE_URL` (falls back to the existing hardcoded LAN IP for Expo Go dev) plus a hand-written PWA manifest for the Metro web single-page-app output. A new `deploy/` directory holds the Nginx server-block templates, pm2 ecosystem file, and a bootstrap shell script, tied together by a runbook doc.

**Tech Stack:** Node/Express/Prisma/PostgreSQL (backend), Expo SDK 54 / React Native (mobile), `express-rate-limit`, Nginx, certbot, pm2, Ubuntu VPS.

## Global Constraints

- No Docker for v1 — native install only (spec: mainland China Docker Hub access is unreliable).
- Single VPS hosts Nginx, backend, and Postgres — no split/managed services (spec: YAGNI at this scale).
- Subdomain routing (`app.<domain>` / `api.<domain>`), not path-based — backend routes mount at root, not under `/api`.
- Postgres bound to `localhost` only, never exposed on a public interface.
- Production `JWT_SECRET` must be freshly generated on the server, never reused from local dev `.env`.
- Auth rate limit: 20 requests per 15 minutes per IP, shared across `/auth/register` and `/auth/login` (exact values fixed in this plan; spec left them unspecified).
- `CORS_ORIGIN` env var (comma-separated) drives the allowlist; unset means reflect-any-origin (today's behavior), preserving local dev.
- No CI/CD in scope — deploys are manual `git pull` + rebuild + `pm2 restart`.
- VPS purchase, ICP filing, and domain registration are stakeholder-run prerequisites, not implementation tasks — captured as a runbook, not automated.

---

### Task 1: Restrict backend CORS via `CORS_ORIGIN` env var

**Files:**
- Modify: `backend/src/app.ts:12-13`
- Test: `backend/tests/cors.test.ts`

**Interfaces:**
- Consumes: `process.env.CORS_ORIGIN` (comma-separated origin list, optional)
- Produces: no new exports; `app`'s CORS behavior changes based on env

- [ ] **Step 1: Write the failing test**

Create `backend/tests/cors.test.ts`:

```typescript
import request from 'supertest';

describe('CORS configuration', () => {
  const ORIGINAL_ENV = process.env.CORS_ORIGIN;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = ORIGINAL_ENV;
    }
    jest.resetModules();
  });

  it('reflects any origin when CORS_ORIGIN is unset (dev default)', async () => {
    delete process.env.CORS_ORIGIN;
    jest.resetModules();
    const { app } = require('../src/app');

    const res = await request(app).get('/health').set('Origin', 'http://example.com');
    expect(res.headers['access-control-allow-origin']).toBe('http://example.com');
  });

  it('only allows the configured origin(s) when CORS_ORIGIN is set', async () => {
    process.env.CORS_ORIGIN = 'https://app.example.com';
    jest.resetModules();
    const { app } = require('../src/app');

    const allowed = await request(app).get('/health').set('Origin', 'https://app.example.com');
    expect(allowed.headers['access-control-allow-origin']).toBe('https://app.example.com');

    const blocked = await request(app).get('/health').set('Origin', 'https://evil.example.com');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/cors.test.ts`
Expected: FAIL — both cases currently pass through `cors()` with no options, so the second test's "blocked" assertion fails (the evil origin currently gets reflected too).

- [ ] **Step 3: Write minimal implementation**

In `backend/src/app.ts`, replace:

```typescript
export const app = express();
app.use(cors());
```

with:

```typescript
export const app = express();
const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((o) => o.trim());
app.use(cors(corsOrigins ? { origin: corsOrigins } : undefined));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/cors.test.ts`
Expected: PASS

- [ ] **Step 5: Run full backend test suite to confirm no regressions**

Run: `cd backend && npm test`
Expected: PASS (all existing tests still green — `CORS_ORIGIN` is unset in the normal test run, so behavior matches today's for every other test file)

- [ ] **Step 6: Commit**

```bash
cd backend
git add src/app.ts tests/cors.test.ts
git commit -m "feat(backend): restrict CORS via CORS_ORIGIN env var"
```

---

### Task 2: Rate-limit `/auth/register` and `/auth/login`

**Files:**
- Create: `backend/src/middleware/rateLimit.ts`
- Modify: `backend/src/routes/auth.ts:11-12` (imports), `:12` (register route), `:35` (login route)
- Test: `backend/tests/authRateLimit.test.ts`
- Modify: `backend/package.json` (new dependency)

**Interfaces:**
- Produces: `authRateLimiter` (Express middleware, default export style `RequestHandler`), `AUTH_RATE_LIMIT_WINDOW_MS: number`, `AUTH_RATE_LIMIT_MAX: number` from `backend/src/middleware/rateLimit.ts`

- [ ] **Step 1: Install the dependency**

Run: `cd backend && npm install express-rate-limit`
Expected: adds `express-rate-limit` to `backend/package.json` dependencies and `package-lock.json`.

- [ ] **Step 2: Write the failing test**

Create `backend/tests/authRateLimit.test.ts`:

```typescript
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/db';
import { AUTH_RATE_LIMIT_MAX } from '../src/middleware/rateLimit';

jest.mock('../src/db', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as { user: { findUnique: jest.Mock } };

describe('auth rate limiting', () => {
  it('allows requests up to the configured max, then blocks with 429', async () => {
    mockedPrisma.user.findUnique.mockResolvedValue(null);

    for (let i = 0; i < AUTH_RATE_LIMIT_MAX; i++) {
      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'x' });
      expect(res.status).toBe(401);
    }

    const blocked = await request(app)
      .post('/auth/login')
      .send({ email: 'nobody@example.com', password: 'x' });
    expect(blocked.status).toBe(429);
  });
});
```

This file imports `app` fresh (its own Jest module registry, isolated from `auth.test.ts`), so its request count doesn't interfere with other test files.

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && npx jest tests/authRateLimit.test.ts`
Expected: FAIL with "Cannot find module '../src/middleware/rateLimit'"

- [ ] **Step 4: Write the middleware**

Create `backend/src/middleware/rateLimit.ts`:

```typescript
import rateLimit from 'express-rate-limit';

export const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const AUTH_RATE_LIMIT_MAX = 20;

export const authRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
```

- [ ] **Step 5: Apply the middleware to the auth routes**

In `backend/src/routes/auth.ts`, add the import:

```typescript
import { authRateLimiter } from '../middleware/rateLimit';
```

Then change:

```typescript
authRouter.post('/register', asyncHandler(async (req, res) => {
```

to:

```typescript
authRouter.post('/register', authRateLimiter, asyncHandler(async (req, res) => {
```

And change:

```typescript
authRouter.post('/login', asyncHandler(async (req, res) => {
```

to:

```typescript
authRouter.post('/login', authRateLimiter, asyncHandler(async (req, res) => {
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && npx jest tests/authRateLimit.test.ts`
Expected: PASS

- [ ] **Step 7: Run full backend test suite to confirm no regressions**

Run: `cd backend && npm test`
Expected: PASS — `tests/auth.test.ts` sends 5 requests to `/auth/register` and 3 to `/auth/login` across its file (8 combined, since the limiter is shared across both routes by IP), well under the 20 max, so it stays green.

- [ ] **Step 8: Commit**

```bash
cd backend
git add src/middleware/rateLimit.ts src/routes/auth.ts tests/authRateLimit.test.ts package.json package-lock.json
git commit -m "feat(backend): rate-limit auth endpoints"
```

---

### Task 3: Environment-driven `API_BASE_URL` for the web build

**Files:**
- Modify: `mobile/src/api/client.ts:1-5`
- Test: `mobile/__tests__/client.test.ts`

**Interfaces:**
- Produces: `resolveApiBaseUrl(envValue: string | undefined): string` (exported, pure function), `API_BASE_URL: string` (unchanged export name/type)

- [ ] **Step 1: Write the failing test**

Create `mobile/__tests__/client.test.ts`:

```typescript
import { resolveApiBaseUrl } from '../src/api/client';

describe('resolveApiBaseUrl', () => {
  it('falls back to the LAN dev address when no env value is set', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('http://192.168.1.125:3000');
  });

  it('uses the provided env value when set', () => {
    expect(resolveApiBaseUrl('https://api.example.com')).toBe('https://api.example.com');
  });

  it('falls back when the env value is an empty string', () => {
    expect(resolveApiBaseUrl('')).toBe('http://192.168.1.125:3000');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mobile && npx jest __tests__/client.test.ts`
Expected: FAIL with "resolveApiBaseUrl is not a function" (or similar — the export doesn't exist yet)

- [ ] **Step 3: Write minimal implementation**

In `mobile/src/api/client.ts`, replace:

```typescript
// Point this at your backend's LAN address when testing on a physical device,
// e.g. http://192.168.1.20:3000
export const API_BASE_URL = 'http://localhost:3000';
```

with:

```typescript
// Falls back to this machine's LAN address for Expo Go dev. For the public
// web build, set EXPO_PUBLIC_API_BASE_URL when running `expo export` —
// see deploy/README.md.
const LAN_DEV_API_BASE_URL = 'http://192.168.1.125:3000';

export function resolveApiBaseUrl(envValue: string | undefined): string {
  return envValue && envValue.length > 0 ? envValue : LAN_DEV_API_BASE_URL;
}

export const API_BASE_URL = resolveApiBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd mobile && npx jest __tests__/client.test.ts`
Expected: PASS

- [ ] **Step 5: Run full mobile test suite to confirm no regressions**

Run: `cd mobile && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd mobile
git add src/api/client.ts __tests__/client.test.ts
git commit -m "feat(mobile): drive API_BASE_URL from EXPO_PUBLIC_API_BASE_URL for web builds"
```

---

### Task 4: PWA manifest for the web build

**Files:**
- Create: `mobile/public/index.html` (via `npx expo customize`)
- Create: `mobile/public/manifest.json`
- Create: `mobile/public/icon.png` (copy of `mobile/assets/icon.png`, already 1024x1024)
- Create: `mobile/public/apple-touch-icon.png` (copy of `mobile/assets/icon.png`)
- Test: `mobile/__tests__/manifest.test.ts`

**Interfaces:**
- No code interfaces — this task produces static assets served at the web root by Expo's Metro web output (contents of `public/` are copied as-is into the export).

- [ ] **Step 1: Generate the customizable HTML template**

Run: `cd mobile && npx expo customize public/index.html`
Expected: creates `mobile/public/index.html` from Expo's default template.

- [ ] **Step 2: Write the failing test**

Create `mobile/__tests__/manifest.test.ts`:

```typescript
import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

describe('PWA manifest', () => {
  it('manifest.json has the fields required for install prompts', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'manifest.json'), 'utf8'));
    expect(manifest.name).toBe('HAPP');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('.');
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('index.html links the manifest', () => {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
    expect(html).toContain('rel="manifest"');
  });

  it('icon files referenced by the manifest exist on disk', () => {
    expect(fs.existsSync(path.join(PUBLIC_DIR, 'icon.png'))).toBe(true);
    expect(fs.existsSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'))).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd mobile && npx jest __tests__/manifest.test.ts`
Expected: FAIL — `manifest.json` doesn't exist yet (ENOENT).

- [ ] **Step 4: Create the manifest**

Create `mobile/public/manifest.json`:

```json
{
  "short_name": "HAPP",
  "name": "HAPP",
  "icons": [
    {
      "src": "/icon.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "/icon.png",
      "type": "image/png",
      "sizes": "512x512"
    }
  ],
  "start_url": ".",
  "display": "standalone",
  "theme_color": "#E6F4FE",
  "background_color": "#E6F4FE"
}
```

(`#E6F4FE` matches the existing Android adaptive-icon background color already used in `mobile/app.json`.)

- [ ] **Step 5: Copy the icon files**

Run:
```bash
cd mobile
cp assets/icon.png public/icon.png
cp assets/icon.png public/apple-touch-icon.png
```

- [ ] **Step 6: Link the manifest and add iOS install meta tags**

In `mobile/public/index.html`, inside the `<head>` section, add:

```html
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-title" content="HAPP" />
<meta name="theme-color" content="#E6F4FE" />
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd mobile && npx jest __tests__/manifest.test.ts`
Expected: PASS

- [ ] **Step 8: Verify the web export actually builds**

Run: `cd mobile && npx expo export --platform web`
Expected: succeeds, produces a `dist/` directory (already gitignored) containing `manifest.json`, `icon.png`, `apple-touch-icon.png`, and an `index.html` that references them.

- [ ] **Step 9: Commit**

```bash
cd mobile
git add public/index.html public/manifest.json public/icon.png public/apple-touch-icon.png __tests__/manifest.test.ts
git commit -m "feat(mobile): add PWA manifest for installable web build"
```

---

### Task 5: Deployment artifacts and runbook

**Files:**
- Create: `deploy/setup-server.sh`
- Create: `deploy/nginx-app.conf`
- Create: `deploy/nginx-api.conf`
- Create: `deploy/ecosystem.config.js`
- Create: `deploy/backup-db.sh`
- Create: `deploy/README.md`

**Interfaces:**
- None — these are operational artifacts consumed by a human running them on the future VPS, not by application code. No live server exists yet, so "testing" here means syntax validation, not execution.

- [ ] **Step 1: Write the server bootstrap script**

Create `deploy/setup-server.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Run as root (or via sudo) on a fresh Ubuntu 22.04+ VPS, after DNS for
# both subdomains points at this server's IP.
#
# Required env var: HAPP_DB_PASSWORD (password for the app's Postgres role)
#   HAPP_DB_PASSWORD='...' ./setup-server.sh

: "${HAPP_DB_PASSWORD:?Set HAPP_DB_PASSWORD before running this script}"

apt-get update
apt-get install -y curl ufw nginx postgresql postgresql-contrib

curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

npm install -g pm2

ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

sudo -u postgres psql -c "CREATE DATABASE happ;"
sudo -u postgres psql -c "CREATE USER happ_app WITH PASSWORD '${HAPP_DB_PASSWORD}';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE happ TO happ_app;"

apt-get install -y certbot python3-certbot-nginx

echo "Server bootstrap complete. Next: deploy the app (see deploy/README.md)."
```

- [ ] **Step 2: Verify the script's syntax**

Run: `bash -n deploy/setup-server.sh`
Expected: no output, exit code 0 (syntax-only check — this can't be run end-to-end without a live VPS, so this is the honest test available right now).

- [ ] **Step 3: Write the Nginx server blocks**

Create `deploy/nginx-app.conf`:

```nginx
server {
    listen 80;
    server_name __APP_DOMAIN__;

    root /var/www/happ/mobile-web;
    index index.html;

    location / {
        try_files $uri /index.html;
    }
}
```

Create `deploy/nginx-api.conf`:

```nginx
server {
    listen 80;
    server_name __API_DOMAIN__;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

(`__APP_DOMAIN__` / `__API_DOMAIN__` are placeholders substituted at deploy time via `sed` — see the runbook. `certbot --nginx` rewrites these files in place to add the `listen 443 ssl` blocks, so they're left as HTTP-only here.)

- [ ] **Step 4: Verify the Nginx configs have no obvious syntax errors**

Run: `grep -c "server {" deploy/nginx-app.conf deploy/nginx-api.conf`
Expected: `1` for each file (confirms each file has exactly one server block — a real `nginx -t` check requires an installed Nginx, not available locally, so this is a lightweight sanity check standing in for it).

- [ ] **Step 5: Write the daily backup script**

Create `deploy/backup-db.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

# Intended to run daily via cron on the VPS (see deploy/README.md for the
# crontab line). v1-scope only: local disk, unencrypted, not shipped
# off-server — a known limitation, not solved here.

BACKUP_DIR="/var/backups/happ"
mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
sudo -u postgres pg_dump happ > "$BACKUP_DIR/happ-$TIMESTAMP.sql"

# Keep the last 14 daily backups, delete anything older.
find "$BACKUP_DIR" -name 'happ-*.sql' -mtime +14 -delete
```

- [ ] **Step 6: Verify the backup script's syntax**

Run: `bash -n deploy/backup-db.sh`
Expected: no output, exit code 0.

- [ ] **Step 7: Write the pm2 process file**

Create `deploy/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'happ-backend',
      cwd: '/var/www/happ/backend',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
```

- [ ] **Step 8: Write the runbook**

Create `deploy/README.md`:

```markdown
# HAPP deployment runbook

## Prerequisites (external, not automated by anything in this repo)

1. A Tencent Cloud or Alibaba Cloud VPS (mainland China region), purchased
   and set up with SSH key access.
2. ICP filing completed for the domain you'll use — required before a
   domain resolves to a mainland-China-hosted server. This is a government
   review process; budget real time for it.
3. A registered domain, with two DNS A records pointing at the VPS's IP:
   - `app.<domain>` (the web app)
   - `api.<domain>` (the backend)

## Server bootstrap (run once, on the VPS)

```bash
HAPP_DB_PASSWORD='<choose a real password>' ./deploy/setup-server.sh
```

## Deploy the backend

```bash
cd /var/www
git clone https://github.com/Harolddddd/HAPP.git happ
cd happ/backend
npm install
npm run build

cat > .env <<EOF
DATABASE_URL="postgresql://happ_app:<HAPP_DB_PASSWORD>@localhost:5432/happ?schema=public"
JWT_SECRET="<generate a new random value, e.g. node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">"
PORT=3000
CORS_ORIGIN="https://app.<domain>"
EOF

npx prisma migrate deploy

pm2 start /var/www/happ/deploy/ecosystem.config.js
pm2 save
pm2 startup
```

## Set up daily backups

```bash
chmod +x /var/www/happ/deploy/backup-db.sh
( crontab -l 2>/dev/null; echo "0 3 * * * /var/www/happ/deploy/backup-db.sh" ) | crontab -
```

## Deploy the web build

```bash
cd /var/www/happ/mobile
EXPO_PUBLIC_API_BASE_URL="https://api.<domain>" npx expo export --platform web
mkdir -p /var/www/happ/mobile-web
cp -r dist/* /var/www/happ/mobile-web/
```

## Wire up Nginx + TLS

```bash
sed "s/__APP_DOMAIN__/app.<domain>/" /var/www/happ/deploy/nginx-app.conf > /etc/nginx/sites-available/happ-app
sed "s/__API_DOMAIN__/api.<domain>/" /var/www/happ/deploy/nginx-api.conf > /etc/nginx/sites-available/happ-api
ln -s /etc/nginx/sites-available/happ-app /etc/nginx/sites-enabled/
ln -s /etc/nginx/sites-available/happ-api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

certbot --nginx -d app.<domain> -d api.<domain>
```

## Verify

1. Visit `https://app.<domain>` on a phone browser — confirm it loads and
   offers "Add to Home Screen" (Android auto-prompt; iOS Safari: Share →
   Add to Home Screen, should show the HAPP icon/name).
2. Register a real account through the public flow, log in.
3. Confirm `GET https://api.<domain>/health` returns `{"status":"ok"}`.
4. Confirm a non-admin token gets 403 from `https://api.<domain>/admin/stats`.

## Future code changes

```bash
cd /var/www/happ
git pull
cd backend && npm install && npm run build && npx prisma migrate deploy && pm2 restart happ-backend
cd ../mobile && npm install && EXPO_PUBLIC_API_BASE_URL="https://api.<domain>" npx expo export --platform web && cp -r dist/* /var/www/happ/mobile-web/
```
```

- [ ] **Step 9: Commit**

```bash
git add deploy/
git commit -m "docs: add deployment artifacts and runbook for public hosting"
```
