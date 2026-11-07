# Bralni mentor 2 (test version with friends)

Live at https://sportnaklinika-si.github.io/reading-gym/v2/ next to the first version (one folder up, unchanged).
It is the same app plus a fourth tab, **Prijatelji**: reading clubs with a weekly leaderboard, points and a chat.

## Friends
- **Bralni klub** (reading club): one person creates it and shares a link (`…/v2/#klub=K7M2QX`) or the 6-letter code;
  friends open it, type a name and are in. Up to 50 per club, up to 5 clubs per person. No accounts or passwords.
- **Leaderboard**: *Ta teden* ranks by this week's points (Monday to Sunday), *Skupaj* by all-time reading time.
  Each row has the friend's own reader drawing at their level, seven day slots, minutes this week, and "bere" while they read.
  Last week's winner gets a crown; the winner's phone posts the win to the chat once.
- **Points** (`core.js` RULES + `weekPoints`, tested in `test/core.test.js`); each club picks one set, the founder can change it:
  - A *Uravnoteženo* (default): reading day (15+ min) +10, +1 per 10 min (max 6 a day), day without reading −5, all 7 days +20
  - B *Vsak dan*: reading day (10+ min) +10, day without reading −10, all 7 days +30
  - C *Minute*: +1 per minute (max 120 a day), day without reading −20, all 7 days (15+ min) +50
  A short day earns only its minute points and costs nothing; today can't cost points until it ends; days before someone
  started with the app don't count.
- **Chat**: messages, a *Bravo* on any message, replies (comments) on messages and on events. Events are posted by the app
  itself: someone joins, finishes a book, reaches a new level, a streak of 7/14/21/30/50/… days, wins the week, changes the rules.
- **Privacy**: friends see the name, level, total time, minutes per day for the last three weeks, books finished, and the
  title being read (can be hidden in the club settings). *Izbriši moj profil pri prijateljih* in Napredek deletes it all.

## Data safety
- **Same data as the first version.** Both versions are on the same web address, so on the phone they read and write the
  same storage ('state'). Reading in either counts in both, and switching later needs no move of data.
- **No version overwrites the other.** This version reads the stored data again whenever it comes back on screen and, before
  every save, takes in what the other version added. What it adds itself is also kept in its own journal (`bm2-own`), so if
  the old version (open in the background with an older copy) writes over it, it comes back on the next start. Deleted
  books stay deleted. Tested with both versions open side by side (see "Checks" below).
- **A copy a day** of the whole state stays on the phone for 7 days (`snap:YYYY-MM-DD` in IndexedDB).
- **Cloud backup**: once someone joins friends, the reading log (books, sessions, goals; no cover photos) is copied to the
  server after every change. Napredek → Varnostna kopija → *Koda za prenos* gives a code that moves everything, and the
  friends' profile, to a new phone (*Vpiši kodo* there). The file backup (*Shrani kopijo*) still works and keeps the covers.

## Server
Supabase (free plan) in Jan's account. `server/schema.sql` is the whole server: five tables closed to the outside (row
level security, no policies) and `bm_*` functions that check each phone's id and secret key (the server keeps only a hash).
The public key in `config.js` can only call those functions. `.github/workflows/keep-awake.yml` (repo root) calls
`bm_ping` once a day so the free project never goes to sleep.

Setting it up: create a project (region Frankfurt), run `server/schema.sql` in the SQL editor, put the project URL + `/rest/v1`
and the publishable key in `config.js`, push. While `config.js` is empty, the Prijatelji tab says friends aren't on yet.

## Checks
- `node test/core.test.js`: the rules, including points for all three sets
- `test/server/up.sh` starts Postgres 17 + PostgREST (Supabase's API layer) in Docker with the schema loaded twice; then
  `docker run --rm --network bm-test -v "<v2>:/app" -w /app node:24-alpine node test/server/api.test.mjs` runs every function
  (registering, closed tables, clubs, board, chat, bravo, replies, events, owner rules, leaving, backup, deleting a profile).
  The same test runs against the real server with `BM_URL=https://<ref>.supabase.co/rest/v1 BM_KEY=<publishable key>`.
- The app against the local server: open `http://127.0.0.1:8765/v2/#api=local` (and `http://localhost:8765/v2/` as a second
  phone; different address, separate storage).
- Demo screens (no server): `#demo-friends`, `#demo-friends-all`, `#demo-chat`, `#demo-member`, `#demo-club`, `#demo-welcome`,
  `#demo-invite`, `#demo-today-club`, `#demo-backup`; `test/shoot.sh` screenshots them into `test/friends-*.png`.

## Making it the main version later
Copy `v2/*` (without `test/`, `server/`) over the root files, keep the root `manifest.webmanifest` name/id or change it, and turn
`v2/` into a page that forwards to `../`. The data needs nothing: both already use the same storage.
