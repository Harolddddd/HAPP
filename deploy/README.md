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
apt-get update && apt-get install -y git
mkdir -p /var/www
cd /var/www
git clone https://github.com/Harolddddd/HAPP.git happ
cd happ

HAPP_DB_PASSWORD='<choose a real password>' ./deploy/setup-server.sh
```

## Deploy the backend

```bash
cd /var/www/happ/backend
npm install
npm run build

JWT_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"

cat > .env <<EOF
DATABASE_URL="postgresql://happ_app:<HAPP_DB_PASSWORD>@localhost:5432/happ?schema=public"
JWT_SECRET="${JWT_SECRET}"
PORT=3000
CORS_ORIGIN="https://app.<domain>"
EOF

npx prisma migrate deploy

pm2 start /var/www/happ/deploy/ecosystem.config.js
pm2 save
pm2 startup
```

`pm2 startup` only *prints* a `sudo env PATH=... pm2 startup ...` command — copy
that printed command and run it as a separate step, otherwise the systemd unit
is never registered and pm2 will not restart the backend after a reboot.

## Set up daily backups

```bash
chmod +x /var/www/happ/deploy/backup-db.sh
( crontab -l 2>/dev/null; echo "0 3 * * * /var/www/happ/deploy/backup-db.sh" ) | crontab -
```

## Deploy the web build

```bash
cd /var/www/happ/mobile
npm install
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
5. Confirm the exported web bundle really points at the production API — run
   from `/var/www/happ/mobile`:

   ```bash
   grep -rl "api.<domain>" dist/_expo | head -1
   ```

   Expected: a file path. Empty output means `EXPO_PUBLIC_API_BASE_URL` was
   missed at export time, so the bundle still calls the hardcoded LAN dev IP
   (`http://192.168.1.125:3000`) — which an HTTPS page blocks as mixed content,
   with nothing failing server-side to make it obvious. Re-export with the env
   var set and re-copy to `/var/www/happ/mobile-web/`.
6. Confirm CORS rejects a bogus origin:

   ```bash
   curl -sI -H "Origin: https://evil.example.com" https://api.<domain>/health | grep -i access-control
   ```

   Expected: no output at all — the response must carry no
   `Access-Control-Allow-Origin` header.
7. Confirm CORS still allows the real app origin:

   ```bash
   curl -sI -H "Origin: https://app.<domain>" https://api.<domain>/health | grep -i access-control
   ```

   Expected: `access-control-allow-origin: https://app.<domain>`.

## Future code changes

```bash
cd /var/www/happ
git pull
cd backend && npm install && npm run build && npx prisma migrate deploy && pm2 restart happ-backend
cd ../mobile && npm install && EXPO_PUBLIC_API_BASE_URL="https://api.<domain>" npx expo export --platform web && cp -r dist/* /var/www/happ/mobile-web/
```
