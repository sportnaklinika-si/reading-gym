# Product

<!-- impeccable:product-schema 1 -->

Updated 3 Nov 2026 from the owner's written requests. Facts marked (inferred) were not confirmed in words.

## Platform

web

## Users
One person: Jan, owner of a sports clinic (kinesiologist) in Slovenia, who wants to read more paper books. Jan opens the app on a phone, presses start when the book opens, and puts the phone down beside the book. Often in the evening at home (inferred).

## Product Purpose
Time real reading and make it a habit. By default the timer counts while the app is on screen; leaving the app or locking the phone pauses it. Jan (3 Nov 2026) wants to put the phone down while reading, but not to count time spent in other apps, so the phone stays awake and the reading screen turns black instead. A setting (off by default) counts with the screen locked too; a web app can't tell a locked screen from another app, so it says so and asks on return. A daily goal fills the day; stats and a level roster show progress. Success: Jan keeps reading most days and enjoys opening the app.

## Positioning
Bralni mentor ("reading mentor"): the reader grows up across 18 levels, from a toddler with a picture book to a wise old reader with a soft glow, while the room around them fills in (shelf, window, lamp, plants, a whole library, then light). Two running jokes: a cat that grows old alongside and keeps sitting on the book, and one favourite red picture book that comes back at the end. The streak forgives: goal days earn bookmarks, and a bookmark saves the streak on a missed day.

## Operating Context
Installed to the phone's home screen as a web app (iPhone Safari or Android Chrome). Paper books, so the phone is only the timer and logbook. While a session runs the phone stays awake and after 8 seconds without a touch the screen is pure black (on OLED as good as off), with the time barely visible. Several books can be in progress at once; each keeps its own time and history.

## Capabilities and Constraints
- Timer with pause on leave and a black screen while reading, "Še bereš?" check after 45 min, optional counting with the screen locked (return question after more than 20 minutes away: count all, or only until the screen went off; after more than 4 hours the latter is proposed), sessions under a minute not saved, time by hand for untimed reading.
- Books: cover photo or title, author optional, statuses reading / finished / put aside, history with dates.
- Daily goal 5 to 180 min (default 20); streak with up to 3 bookmarks (1 per 7 goal days).
- Monthly view in Napredek (Jan, 3 Nov 2026): per month the reading days, total time, goal days, the best streak and a calendar showing days with and without reading, with arrows between months.
- 18 levels from 0 h to 1000 h in three tiers (bronze, silver, gold rings). Names: the set "Pot mojstra" chosen by Jan (Novinec, Vajenec, Pridni vajenec, Učenec, Marljivi učenec, Pomočnik, Popotnik, Raziskovalec, Iskalec, Poznavalec, Pripovedovalec, Mojster, Učitelj, Svetovalec, Mentor, Modrec, Veliki modrec, Razsvetljeni), in one table in core.js; each level has a one-line note.
- Data stays on the phone (IndexedDB, keys unchanged since the app was called Reading Gym); backup is a JSON file the user saves.
- Vanilla HTML, CSS and JS with no build step; works offline; the whole UI is in standard Slovene (direct "ti" form, four plural forms).

## Brand Commitments
- Name: Bralni mentor (Jan, 3 Nov 2026). The bookmark rule was chosen by Jan and stays.
- Levels are one character who grows up (Jan, 3 Nov 2026: "Grows up"; "make it funnier", "a realistic character", "better animation"). The names should be good, not silly; Jan chose "Pot mojstra" (3 Nov 2026).
- Visual direction: "simplicity, clean vibe, smart vibe, zen mode" (Jan, 3 Nov 2026). Jan chose look A, Washi (3 Nov 2026): stone-grey paper, ink, moss green, no boxes, Figtree and Newsreader. Every colour, font and radius stays in the single theme block. App icon: the young reader and the cat in that look (Jan's request).

## Evidence on Hand
No real covers or reading history in the repo. Demo data (`#demo`) is synthetic and labelled on screen ("Vzorčni podatki, nič se ne shrani").

## Product Principles
- Starting a session is one tap from the first screen.
- Progress is always visible: today's minutes, the streak, the next level.
- Forgiving, never scolding: a missed day is saved where the rules allow and never shown as failure.
- During reading the screen stays quiet so it does not pull attention from the book.
- Calm over busy: space and hairlines instead of boxes.

## Accessibility & Inclusion
Text contrast WCAG AA, tap targets at least 44 px, respects reduced motion.
