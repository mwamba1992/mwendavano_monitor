#!/usr/bin/env bash
# Gives each public site its own nginx access log, which is what the visitor numbers read.
# Run on the server, as root, once. Safe to run again.
#
#   bash deploy/add-visitor-logs.sh
#
# Backs the configs up first, and puts them back if nginx -t fails, so a bad edit never reaches the live sites.
# Set NGINX_SITES to try it on copies; nginx is then left alone.
set -euo pipefail

SITES_DIR="${NGINX_SITES:-/etc/nginx/sites-available}"
BACKUP="${NGINX_BACKUP:-/root/nginx-backup-$(date +%Y%m%d-%H%M%S)}"
LOG_DIR=/var/log/nginx

mkdir -p "$BACKUP"
cd "$SITES_DIR"

# config file | the server_name line of its HTTPS block | log name (the same names as SITES in visitors.service.ts)
add() {
  local file="$1" name="$2" log="$LOG_DIR/$3"
  cp -p "$file" "$BACKUP/$file"
  if grep -q "access_log $log;" "$file"; then echo "  already there: $file"; return; fi
  grep -q "^[[:space:]]*server_name $name;" "$file" || { echo "!! no 'server_name $name;' in $file"; exit 1; }
  # cat > keeps the file's owner and mode. Only the first match: that is the HTTPS block in all of these.
  awk -v want="server_name $name;" -v line="    access_log $log;" '
    { print }
    !done { s = $0; sub(/^[ \t]+/, "", s); if (s == want) { print line; done = 1 } }
  ' "$file" > "$BACKUP/$file.new"
  cat "$BACKUP/$file.new" > "$file"
  rm -f "$BACKUP/$file.new"
  echo "  added: $file"
}

add dukanisoko.com         'dukanisoko.com www.dukanisoko.com' dukanisoko.com.access.log
add dukanimauzo            'dukanimauzo.com'                   dukanimauzo.com.access.log
add store.mwendavano.com   'store.mwendavano.com'              store.mwendavano.com.access.log
add cargo.mwendavano.com   'cargo.mwendavano.com'              cargo.mwendavano.com.access.log
add wafanyakazi            'wafanyakazi.mwendavano.com'        wafanyakazi.mwendavano.com.access.log
add mwendavano.com         'mwendavano.com'                    mwendavano.com.access.log

[ -n "${NGINX_SITES:-}" ] && { echo "Copies only: nginx left alone"; exit 0; }

if nginx -t; then
  systemctl reload nginx
  echo "✓ Reloaded. Backup: $BACKUP. Visitor numbers start now and appear within 10 minutes."
else
  cp -p "$BACKUP"/* "$SITES_DIR"/
  echo "!! nginx -t failed. The configs are back as they were, and nginx was not reloaded."
  exit 1
fi
