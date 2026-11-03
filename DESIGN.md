---
name: Bralni mentor
description: A calm Slovene reading timer where one kid reader grows across 18 levels into the enlightened mentor.
colors:
  paper: "#F6F5F2"
  surface: "#FFFFFF"
  surface-quiet: "#EEECE7"
  hairline: "#E1DED7"
  ink: "#1F1E1C"
  muted: "#67635C"
  faint: "#726D64"
  accent: "#2F5B4E"
  on-accent: "#FFFFFF"
  good: "#2F7A52"
  mark: "#B04A40"
  under: "#7F8FB0"
  kid-line: "#2A2927"
  kid-accent: "#D98A6A"
  tier-bronze: "#B98A63"
  tier-silver: "#A6AEB9"
  tier-gold: "#C7A04A"
  lock: "#DDD9D1"
  reader-black: "#0C0C0D"
  reader-text: "#D4D0C9"
  reader-ring: "#5C8576"
typography:
  display:
    fontFamily: "Rubik Plate (self-hosted Rubik Bold with Slovene glyphs), SF Pro Rounded, ui-rounded, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Rubik Plate, ui-rounded, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.15
  numeral:
    fontFamily: "Rubik Plate, ui-rounded, sans-serif"
    fontSize: "2.4rem"
    fontWeight: 700
    lineHeight: 1
    fontFeature: "tnum"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, Roboto, Helvetica Neue, sans-serif"
    fontSize: "0.85rem"
    fontWeight: 600
    lineHeight: 1.3
rounded:
  sm: "10px"
  md: "14px"
  lg: "20px"
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

A reading log that stays out of the way: one column, generous space, sections separated by a single hairline instead of boxes. Every reading day is a dated slot that fills when the goal is reached, the way a library due-date card collects its stamps. The reward is a character: one kid reader drawn in calm lines who, level by level, gains a picture book, glasses, a backpack, a lamp, a cape of pages, and at the top floats in light.

**The look is a placeholder.** Jan asked for "simplicity, clean vibe, smart vibe, zen mode" and will choose the final style from examples. Until then the app runs a neutral paper-and-ink theme. The system is built so that choice lands in one place: every colour, font, radius and shadow is a custom property in the single theme block at the top of `index.html`, and the kid is coloured only by `--kid-*` variables.

**Key Characteristics:**
- One theme block (`:root`, between the THEME and "end of theme" comments) owns all visual values; no colour lives anywhere else.
- Space and hairlines, not cards. Book lists are rows with a bottom hairline.
- One accent for what you press; three meanings with their own colour: goal reached, bookmarks and records, minutes under the goal.
- The kid reader is the only illustration, a line drawing in a disc ringed by its tier (bronze, silver, gold).
- The reading screen is near black in every theme so it can stay on beside the book.

## Colors

Restrained: a paper ground, ink text, one accent and three meaning colours.

### Primary
- **Accent** (accent, placeholder deep sage): primary buttons, play buttons, the open tab, focus rings, today's open slot, the level progress bar, the current cell in the roster, the goal line in the chart.

### Secondary
- **Good** (good): only "goal reached": filled date slots, the tick in the today ring, goal bars, goal days in the calendar.
- **Mark** (mark): bookmarks, days saved by a bookmark, the OR (personal record) chip, the PREBRANO label on finished books. Delete uses **danger**, which equals mark in the placeholder.

### Tertiary
- **Under** (under): minutes read but under the goal, as chart bars and as the calendar dot that grows with time read.

### Neutral
- **Paper** (paper): the page ground and inputs. **Surface** (surface): sheets and secondary buttons. **Surface quiet** (surface-quiet): tracks and quiet chips. **Hairline** (hairline): every divider and border.
- **Ink** (ink) for text, **Muted** (muted, 6:1 on paper) for secondary text, **Faint** (faint, 4.9:1) for empty slots and locked names.
- **Reader black** (reader-black) with dimmed **reader text** and a dim **reader ring**: the running timer.
- **Tier bronze / silver / gold**: only the ring around the kid and the dot beside a tier name.

### Named Rules
**The One Block Rule.** A new colour, font, radius or shadow is added to the theme block first and referenced by name everywhere else. Inline SVG uses `style="fill:var(...)"` or the kid's classes, never a literal.

**The One Meaning Rule.** Good is only goal reached, mark is only bookmarks and records, under is only minutes under the goal, accent is only what you press or where you are.

## Typography

**Display Font:** Rubik Bold, self-hosted as `fonts/rubik-bold.woff2` (21 KB subset with č š ž ć đ and Slovene quotes, SIL OFL), in a variable so a theme can swap it.
**Body Font:** the platform system sans.

**Character:** a friendly rounded display voice for names and numbers over a native, quiet body.

### Hierarchy
- **Display** (700, 1.6–1.9rem): screen titles and the level name on Today.
- **Headline** (700, 1.1–1.3rem): section and sheet titles ("Trenutno berem", "Ta teden").
- **Numeral** (700, 2–4.4rem, tabular): streak count, today's minutes, the running clock, records.
- **Body** (400, 16px, 1.45): sentences; hints at 0.85rem in muted, max 46ch.
- **Label** (600, 0.72–0.85rem): meta lines, tabs, chips, slot dates, calendar headers. Sentence case, never tracked capitals (PREBRANO on a finished book is the one stamped label).

### Named Rules
**The No Kicker Rule.** No small label above a heading.

## Layout

Single column, max 560px, 20px gutters respecting the safe areas (viewport-fit=cover). Sections stack with a 26px gap (`--space`), each opened by one hairline and 26px of air. The bottom tab bar (Danes, Knjige, Napredek) is translucent paper with a hairline top and its three items held to the column width. Sheets rise from the bottom with a grab handle. The level roster is two columns; the finished-book wall three.

## Elevation & Depth

Flat. Book covers carry the only resting shadow (`--shadow`); sheets carry an upward shadow (`--shadow-up`) and the toast is an ink pill. No card shadows, no glass beyond the tab bar's blur.

## Shapes

Soft and quiet: 10px slots and inputs, 14px buttons, 20px sheet tops and roster cells, full pills for chips and play buttons. Book covers have a book's corners (3px spine, 5px fore-edge). The kid sits in a circle.

## Components

### Buttons
- **Primary:** flat accent, white text, 48px, 14px radius; presses to 0.98.
- **Secondary:** surface with a hairline. **Ghost:** no border. **Add a book:** a text button in accent with a plus icon.
- **Delete:** danger text below a divider; first tap arms it (filled, "Izbriši za vedno").
- **Play:** 46px accent circle with a drawn triangle on every book being read.

### Date slots (signature)
- Seven per week on Today. Empty: the date in faint over a dashed hairline. Today, open: accent outline. Goal reached: good-soft fill with the date in good. Saved by a bookmark: mark-soft fill with a small bookmark and the date in mark. The day the goal is reached the slot presses in once.
- Theme switches: `--stamp-tilt` (0 straight, 1 a few degrees crooked, stamp-like) and `--stamp-mask` (an ink-grain mask). Both off in the placeholder.

### The kid reader (signature)
- `kid.js` draws one kid at 18 stages in a 120-unit viewBox: line strokes (`k-l`, `--kid-line`, `--kid-stroke`), paper fills (`k-f`), soft fills (`k-s`), one accent scarf (`k-a`), glow (`k-g`). Glasses from stage 7, a cape of pages from 13, closed calm eyes and a halo from 14, floating from 15, light at 18. Each drawing clips to its disc; the ring is the tier colour. Locked stages are silhouettes in `--lock`.
- Shown at 96px on Today (with the next stage as a 32px silhouette at the end of the progress bar), 188px in the level-up overlay, 76px in the roster with name, hours and a one-line note.

### Lists and roster
- Book rows: cover, title, author, time read, play button, bottom hairline; hover underlines the title.
- Roster cells: no box; the current stage sits on an accent-soft tile with "Tukaj si".

### Inputs / Fields
- Paper ground, hairline border, 10px radius, 48px. Focus: accent border and an accent-soft ring. Errors in danger under the field.

## Do's and Don'ts

### Do:
- **Do** change the look only in the theme block, and keep the kid's colours in `--kid-*`.
- **Do** give each state a shape as well as a colour (filled slot, outlined slot, bookmark, dashed empty).
- **Do** keep all copy in standard Slovene with the plural helper (`plural(n, [1, 2, 3–4, 5+])`) and no-break spaces inside times.
- **Do** keep the running timer near black with dimmed text.

### Don't:
- **Don't** put a literal colour in app.js, kid.js or below the theme block.
- **Don't** box sections into cards or nest containers; use space and one hairline.
- **Don't** use emoji or text glyphs as icons; draw them.
- **Don't** add a small label above a heading.
- **Don't** pulse or loop motion on the reading screen.
