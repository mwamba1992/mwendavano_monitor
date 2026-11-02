# Mwendavano Monitor: build spec

Hand-off document for a Claude Code session. Read this whole file before writing code.

## 1. What it is

One private web panel where Mwendavano Holdings staff watch **every system the company runs**:

- new users
- website visitors
- system health
- the server
- staff access

**The panel is read-only**: it never changes data in the systems it watches.

Owner: Joel M. Gaitan (CEO). Address: **monitor.mwendavano.com** (assumed; confirm with the owner before deploying).

### Systems to monitor

| System | What it is | Code (local) | Database | Service on the server |
|---|---|---|---|---|
| Dukani Mauzo | Shops' sales/stock app + portal (dukanimauzo.com) | `~/personal/inventory-management-backend` | `inventorydb`, schema `core` | `dukani-api` |
| Dukani Soko | Marketplace for buyers (dukanisoko.com, iOS/Android app) | API: same backend · web: `~/personal/ecommerce-store-front` (Nuxt) | `inventorydb` (`core`) | `dukani-api`, `dukani-soko` (web) |
| Global Authentics TZ | Our own retail shop (business_id = 1 in inventorydb) | same backend | `inventorydb` | `dukani-api` |
| Dukani Wafanyakazi | Staff attendance and pay | `~/personal/wafanyakazi` (backend + web) | `wafanyakazi` | `wafanyakazi-api` (port 3101) |
| Mwendavano Cargo | Cargo shipments Dubai → Dar | `~/personal/mwendavano-cargo` | `mwendavano_cargo` | `cargo-api` |

All of them run on **one Ubuntu VPS (Contabo, 84.247.178.93)** with nginx and one PostgreSQL server.

## 2. The design (follow it closely)

The design files are in `design/`:

- `Main.dc.html`: Overview
- `Users.dc.html`: Users
- `Staff.dc.html`: Staff and access

Each file is HTML. The `renderVals()` script at the bottom holds the sample data and the exact colours and styles. Use them as the visual reference; do not import that format. Live design canvas, owner only: https://claude.ai/artifact/FnrYMoQ1xSVwgZt7TLcSvM

### Design language
- **Fonts:** Inter Tight for UI, IBM Plex Mono for numbers.
- **Colours:**

  | Use | Value |
  |---|---|
  | Ground | `#f3f5f4` |
  | Cards | `#ffffff`, border `#dce5e1`, radius 14px |
  | Ink | `#10211f` |
  | Muted text | `#4d5f5c` |
  | Sidebar | `#0f2624`, active item `#1d3d3a` |
  | Accent teal | `#0f6b6b` |
  | Amber | `#f0b429` |
  | OK | `#145c39` on `#dff3e8` |
  | Warning | `#7a4a00` on `#fdf0d2` |
  | Bad | `#8a1c12` on `#fde7e4` |

- **System tags:**

  | System | Text on background |
  |---|---|
  | Mauzo | `#0a4c4c` / `#dcefee` |
  | Soko | `#3d4a08` / `#eef8c7` |
  | Wafanyakazi | `#7a4a00` / `#fdf0d2` |
  | Cargo | `#22396b` / `#e3eaf8` |

- **Layout:** sidebar menu plus content. It must work on a phone: the menu stacks, and wide tables scroll inside their box. Touch targets are at least 44px.

### Screens

**Overview** (`/`)
- Period switch: Today / 7 days / 30 days.
- KPI cards:
  - new users across all systems
  - website visitors
  - active shops
  - Soko orders
  - staff checked in (Wafanyakazi)

  Each card shows a change against the previous period of the same length.
- **Systems** cards, one per system:
  - status pill (Online / Degraded / Down; plus a manual "In App Review" note)
  - uptime % (30 days)
  - last deploy (git log date of the deployed checkout)
  - three key numbers:

    | System | Numbers |
    |---|---|
    | Mauzo | shops, sales today, trials |
    | Soko | buyers, orders today, messages today |
    | Wafanyakazi | workplaces, checked in today, late today |
    | Cargo | in transit, arrived, customers |
    | Global Authentics | products, sales today, WhatsApp orders today |

- **Website visitors** chart: daily unique visitors for 14 days, one bar series per site.
- **Where visitors come from**: referrers grouped as Instagram, Google, WhatsApp, Facebook, Direct, Other.
- **New sign-ups**: latest 6 from all systems (name, system tag, type, location, time ago).
- **Needs attention** alerts:
  - service down
  - disk over 80%
  - memory over 85%
  - Mauzo trial ending in 24 h with no payment
  - an unreviewed Soko chat report
  - plus manual notes staff can add
- **Server and services** tiles:
  - API response time
  - DB connections in use
  - disk
  - memory
  - server load

**Users** (`/users`)
- Total cards per system, which also act as a filter.
- Search by name, phone or shop.
- Filters: type and joined period.
- Table columns: name, phone (masked like `0754 ••• 210`; full number only for Admin), system, type, plan or shop, joined, last active, status (Active / Trial / Inactive / Blocked).
- Paginated (50 rows) and exportable to CSV.

**Staff and access** (`/staff`)
- Team table: each Monitor staff member's role, per-system access (Admin / Support / View / None) and last seen.
- Invite staff (Admin only).
- Activity log of every staff action inside the Monitor (logins, exports, viewing a full phone number, settings changes). Filter it by person.

## 3. Architecture

Use the same stack as Cargo and Wafanyakazi, so it is deployed the same way.

```
mwendavano-monitor/
  backend/   NestJS 11 + TypeORM, port 3202, systemd "monitor-api" (3201 is Cargo)
  web/       Vue 3 + Vite SPA, built to web/dist
  deploy/    nginx site, systemd unit, DEPLOY.md
  design/    the three design files (reference only)
```

### Data access
- **Its own database** `mwendavano_monitor` stores Monitor data only: staff, roles and access, sessions, activity log, uptime checks, visitor stats, manual notes. Use TypeORM migrations here.
- **Read-only connections** to `inventorydb`, `wafanyakazi` and `mwendavano_cargo`:
  - Use a new Postgres role, e.g. `monitor_ro`, with `CONNECT` plus `USAGE` on the schemas and `SELECT` on the tables only, through `ALTER DEFAULT PRIVILEGES … GRANT SELECT`.
  - Never use the systems' own DB users.
  - Set `synchronize: false` and `migrationsRun: false` on these connections. Use raw SQL or read-only entities; **never write** to them.
- Before querying, read the entity files in each project and confirm the table and column names. Starting points:

  **inventorydb** (`core` schema; TypeORM entities in `inventory-management-backend/src`)

  | Area | Table | Notes |
  |---|---|---|
  | Shops | `business` | `status`, `registeredAt`, `marketListed` (shown in Soko), `slug` |
  | Mauzo trials and paid plans | `subscription` | `plan`, `status`, `trialEndsAt`, `paidUntil`, `createdAt` |
  | Mauzo shop staff | `user`, `shop_membership` | |
  | Sales | `sale`, `sale_receipt` | sales today |
  | Soko buyers | `buyer` | `phone`, `name`, `city`, `region`, `createdAt` |
  | Soko orders | `whatsapp_orders` | check how Soko orders are marked versus WhatsApp-bot orders |
  | Soko messages | `chat_conversation`, `chat_message`, `chat_report` | `reviewedAt` null = unreviewed |
  | SMS sent | `sms_messages` | |

  Most entities extend a BaseEntity with `createdAt` and soft-delete `deletedAt`. Always filter out soft-deleted rows.

  **wafanyakazi**

  | Area | Table | Notes |
  |---|---|---|
  | Workplaces | `businesses` | |
  | | `branches` | |
  | Workers and managers | `employees` | has a `role` |
  | Check-ins | `attendance` | today's check-ins and late arrivals |
  | | `leave_requests`, `payroll_runs` | |
  | SMS | `sms_log` | |

  **mwendavano_cargo**

  | Area | Table | Notes |
  |---|---|---|
  | Shipments | `shipments` | status: in transit / arrived |
  | | `shipment_events`, `consignments` | |
  | Customers | `customers` | |
  | Cargo company accounts | `tenants`, `users` | |
  | | `payments` | |

- **Exclude test data**:
  - App Review accounts: phone `0700000000`–`0700000003` in Wafanyakazi; `REVIEW_PHONE` in Soko.
  - The Soko test shop "Duka la Majaribio".
  - The walk-in placeholder customer `WALK IN KARIAKOO`.

### Health checks (cron inside monitor-api, every minute)
- **HTTP GET** each site and API with a 5 s timeout. Store status, response time and the check time in `uptime_check`. Keep raw checks for 30 days and roll them up per day after that.
  - https://dukanimauzo.com
  - https://dukanisoko.com
  - https://wafanyakazi.mwendavano.com
  - https://cargo.mwendavano.com
  - store.mwendavano.com
  - each API's health route (use one if it exists; otherwise a cheap public GET)
- **`systemctl is-active`** for `dukani-api`, `dukani-soko`, `wafanyakazi-api`, `cargo-api`, `nginx`, `postgresql`. The Monitor runs on the same box, so it can run this through `child_process` with a fixed allow-list of names. Never pass user input to it.
- **Server:** disk from `df` / `statfs`, memory and load from `os`, and DB connections from `pg_stat_activity`.
- The Monitor does not call Beem (owner's decision, 2 Nov 2026): no SMS balance and no SMS codes.
- **Last deploy:** `git -C <app dir> log -1 --format=%cI` for each app directory.

### Visitors (no tracking scripts)
- Parse the nginx access logs (`/var/log/nginx/*.log`, including rotated `.gz` files) for the public sites.
- Count unique visitors per day per site as distinct IP + user agent. Exclude:
  - bots (user agents matching bot, crawler, spider, preview, facebookexternalhit, WhatsApp link previews)
  - static asset requests
  - API calls
- Classify the referrer into the source groups listed under Overview.
- Run every 10 minutes, keeping a file offset so it resumes where it stopped. Store **only aggregates** (`visitor_daily`: date, site, visitors, page views, source counts). Do not store IPs.
- Check the actual log names and formats in the nginx site configs on the server first. If the sites share one log, add a site-specific `access_log` (that is a deploy step, so ask first).

### Auth and roles
- Staff sign in with phone + password (bcrypt) only, with no second step (owner's decision, 2 Nov 2026).
- Use a short-lived JWT plus a refresh token in an httpOnly cookie.
- Lock the account for 15 minutes after 5 failed attempts (Cargo has a `lockouts` pattern to reuse).
- Roles per system: **Admin** (everything, including manage staff and see full phone numbers), **Support** (see users and details), **View** (numbers only, no personal data), **None**.
- Write every sign-in, export, full-phone reveal and staff or role change to `activity_log`.
- First owner account: created by a CLI seed command (`npm run seed:owner -- --phone … --name …`) that prints a one-time password. Never hard-code credentials.

### API (sketch)
```
POST /api/auth/login, /api/auth/refresh, /api/auth/logout
GET  /api/overview?period=today|7d|30d
GET  /api/systems
GET  /api/visitors?days=14
GET  /api/users?system=&type=&joined=&q=&page=
GET  /api/users/export.csv
GET  /api/alerts            POST /api/alerts/notes   (manual notes)
GET  /api/staff             POST /api/staff/invite   PATCH /api/staff/:id
GET  /api/activity?staffId=
```
Cache overview queries for 60 s. The panel should load in under 1 s.

## 4. Rules for whoever builds this

- **No Docker.** Production is plain systemd + nginx, like Cargo and Wafanyakazi; copy their `deploy/` layout and DEPLOY.md style.
- **Node on the server:** 20.19.5 via nvm (`/root/.nvm/versions/node/v20.19.5/bin`).
- **Restart services** with `systemctl restart <name>`, never pm2.
- **Work locally first.** For local data, use a local Postgres with copies of the three schemas. Never point local development at production databases.
- **Do not touch the server** (deploy, reading production `.env` files, creating the DB role, changing nginx, certbot) without the owner's explicit OK in chat.
- **No secrets** in git, chat or logs. Each app's `.env` is `chmod 600`.
- **Write tests:**
  - services: query builders, visitor log parser, bot filter, role checks
  - an e2e test showing a View user cannot see phone numbers and a None user cannot see that system
- **Keep commits small**, with plain-English messages. Do not push or force-push unless asked.
- **The owner prefers few questions.** Pick sensible defaults and state them; ask only for decisions that are really theirs (domain, who gets access).

## 5. Build order

1. Scaffold `backend/` and `web/`. Set up the Monitor DB with migrations, auth, the owner seed and the sidebar layout.
2. **Overview**: KPIs, systems cards and health checks, server tiles, new sign-ups, alerts.
3. **Users**: list, filters, search, masking, CSV export.
4. **Visitors**: the log parser, aggregates, and the chart and sources on Overview.
5. **Staff and access**: invite, roles per system, activity log.
6. **Deploy**: `deploy/nginx/monitor.mwendavano.com.conf`, `deploy/systemd/monitor-api.service`, the `monitor_ro` role SQL, certbot, and DEPLOY.md. Run it only after the owner says "deploy".

## 6. Done means

- [ ] All three screens match the design, with real data, and work on a phone.
- [ ] No write path to `inventorydb`, `wafanyakazi` or `mwendavano_cargo`: the role is SELECT-only, and this is verified by attempting an INSERT that must fail.
- [ ] Health checks run every minute, and a stopped service shows as Down with an alert within 2 minutes.
- [ ] Visitor numbers come from nginx logs, with bots excluded and no IPs stored.
- [ ] Roles enforced on the API, not only hidden in the UI; activity log complete.
- [ ] Tests pass; DEPLOY.md lets someone deploy from scratch.
