# HAPP

Personal chronic-disease health tracking app. `backend/` is a Node.js + Express +
TypeScript + PostgreSQL (Prisma) API. `mobile/` is an Expo / React Native app.

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
