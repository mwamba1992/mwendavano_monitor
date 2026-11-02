#!/usr/bin/env bash
# Deploys Mwendavano Monitor to the Mwendavano VPS (no Docker): API on :3202 + website, at https://monitor.mwendavano.com
#
#   bash deploy/deploy.sh                 first install or update (safe to run again)
#
# The owner's OK comes first: see DEPLOY.md. Later runs only upload new code and restart;
# .env and the database are never overwritten. This never changes another app's nginx site.
set -euo pipefail

SERVER="${SERVER:-root@84.247.178.93}"
DOMAIN="${DOMAIN:-monitor.mwendavano.com}"
APP=/var/www/mwendavano-monitor
WEB=/var/www/monitor-web
NODE_BIN=/root/.nvm/versions/node/v20.19.5/bin
HERE="$(cd "$(dirname "$0")/.." && pwd)"

# One SSH connection for every step: the server rate-limits SSH.
SSH_CTL="/tmp/mon-%C"
SSH_OPTS=(-o ControlMaster=auto -o ControlPath="$SSH_CTL" -o ControlPersist=120 -o ConnectTimeout=15)
ssh() { command ssh "${SSH_OPTS[@]}" "$@"; }
export RSYNC_RSH="ssh ${SSH_OPTS[*]}"
trap 'command ssh "${SSH_OPTS[@]}" -O exit "$SERVER" 2>/dev/null || true' EXIT

echo "→ Building API and website"
(cd "$HERE/backend" && npm run build >/dev/null)
(cd "$HERE/web" && npm run build >/dev/null)

echo "→ Uploading to $SERVER"
ssh "$SERVER" "mkdir -p $APP/backend $WEB"
rsync -az --delete "$HERE/backend/dist/" "$SERVER:$APP/backend/dist/"
rsync -az "$HERE/backend/package.json" "$HERE/backend/package-lock.json" "$SERVER:$APP/backend/"
rsync -az "$HERE/deploy/" "$SERVER:$APP/deploy/"
rsync -az --delete "$HERE/web/dist/" "$SERVER:$WEB/"

echo "→ Installing on the server"
ssh "$SERVER" APP="$APP" DOMAIN="$DOMAIN" NODE_BIN="$NODE_BIN" bash -s <<'REMOTE'
set -euo pipefail
export PATH="$NODE_BIN:$PATH"
cd "$APP/backend"
ss -ltn | grep -q ':3202 ' && ! systemctl is-active -q monitor-api && { echo "!! Port 3202 is in use by something else"; exit 1; }

# First run: own database, read-only role, .env with random secrets.
if [ ! -f .env ]; then
  DB_PASS=$(openssl rand -hex 24)
  RO_PASS=$(openssl rand -hex 24)
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='monitor'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER monitor;" >/dev/null
  printf "ALTER USER monitor WITH PASSWORD '%s';\n" "$DB_PASS" | sudo -u postgres psql -q
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='mwendavano_monitor'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE mwendavano_monitor OWNER monitor;" >/dev/null
  cp "$APP/deploy/monitor-ro.sql" "$APP/deploy/monitor-ro-role.sql" /tmp/
  sudo -u postgres psql -q -d postgres -v pw="'$RO_PASS'" -f /tmp/monitor-ro-role.sql
  sudo -u postgres psql -q -d inventorydb -v schema=core -f /tmp/monitor-ro.sql
  sudo -u postgres psql -q -d wafanyakazi -v schema=public -f /tmp/monitor-ro.sql
  sudo -u postgres psql -q -d mwendavano_cargo -v schema=public -f /tmp/monitor-ro.sql
  rm -f /tmp/monitor-ro.sql /tmp/monitor-ro-role.sql
  ( umask 077
  cat > .env <<ENV
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=monitor
DB_PASSWORD=$DB_PASS
DB_DATABASE=mwendavano_monitor
JWT_SECRET=$(openssl rand -hex 32)
RO_DB_USERNAME=monitor_ro
RO_DB_PASSWORD=$RO_PASS
RO_DB_INVENTORY=inventorydb
RO_DB_WAFANYAKAZI=wafanyakazi
RO_DB_CARGO=mwendavano_cargo
# The Soko App Review phone: set it, then systemctl restart monitor-api
REVIEW_PHONE=
ENV
  )
  chmod 600 .env
  echo "  created database, read-only role and .env"
fi

npm ci --omit=dev --no-audit --no-fund >/dev/null

# Service (migrations run at boot because NODE_ENV=production).
cp "$APP/deploy/systemd/monitor-api.service" /etc/systemd/system/monitor-api.service
systemctl daemon-reload
systemctl enable monitor-api >/dev/null 2>&1
systemctl restart monitor-api
for i in $(seq 1 30); do curl -sf http://127.0.0.1:3202/api/health >/dev/null && break; sleep 1; done
curl -sf http://127.0.0.1:3202/api/health >/dev/null || { journalctl -u monitor-api -n 40 --no-pager; exit 1; }
echo "  API healthy"

# nginx + HTTPS, first time only (certbot adds the 443 block to this file).
cp "$APP/deploy/nginx/monitor-proxy.conf" /etc/nginx/monitor-proxy.conf
if [ ! -f "/etc/nginx/sites-available/$DOMAIN" ]; then
  cp "$APP/deploy/nginx/$DOMAIN.conf" "/etc/nginx/sites-available/$DOMAIN"
  ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
fi
nginx -t && systemctl reload nginx
if ! grep -q ssl_certificate "/etc/nginx/sites-available/$DOMAIN"; then
  certbot --nginx -d "$DOMAIN" --redirect --non-interactive --agree-tos --register-unsafely-without-email \
    || echo "!! HTTPS not set up yet: add the DNS A record for $DOMAIN, then run this script again"
fi
REMOTE

echo "✓ Live: https://$DOMAIN"
