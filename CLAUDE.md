# Mwendavano Monitor

Private, read-only admin panel that monitors every Mwendavano system: Dukani Mauzo, Dukani Soko, Global Authentics, Dukani Wafanyakazi and Mwendavano Cargo.

**Start by reading `SPEC.md`.** It covers what to build, the data sources, the rules and the build order. The visual reference is in `design/`.

Key rules (details in SPEC.md §4):
- Never write to the monitored databases. Use the SELECT-only role `monitor_ro`.
- No Docker. Deploy with systemd + nginx, like `~/personal/mwendavano-cargo`.
- Never touch the production server without the owner's explicit OK in chat.
- No secrets in git, chat or logs.
