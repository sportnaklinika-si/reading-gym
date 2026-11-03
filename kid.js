/* Bralni mentor: the kid reader at each of the 18 levels, a calm line drawing (viewBox 120 x 120).
   Every colour comes from the theme (CSS classes k-l, k-f, k-s, k-a, k-g, k-t use --kid-* variables), so a new theme recolours it.
   The same kid every time (one curl of hair, a scarf, a book); things accumulate: glasses from level 7, a cape of pages from 13,
   closed calm eyes and a halo from 14, floating from 15, light at the top. The ring is the tier (bronze, silver, gold). Locked levels are silhouettes. */
'use strict';
const KID_NOTES = [
  'Lovi črke, še preden jih zna prebrati.',
  'Slike najprej, besede pozneje.',
  'Be-ri, be-ri, še en zlog.',
  'Prvi molj se je naselil v knjigi.',
  'Zgodbe letijo, mreža je pripravljena.',
  'Še eno poglavje, potem pa spat.',
  'Zdaj vidi tudi drobni tisk.',
  'Nahrbtnik je težji od torbe za trening.',
  'Izkaznica je že čisto obrabljena.',
  'Poglavje za zajtrk, dve za kosilo.',
  'Potuje daleč, ne da bi vstal s kavča.',
  'Lučka ugasne zadnja v hiši.',
  'Vsaka prebrana stran je del plašča.',
  'Bere počasi in razume več.',
  'Dobra zgodba dvigne od tal.',
  'Knjige krožijo, misli so mirne.',
  'Zdaj pomaga drugim do prve knjige.',
  'Tisoč ur branja. Vse je jasno.',
];
const KID = (() => {
  const book = soft => `<path class="k-${soft ? 'g' : 's'} k-l" d="M43 86Q51.5 82 60 86Q68.5 82 77 86V93Q68.5 89 60 93Q51.5 89 43 93Z"/><path class="k-l" d="M60 86V93"/>`;
  const tiny = (x, y, r) => `<rect class="k-f k-l" x="${x - 5}" y="${y - 6.5}" width="10" height="13" rx="1.5" transform="rotate(${r} ${x} ${y})"/>`;
  const halo = (r, y) => `<circle class="k-g" cx="60" cy="${y || 47}" r="${r}"/>`;
  function body(i, up) {
    const calm = i >= 13;
    let s = `<path class="k-f k-l" d="M34 96Q60 84 86 96Q60 104 34 96Z"/><path class="k-f k-l" d="M45 70Q60 64 75 70L79 93Q60 98 41 93Z"/><path class="k-a" d="M47 66.5Q60 73 73 66.5"/>`;
    s += up ? `<path class="k-l" d="M47 73Q38 63 39 53M73 73Q82 63 81 53"/>` : `<path class="k-l" d="M47 74Q43 83 50 87M73 74Q77 83 70 87"/>`;
    s += `<circle class="k-f k-l" cx="60" cy="47" r="14"/><path class="k-l" d="M56 33.5Q58 26.5 64.5 28.8"/>`;
    s += calm ? `<path class="k-l k-thin" d="M53 47.5q2.5 1.8 5 0M62 47.5q2.5 1.8 5 0"/>` : `<circle class="k-t" cx="55.5" cy="47" r="1.5"/><circle class="k-t" cx="64.5" cy="47" r="1.5"/>`;
    s += up ? `<circle class="k-l k-thin" cx="60" cy="53.5" r="1.8"/>` : `<path class="k-l k-thin" d="M57.5 52.8q2.5 2 5 0"/>`;
    if (i >= 6) s += `<g class="k-l k-thin"><circle cx="55.5" cy="47.2" r="4"/><circle cx="64.5" cy="47.2" r="4"/><path d="M59.5 47.2h1"/></g>`;
    return s;
  }
  // what each level adds: [behind the kid, in front of the kid, arms up]
  const PROPS = {
    letters: () => [`<text class="k-t k-letter" x="26" y="34" transform="rotate(-12 26 34)">A</text><text class="k-t k-letter" x="86" y="30" transform="rotate(10 86 30)">Ž</text><text class="k-t k-letter" x="57" y="22">b</text>`, '', true],
    picturebook: () => ['', book() + `<circle class="k-a-f" cx="51" cy="88.5" r="2"/>`],
    syllables: () => [`<path class="k-f k-l k-thin" d="M74 27h20a6 6 0 0 1 6 6v1a6 6 0 0 1-6 6H83l-5 5 1-5h-5a6 6 0 0 1-6-6v-1a6 6 0 0 1 6-6z"/><text class="k-t k-small" x="84" y="36.6" text-anchor="middle">BE·RI</text>`, book()],
    worm: () => ['', book() + `<path class="k-l" d="M70 86q1-9 7-8q4 1 1.5 5"/>`],
    net: () => [`<path class="k-l" d="M72 87L96 42"/><circle class="k-l k-thin" cx="98" cy="36" r="8"/>`, book()],
    blanket: () => [`<path class="k-s k-l" d="M28 100Q30 46 60 26Q90 46 92 100"/>`, book() + `<path class="k-l k-thin" d="M52 80l-3-5M60 79v-6M68 80l3-5"/>`],
    glasses: () => ['', book()],
    backpack: () => [`<rect class="k-f k-l" x="72" y="61" width="22" height="30" rx="7"/><path class="k-l k-thin" d="M78 61v-7M84 61v-9M90 61v-6"/>`, book()],
    card: () => ['', book() + `<rect class="k-f k-l k-thin" x="80" y="62" width="14" height="19" rx="2" transform="rotate(10 87 71)"/><path class="k-l k-thin" d="M83.5 67.5h7M83 72h7" transform="rotate(10 87 71)"/>`],
    stack: () => [tiny(24, 94, 0) + tiny(25, 80, -5) + tiny(23, 66, 4) + tiny(24, 52, -7), book()],
    hat: () => [`<path class="k-l" d="M95 100L101 56"/>`, book() + `<path class="k-f k-l" d="M48 35.5Q49 23 60 23Q71 23 72 35.5"/><path class="k-l" d="M41 36h38"/>`],
    lamp: () => [`<path class="k-g" d="M24 57L62 82H44Z"/><path class="k-l" d="M18 100h12M24 100V57"/><path class="k-f k-l" d="M17 57h14l-3.5-9h-7z"/>`, book(true)],
    cape: () => ['', book()],
    calm: () => [halo(23), book()],
    float: () => [halo(25) + tiny(22, 50, -14) + tiny(98, 44, 12), book(true)],
    orbit: () => [halo(28, 49) + `<ellipse class="k-l k-thin k-dash" cx="60" cy="84" rx="45" ry="11"/>` + tiny(17, 82, -10) + tiny(103, 80, 10) + tiny(84, 70, 6), book(true)],
    owl: () => [halo(30, 49) + `<path class="k-l k-thin" d="M51 79l-7-12M60 77V64M69 79l7-12"/>`, book(true) + `<g transform="translate(34 63)"><path class="k-f k-l k-thin" d="M-6 7Q-7-6 0-7Q7-6 6 7Z"/><circle class="k-l k-thin" cx="-2.4" cy="-2" r="2"/><circle class="k-l k-thin" cx="2.4" cy="-2" r="2"/></g>`],
    light: () => [`<circle class="k-g k-g1" cx="60" cy="52" r="42"/><circle class="k-g" cx="60" cy="50" r="33"/>` + halo(27, 48)
      + Array.from({ length: 8 }, (_, k) => { const a = (k + .5) / 8 * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a); return `<path class="k-ray" d="M${(60 + c * 35).toFixed(1)} ${(52 + s * 35).toFixed(1)}L${(60 + c * 41).toFixed(1)} ${(52 + s * 41).toFixed(1)}"/>`; }).join('')
      + tiny(25, 40, -14) + tiny(95, 40, 14), book(true)],
  };
  const cape = `<path class="k-s k-l" d="M44 67Q28 86 31 99H89Q92 86 76 67"/>`;
  let n = 0;   // each drawing clips to its own disc, so glow and floating books never spill past the ring
  return function kid(i, size, locked) {
    const t = Math.min(2, Math.floor(i / 6)), p = PROPS[RG.LEVELS[i][2]](), lift = i >= 17 ? 10 : i >= 14 ? 8 : 0, id = 'kc' + (++n);
    const sc = [1.06, 1.12, 1.14][t];
    const fig = `<g transform="translate(0 ${-lift}) translate(60 102) scale(${sc}) translate(-60 -102)">${p[0]}${i >= 12 ? cape : ''}${body(i, p[2])}${p[1]}</g>`;
    return `<svg class="kid t${t + 1}${locked ? ' locked' : ''}" width="${size}" height="${size}" viewBox="0 0 120 120" aria-hidden="true"><defs><clipPath id="${id}"><circle cx="60" cy="60" r="57"/></clipPath></defs><circle class="k-disc" cx="60" cy="60" r="58"/><g class="fig" clip-path="url(#${id})"><path class="k-ground" d="M${lift ? 44 : 32} 104h${lift ? 32 : 56}"/>${fig}</g><circle class="k-ring" cx="60" cy="60" r="58"/></svg>`;
  };
})();
