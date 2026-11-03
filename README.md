# Bralni mentor

A small phone app for timing reading, in Slovene. Press start when you open the book. The phone stays awake and the screen turns black after a few seconds (a tap brings the timer back); leaving the app or locking the phone pauses it. Optionally (Napredek → Štoparica) the timer also counts with the screen locked and asks on return how much counts.
Reach the daily goal and the day fills with its date, keep a streak (bookmarks save it on a day off), see each month at a glance, and watch your reader grow up across 18 levels, from a toddler with a picture book to a wise old reader in a room full of books and light (with a cat that grows old alongside).

It is a web app: open it once on the phone and add it to the home screen. All data stays on the phone (IndexedDB, with the same storage names as when the app was called Reading Gym, so old data keeps working); Napredek → Varnostna kopija saves a copy.

- `core.js`: the rules (days, streak, levels) and **the level table** (hours, name, one-line note per level; the names are the set "Pot mojstra", Novinec to Razsvetljeni), tested with `node test/core.test.js`
- `kid.js`: the level illustration: the reader at each age, the cat and the room that fills in level by level, coloured by the theme, with gentle motion
- `app.js`, `index.html`: screens, texts and timer. **The whole look is the theme block at the top of `index.html`** (colours, illustration colours `--il-*`, fonts, radii, shadows); swap that block to change the style.
- `sw.js`, `manifest.webmanifest`, `icons/`: what makes it installable and work offline (`icons/make-icons.sh` redraws the icons from `icons/icon.svg`)
- `fonts/`: Figtree (interface) and Newsreader SemiBold (titles and numbers), small subsets with the Slovene letters, precached for offline use (SIL Open Font License, see `fonts/OFL.txt`)
- `DESIGN.md`: the design system and its rules; `PRODUCT.md`: who the app is for
- The look is Washi (look A, Jan's pick). The other looks he compared stay as a test tool, not part of the app: add `&theme=B` (C, D) to any demo hash; `test/themes.js` overrides the theme block and `test/shoot-themes.sh` screenshots Today and the month view of each.
- `index.html#demo`, `#demo-books`, `#demo-stats`, `#demo-month`, `#demo-reader`, `#demo-black`, `#demo-back`, `#demo-back4`, `#demo-timer`, `#demo-paused`, `#demo-detail`, `#demo-add`, `#demo-level`, `#demo-finished`, `#demo-new`, `#demo-levels`, `#demo-ages`: example data for checking the screens, never saved (add `&clean` to leave out the example-data badge); `test/shoot.sh` screenshots them, the level sheets and the app icon at home-screen sizes
