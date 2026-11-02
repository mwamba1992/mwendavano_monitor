# Mwendavano Monitor

Private, read-only panel over every Mwendavano system. `SPEC.md` is the brief, `DEPLOY.md` the way to production.

```
backend/   NestJS 11 + TypeORM, port 3202
web/       Vue 3 + Vite
deploy/    nginx site, systemd unit, read-only role SQL
design/    the three design files (reference only)
```

## Run locally

Needs a local Postgres. All data here is made up; nothing connects to production.

```bash
createdb mwendavano_monitor
cd backend && npm install
cp .env.example .env          # set DB_USERNAME, JWT_SECRET, RO_DB_PASSWORD=local-only-monitor-ro
npm run seed:dev              # made-up source databases, uptime and visitors
npm run seed:owner -- --phone 0700 000 999 --name "Your Name"
npm run start:dev             # http://127.0.0.1:3202/api

cd ../web && npm install && npm run dev   # http://localhost:5180
```

## Tests

```bash
cd backend && npm test
```

The e2e suite builds its own databases from `backend/test/sources/*.sql`, which are the real table definitions with no rows (`test/make-sources.sh` regenerates them), and reads them as a real `monitor_ro` role.

## How it stays read-only

The monitored databases are read with raw SELECTs in `backend/src/sources/`. A write would have to get past the `monitor_ro` role, which has SELECT only, and connections that open with `default_transaction_read_only=on`. In production the API refuses to boot under any other role.

## Access

| Level | Sees |
|---|---|
| Admin | Everything, can reveal a full phone number (logged) |
| Support | People and details, phones masked |
| View | Numbers only, no names or phones |
| None | The system does not appear |

Global Authentics follows Mauzo, since it lives in the same database. Managing staff takes the owner or Admin on Server. Levels are read from the database on every request, so a change applies at once.
