#!/usr/bin/env bash
# Builds and starts Mwendavano Monitor on the server, from the git clone in /var/www/mwendavano-monitor.
# API on :3202 under systemd, website through nginx, at https://monitor.mwendavano.com
#
#   cd /var/www/mwendavano-monitor && git pull --ff-only && bash deploy/deploy.sh
#
# Run it on the server, as root. First install or update, safe to run again.
# The owner's OK comes first: see DEPLOY.md. Later runs only build and restart;
# .env and the database are never overwritten. This never changes another app's nginx site.
set -euo pipefail

DOMAIN="${DOMAIN:-monitor.mwendavano.com}"
APP=/var/www/mwendavano-monitor
WEB=/var/www/monitor-web
NODE_BIN=/root/.nvm/versions/node/v20.19.5/bin
HERE="$(cd "$(dirname "$0")/.." && pwd)"

[ "$(id -u)" = 0 ] && [ "$HERE" = "$APP" ] || { echo "!! Run this on the server, as root, from $APP"; exit 1; }
export PATH="$NODE_BIN:$PATH"
cd "$APP/backend"
if ss -ltn | grep -q ':3202 ' && ! systemctl is-active -q monitor-api; then echo "!! Port 3202 is in use by something else"; exit 1; fi

# First run: own database, read-only role, .env with random secrets.
if [ ! -f .env ]; then
  DB_PASS=$(openssl rand -hex 24)
  RO_PASS=$(openssl rand -hex 24)
  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='monitor'" | grep -q 1 || sudo -u postgres psql -c "CREATE USER monitor;" >/dev/null
  # Passwords go in through stdin: a sudo command line is written to /var/log/auth.log.
  printf "SET log_statement = 'none';\nALTER USER monitor WITH PASSWORD '%s';\n" "$DB_PASS" | sudo -u postgres psql -q
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='mwendavano_monitor'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE mwendavano_monitor OWNER monitor;" >/dev/null
  cp "$APP/deploy/monitor-ro.sql" "$APP/deploy/monitor-ro-role.sql" /tmp/
  { printf '\\set pw %s\n' "$RO_PASS"; cat /tmp/monitor-ro-role.sql; } | sudo -u postgres psql -q -d postgres
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
INVENTORY_DB_TIMEZONE=$(timedatectl show -p Timezone --value)
# The Soko App Review phone: set it, then systemctl restart monitor-api
REVIEW_PHONE=
ENV
  )
  chmod 600 .env
  echo "  created database, read-only role and .env"
fi

echo "→ Building API and website"
npm ci --no-audit --no-fund >/dev/null
npm run build >/dev/null
npm prune --omit=dev --no-audit --no-fund >/dev/null
(cd "$APP/web" && npm ci --no-audit --no-fund >/dev/null && npm run build >/dev/null)
rm -rf "$WEB.new"
cp -r "$APP/web/dist" "$WEB.new"
rm -rf "$WEB"
mv "$WEB.new" "$WEB"

# Service (migrations run at boot because NODE_ENV=production).
cp "$APP/deploy/systemd/monitor-api.service" /etc/systemd/system/monitor-api.service
systemctl daemon-reload
systemctl enable monitor-api >/dev/null 2>&1
systemctl restart monitor-api
for i in $(seq 1 30); do curl -sf http://127.0.0.1:3202/api/health >/dev/null && break; sleep 1; done
curl -sf http://127.0.0.1:3202/api/health >/dev/null || { journalctl -u monitor-api -n 40 --no-pager; exit 1; }
echo "  API healthy"

# nginx + HTTPS, first time only (certbot adds the 443 block to this file).
cp "$APP/deploy/nginx/monitor-proxy.conf" "$APP/deploy/nginx/monitor-headers.conf" /etc/nginx/
if [ ! -f "/etc/nginx/sites-available/$DOMAIN" ]; then
  cp "$APP/deploy/nginx/$DOMAIN.conf" "/etc/nginx/sites-available/$DOMAIN"
  ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"
fi
nginx -t && systemctl reload nginx
if ! grep -q ssl_certificate "/etc/nginx/sites-available/$DOMAIN"; then
  certbot --nginx -d "$DOMAIN" --redirect --non-interactive --agree-tos --register-unsafely-without-email \
    || echo "!! HTTPS not set up yet: add the DNS A record for $DOMAIN, then run this script again"
fi

echo "✓ Live: https://$DOMAIN"
