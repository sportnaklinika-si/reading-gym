/* Bralni mentor: the reader growing up across the 18 levels, a flat illustration in a 160 x 160 room.
   Every three levels the reader is older: toddler, schoolkid, teen, adult, middle-aged, old. Two running jokes: a cat that grows old alongside
   (and keeps sitting on the book), and one favourite red picture book: the toddler reads it, the teen leaves it on the floor, the adult keeps it
   on the shelf, the old reader reads it again. The room opens up level by level: a rug, a drawing, a shelf, a window, a lamp, plants, a whole
   library, then light. All colours are theme variables (--il-*); this file injects one fill class f-x and one stroke class s-x per variable.
   Gentle motion only when the drawing has the class "live": breathing, blinking, a page turning, a swishing tail, floating dust at the top level. */
'use strict';
const KID = (() => {
  const TOKENS = ['wall', 'wall-shade', 'floor', 'floor-shade', 'rug', 'rug-2', 'skin', 'skin-shade', 'blush', 'lip', 'ink', 'hair', 'hair-grey', 'hair-white',
    'cloth-1', 'cloth-2', 'cloth-2b', 'cloth-3', 'cloth-3d', 'cloth-4', 'cloth-4d', 'cloth-5', 'cloth-6', 'cloth-7', 'pants', 'pants-kid', 'shoe',
    'book', 'book-2', 'book-3', 'book-4', 'star', 'paper', 'paper-line', 'wood', 'wood-dark', 'chair', 'chair-shade', 'cushion', 'beanbag', 'blanket', 'box',
    'window', 'window-frame', 'moon', 'curtain', 'plant', 'plant-dark', 'pot', 'cat', 'cat-shade', 'cat-light', 'cat-old', 'nose', 'lamp', 'light', 'beam', 'glow'];
  if (typeof document !== 'undefined') {
    const st = document.createElement('style');
    st.textContent = TOKENS.map(t => `.f-${t}{fill:var(--il-${t})}.s-${t}{stroke:var(--il-${t})}`).join('') + '.ln{fill:none;stroke-linecap:round;stroke-linejoin:round}';
    document.head.appendChild(st);
  }
  const at = o => o ? Object.entries(o).map(([k, v]) => ` ${k}="${v}"`).join('') : '';
  const P = (c, d, w, o) => `<path class="${c}" d="${d}"${w ? ` stroke-width="${w}"` : ''}${at(o)}/>`;
  const E = (c, cx, cy, rx, ry, o) => `<ellipse class="${c}" cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry == null ? rx : ry}"${at(o)}/>`;
  const R = (c, x, y, w, h, r, o) => `<rect class="${c}" x="${x}" y="${y}" width="${w}" height="${h}"${r ? ` rx="${r}"` : ''}${at(o)}/>`;
  const G = (tr, inner, c) => `<g${c ? ` class="${c}"` : ''}${tr ? ` transform="${tr}"` : ''}>${inner}</g>`;
  const star = (cx, cy, r, c) => P(c || 'f-star', 'M' + Array.from({ length: 10 }, (_, k) => { const a = k / 10 * 2 * Math.PI - Math.PI / 2, q = k % 2 ? r * .45 : r; return (cx + q * Math.cos(a)).toFixed(1) + ' ' + (cy + q * Math.sin(a)).toFixed(1); }).join('L') + 'Z');

  // ---------- the reader. Origin of each part: the hips (0,0), y up is negative; the head has its own origin at its centre.
  const AGE = [
    { k: .64, hf: 1.42, hy: 137, hair: 'tod', top: 'tee', legs: 'cross', seat: '', pants: 'f-pants-kid', feet: 'f-paper' },
    { k: .8, hf: 1.2, hy: 134, hair: 'kid', top: 'stripes', legs: 'cross', seat: 'cushion', pants: 'f-pants-kid', feet: 'f-shoe' },
    { k: .92, hf: 1.06, hy: 129, hair: 'teen', top: 'hoodie', legs: 'cross', seat: 'beanbag', pants: 'f-pants', feet: 'f-shoe' },
    { k: 1, hf: 1, hy: 113, hair: 'adult', top: 'sweater', legs: 'down', seat: 'chair', pants: 'f-pants', feet: 'f-shoe' },
    { k: 1, hf: 1, hy: 113, hair: 'mid', top: 'vest', legs: 'down', seat: 'chair', pants: 'f-pants', feet: 'f-shoe', specs: 1 },
    { k: .97, hf: 1, hy: 113, hair: 'old', top: 'cardigan', legs: 'down', seat: 'chair', pants: 'f-pants', feet: 'f-shoe', specs: 1, blanket: 1 },
  ];
  const HAIR = {
    tod: 'M-11.6 0C-12.4-10.6-6-14 0-13.8C6-14 12.4-10.6 11.6 0C10-5.6 5-8.2 0-8C-5-8.2-10-5.6-11.6 0Z',
    kid: 'M-12 2C-13.6-10-6.4-15.6 0-15.2C7-15.6 13.6-10 12 2C11.4-3 9.6-5.6 7.4-6.4L5.6-3.8L3.6-7L.6-4.4L-2.6-7.4L-5.6-4L-8-6.4C-10-4.8-11.4-1.8-12 2Z',
    teen: 'M-12.4 3C-14-9-6.6-16.4 1-16C9-15.8 14-9.4 12.6 2C12-2.6 10.4-6 7.6-7.6C3-5.4-3.4-3.6-9-4.8C-10.6-2.4-11.8.4-12.4 3Z',
    adult: 'M-11.6-.4C-12.4-11-6.2-15.2 0-15C7-15.2 12.4-10.6 11.6-.4C10.8-6.2 8-8.8 3-9.2C-2-9.6-8.4-8-11.6-.4Z',
  };
  HAIR.mid = HAIR.adult;
  function head(a, i) {
    const kid = a.k < .9, old = a.hair === 'old';
    let s = a.hair === 'teen' ? P('f-hair', 'M-12.6 4C-13.8-6-12-12.4-8-14.8C-3-17.8 6-17 10-13.6C13.6-10.6 14-3 12.6 4Z') : '';
    s += E('f-skin', -11.2, 1.6, 2.2, 3.1) + E('f-skin', 11.2, 1.6, 2.2, 3.1) + E('f-skin-shade', -11.5, 1.8, 1, 1.7) + E('f-skin-shade', 11.5, 1.8, 1, 1.7);
    s += E('f-skin', 0, 0, 11.4, 12.4);
    if (kid || old) s += E('f-blush', -6.9, 6, 2.1, 1.2, { opacity: .45 }) + E('f-blush', 6.9, 6, 2.1, 1.2, { opacity: .45 });
    // eyes look down at the book; children's eyes are larger and catch the light
    const er = kid ? [1.5, 1.8] : [1.25, 1.5];
    s += `<g class="blink">${E('f-ink', -4.3, 2.2, er[0], er[1])}${E('f-ink', 4.3, 2.2, er[0], er[1])}${kid ? E('f-paper', -3.8, 1.5, .5) + E('f-paper', 4.8, 1.5, .5) : ''}</g>`;
    s += P(`ln ${old ? 's-hair-grey' : 's-hair'}`, 'M-6.6-2.6q2.2-1.4 4.4-.4M6.6-2.6q-2.2-1.4-4.4-.4', 1.1);
    s += P('ln s-skin-shade', 'M.4 3.4q1.6 2.4-.8 3.4', 1.1);
    s += i === 0 ? E('f-lip', 0, 8.6, 2, 1.7) : P('ln s-lip', 'M-2.8 8.2q2.8 1.9 5.6 0', 1.2);
    if (old) s += P('ln s-skin-shade', 'M-9 1.2q-1 1-1.2 2.2M9 1.2q1 1 1.2 2.2M-5.2 10.8q5.2 1.8 10.4 0', .7);
    if (old) s += P('f-hair-white', 'M-11.8 2.6C-12.8-5-10.6-10.2-6.4-11.8C-8.4-8-10-3.6-10.2 2.6ZM11.8 2.6C12.8-5 10.6-10.2 6.4-11.8C8.4-8 10-3.6 10.2 2.6ZM-6-12Q0-14.8 6-12Q2.6-12.8 0-12.2Q-2.6-12.8-6-12Z') + E('f-paper', -3.4, -8.6, 2.6, 1.2, { opacity: .35 });
    else s += P('f-hair', HAIR[a.hair]);
    if (a.hair === 'tod') s += P('ln s-hair', 'M-1-13.6c-1.4-4.6 5.4-6.6 6.2-2.2c-.8-2-3.8-1.6-3 .8', 1.8);
    if (a.hair === 'mid') s += P('f-hair-grey', 'M-11.6-.4C-11.8-3-11.4-5-10.6-6.6L-9.4-1.6ZM11.6-.4C11.8-3 11.4-5 10.6-6.6L9.4-1.6Z');
    if (a.specs) s += `<g class="f-paper s-ink" fill-opacity=".22" stroke-width=".8"><circle cx="-4.3" cy="2.4" r="3.3"/><circle cx="4.3" cy="2.4" r="3.3"/></g>` + P('ln s-ink', 'M-1 2.2h2M-7.6 1.8L-11 .8M7.6 1.8L11 .8', .8);
    return s;
  }
  const TORSO = 'M-10 0C-12-12-15.2-25-13.4-32.6Q-7-36.9 0-36.7Q7-36.9 13.4-32.6C15.2-25 12-12 10 0Z';
  const NECKLINE = 'M-4.4-36.6Q0-31.8 4.4-36.6Z';
  function top(a) {
    switch (a.top) {
      case 'tee': return P('f-cloth-1', TORSO) + P('f-skin', NECKLINE) + E('f-star', 0, -20, 3.4) + P('ln s-star', 'M0-26.4v1.6M0-15.2v1.6M-6.4-20h1.6M4.8-20h1.6', 1.2);
      case 'stripes': return P('f-cloth-2b', TORSO) + R('f-cloth-2', -14.1, -31, 28.2, 3.2) + R('f-cloth-2', -14.5, -24, 29, 3.2) + R('f-cloth-2', -13.6, -17, 27.2, 3.2) + R('f-cloth-2', -12.3, -10, 24.6, 3.2) + P('f-skin', NECKLINE);
      case 'hoodie': return P('f-cloth-3', TORSO) + P('f-cloth-3d', 'M-8.4-4.4H8.4L6.6-12H-6.6Z', 0, { opacity: .7 }) + P('f-cloth-3d', 'M-10.4-33.4Q-10-40.6 0-41.2Q10-40.6 10.4-33.4Q5.4-30.4 0-30.6Q-5.4-30.4-10.4-33.4Z') + P('ln s-paper', 'M-2.6-31v7.4M2.6-31v6.4', .9);
      case 'sweater': return P('f-cloth-4', TORSO) + P('f-paper', 'M-4.6-36.6L0-30.4L4.6-36.6Q0-34.4-4.6-36.6Z') + P('ln s-cloth-4d', 'M-10.6-2.6H10.6M-12.6-29Q-14.4-22-12.8-17M12.6-29Q14.4-22 12.8-17', 1.4);
      case 'vest': return P('f-cloth-5', TORSO) + P('f-cloth-6', 'M-13.4-32.6Q-9.6-35.4-5.4-36.2L-1.6-2.4Q-5.6-.4-10 0C-12-12-15.2-25-13.4-32.6ZM13.4-32.6Q9.6-35.4 5.4-36.2L1.6-2.4Q5.6-.4 10 0C12-12 15.2-25 13.4-32.6Z') + P('f-paper', 'M-4.6-36.6L-1.6-31.2L0-34L1.6-31.2L4.6-36.6Q0-35-4.6-36.6Z') + E('f-ink', -2.6, -22, .7) + E('f-ink', -2.2, -14, .7);
      case 'cardigan': return P('f-paper', TORSO) + P('f-cloth-7', 'M-13.4-32.6Q-9.6-35.4-4.6-36.4L-.8-1Q-5.6-.4-10 0C-12-12-15.2-25-13.4-32.6ZM13.4-32.6Q9.6-35.4 4.6-36.4L2.4-1Q5.6-.4 10 0C12-12 15.2-25 13.4-32.6Z') + E('f-cloth-4d', -1.8, -26, .9) + E('f-cloth-4d', -1.4, -18, .9) + E('f-cloth-4d', -1.1, -10, .9);
    }
    return '';
  }
  const SLEEVE = { tee: 'cloth-1', stripes: 'cloth-2', hoodie: 'cloth-3', sweater: 'cloth-4', vest: 'cloth-5', cardigan: 'cloth-7' };
  const ARMS = 'M12.4-31.6Q18.8-25.4 17.6-19.2Q16.6-15 14.4-13.6M-12.4-31.6Q-18.8-25.4-17.6-19.2Q-16.6-15-14.4-13.6';
  function arms(a) {
    if (a.top === 'tee') return P('ln s-skin', ARMS, 5.6) + P('ln s-cloth-1', 'M12.4-31.6Q16.6-28 17.8-25M-12.4-31.6Q-16.6-28-17.8-25', 6.4);
    return P(`ln s-${SLEEVE[a.top]}`, ARMS, 6.4);
  }
  const hands = () => E('f-skin', -14.8, -13.6, 3.2, 2.8) + E('f-skin', 14.8, -13.6, 3.2, 2.8) + E('f-skin', -12.6, -15.8, 1.4, 2) + E('f-skin', 12.6, -15.8, 1.4, 2);
  // the open book; the favourite is the red picture book with a gold ribbon (a cat drawn on its right page)
  function book(fav, cover) {
    let s = P(fav ? 'f-book' : cover, 'M-16.4-20.4Q-8.2-24.8 0-20.6Q8.2-24.8 16.4-20.4V-7.2Q8.2-11.6 0-7.2Q-8.2-11.6-16.4-7.2Z');
    s += P('f-paper', 'M-15-20.4Q-7.6-24 0-20.2Q7.6-24 15-20.4V-8.8Q7.6-12.4 0-8.8Q-7.6-12.4-15-8.8Z') + P('ln s-paper-line', 'M0-20.2V-8.8', .8);
    s += fav ? E('f-star', -9.4, -17.2, 1.9) + P('f-plant', 'M-14.4-9.4Q-9-14.4-3-10.4V-9.2Q-8.8-12-14.4-9.2Z') + E('f-cat', 7.6, -14.6, 2.7) + P('f-cat', 'M5.4-15.8l.5-2.8 1.8 1.4ZM9.8-15.8l-.5-2.8-1.8 1.4Z') + P('f-star', 'M1.4-8.6h2.4v7l-1.2-1.4-1.2 1.4Z')
      : P('ln s-paper-line', 'M-12.8-17.6q5.4-1.8 10.4.4M-12.8-14.6q5.4-1.8 10.4.4M-12.8-11.6q5.4-1.8 7.4.2M2.4-17.2q5.4-2 10.4-.2M2.4-14.2q5.4-2 10.4-.2M2.4-11.2q5.4-2 6-.2', .8);
    return s + P('f-paper page', 'M0-20.2Q7.6-24 15-20.4V-8.8Q7.6-12.4 0-8.8Z');
  }
  function legs(a) {
    if (a.legs === 'cross') return P(a.pants, 'M-25 2.6Q-27.6-6.6-12-6.2H12Q27.6-6.6 25 2.6Q22 9.6 0 9.6Q-22 9.6-25 2.6Z') + P('ln s-ink', 'M-9 3.4Q0 6 9 3.4', .6, { opacity: .3 }) + E(a.feet, -20, 5.6, 5.4, 3.2) + E(a.feet, 20, 5.6, 5.4, 3.2);
    const feet = E(a.feet, -6.8, 27.4, 6.4, 3.2) + E(a.feet, 6.8, 27.4, 6.4, 3.2);
    if (a.blanket) return feet + P('f-blanket', 'M-17-5H17L18.6 24.6Q0 27-18.6 24.6Z') + P('ln s-wood', 'M-9-5L-10 25.4M0-5V26M9-5L10 25.4M-17.4 5H17.4M-18 15H18', .7, { opacity: .45 });
    return P(a.pants, 'M-12.6-5.4H-1L-2.2 25.8H-11.4ZM12.6-5.4H1L2.2 25.8H11.4Z') + P('ln s-ink', 'M-6.6 8v4M6.6 8v4', .7, { opacity: .25 }) + feet;
  }
  function seat(a) {
    if (a.seat === 'cushion') return E('f-cushion', 72, 140, 30, 7.4) + P('ln s-wood', 'M46 139Q72 145 98 139', .7, { opacity: .5 });
    if (a.seat === 'beanbag') return P('f-beanbag', 'M36 147Q30 124 50 113Q72 103 94 113Q114 124 108 147Q72 155 36 147Z') + P('ln s-paper', 'M50 120Q58 112 68 111', 1.6, { opacity: .3 });
    if (a.seat === 'chair') return R('f-chair', 42, 64, 60, 66, 16) + R('f-chair-shade', 46, 104, 52, 18, 6) + R('f-chair', 34, 94, 16, 42, 8) + R('f-chair', 94, 94, 16, 42, 8) + R('f-wood-dark', 40, 134, 5, 10, 2) + R('f-wood-dark', 99, 134, 5, 10, 2);
    return '';
  }
  function person(i, a) {
    const fav = i <= 5 || i >= 15, hd = -37 - 10.4 * a.hf;
    const cover = a.top === 'hoodie' ? 'f-book-2' : a.top === 'sweater' ? 'f-book-3' : 'f-book-4';
    const phones = i === 7 || i === 8 ? P('ln s-ink', 'M-8.4-36.4Q0-29.6 8.4-36.4', 1.5) + E('f-ink', -9, -36.8, 2.3, 3) + E('f-ink', 9, -36.8, 2.3, 3) : '';
    const upper = R('f-skin', -3.6, -40.6, 7.2, 6) + top(a) + phones + G(`translate(0 ${hd.toFixed(2)}) scale(${a.hf})`, head(a, i)) + arms(a) + book(fav, cover) + hands();
    return G(`translate(72 ${a.hy}) scale(${a.k})`, legs(a) + `<g class="breath">${upper}</g>`);
  }

  // ---------- the cat: kitten (0), young (1), adult (2), round (3), old (4)
  function cat(pose, age, x, y, sc, extra) {
    const old = age === 4, fat = age >= 3, kit = age === 0, muz = old ? 'f-cat-old' : 'f-cat-light', ex = extra || '';
    const ears = P('f-cat', 'M-7-2.4L-5.8-10.4L-1.6-6ZM7-2.4L5.8-10.4L1.6-6Z') + P('f-nose', 'M-5.6-4L-5-8.2L-3.2-6ZM5.6-4L5-8.2L3.2-6Z', 0, { opacity: .55 });
    const face = (asleep) => P('ln s-cat-shade', 'M-1.8-6.4v2.6M1.8-6.4v2.6M0-6.8v3.2', 1) + E(muz, 0, 2.6, 3.8, 2.7)
      + (asleep || old ? P('ln s-ink', 'M-4.2-.4q1.3.9 2.6 0M1.6-.4q1.3.9 2.6 0', .9) : `<g class="blink">${E('f-ink', -2.9, -.6, 1.05, 1.4)}${E('f-ink', 2.9, -.6, 1.05, 1.4)}</g>`)
      + P('f-nose', 'M-1 1.4h2L0 2.5Z') + P('ln s-ink', 'M-4 2.6l-4.4-.8M-4 3.6l-4.4.6M4 2.6l4.4-.8M4 3.6l4.4.6', .35, { opacity: .55 })
      + (ex.includes('specs') ? `<g class="f-paper s-ink" fill-opacity=".25" stroke-width=".6"><circle cx="-2.9" cy="-.4" r="2.3"/><circle cx="2.9" cy="-.4" r="2.3"/></g>` : '');
    let s;
    if (pose === 'sleep') {
      s = E('f-cat snooze', 0, -6.8, fat ? 16 : 13.6, fat ? 8 : 7) + P('ln s-cat-shade', 'M2-12.4q2.2 3 0 6.2M7-11.6q2.2 3 0 6M-3-12.6q2 3 0 6.2', 1)
        + P('ln s-cat', 'M12.6-3.6Q17 2 4 1.6Q-6 1.4-13-1', 3.2) + G('translate(-10 -7.6) scale(.86)', ears + E('f-cat', 0, 0, 7.4, 7) + face(true));
    } else {
      const body = fat ? 'M-12.6 0Q-15.6-13-6.2-19.6H6.2Q15.6-13 12.6 0Z' : 'M-9.6 0Q-12.2-13-5.6-19.6H5.6Q12.2-13 9.6 0Z';
      s = (pose === 'box' ? '' : P('ln s-cat tail', 'M7.6-2.4Q19-3.6 17-15.4', 3.4)) + P('f-cat', body) + E('f-cat-light', 0, -8.6, fat ? 5.4 : 4.2, 6.2)
        + E('f-cat-light', -3.8, -.9, 2.6, 1.6) + E('f-cat-light', 3.8, -.9, 2.6, 1.6)
        + G(`translate(0 -24.6) scale(${kit ? 1.22 : 1})`, ears + E('f-cat', 0, 0, 7.4, 7) + face(false));
      if (ex.includes('phones')) s += P('ln s-ink', 'M-7.8-24Q-7.8-35.4 0-35.4Q7.8-35.4 7.8-24', 1.6) + E('f-cloth-3d', -7.8, -24, 2.2, 3) + E('f-cloth-3d', 7.8, -24, 2.2, 3);
      if (ex.includes('paw')) s += E('f-cat-light', 7.4, -14, 2.6, 2.2) + P('ln s-star', 'M12-34Q9-24 8.4-16', .9);
      if (ex.includes('yarn')) s += P('ln s-cloth-4', 'M8.6-2Q2 3-7 1', .8) + E('f-cloth-4', 12.4, -3.6, 4.4) + P('ln s-cloth-4d', 'M9-5.6q3.4 2 6.6-1M9.8-2q3.4-3 5.6 1', .6);
      if (ex.includes('book')) s += P('f-paper', 'M-7-2.6Q-3.5-4.2 0-2.8Q3.5-4.2 7-2.6V1.6Q3.5 0 0 1.6Q-3.5 0-7 1.6Z') + P('ln s-paper-line', 'M0-2.8V1.6', .5);
      if (pose === 'box') s += P('f-box', 'M-16-10L-22-16H-11L-9-10ZM16-10L22-16H11L9-10Z') + R('f-box', -16, -10, 32, 12, 1) + P('ln s-wood', 'M-16-6H16', .6, { opacity: .4 });
    }
    return G(`translate(${x} ${y}) scale(${(sc * (kit ? .62 : 1)).toFixed(3)})`, s);
  }
  // [pose, age, x, y, scale, extras]; y 'book' and 'lap' are worked out from the reader
  const CATS = [
    ['sit', 0, 128, 150, 1, 'paw'], ['sleep', 0, 128, 150, 1], ['sit', 0, 126, 150, 1, 'yarn'],
    ['sit', 1, 128, 63, .8], ['sleep', 1, 72, 'book', .66], ['box', 1, 130, 150, .9],
    ['sit', 2, 130, 150, .92, 'phones'], ['sit', 2, 30, 44, .7], ['sleep', 2, 72, 'book', .74],
    ['sleep', 2, 72, 'lap', .9], ['sleep', 2, 86, 67, .72], ['sit', 2, 141, 150, .86],
    ['sit', 3, 128, 63, .78], ['sleep', 3, 28, 9.4, .62], ['sleep', 3, 46, 151, .72],
    ['sit', 4, 131, 149, .8, 'specs book'], ['sleep', 4, 72, 'lap', .9], ['sleep', 4, 72, 'lap', .9],
  ];

  // ---------- the room, filled in level by level
  function books(x, base, w, seed) {
    const C = ['f-book-2', 'f-book-3', 'f-book-4', 'f-cloth-4', 'f-cloth-6', 'f-curtain', 'f-cloth-3'];
    let s = '', n = seed;
    while (x < w - 3) { n = (n * 7 + 3) % 11; const bw = 3 + n % 3, bh = 13 + (n * 3) % 6; s += R(C[n % C.length], x, base - bh, bw, bh, .6); x += bw + .6; }
    return s;
  }
  function room(i) {
    let s = R('f-wall', 0, 0, 160, 120) + R('f-floor', 0, 118, 160, 42) + R('f-wall-shade', 0, 114, 160, 4) + P('ln s-floor-shade', 'M0 131H160M0 145H160', .8)
      + E('f-rug', 72, 148, 54, 8) + `<ellipse class="ln s-rug-2" cx="72" cy="148" rx="48" ry="6" stroke-width="1.2"/>`;
    if (i >= 12) s += R('f-wood-dark', 4, 8, 48, 110, 3) + R('f-wood', 7, 11, 42, 104, 2) + [36, 62, 88].map(y => R('f-wood-dark', 7, y, 42, 3)).join('')
      + books(9, 36, 49, 1) + books(9, 62, 30, 4) + books(9, 88, 49, 6) + books(9, 113, 49, 2) + R('f-book', 31, 45, 11, 17, 1) + star(36.5, 53.5, 3.2);
    else if (i >= 6) s += R('f-wood', 8, 44, 44, 3.4, 1) + R('f-wood', 8, 76, 44, 3.4, 1) + books(10, 44, i >= 9 ? 32 : 50, 3) + books(10, 76, 50, 5)
      + (i >= 9 ? R('f-book', 35, 30, 11, 14, 1) + star(40.5, 37, 3) : '');
    else if (i >= 2) s += R('f-wood', 8, 54, 40, 3.4, 1) + R('f-book-2', 12, 40, 5, 14, .6) + R('f-book-3', 17.6, 42, 4, 12, .6) + R('f-book-4', 22.2, 39, 6, 15, .6) + E('f-cloth-1', 40, 50.4, 3.6);
    if (i >= 1 && i <= 5) s += G('rotate(-3 74 25)', R('f-paper', 62, 15, 24, 19, 1) + E('f-star', 68, 21, 3) + P('f-cloth-4', 'M70 33V27l5-4 5 4v6Z') + P('ln s-plant', 'M62.6 32.4Q74 29.4 85.4 32.4', 1)) + R('f-wall-shade', 71, 13.2, 6, 3, .6);
    if (i >= 6 && i <= 8) s += R('f-cloth-3', 60, 12, 28, 32, 1.5) + E('f-star', 74, 25, 5.6) + `<ellipse class="ln s-paper" cx="74" cy="25" rx="10" ry="2.6" stroke-width="1.1" transform="rotate(-14 74 25)"/>` + E('f-paper', 65, 16, .8) + E('f-paper', 83, 34, .8) + P('ln s-paper', 'M65 39H83', 1.2);
    if (i >= 9 && i <= 12) s += R('f-wood-dark', 61, 14, 26, 22, 1.5) + R('f-window', 63.6, 16.6, 20.8, 16.8, .8) + P('f-plant', 'M63.6 33.4L70 25L74 29L78 23L84.4 33.4Z') + E('f-moon', 80, 20.6, 2);
    if (i >= 13) s += `<circle class="f-paper s-wood-dark" cx="74" cy="26" r="9" stroke-width="1.8"/>` + P('ln s-ink', 'M74 26V20.4M74 26l3.6 2.2', 1.2) + E('f-ink', 74, 26, .9);
    if (i >= 15) s += R('f-wood-dark', 106, 72, 50, 46, 3) + R('f-wood', 109, 75, 44, 40, 2) + R('f-wood-dark', 109, 94, 44, 3) + books(111, 94, 152, 2) + books(111, 115, 152, 5);
    if (i >= 3) {
      s += R('f-window-frame', 104, 14, 48, 50, 3) + R('f-window', 107.4, 17.4, 41.2, 43.2, 1.5) + E('f-moon', 138, 28, 4.6) + E('f-moon', 116, 26, .7) + E('f-moon', 124, 46, .6) + E('f-moon', 143, 49, .7)
        + P('ln s-window-frame', 'M128 17.4V60.6M107.4 39H148.6', 2.4) + R('f-window-frame', 100, 62, 56, 4.4, 1.5);
      if (i === 3) s += P('f-ink', 'M116 31q3-3.4 6-.4q2.4-1.6 4.4.4q-2.6-.6-4.4 1.4q-3-1.6-6-1.4Z', 0, { opacity: .7 });
      if (i >= 9) s += P('f-curtain', 'M98 10H110Q107 36 112 70H98ZM158 10H146Q149 36 144 70H158Z') + P('ln s-wood-dark', 'M96 10H160', 1.6);
    }
    if (i >= 16) s += P('f-beam', 'M108 18H148L104 160H30Z');
    if (i >= 7) s += P('ln s-ink', 'M2 10Q22 20 42 11T82 11T122 11T162 11', .6, { opacity: .5 }) + [[12, 14.4], [30, 15.6], [52, 14.4], [70, 15.6], [92, 14.4], [110, 15.6], [132, 14.4], [150, 15.6]].map(p => E('f-lamp', p[0], p[1], 1.5)).join('');
    if (i >= 15) s += P('ln s-wood', 'M30 150L40 12M42 150L52 12', 2) + P('ln s-wood', Array.from({ length: 9 }, (_, k) => { const y = 140 - k * 15, x = 30 + (150 - y) * 10 / 138; return `M${x.toFixed(1)} ${y}H${(x + 12).toFixed(1)}`; }).join(''), 1.6);
    if (i >= 4) s += P('f-light', 'M19 62H35L86 146H-2Z') + P('ln s-wood-dark', 'M27 62V146', 1.8) + E('f-wood-dark', 27, 146.6, 7, 2) + P('f-lamp', 'M17 62H37L33 48H21Z');
    if (i >= 8) s += R('f-book-3', 4, 140, 22, 5, 1) + R('f-cloth-4', 6, 135, 19, 5, 1) + R('f-book-2', 5, 130, 20, 5, 1) + R('f-book-4', 7.5, 125, 16, 5, 1);
    if (i >= 5 && i <= 9) s += P('f-pot', 'M143 150H155L156.6 138H141.4Z') + P('f-plant', 'M149 138Q140 128 144 120Q150 128 149 138ZM149 138Q148 124 152 116Q154 128 149 138Z') + P('f-plant-dark', 'M149 138Q158 130 156 122Q149 128 149 138Z');
    if (i >= 10) s += P('ln s-plant-dark', 'M149 132Q146 112 140 98M149 132Q152 110 158 100M149 132Q150 116 150 104', 1.4)
      + P('f-plant', 'M140 98Q132 100 134 108Q140 106 140 98ZM158 100Q164 104 160 112Q155 108 158 100ZM150 104Q144 96 150 90Q155 96 150 104Z') + P('f-plant-dark', 'M144 114Q136 116 137 123Q143 121 144 114ZM154 112Q161 114 160 121Q154 119 154 112Z') + P('f-pot', 'M140 150H158L156 132H142Z');
    if (i >= 11) s += R('f-wood-dark', 117, 118, 4, 28, 1) + R('f-wood', 109, 115, 20, 4, 1.5) + R('f-paper', 113, 106.6, 7, 8.4, 1.6) + P('ln s-paper', 'M120 109q3 0 3 2.6t-3 2.6', 1.4) + P('ln s-paper-line steam', 'M115 104q-1.6-2.4 0-4.6t0-4.6M118.4 104q-1.6-2.4 0-4.6', .8);
    if (i >= 6 && i <= 8) s += G('translate(106 145) rotate(-8)', R('f-book', -8, -6, 16, 11, 1.4) + star(0, -.6, 2.8));
    if (i === 7) s += G('translate(50 66) rotate(28)', R('f-book-2', -4, -6, 8, 12, 1)) + P('ln s-ink', 'M44 56l-3-3M48 54l-1-4', .7, { opacity: .5 });
    return s;
  }

  let n = 0;
  return function kid(i, size, locked, live) {
    const a = AGE[Math.floor(i / 3)], t = Math.min(2, Math.floor(i / 6)), id = 'kc' + (++n), c = CATS[i];
    const cy = c[3] === 'book' ? a.hy - 7.6 * a.k : c[3] === 'lap' ? a.hy + 1.5 : c[3];
    const hx = 72, hy = a.hy + (-37 - 10.4 * a.hf) * a.k;
    const glow = i >= 17 ? E('f-glow glow aura', hx, hy + 6, 40) + E('f-glow glow aura', hx, hy + 2, 27)
      + [[50, 96, 0], [96, 84, 1.4], [60, 70, 2.6], [104, 108, 3.6], [40, 118, 4.4], [90, 60, 5.2]].map(p => E('f-lamp glow mote', p[0], p[1], 1.2, 1.2, { style: `animation-delay:-${p[2]}s` })).join('') : '';
    const fig = glow + seat(a) + person(i, a) + cat(c[0], c[1], c[2], cy, c[4], c[5]);
    return `<svg class="kid t${t + 1}${locked ? ' locked' : ''}${live ? ' live' : ''}" width="${size}" height="${size}" viewBox="0 0 160 160" aria-hidden="true"><defs><clipPath id="${id}"><rect width="160" height="160" rx="30"/></clipPath></defs>`
      + `<g clip-path="url(#${id})"><rect class="k-bg" width="160" height="160"/><g class="room">${room(i)}</g><g class="fig">${fig}</g></g><rect class="k-ring" x="1.5" y="1.5" width="157" height="157" rx="28.5"/></svg>`;
  };
})();
