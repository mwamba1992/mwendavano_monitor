-- The SELECT-only role the Monitor reads every system with. Safe to run again.
-- Run as postgres, once per monitored database, schema `core` for inventorydb and `public` for the rest:
--   { printf '\\set pw %s\n' "$RO_PASS"; cat deploy/monitor-ro-role.sql; } | sudo -u postgres psql -d postgres
--   sudo -u postgres psql -d inventorydb      -v schema=core   -f deploy/monitor-ro.sql
--   sudo -u postgres psql -d wafanyakazi      -v schema=public -f deploy/monitor-ro.sql
--   sudo -u postgres psql -d mwendavano_cargo -v schema=public -f deploy/monitor-ro.sql
\set ON_ERROR_STOP on
SELECT format('GRANT CONNECT ON DATABASE %I TO monitor_ro', current_database()) \gexec
SELECT format('GRANT USAGE ON SCHEMA %I TO monitor_ro', :'schema') \gexec
SELECT format('GRANT SELECT ON ALL TABLES IN SCHEMA %I TO monitor_ro', :'schema') \gexec
-- Tables made later by each app's migrations: default privileges follow the role that creates them.
SELECT format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA %I GRANT SELECT ON TABLES TO monitor_ro', tableowner, :'schema')
  FROM (SELECT DISTINCT tableowner FROM pg_tables WHERE schemaname = :'schema') o \gexec
