# Bralni mentor 2 (test version with friends)

Live at https://sportnaklinika-si.github.io/reading-gym/v2/ next to the first version (one folder up, unchanged).
It is the same app plus a fourth tab, **Prijatelji**: reading friends with a weekly leaderboard, points and comments.

## Friends
- **Adding friends** (Jan's pick, 7. 11. 2026: a personal friends list, not clubs): everyone gets a personal code of 8
  characters (`K7M2 QX9P`). Sending the link (`…/v2/#prijatelj=K7M2QX9P`) or typing the code makes the two of you friends,
  both ways. A friend can be removed any time; *Nova koda* makes a new code (the old link stops working, friends stay).
  Up to 100 friends; 30 wrong codes a day at most, so codes can't be guessed. No accounts or passwords.
- **Leaderboard**: me and my friends. *Ta teden* ranks by this week's points (Monday to Sunday), *Skupaj* by all-time
  reading time. Each row has the friend's own reader drawing at their level, seven day slots, minutes this week, and "bere"
  while they read. Last week's winner gets a crown (among me and the friends I already had by that Sunday).
- **Points** (`core.js` RULES A + `weekPoints`, tested in `test/core.test.js`; Jan picked A): reading day (15+ min) +10,
  +1 per 10 min (max 6 a day), day without reading −5, all 7 days +20. A short day earns only its minute points and costs
  nothing; today can't cost points until it ends; days before someone started with the app don't count. Sets B and C stay
  in `core.js` (and its tests) in case they are wanted later.
- **Klepet**: posts to my friends, a *Bravo* on anything, comments (a comment is seen by everyone who sees the message it
  answers). The app also posts reading moments by itself: a finished book, a new level, a streak of 7/14/21/30/50/… days.
  You can delete your own messages and any comment in your own thread.
- **Privacy**: friends see the name, level, total time, minutes per day for the last three weeks, books finished, and the
  title being read (can be hidden in the settings). *Izbriši moj profil pri prijateljih* in Napredek deletes it all.

## Data safety
- **Same data as the first version.** Both versions are on the same web address, so on the phone they read and write the
  same storage ('state'). Reading in either counts in both, and switching later needs no move of data.
- **No version overwrites the other.** This version reads the stored data again whenever it comes back on screen and, before
  every save, takes in what the other version added. What it adds itself is also kept in its own journal (`bm2-own`), so if
  the old version (open in the background with an older copy) writes over it, it comes back on the next start. Deleted
  books stay deleted. Tested with both versions open side by side.
- **A copy a day** of the whole state stays on the phone for 7 days (`snap:YYYY-MM-DD` in IndexedDB).
- **Cloud backup**: once someone joins friends, the reading log (books, sessions, goals; no cover photos) is copied to the
  server after every change. Napredek → Varnostna kopija → *Koda za prenos* gives a code that moves everything, and the
  friends' profile, to a new phone (*Vpiši kodo* there). The file backup (*Shrani kopijo*) still works and keeps the covers.
- **On the server**: a database dump every night, kept 14 days (`server/self-host/backup.sh`), plus Contabo's own backup.

## Server
Our own: the Contabo VPS (Jan's, also meant for the clinic website), kept apart from everything else on it.
`server/schema.sql` is the whole server logic: four tables closed to the outside and `bm_*` functions that check each
phone's id and secret key (the server keeps only a hash). `server/self-host/` runs it:
- `compose.yaml`: Docker containers in `/opt/bralni-mentor` (project `bralni-mentor`): Postgres 17 (256 MB cap, not
  reachable from outside), PostgREST (128 MB, on 127.0.0.1:3000 only) and the nightly dump. About 75 MB of memory in use.
- `install.sh`: first install and every update (new `schema.sql`): makes `.env` with random passwords, loads the roles
  (`roles.sql`) and the schema, checks `bm_ping`. Safe to run again; the data stays.
- `cert.sh --install <IP>`: HTTPS without a domain name. nginx serves the API at `https://<IP>:8443/` with a Let's Encrypt
  certificate for the IP address (6-day "shortlived" certificates, the only kind for IP addresses; lego renews them, a
  systemd timer runs twice a day). Port 8443 is the app's own; the port-80 block answers only for the bare IP address, so the
  website's server blocks on 80/443 are not touched (`nginx-bralni-mentor.conf`). Remove with
  `docker compose down -v` in `/opt/bralni-mentor` and deleting `/etc/nginx/sites-enabled/bralni-mentor`.
- `.github/workflows/keep-awake.yml` (repo root) calls `bm_ping` once a day; if the server or its certificate fails, GitHub
  e-mails the repository owner.

`config.js` holds the address (`https://<IP>:8443`). While it is empty, the Prijatelji tab says friends aren't on yet.
A Supabase project would work as well (its API address + `/rest/v1` and public key in `config.js`).

## Checks
- `node test/core.test.js`: the rules, including points for all three sets
- `test/server/up.sh` starts Postgres 17 + PostgREST in Docker with the schema loaded twice (and Supabase-style open grants,
  to prove the schema closes the tables itself); then
  `docker run --rm --network bm-test -v "<v2>:/app" -w /app node:24-alpine node test/server/api.test.mjs` runs every function
  (registering, codes, friends both ways, who sees which posts and comments, bravo, deleting, the guessing limit, the
  posting limit, backup, deleting a profile). The same test runs against the real server with `BM_URL=https://<IP>:8443`.
- The self-host package was tested the same way: `install.sh` in a fresh folder, the API test against it, a second
  `install.sh` run, the nightly dump and a restore from it; `cert.sh`'s lego call against Pebble (Let's Encrypt's test
  server: an IP certificate, and a second run that skips renewal); nginx 1.24 accepts the site file.
- The app against the local server: open `http://127.0.0.1:8765/v2/#api=local` (and `http://localhost:8765/v2/` as a second
  phone; different address, separate storage).
- Demo screens (no server): `#demo-friends`, `#demo-friends-all`, `#demo-friends-alone`, `#demo-friends-add`, `#demo-chat`,
  `#demo-member`, `#demo-club` (settings), `#demo-welcome`, `#demo-invite`, `#demo-today-club`, `#demo-backup`;
  `test/shoot.sh` screenshots them into `test/friends-*.png`.

## Making it the main version
Jan's pick: as soon as the Prijatelji tab works. Copy `v2/*` (without `test/`, `server/`) over the root files, keep the
root `manifest.webmanifest` name/id or change it, and turn `v2/` into a page that forwards to `../`. The data needs nothing:
both already use the same storage. Two spots name the folder: the `/v2/sw.js` check in `app.js` (so the worker's first
take-over is not treated as an update) and `v2/config.js` in `.github/workflows/keep-awake.yml`.
