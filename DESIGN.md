---
name: Bralni mentor
description: A calm Slovene reading timer where one kid reader grows across 18 levels into the enlightened mentor.
colors:
  paper: "#ECEBE4"
  surface: "#F6F5F0"
  surface-quiet: "#D3D2C9"
  hairline: "#D3D2C9"
  ink: "#23241F"
  muted: "#62635B"
  faint: "#62635B"
  accent: "#51664A"
  on-accent: "#FFFFFF"
  good: "#3B6747"
  mark: "#984835"
  under: "#8A8DA4"
  kid-wall: "#E3E1D6"
  kid-book: "#A5523F"
  tier-bronze: "#A88566"
  tier-silver: "#9EA3A6"
  tier-gold: "#B8975A"
  lock: "#D3D2C9"
  reader-black: "#0C0C0D"
  reader-text: "#D4D0C9"
  reader-ring: "#6F8A62"
typography:
  display:
    fontFamily: "Newsreader (self-hosted SemiBold subset with Slovene glyphs), Georgia, serif"
    fontSize: "1.9rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.15
  numeral:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "2.4rem"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  body:
    fontFamily: "Figtree (self-hosted variable subset, 400 to 700), -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Figtree, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: "8px"
  md: "12px"
  lg: "18px"
  pill: "999px"
spacing:
  gutter: "20px"
  section: "26px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
    height: "48px"
  play-button:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    size: "46px"
  date-slot-goal:
    backgroundColor: "{colors.good}"
    textColor: "{colors.good}"
    rounded: "{rounded.sm}"
    size: "42px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "13px 12px"
    height: "48px"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "28px 20px"
---

# Design System: Bralni mentor

## Overview

**Creative North Star: "The Quiet Reading Log"**

A reading log that stays out of the way: one column, generous space, sections separated by a single hairline instead of boxes. Every reading day is a dated slot that fills when the goal is reached, the way a library due-date card collects its stamps. The reward is a character in a room: a flat illustration of one reader who grows up across the 18 levels (toddler, schoolkid, teen, adult, middle-aged, old), with a cat that grows old alongside and a room that fills in level by level until it is a library full of light.

**The look is Washi (look A), Jan's pick of four on 3 Nov 2026,** after asking for "simplicity, clean vibe, smart vibe, zen mode": stone-grey paper, ink, one moss green, no boxes, Figtree for the interface and Newsreader for titles and numbers. Muted, accent, good and mark are one shade darker than the picked swatches so every text pair passes WCAG AA. The other looks (B Jutro, C Tihota, D Žad) stay as a test tool (`test/themes.js`, `#demo&theme=B`), which the app never loads. A look lands in one place: every colour, font, radius and shadow is a custom property in the single theme block at the top of `index.html`, and the level illustration is coloured only by the `--il-*` variables.

**Key Characteristics:**
- One theme block (`:root`, between the THEME and "end of theme" comments) owns all visual values; no colour lives anywhere else.
- Space and hairlines, not cards. Book lists are rows with a bottom hairline.
- One accent for what you press; three meanings with their own colour: goal reached, bookmarks and records, minutes under the goal.
- The level illustration is the only picture: a square room with rounded corners, ringed by its tier (bronze, silver, gold), coloured by the --il-* group of the theme.
- The reading screen is near black in every theme so it can stay on beside the book.

## Colors

Restrained: a paper ground, ink text, one accent and three meaning colours.

### Primary
- **Accent** (accent, moss green, 5.3:1 on paper, 6.3:1 under white text): primary buttons, play buttons, the open tab, focus rings, today's open slot, the level progress bar, the current cell in the roster, the goal line in the chart.

### Secondary
- **Good** (good): only "goal reached": filled date slots, the tick in the today ring, goal bars, goal days in the calendar.
- **Mark** (mark): bookmarks, days saved by a bookmark, the OR (personal record) chip, the PREBRANO label on finished books. Delete uses **danger**, which equals mark in Washi.

### Tertiary
- **Under** (under): minutes read but under the goal, as chart bars and as the calendar dot that grows with time read.

### Neutral
- **Paper** (paper, stone grey): the page ground and inputs. **Surface** (surface): sheets and secondary buttons. **Surface quiet** (surface-quiet, equal to the hairline in Washi): tracks. **Hairline** (hairline): every divider and border, and the outline of the quiet status chip.
- **Ink** (ink) for text, **Muted** (muted, 5.1:1 on paper, 4.5:1 on the accent-soft tile) for secondary text, **Faint** (equal to muted in Washi) for empty slots and locked names.
- **Reader black** (reader-black) with dimmed **reader text** and a dim **reader ring**: the running timer.
- **Tier bronze / silver / gold**: only the ring around the illustration and the dot beside a tier name.
- **Illustration group (--il-*)**: the room, the reader, the cat and the light, about sixty variables (wall, floor, skin, hair at three ages, clothes per age, books, wood, plants, cat, lamp light, glow). They are part of the theme block and change with it; `kid.js` turns each into a fill class `f-*` and a stroke class `s-*`.

### Named Rules
**The One Block Rule.** A new colour, font, radius or shadow is added to the theme block first and referenced by name everywhere else. Inline SVG uses `style="fill:var(...)"` or the kid's classes, never a literal.

**The One Meaning Rule.** Good is only goal reached, mark is only bookmarks and records, under is only minutes under the goal, accent is only what you press or where you are.

## Typography

**Display Font:** Newsreader SemiBold, self-hosted as `fonts/newsreader-semibold.woff2` (30 KB: weight 600, optical size 24, Latin and Latin Extended-A, so č š ž Č Š Ž; SIL OFL). Every use of the display face takes `--display-w`, and `font-synthesis-weight:none` keeps the browser from faking a bolder cut.
**Body Font:** Figtree, self-hosted as `fonts/figtree.woff2` (19 KB variable subset, weights 400 to 700, same characters; SIL OFL). Both are preloaded and precached by the service worker, so the app looks the same offline.

**Character:** a bookish serif for names, titles and numbers over a clean, quiet sans.

### Hierarchy
- **Display** (600, 1.6–1.9rem): screen titles and the level name on Today.
- **Headline** (600, 1.1–1.3rem): section and sheet titles ("Trenutno berem", "Ta teden").
- **Numeral** (600, 2–4.4rem, tabular): streak count, today's minutes, the running clock, records.
- **Body** (400, 16px, 1.45): sentences; hints at 0.85rem in muted, max 46ch.
- **Label** (600, 0.72–0.85rem): meta lines, tabs, chips, slot dates, calendar headers. Sentence case, never tracked capitals (PREBRANO on a finished book is the one stamped label).

### Named Rules
**The No Kicker Rule.** No small label above a heading.

## Layout

Single column, max 560px, 20px gutters respecting the safe areas (viewport-fit=cover). Theme hooks: `--bg-paint` (a gradient ground), `--panel-*` (open sections by default; a theme can make them soft panels with a radius and padding), `--sec-pt`, `--space`, `--display-w`, `--num` and `--num-w` (a separate face and weight for numerals). Sections stack with a 26px gap (`--space`), each opened by one hairline and 26px of air. The bottom tab bar (Danes, Knjige, Napredek) is translucent paper with a hairline top and its three items held to the column width. Sheets rise from the bottom with a grab handle. The level roster is two columns; the finished-book wall three.

## Elevation & Depth

Flat. Book covers carry the only resting shadow (`--shadow`); sheets carry an upward shadow (`--shadow-up`) and the toast is an ink pill. No card shadows, no glass beyond the tab bar's blur.

## Shapes

Soft and quiet: 8px slots and inputs, 12px buttons, 18px sheet tops and roster cells, full pills for chips and play buttons. Book covers have a book's corners (3px spine, 5px fore-edge). The kid sits in a circle.

## Components

### Buttons
- **Primary:** flat accent, white text, 48px, 12px radius; presses to 0.98.
- **Secondary:** surface with a hairline. **Ghost:** no border. **Add a book:** a text button in accent with a plus icon.
- **Delete:** danger text below a divider; first tap arms it (filled, "Izbriši za vedno").
- **Play:** 46px accent circle with a drawn triangle on every book being read.

### Date slots (signature)
- Seven per week on Today. Empty: the date in faint over a dashed hairline. Today, open: accent outline. Goal reached: good-soft fill with the date in good. Saved by a bookmark: mark-soft fill with a small bookmark and the date in mark. The day the goal is reached the slot presses in once.
- Theme switches: `--stamp-tilt` (0 straight, 1 a few degrees crooked, stamp-like) and `--stamp-mask` (an ink-grain mask). Both off in Washi.

### The level illustration (signature)
- `kid.js` draws a 160-unit square room for each of the 18 levels. The reader ages every three levels: toddler on the rug (picture book), schoolkid on a cushion, teen on a beanbag (hoodie, headphones), adult in an armchair (sweater), middle-aged (vest, reading glasses, grey temples), old (white hair, cardigan, blanket on the knees). Real proportions: head, ears, eyes that look down at the book, brows, nose, mouth, hair, clothes, sleeves, hands holding the book.
- Running jokes: the cat (kitten, young, adult, round, old with grey muzzle) plays with the ribbon, sleeps, sits on the window sill, lies on the book, wears the teen's headphones, knocks a book off the shelf, sleeps on the lap, conquers the bookcase and finally reads with its own glasses. The favourite red picture book (a cat on its right page, gold ribbon) is in the toddler's hands, on the teen's floor, face-out on the adult's shelf, and in the old reader's hands again.
- The room fills in: rug, child's drawing, small shelf, window with the moon, floor lamp and its light, plant, fairy lights, poster, book stacks, curtains, tall plant, framed picture, side table with a steaming cup, full bookcase, clock, low bookcase and ladder, light beams, and at level 18 a soft glow with dust in the light.
- Motion only on drawings marked `live` (Today, the current roster cell, the level-up overlay): breathing, blinking, a page turning every few seconds, the cat's tail, steam, the glow. Level up: the old stage fades into light while the new one grows out of a ring of light. All of it stops under prefers-reduced-motion (the level-up then shows only the new stage).
- Locked levels: the room is hidden and the reader, the seat and the cat are a silhouette in `--lock` on `--lock-bg`.
- Sizes: 132px on Today (the next level as a 34px silhouette at the end of the progress bar), 200px in the level-up overlay, 128px in the roster with name, hours and a one-line note.

### Month view
- In Napredek: the month name with arrows, four numbers in two columns (Bralni dnevi "29 od 31", Skupaj, Cilj dosežen, Najdaljši niz), then the calendar: goal days filled green, bookmark days in mark, under-goal days with a dot that grows with the minutes, days with no reading marked with a short hairline.

### Lists and roster
- Book rows: cover, title, author, time read, play button, bottom hairline; hover underlines the title.
- Roster cells: no box; the current stage sits on an accent-soft tile with "Tukaj si". The names (the set "Pot mojstra", Novinec to Razsvetljeni) live only in core.js; in a sentence a name follows a colon ("Še 3,2 h do naslednje stopnje: Učenec"), so it stays in the nominative.
- Status chip in a book sheet: muted text in a hairline outline.

### App icon
- `icons/icon.svg`: the schoolkid from the level drawings, head and shoulders with the red favourite book, and the young cat close behind, on stone-grey paper with a faint circle. Everything that matters sits inside the maskable safe zone; the body and the cat run on below the edge so they still reach it when the maskable version is scaled down. `icons/make-icons.sh` renders 512, maskable 512, 192 and the 180 apple-touch icon; `test/icons.html` shows them at home-screen sizes.

### Inputs / Fields
- Paper ground, hairline border, 8px radius, 48px. Focus: accent border and an accent-soft ring. Errors in danger under the field.

## Do's and Don'ts

### Do:
- **Do** change the look only in the theme block, and keep the illustration's colours in `--il-*`.
- **Do** give each state a shape as well as a colour (filled slot, outlined slot, bookmark, dashed empty).
- **Do** keep all copy in standard Slovene with the plural helper (`plural(n, [1, 2, 3–4, 5+])`) and no-break spaces inside times.
- **Do** keep the running timer near black with dimmed text.

### Don't:
- **Don't** put a literal colour in app.js, kid.js or below the theme block.
- **Don't** box sections into cards or nest containers; use space and one hairline.
- **Don't** use emoji or text glyphs as icons; draw them.
- **Don't** add a small label above a heading.
- **Don't** pulse or loop motion on the reading screen.
