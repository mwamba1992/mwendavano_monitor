#!/usr/bin/env bash
# Regenerates the source-schema fixtures from schema-only copies of the three real databases.
# Table definitions only: no rows, so no customer data can reach git.
#   bash test/make-sources.sh   (needs local databases mon_src_inventory/wafanyakazi/cargo)
set -euo pipefail
cd "$(dirname "$0")/sources"

clean() { sed -E '/^(SET|SELECT pg_catalog|\\restrict|\\unrestrict|--)/d;/^$/d'; }

pg_dump --schema-only --no-owner --no-privileges -n core mon_src_inventory | clean > inventory.sql
pg_dump --schema-only --no-owner --no-privileges mon_src_wafanyakazi | clean > wafanyakazi.sql
pg_dump --schema-only --no-owner --no-privileges mon_src_cargo | clean > cargo.sql
wc -l inventory.sql wafanyakazi.sql cargo.sql
