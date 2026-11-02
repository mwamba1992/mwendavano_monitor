#!/usr/bin/env bash
# Proves the role cannot write. Every line must print "refused". Run on the server from backend/.
set -uo pipefail
set -a; . ./.env; set +a
try() {
  out=$(PGPASSWORD="$RO_DB_PASSWORD" psql -h localhost -U monitor_ro -d "$1" -Atc "$2" 2>&1)
  if grep -q "permission denied" <<<"$out"; then echo "refused: $1"; else echo "WRITE WAS NOT REFUSED on $1: $out"; exit 1; fi
}
try inventorydb "INSERT INTO core.buyer (phone) VALUES ('+255000000000')"
try wafanyakazi "DELETE FROM employees"
try mwendavano_cargo "UPDATE customers SET name = name"
