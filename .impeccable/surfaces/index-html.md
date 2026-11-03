---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["app.js","kid.js"]
---

Scope: the whole phone app, renamed Bralni mentor (Today, Books, Progress, the reading timer, sheets, celebrations). Visitor mode: Operate. Audience: Jan, reading paper books in the evening with the phone beside the book; job: start a session in one tap, see today, streak and level at a glance. Jan's pinned brief (3 Nov 2026): name Bralni mentor, Slovene UI, levels shown as one kid character who grows and slowly becomes enlightened. Mid-build Jan pinned the visual direction "simplicity, clean vibe, smart vibe, zen mode" and will choose the final look from examples himself, so the build ships a neutral placeholder theme in one swappable :root block. The library-card world rolled first (seed below) survives only as the date-slot structure; its violet stamp palette was dropped.

## Direction contract

THESIS: A calm reading log: every reading day is a dated slot that fills when the goal is reached, and one kid reader grows across 18 levels from letter-catcher to the enlightened mentor. Refuses the habit-tracker default of grey cards, one accent and rings standing in for reward; refuses boxes: sections are separated by space and one hairline.

OWN-WORLD: Pending Jan's pick. Placeholder: paper ground (#F6F5F2), white surfaces, ink text, one deep sage accent for what you press, green for goal reached, brick for bookmarks and records, slate blue for minutes under the goal; tier rings bronze, silver, gold. Every colour, font, radius and shadow is a custom property in the single theme block at the top of index.html; the level illustration is coloured only by the --il-* variables.

STORY: Jan opens the app, sees the reader at the current age in a room that fills in level by level, today's minutes and the week of dated slots, taps the play button on a book, and later watches the reader grow up from a toddler with a picture book to a wise old reader with a soft glow, the cat ageing alongside.

FIRST VIEWPORT: Today. Top: the level illustration at 132 px (rounded square, tier ring, gently breathing) beside the level name, meta line, a thin progress bar ending at the next level's silhouette. Then today's minutes with a thin ring; then the streak with three paper bookmarks and seven dated slots (goal days filled green with their date); then Trenutno berem as a hairline list with round play buttons. Bottom tab bar.

FORM: Library date-due card, candidate 7 of 7 (1 Bralna značka booklet, 2 Čebelica picture books, 3 Ciciban magazine covers, 4 school reading diary, 5 star chart, 6 summer-camp badges, 7 library date-due card), reduced by Jan's zen pin to its structure. seed:95dc0c007c86d057. Signature move: the date slot; a day turns from an empty ruled slot into a filled slot with its date, pressed in once when the goal is reached; a finished book gets a PREBRANO date label. Stamp tilt and ink grain exist as theme switches (--stamp-tilt, --stamp-mask), off in the placeholder. Raise from the character goods catalog challenger: the level roster, each stage with a name plate, hours and a one-line note, locked stages as silhouettes.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
