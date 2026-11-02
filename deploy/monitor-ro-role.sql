-- Creates monitor_ro, or resets its password. NOSUPERUSER etc. are spelled out on purpose.
\set ON_ERROR_STOP on
SELECT 'CREATE ROLE monitor_ro' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'monitor_ro') \gexec
ALTER ROLE monitor_ro LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :pw;
