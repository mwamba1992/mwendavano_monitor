# Deploying Mwendavano Monitor

**Nothing here runs without the owner saying "deploy" in chat.** Everything below touches the production server.

The Monitor runs on the Contabo VPS next to the systems it watches: systemd `monitor-api` on port **3202** (3201 is Cargo, 3101 is Wafanyakazi, 3000 is the Dukani API, 3001 is the Soko site), nginx serving `web/dist`, its own database `mwendavano_monitor`.

## Before the first deploy

1. Owner confirms the address. `monitor.mwendavano.com` is assumed.
2. Add a DNS A record for that name, pointing at 84.247.178.93.
3. The live Soko service is `dukani-store`, and that is what the Monitor watches. `dukani-soko` is an old duplicate on the same port, which restarts and fails.
4. The Dukani tables have no time zone in their timestamps. `deploy.sh` copies the server's zone into `INVENTORY_DB_TIMEZONE` on the first run. If the server's zone ever changes, change that line in `.env` too.

## First deploy

The code reaches the server through git, like Wafanyakazi. The server needs read access to the GitHub repo. The server has no GitHub SSH key today, so it clones over HTTPS, which needs the repo to be public; a private repo needs a deploy key and the SSH address.

On the server, as root:

```bash
git clone https://github.com/mwamba1992/mwendavano_monitor.git /var/www/mwendavano-monitor
cd /var/www/mwendavano-monitor
bash deploy/deploy.sh
```

This builds both apps on the server, and on the first run creates:

- the database and its `monitor` user,
- the SELECT-only role `monitor_ro` with grants on `inventorydb`, `wafanyakazi`, `mwendavano_cargo`,
- `.env` with random secrets, `chmod 600`,
- the service, the nginx site and the certificate.

Then, on the server:

```bash
cd /var/www/mwendavano-monitor/backend

# 1. Prove the role cannot write. Every line must say "refused".
bash ../deploy/verify-readonly.sh

# 2. Set REVIEW_PHONE in .env so App Review is left out of the numbers, then:
systemctl restart monitor-api

# 3. Create the owner. Prints a one-time password, once.
npm run seed:owner:prod -- --phone <phone> --name "<name>"
```

Sign in at the address above with the phone and that password. The Monitor asks for a new password at first sign-in.

## Turn on visitor numbers

All the sites write to the shared `/var/log/nginx/access.log`, in a format with no site name, so visitors cannot be split by site. This script gives each site its own log. It backs up the configs, and restores them if `nginx -t` fails:

```bash
bash /var/www/mwendavano-monitor/deploy/add-visitor-logs.sh
```

The stock logrotate rule for `/var/log/nginx/*.log` already covers the new files. Numbers start from that moment; history in the shared log cannot be split.

## Updates

On the server, as root:

```bash
cd /var/www/mwendavano-monitor && git pull --ff-only && bash deploy/deploy.sh
```

`.env` and the database are left alone. Migrations run at boot.

## Turn on the Customer journey page

The page reads `core.app_event`, which the Dukani API (branch `feat/journey-events`) creates at
start-up through TypeORM synchronize, and the Soko and Mauzo apps fill. In this order, each step
only after the owner's OK:

1. Deploy the API build with the events table and restart it: `systemctl restart dukani-api`.
   Check: `sudo -u postgres psql -d inventorydb -c '\d core.app_event'`.
2. Let `monitor_ro` read it (default privileges may already cover it; the check says):
   `sudo -u postgres psql -d inventorydb -f deploy/monitor-ro-app-event.sql`
3. Deploy this Monitor build (Updates, below) and `systemctl restart monitor-api`.
4. Until the new app releases are out, the page says there is no data yet; it never fails.

## Checks after any deploy

```bash
systemctl status monitor-api
curl -s http://127.0.0.1:3202/api/health
journalctl -u monitor-api -n 40 --no-pager
```

Within two minutes the Systems cards should show live status instead of No data.

## Undoing it

```bash
systemctl disable --now monitor-api
rm /etc/nginx/sites-enabled/monitor.mwendavano.com && systemctl reload nginx
```

The Monitor only reads the other systems, so removing it changes nothing in them.
