# HAPP

Personal chronic-disease health tracking app. `backend/` is a Node.js + Express +
TypeScript + PostgreSQL (Prisma) API. `mobile/` is an Expo / React Native app.

## Quickstart

```
git clone https://github.com/Harolddddd/HAPP.git
cd HAPP/backend
npm install
cp .env.example .env        # then edit it — see note 1 below
npx prisma migrate deploy   # requires note 2 below to be done first
npm run dev
```

```
cd HAPP/mobile
npm install
# edit src/api/client.ts -> API_BASE_URL, see note 3 below
npx expo start
```

Scan the QR code with Expo Go. Backend and mobile run as two separate,
simultaneous processes — keep both terminals open.

**Notes — unlike a plain pip/npm package, this can't run unmodified:**

1. `.env` has no working default. You must open it and fill in a real
   `DATABASE_URL` (with your Postgres password) and a real `JWT_SECRET`
   (any long random string) before anything will start.
2. Postgres itself must already be installed, running, and have a `happ`
   database created (`CREATE DATABASE happ;`) before `prisma migrate deploy`
   will succeed — it doesn't set up Postgres for you.
3. `API_BASE_URL` in `client.ts` is your phone's route back to this laptop.
   It must be this machine's *current* LAN IP (`ipconfig` → IPv4), so it
   changes every time you change networks or switch machines — there's no
   way to make this one portable.
4. Windows Firewall will silently block the phone from reaching the backend
   unless you add an inbound rule for port 3000.

Full step-by-step version below if any of the above needs more detail.

## Setting up on a new machine

GitHub has all source code and docs. A few things are intentionally **not** in
git and must be recreated locally on each machine:

1. **Install prerequisites**: Git, Node.js, PostgreSQL, Expo Go (on your phone).

2. **Clone**
   ```
   git clone https://github.com/Harolddddd/HAPP.git
   cd HAPP
   ```

3. **Backend**
   ```
   cd backend
   npm install
   ```
   Copy `.env.example` to `.env` and fill in real values:
   ```
   cp .env.example .env
   ```
   - `DATABASE_URL` — point at a Postgres instance on this machine (create a
     `happ` database first).
   - `JWT_SECRET` — any long random string. Use the same value as another
     machine only if you want existing logins/tokens to keep working there.
   - `PORT` — 3000 unless you have a conflict.

   Then set up the schema:
   ```
   npx prisma migrate deploy
   ```

4. **Mobile**
   ```
   cd ../mobile
   npm install
   ```
   Edit `mobile/src/api/client.ts` and set `API_BASE_URL` to this machine's
   LAN IP (`ipconfig` → IPv4 Address), e.g. `http://192.168.1.20:3000`. This
   file is intentionally gitignored-in-spirit (tracked, but the LAN IP line is
   expected to differ per machine and per network) — don't commit your local
   IP.

5. **Windows Firewall**: allow inbound connections on port 3000 so your phone
   (on the same WiFi) can reach the backend.

6. **Run**
   ```
   cd backend && npm run dev
   cd mobile && npx expo start
   ```
   Scan the QR code with Expo Go.

## Not carried by git (by design)

| Item | Why | What to do |
|---|---|---|
| `backend/.env` | secrets | recreate from `.env.example` |
| Postgres database contents | runtime data | fresh DB, or `pg_dump`/`pg_restore` from the old machine if you want existing accounts |
| `node_modules/` | generated | `npm install` |
| `.claude/settings.local.json` | machine-specific Claude Code hook config | optional, recreate if wanted |
