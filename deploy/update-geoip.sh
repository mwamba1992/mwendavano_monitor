#!/usr/bin/env bash
# Fetches the free DB-IP City Lite database that turns visitor IPs into a country and city.
# Run on the server, as root. deploy.sh runs it, and /etc/cron.d/monitor-geoip repeats it monthly.
# The Monitor notices the new file by itself on its next run, so nothing needs restarting.
#
# DB-IP Lite is CC BY 4.0: the Overview page must keep its "IP Geolocation by DB-IP" link.
set -euo pipefail

DIR="${GEOIP_DIR:-/var/lib/mwendavano-monitor}"
FILE="$DIR/dbip-city-lite.mmdb"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$DIR"
# Early in a month the new file may not be out yet, so fall back to last month's.
for month in "$(date +%Y-%m)" "$(date -d "$(date +%Y-%m-15) -1 month" +%Y-%m)"; do
  if curl -fsSL --max-time 600 -o "$TMP/db.gz" "https://download.db-ip.com/free/dbip-city-lite-$month.mmdb.gz"; then
    gunzip -c "$TMP/db.gz" > "$TMP/db.mmdb"
    # Under 10 MB is an error page or a cut-off download, never the database.
    [ "$(stat -c %s "$TMP/db.mmdb")" -gt 10000000 ] || { echo "!! $month download is too small"; exit 1; }
    cp "$TMP/db.mmdb" "$FILE.new"
    chmod 644 "$FILE.new"
    mv "$FILE.new" "$FILE"
    echo "✓ Location database: $month"
    exit 0
  fi
done

# A failed update keeps the database already there, so visitor places carry on.
echo "!! Could not download a location database"
exit 1
