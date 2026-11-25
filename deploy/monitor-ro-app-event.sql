-- Lets the Monitor read the app journey steps (Customer journey page). Run as postgres, once,
-- AFTER dukani-api has restarted on the build that creates core.app_event. Safe to run again.
--   sudo -u postgres psql -d inventorydb -f deploy/monitor-ro-app-event.sql
\set ON_ERROR_STOP on
GRANT SELECT ON core.app_event TO monitor_ro;
-- Check: must print t
SELECT has_table_privilege('monitor_ro', 'core.app_event', 'SELECT') AS monitor_can_read;
-- And must still refuse writes: this is expected to fail with "permission denied".
-- SET ROLE monitor_ro; INSERT INTO core.app_event (event, device_id) VALUES ('x', gen_random_uuid()); RESET ROLE;
