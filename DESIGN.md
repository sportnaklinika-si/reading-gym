---
name: Reading Gym
description: A phone app that times reading and turns progress into a case of enamel pins.
colors:
  ribbon-navy: "#0B1024"
  case-panel: "#141B38"
  case-panel-raised: "#1C2550"
  seam: "#283266"
  bone: "#EEF0F8"
  muted-lilac: "#A6ADCE"
  faint-lilac: "#7C86B6"
  plate-gold: "#F2BE4A"
  plate-gold-light: "#FFE39A"
  ink-on-gold: "#1A1405"
  enamel-green: "#34C27E"
  ink-on-green: "#04170D"
  ribbon-scarlet: "#E4483F"
  ribbon-scarlet-light: "#FF8A7E"
  cobalt: "#5B85F0"
  danger-coral: "#FF8577"
  bronze: "#D08C58"
  silver: "#C9D1DD"
  reader-black: "#04060E"
typography:
  display:
    fontFamily: "Rubik Plate (self-hosted Rubik Bold), SF Pro Rounded, ui-rounded, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Rubik Plate, ui-rounded, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 700
    lineHeight: 1.12
  numeral:
    fontFamily: "Rubik Plate, ui-rounded, sans-serif"
    fontSize: "2.6rem"
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
  chip: "99px"
  control: "14px"
  row: "18px"
  panel: "20px"
  sheet: "24px"
spacing:
  gutter: "16px"
  stack: "14px"
  panel-pad: "16px"
components:
  button-primary:
    backgroundColor: "{colors.plate-gold}"
    textColor: "{colors.ink-on-gold}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  button-secondary:
    backgroundColor: "{colors.case-panel-raised}"
    textColor: "{colors.bone}"
    rounded: "{rounded.control}"
    padding: "12px 16px"
    height: "48px"
  play-disc:
    backgroundColor: "{colors.plate-gold}"
    textColor: "{colors.ink-on-gold}"
    rounded: "{rounded.chip}"
    size: "50px"
  panel:
    backgroundColor: "{colors.case-panel}"
    rounded: "{rounded.panel}"
    padding: "{spacing.panel-pad}"
  book-row:
    backgroundColor: "{colors.case-panel}"
    textColor: "{colors.bone}"
    rounded: "{rounded.row}"
    padding: "10px"
  input:
    backgroundColor: "{colors.ribbon-navy}"
    textColor: "{colors.bone}"
    rounded: "12px"
    padding: "13px 12px"
    height: "48px"
  chip-new:
    backgroundColor: "{colors.plate-gold}"
    textColor: "{colors.ink-on-gold}"
    rounded: "{rounded.chip}"
    padding: "2px 9px"
---

# Design System: Reading Gym

## Overview

**Creative North Star: "The Award Cabinet"**

Reading progress is kept like a sports trophy case. The ground is the deep navy of a medal case's velvet. Every one of the 18 levels is a cloisonné enamel pin with a plated metal body, a field of its own enamel colour and an icon struck in metal. Bookmarks that save a streak are red silk ribbons. The interface around these objects stays a clean phone app: standard tabs, rows, sheets and buttons, in the cabinet's palette.

The app is read in the evening beside a paper book, so it is dark on purpose. While the timer runs the screen drops to near black. Density is calm: one panel per idea, generous rows, large numerals for the numbers that matter (minutes today, streak, level).

Illustrations and pins are authored vector art. Controls never imitate metal; gold on a button is a flat colour.

**Key Characteristics:**
- Ribbon-navy ground with slightly lighter enamel panels and a one-pixel light top edge.
- Gold is what you press; green means goal reached; scarlet means bookmarks and records; cobalt means minutes under the goal.
- Rubik Bold for names and numbers, the system sans for everything else.
- Level pins change shape by tier: round bronze, hexagonal silver, scalloped gold.
- State is carried in shape as well as colour.

## Colors

A committed navy cabinet with four working colours that each mean one thing.

### Primary
- **Plate Gold** (plate-gold): primary buttons, the play disc on each book, the open tab, focus rings, the level progress bar, the "New pin" chip, the current cell in the pin case. Nothing decorative is gold outside the pins.

### Secondary
- **Enamel Green** (enamel-green): only "goal reached": the tick disc in the today ring, ticked days, green bars and calendar days.
- **Ribbon Scarlet** (ribbon-scarlet): bookmark ribbons, days saved by a bookmark, the PR chip. Delete actions use **Danger Coral** (danger-coral) as text, never a filled red at rest.

### Tertiary
- **Cobalt** (cobalt): minutes read but under the goal, as chart bars and as the calendar dot that grows with time read.

### Neutral
- **Ribbon Navy** (ribbon-navy): the page ground and input fields.
- **Case Panel** (case-panel) and **Case Panel Raised** (case-panel-raised): panels, rows and sheets; raised for secondary buttons and tracks.
- **Seam** (seam): one-pixel borders and dividers.
- **Bone** (bone): primary text. **Muted Lilac** (muted-lilac): secondary text (7.7:1 on panels). **Faint Lilac** (faint-lilac): missed days only (4.8:1).
- **Reader Black** (reader-black): the running timer screen, with its text dimmed to about #C8CDE2 and the ring in dim gold.
- **Bronze / Silver / Gold plating** (bronze, silver, and the gold gradient inside pins): tier colours, used only on pins and tier labels.

### Named Rules
**The One Meaning Rule.** Each working colour has one job. Green is never used for "nice", gold is never used for decoration, scarlet is never used for errors.

**The Metal Stays In The Pin Rule.** Plating gradients exist only inside pin and rosette illustrations. Buttons, bars and discs are flat.

## Typography

**Display Font:** Rubik Bold, self-hosted as a 21 KB Latin subset (fonts/rubik-bold.woff2, SIL OFL), with SF Pro Rounded and ui-rounded as fallbacks.
**Body Font:** the platform system sans (SF Pro on iPhone, Roboto on Android, Segoe UI on Windows).

**Character:** Rubik's chunky, slightly rounded strokes read like die-struck pin lettering; the system sans keeps every sentence native and quiet.

### Hierarchy
- **Display** (700, 1.7–1.9rem, 1.12): screen titles and the level name on Today.
- **Headline** (700, 1.1–1.35rem): panel and sheet titles, section heads ("Reading now").
- **Numeral** (700, 2–4.4rem, tabular): streak count, today's minutes in the ring, the running clock (clamp 2.9–4.4rem), record values.
- **Body** (400, 16px, 1.45): sentences and hints; hints at 0.85rem in muted lilac.
- **Label** (600, 0.75–0.85rem): meta lines, tab labels, chips, calendar headers. Sentence case, never tracked capitals.

### Named Rules
**The No Kicker Rule.** No small label above a heading. Level number and hours read sit in a meta line under the level name.

## Layout

Single column, max 560px, centred, 16px gutters that respect the phone's safe areas (viewport-fit=cover). Panels stack with a 14px gap; section heads get 10px extra above. A fixed bottom tab bar (Today, Books, Stats) clears the home indicator; a soft navy fade under the status bar keeps scrolled content off the clock. Sheets rise from the bottom with a grab handle. The pin case and the finished-book wall use three equal columns.

## Elevation & Depth

Mostly tonal: panels are one step lighter than the ground, with a one-pixel seam border and a one-pixel light top edge. One soft ambient shadow under panels and rows (`0 12px 28px -18px rgba(0,0,0,.7)`), a gold-tinted soft shadow under primary buttons and play discs, a deeper one under sheets and toasts. No hard or zero-offset shadows.

## Shapes

Rounded but firm: 14px controls, 18px book rows, 20px panels, 24px sheet tops, full pills for chips. Book covers have a book's corners (4px at the spine, 6px at the fore-edge). Pins carry the strongest geometry: circle, hexagon, 16-scallop rosette.

## Components

### Buttons
- **Primary:** flat plate gold with dark ink text, 48px minimum height, 14px radius, soft gold shadow; presses to 0.98 scale.
- **Secondary:** raised case panel with seam border. **Ghost:** transparent. **Delete:** coral text button set apart below a divider; first tap arms it (filled scarlet, "Delete for good").
- **Play disc:** 50px flat gold circle with a rounded triangle, on every book being read.

### Chips
- **New pin:** gold fill. **PR:** scarlet tint with scarlet outline. **Status:** raised panel with seam outline.

### Cards / Containers
- **Panel:** case panel, 20px radius, 16px padding, seam border, top edge, ambient shadow. Never nested: cells inside a panel have no background of their own.

### Inputs / Fields
- **Style:** navy ground, seam border, 12px radius, 48px tall. **Focus:** gold border and a soft gold ring. **Error:** coral text under the field.

### Navigation
- Bottom tab bar on translucent navy with blur, icons 24px, labels 0.75rem 600; the open tab turns gold with a 3px gold bar at its top edge.

### Level pin (signature)
- 48-unit SVG: plated body in the tier gradient, enamel field from a six-colour set (cobalt, teal, emerald, scarlet, violet, black enamel), a thin plated wire ring, a white sheen arc, and the level icon in light metal with a dark offset under it. Locked levels are unplated blanks in raised panel with the icon faint. A newly earned pin glints on Today until the pin case is opened; a level-up presses the pin in with one glint and a burst of enamel chips.

### Bookmark ribbon (signature)
- Red silk swallowtail ribbon hanging from the streak panel's top edge, three slots; an unearned slot is a dashed outline.

### Book cover
- A photo when there is one; otherwise a cloth binding in one of six colours picked from the book's id, a darker spine strip and the initials in gold foil between two foil rules.

## Do's and Don'ts

### Do:
- **Do** give every new state a distinct shape as well as a colour (disc, ribbon, dashed ring, gold ring).
- **Do** keep the running timer screen near black (#04060E) with dimmed text so it can stay on beside a book.
- **Do** draw new icons as 24-unit stroke SVG (2px, round caps) so they can be struck into a pin.
- **Do** keep text at least 4.5:1 on its panel and tap targets at least 44px.

### Don't:
- **Don't** put gradients that imitate metal on buttons, bars or discs; metal lives in pins and the rosette only.
- **Don't** nest cards: no tinted tiles inside a panel.
- **Don't** use emoji or text glyphs as icons (no ✓ or ▶); use the drawn SVG.
- **Don't** add a small label above a heading.
- **Don't** pulse or loop motion on the reading screen; the clock already shows it is running.
