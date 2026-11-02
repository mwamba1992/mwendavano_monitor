# Deploying Mwendavano Monitor

**Nothing here runs without the owner saying "deploy" in chat.** Everything below touches the production server.

The Monitor runs on the Contabo VPS next to the systems it watches: systemd `monitor-api` on port **3202** (3201 is Cargo, 3101 is Wafanyakazi, 3000 is the Dukani API, 3001 is the Soko site), nginx serving `web/dist`, its own database `mwendavano_monitor`.

## Before the first deploy

1. Owner confirms the address. `monitor.mwendavano.com` is assumed.
2. Add a DNS A record for that name, pointing at 84.247.178.93.
3. Check which Soko service is the live one. The 28 October backup has both `dukani-soko` and `dukani-store`, on the same port:
   ```bash
   systemctl is-active dukani-soko dukani-store
   ```
   The Monitor watches `dukani-soko`, as the spec says. If that one is not active, change `backend/src/health/targets.ts` first, or Soko will show as Down.
4. Check the server clock zone, which decides what "today" means for the Dukani tables (their timestamps have no zone):
   ```bash
   timedatectl | grep "Time zone"
   ```
   The Monitor assumes UTC. If it is anything else, put `INVENTORY_DB_TIMEZONE=<zone>` in the Monitor's `.env`.

## First deploy

```bash
bash deploy/deploy.sh
```

This builds both apps, uploads them, and on the first run creates:

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

Sign in at the address above. With no Beem keys in `.env`, Admin sign-in shows a QR code for an authenticator app.

## Turn on visitor numbers

All the sites write to the shared `/var/log/nginx/access.log` today, in a format with no site name, so visitors cannot be split by site. This is a change to other apps' nginx sites, so it needs its own OK. Add one line to the main `server` block of each site:

| Site config | Line |
|---|---|
| `dukanisoko.com` | `access_log /var/log/nginx/dukanisoko.com.access.log;` |
| `dukanimauzo` | `access_log /var/log/nginx/dukanimauzo.com.access.log;` |
| `store.mwendavano.com` | `access_log /var/log/nginx/store.mwendavano.com.access.log;` |
| `cargo.mwendavano.com` | `access_log /var/log/nginx/cargo.mwendavano.com.access.log;` |
| `wafanyakazi` | `access_log /var/log/nginx/wafanyakazi.mwendavano.com.access.log;` |
| `mwendavano.com` | `access_log /var/log/nginx/mwendavano.com.access.log;` |

Put it in the HTTPS `server` block, which certbot manages, then `nginx -t && systemctl reload nginx`. The stock logrotate rule for `/var/log/nginx/*.log` already covers these files. Numbers start from that moment; history in the shared log cannot be split.

## Updates

```bash
bash deploy/deploy.sh
```

`.env` and the database are left alone. Migrations run at boot.

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
