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
