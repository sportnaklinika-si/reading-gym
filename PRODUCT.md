# Product

<!-- impeccable:product-schema 1 -->

Updated 3 Nov 2026 from the owner's written requests. Facts marked (inferred) were not confirmed in words.

## Platform

web

## Users
One person: Jan, owner of a sports clinic (kinesiologist) in Slovenia, who wants to read more paper books. Jan opens the app on a phone, presses start when the book opens, and puts the phone down beside the book. Often in the evening at home (inferred).

## Product Purpose
Time real reading and make it a habit. The timer only counts while the app is on screen; leaving the app or locking the phone pauses it. A daily goal fills the day; stats and a level roster show progress. Success: Jan keeps reading most days and enjoys opening the app.

## Positioning
Bralni mentor ("reading mentor"): one kid reader grows across 18 levels, from Črkolovec (letter-catcher) to Razsvetljeni (the enlightened one), gaining glasses, a lamp, a cape of pages and finally floating in light. The streak forgives: goal days earn bookmarks, and a bookmark saves the streak on a missed day.

## Operating Context
Installed to the phone's home screen as a web app (iPhone Safari or Android Chrome). Paper books, so the phone is only the timer and logbook. While a session runs the screen is kept on, near black. Several books can be in progress at once; each keeps its own time and history.

## Capabilities and Constraints
- Timer with pause on leave, "Še bereš?" check after 45 min, sessions under a minute not saved, time by hand for untimed reading.
- Books: cover photo or title, author optional, statuses reading / finished / put aside, history with dates.
- Daily goal 5 to 180 min (default 20); streak with up to 3 bookmarks (1 per 7 goal days).
- 18 levels from 0 h to 1000 h in three tiers (bronze, silver, gold rings), each a stage of the same kid with a one-line note.
- Data stays on the phone (IndexedDB, keys unchanged since the app was called Reading Gym); backup is a JSON file the user saves.
- Vanilla HTML, CSS and JS with no build step; works offline; the whole UI is in standard Slovene (direct "ti" form, four plural forms).

## Brand Commitments
- Name: Bralni mentor (Jan, 3 Nov 2026). The bookmark rule was chosen by Jan and stays.
- Levels are one character, a kid who progresses and slowly becomes enlightened (Jan, 3 Nov 2026).
- Visual direction: "simplicity, clean vibe, smart vibe, zen mode" (Jan, 3 Nov 2026). Jan will choose the final look from examples; until then the app runs a neutral placeholder theme, and every colour, font and radius stays in the single theme block so the chosen theme drops in one place.

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
