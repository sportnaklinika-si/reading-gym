# Bralni mentor

A small phone app for timing reading, in Slovene. Press start when you open the book; leaving the app or locking the phone pauses the timer.
Reach the daily goal and the day fills with its date, keep a streak (bookmarks save it on a day off), and watch one kid reader grow across 18 levels from Črkolovec to Razsvetljeni.

It is a web app: open it once on the phone and add it to the home screen. All data stays on the phone (IndexedDB, with the same storage names as when the app was called Reading Gym, so old data keeps working); Napredek → Varnostna kopija saves a copy.

- `core.js`: the rules (days, streak, levels and their names), tested with `node test/core.test.js`
- `kid.js`: the kid reader at each level, a line drawing coloured by the theme
- `app.js`, `index.html`: screens, texts and timer. **The whole look is the theme block at the top of `index.html`** (colours, fonts, radii, shadows); swap that block to change the style.
- `sw.js`, `manifest.webmanifest`, `icons/`: what makes it installable and work offline (`icons/make-icons.sh` redraws the icons from `icons/icon.svg`)
- `fonts/rubik-bold.woff2`: the display font, a subset of Rubik Bold with the Slovene letters (SIL Open Font License, see `fonts/OFL.txt`)
- `DESIGN.md`: the design system and its rules; `PRODUCT.md`: who the app is for
- `index.html#demo`, `#demo-books`, `#demo-stats`, `#demo-reader`, `#demo-paused`, `#demo-detail`, `#demo-add`, `#demo-level`, `#demo-finished`, `#demo-new`, `#demo-levels`: example data for checking the screens, never saved; `test/shoot.sh` screenshots them
