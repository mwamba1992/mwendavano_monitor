#!/usr/bin/env bash
# Fetches the free DB-IP Lite databases the visitor counter uses:
#   - City Lite: turns a visitor IP into a country and city;
#   - ASN Lite:  names the network an IP is on, so visits from data centres (crawlers, scanners,
#                uptime checks) are not counted as people.
# Run on the server, as root. deploy.sh runs it, and /etc/cron.d/monitor-geoip repeats it monthly.
# The Monitor notices new files by itself on its next run, so nothing needs restarting.
#
# DB-IP Lite is CC BY 4.0: the Overview page must keep its "IP Geolocation by DB-IP" link.
set -euo pipefail

DIR="${GEOIP_DIR:-/var/lib/mwendavano-monitor}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$DIR"

# fetch <db-ip name> <minimum size in bytes> <label>
fetch() {
  local name="$1" min="$2" label="$3" file="$DIR/$1.mmdb"
  # Early in a month the new file may not be out yet, so fall back to last month's.
  for month in "$(date +%Y-%m)" "$(date -d "$(date +%Y-%m-15) -1 month" +%Y-%m)"; do
    if curl -fsSL --max-time 600 -o "$TMP/$name.gz" "https://download.db-ip.com/free/$name-$month.mmdb.gz"; then
      gunzip -c "$TMP/$name.gz" > "$TMP/$name.mmdb"
      # A small file is an error page or a cut-off download, never the database.
      [ "$(stat -c %s "$TMP/$name.mmdb")" -gt "$min" ] || { echo "!! $label $month download is too small"; return 1; }
      cp "$TMP/$name.mmdb" "$file.new"
      chmod 644 "$file.new"
      mv "$file.new" "$file"
      echo "✓ $label: $month"
      return 0
    fi
  done
  # A failed update keeps the file already there, so counting carries on.
  echo "!! Could not download the $label"
  return 1
}

status=0
fetch dbip-city-lite 10000000 "location database" || status=1
fetch dbip-asn-lite 1000000 "network database" || status=1
exit $status
