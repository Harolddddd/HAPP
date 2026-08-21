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
