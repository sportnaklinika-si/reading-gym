# Reading Gym

A small phone app for timing reading. Press start when you open the book; leaving the app or locking the phone pauses the timer.
Reach the daily goal for a green tick, keep a streak (bookmarks save it on a day off), and collect an enamel pin for each of 18 levels, from Warm-up Reader to The Enlightened.

It is a web app: open it once on the phone and add it to the home screen. All data stays on the phone (IndexedDB); Stats → Backup saves a copy.

- `core.js`: the rules (days, streak, levels), tested with `node test/core.test.js`
- `app.js`, `index.html`: screens and timer
- `sw.js`, `manifest.webmanifest`, `icons/`: what makes it installable and work offline (`icons/make-icons.sh` redraws the icons)
- `fonts/rubik-bold.woff2`: the display font, a Latin subset of Rubik Bold (SIL Open Font License, see `fonts/OFL.txt`)
- `DESIGN.md`: the look (colours, type, pins, ribbons) and its rules; `PRODUCT.md`: who the app is for
- `index.html#demo`, `#demo-books`, `#demo-stats`, `#demo-reader`, `#demo-paused`, `#demo-detail`, `#demo-add`, `#demo-level`, `#demo-finished`, `#demo-new`, `#demo-pins`: example data for checking the screens, never saved; `test/shoot.sh` screenshots them
