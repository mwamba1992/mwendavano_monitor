-- Creates monitor_ro, or resets its password. NOSUPERUSER etc. are spelled out on purpose.
-- Feed it through stdin after `\set pw <password>`, so the password stays off every command line.
\set ON_ERROR_STOP on
SET log_statement = 'none';
SELECT 'CREATE ROLE monitor_ro' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'monitor_ro') \gexec
ALTER ROLE monitor_ro LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'pw';
