# Product

<!-- impeccable:product-schema 1 -->

Inferred from the owner's written requests (3 Nov 2026) and the choices page they answered; written by a design agent that could not interview them live. Facts marked (inferred) were not confirmed in words.

## Platform

web

## Users
One person: Jan, owner of a sports clinic (kinesiologist), who wants to read more paper books. Jan opens the app on a phone, presses start when the book opens, and puts the phone down beside the book. Often in the evening at home (inferred).

## Product Purpose
Time real reading and make it a habit. The timer only counts while the app is on screen; leaving the app or locking the phone pauses it. A daily goal gives a green tick; stats and a level ladder show progress. Success: Jan keeps reading most days and enjoys opening the app.

## Positioning
Reading treated as training: "a gym for the brain". Sessions, a personal record, and an 18-step level ladder named after gym progress (Warm-up Reader to The Enlightened). The streak forgives: goal days earn bookmarks, and a bookmark saves the streak on a missed day.

## Operating Context
Installed to the phone's home screen as a web app (iPhone Safari or Android Chrome). Paper books, so the phone is only the timer and logbook. While a session runs the screen is kept on, near black. Several books can be in progress at once; each keeps its own time and history.

## Capabilities and Constraints
- Timer with pause on leave, "Still reading?" check after 45 min, sessions under a minute not saved, time by hand for untimed reading.
- Books: cover photo or title, author optional, statuses reading / finished / put aside, history with dates.
- Daily goal 5 to 180 min (default 20); streak with up to 3 bookmarks (1 per 7 goal days).
- 18 levels from 0 h to 1000 h in three tiers (bronze, silver, gold), each with its own icon.
- Data stays on the phone (IndexedDB); backup is a JSON file the user saves.
- Vanilla HTML, CSS and JS with no build step; works offline; English text.

## Brand Commitments
- Name: Reading Gym. The level names and the bookmark rule were chosen by Jan and stay as they are.
- Jan asked for "a visual icon" per level and for the app to look attractive enough to want to open.

## Evidence on Hand
No real covers or reading history in the repo. Demo data (`#demo`) is synthetic and labelled on screen.

## Product Principles
- Starting a session is one tap from the first screen.
- Progress is always visible: today's minutes, the streak, the next level.
- Forgiving, never scolding: a missed day is saved where the rules allow and never shown as failure.
- During reading the screen stays quiet so it does not pull attention from the book.

## Accessibility & Inclusion
Text contrast WCAG AA, tap targets at least 44 px, respects reduced motion.
