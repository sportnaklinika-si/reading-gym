/* Reading Gym: screens, the reading timer and storage on the phone. The rules (streak, levels) are in core.js. */
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => RG.dayKey(Date.now());
const CHECK_MS = 45 * 60e3, ANSWER_MS = 3 * 60e3, BEAT_MS = 15e3, MIN_SAVE = 60;
const DEMO = location.hash.startsWith('#demo');   // example data for screenshots (#demo, #demo-stats, #demo-reader), never saved

let S = null, view = DEMO && /stats|books/.test(location.hash) ? location.hash.slice(6) : 'today', calMonth = null, installEvt = null, ask = null, tickT = null, pendingCover = null, pendingImport = null;
const covers = {};   // book id -> object URL of the cover photo

// ---------- storage: IndexedDB on the phone, localStorage only if that fails
const idb = (() => {
  let p;
  const open = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open('reading-gym', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
  const run = (mode, fn) => open().then(db => new Promise((res, rej) => {
    const t = db.transaction('kv', mode), q = fn(t.objectStore('kv'));
    t.oncomplete = () => res(q.result); t.onerror = () => rej(t.error);
  }));
  return { get: k => run('readonly', s => s.get(k)), set: (k, v) => run('readwrite', s => s.put(v, k)), del: k => run('readwrite', s => s.delete(k)) };
})();
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const fresh = () => ({ v: 1, goals: [{ from: today(), min: 20 }], books: [], sessions: [], run: null });

async function load() {
  let s = null;
  if (DEMO) s = demoState();
  else { try { s = await idb.get('state'); } catch (e) { try { s = JSON.parse(lsGet('rg-state')); } catch (e2) {} } }
  S = Object.assign(fresh(), s || {});
  // The app was closed while the timer ran: keep the time up to the last moment it was seen running.
  const r = S.run;
  if (r && r.at) { if (r.beat > r.at) r.segs.push([r.at, r.beat]); r.at = null; r.why = 'closed'; }
  if (!DEMO) for (const b of S.books) if (b.cover) loadCover(b.id);
}
async function loadCover(id) {
  try { const blob = await idb.get('cover:' + id); if (blob) { covers[id] = URL.createObjectURL(blob); render(); } } catch (e) {}
}
let chain = Promise.resolve();
function save() {
  if (DEMO) return;
  const snapS = JSON.parse(JSON.stringify(S));
  chain = chain.then(() => idb.set('state', snapS)).catch(() => lsSet('rg-state', JSON.stringify(snapS)));
}

// ---------- numbers
const totalSec = () => S.sessions.reduce((a, s) => a + s.sec, 0);
const daySec = k => S.sessions.reduce((a, s) => a + (s.day === k ? s.sec : 0), 0);
const goalNow = () => RG.goalFor(S.goals, today());
const streakNow = () => RG.streak(S.sessions, S.goals, today());
const bookById = id => S.books.find(b => b.id === id);
const bookName = b => b ? (b.title || 'Untitled book') : 'Deleted book';
const fmtMin = sec => { const m = Math.floor(sec / 60); return m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : ''); };
const fmtClock = sec => { sec = Math.floor(sec); const p = n => String(n).padStart(2, '0'), h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return h ? h + ':' + p(m) + ':' + p(sec % 60) : m + ':' + p(sec % 60); };
const fmtHours = sec => { const h = sec / 3600; return (h < 10 ? h.toFixed(1) : Math.round(h)) + ' h'; };
const fmtDay = k => RG.keyDate(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const wd = k => RG.keyDate(k).toLocaleDateString('en-GB', { weekday: 'short' });
const vibrate = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

// ---------- the timer. It only runs while the app is on screen.
let lock = null;
async function wake(on) {
  try {
    if (on && !lock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } else if (!on && lock) { const l = lock; lock = null; await l.release(); }
  } catch (e) { lock = null; }
}
const runSec = r => r.segs.reduce((a, g) => a + (g[1] - g[0]), 0) / 1000 + (r.at ? (Date.now() - r.at) / 1000 : 0);

function startRun(bookId) {
  if (S.run) return showReader();
  const now = Date.now();
  S.run = { id: uid(), book: bookId, segs: [], at: now, ok: now, beat: now, why: null };
  save(); wake(true); showReader();
}
// While "Still reading?" is open, time after the question never counts.
function pauseRun(why, end) {
  const r = S.run; if (!r || !r.at) return;
  end = end || ask || Date.now();
  if (end > r.at) r.segs.push([r.at, end]);
  r.at = null; r.why = why; ask = null;
  save(); wake(false); paintReader();
}
function resumeRun() {
  const r = S.run; if (!r) return;
  r.at = r.ok = r.beat = Date.now(); r.why = null;
  save(); wake(true); paintReader();
}
function finishRun() {
  const r = S.run; if (!r) return;
  pauseRun('done');
  const parts = RG.splitByDay(r.segs), total = Object.values(parts).reduce((a, b) => a + b, 0), before = snap();
  S.run = null;
  if (total >= MIN_SAVE) for (const [day, sec] of Object.entries(parts)) if (sec >= 1) S.sessions.push({ id: uid(), run: r.id, book: r.book, day, sec: Math.round(sec), manual: false });
  save(); hideReader(); render();
  if (total >= MIN_SAVE) cheer(before, total); else toast('Under a minute, so it wasn’t saved.');
}
function discardRun() { S.run = null; ask = null; save(); wake(false); hideReader(); render(); toast('Session thrown away.'); }

function tick() {
  const r = S.run; if (!r) return;
  const now = Date.now();
  if (r.at) {
    if (now - r.beat >= BEAT_MS) { r.beat = now; save(); }
    if (!ask && now - r.ok >= CHECK_MS) { ask = now; vibrate([200, 120, 200]); }
    else if (ask && now - ask >= ANSWER_MS) pauseRun('asleep', ask);
    const goal = goalNow() * 60;
    if (!r.hit && daySec(today()) + runSec(r) >= goal) { r.hit = true; vibrate(120); }
  }
  paintReader();
}
function showReader() { $('#reader').hidden = false; paintReader(); clearInterval(tickT); tickT = setInterval(tick, 1000); }
function hideReader() { $('#reader').hidden = true; clearInterval(tickT); tickT = null; }
const RD_C = 2 * Math.PI * 54;
const WHY = {
  pause: 'Paused.',
  left: 'Paused because you left the app or the screen went off.',
  closed: 'The app was closed while the timer ran. The time up to then is kept.',
  asleep: 'Nobody answered, so the timer stopped when the question appeared.',
};
function paintReader() {
  const r = S.run; if (!r || $('#reader').hidden) return;
  const sec = runSec(r), goal = goalNow() * 60, done = daySec(today()) + sec, f = Math.min(1, done / goal), b = bookById(r.book);
  $('#rd-book').textContent = bookName(b);
  const cv = $('#rd-cover'); if (cv.dataset.book !== r.book + (covers[r.book] || '')) { cv.dataset.book = r.book + (covers[r.book] || ''); cv.innerHTML = cover(b, 52); }
  $('#rd-live').classList.toggle('off', !r.at); $('#rd-livetxt').textContent = r.at ? 'Reading' : 'Paused';
  $('#rd-clock').textContent = fmtClock(sec);
  $('#rd-state').textContent = r.at ? 'this session' : 'paused';
  const arc = $('#rd-arc');
  arc.setAttribute('stroke-dasharray', RD_C); arc.setAttribute('stroke-dashoffset', RD_C * (1 - f));
  arc.classList.toggle('done', f >= 1); arc.style.strokeOpacity = f > 0 ? 1 : 0;
  const t = $('#rd-today'); t.classList.toggle('done', f >= 1);
  t.innerHTML = f >= 1 ? IC.tick + '<span>Daily goal done · ' + fmtMin(done) + ' today</span>' : Math.ceil((goal - done) / 60) + ' min to today’s goal';
  $('#rd-run').hidden = !r.at; $('#rd-paused').hidden = !!r.at;
  let why = WHY[r.why] || WHY.pause;
  if (r.why === 'left' && !('wakeLock' in navigator)) why += ' If the screen turns off by itself, give it longer in your phone’s display settings (Auto-Lock or Screen timeout).';
  $('#rd-why').textContent = why;
  $('#rd-ask').hidden = !ask;
}
document.addEventListener('visibilitychange', () => {
  if (!S) return;
  if (document.visibilityState === 'hidden') pauseRun('left');
  else { render(); if (S.run) showReader(); }
});
window.addEventListener('pagehide', () => { if (S) pauseRun('left'); });

// ---------- rewards
function snap() { const st = streakNow(); return { lvl: RG.level(totalSec()).i, tick: daySec(today()) >= goalNow() * 60, pr: RG.longestRun(S.sessions), marks: st.marks, cur: st.cur }; }
let freshTick = false;   // the goal was reached a moment ago: the tick on Today presses in once
function cheer(b, sec) {
  const a = snap(), msgs = [];
  if (!b.tick && a.tick) { msgs.push(['Daily goal done. Streak: ' + a.cur + (a.cur === 1 ? ' day.' : ' days.'), 'tick']); freshTick = true; render(); freshTick = false; }
  if (a.marks > b.marks) msgs.push(['You earned a bookmark. It saves your streak on a day off.', 'ribbon']);
  if (a.pr > b.pr && b.pr > 0) msgs.push(['New PR: your longest session yet, ' + fmtMin(a.pr) + '.', 'pr']);
  if (!msgs.length) msgs.push(['Saved ' + fmtMin(sec) + '.']);
  msgs.forEach(m => toast(m[0], m[1]));
  if (a.lvl > b.lvl) levelUp(a.lvl);
}
const toasts = []; let toastOn = false;
function toast(m, ic) { toasts.push([m, ic]); if (!toastOn) nextToast(); }
function nextToast() {
  const m = toasts.shift(), el = $('#toast');
  if (!m) { el.hidden = true; toastOn = false; return; }
  toastOn = true; el.innerHTML = (TOAST_IC[m[1]] || '') + `<span>${esc(m[0])}</span>`; el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  setTimeout(nextToast, 3200);
}
function party(html) { const el = $('#party'); el.innerHTML = html + '<button class="btn primary" data-act="party-close">Nice</button>'; el.hidden = false; }
// enamel chips flying off the pin when it is pressed in
const sparks = () => Array.from({ length: 14 }, (_, k) => {
  const a = k / 14 * 2 * Math.PI + 0.2, d = 96 + (k % 3) * 16;
  return `<i class="spark" style="--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d)}px;background:${ENAMEL[k % 6]};animation-delay:${(0.28 + (k % 4) * 0.05).toFixed(2)}s"></i>`;
}).join('');
function levelUp(i) {
  const L = RG.LEVELS[i], n = RG.LEVELS[i + 1];
  vibrate([80, 60, 80, 60, 160]);
  party(`<div class="hero"><span class="pin-wrap press">${pin(i, 156)}</span>${sparks()}</div><h2>${esc(L[1])}</h2><p>A new pin for your case: level ${i + 1} of ${RG.LEVELS.length}, ${L[0]} hours of reading.${n ? ' Next: ' + esc(n[1]) + ' at ' + n[0] + '&nbsp;h.' : ' This is the top of the ladder.'}</p>`);
}

// ---------- drawing bits
const ICONS = {
  shoe: '<path d="M3 16.5V11l3.5-2 2 2.5h3l4.5 2 4 1.2c1.2.4 1.5 1.3 1.5 2.3v.5H3z"/><path d="M3 19.5h18M9.5 11.5l1-1.5M12 12l1-1.5"/>',
  stretch: '<circle cx="12" cy="5" r="1.7"/><path d="M6 2.8l6 4.2 6-4.2M12 7v7l-4 6.5M12 14l4 6.5"/>',
  jog: '<circle cx="14.5" cy="4.5" r="1.7"/><path d="M8 10.5l3.5-2.5 3 1.5 1.5 3.5h3M11.5 8l-2 5.5 3.5 2.5-1 5M9.5 13.5L6.5 19H3"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/><path d="M7.5 12.5h2.6l1.4-2.6 2 4.6 1.4-2h1.6"/>',
  bolt: '<path d="M13.5 2.5L5 13.5h6l-1.5 8 8.5-11h-6z"/>',
  dumbbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  barbell: '<path d="M1.5 12h21M5 7.5v9M8 9v6M19 7.5v9M16 9v6"/>',
  plates: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.6"/>',
  kettlebell: '<path d="M8.5 9.5V8a3.5 3.5 0 0 1 7 0v1.5"/><path d="M7 9.5h10l1.2 3.2A6.5 6.5 0 0 1 12 21a6.5 6.5 0 0 1-6.2-8.3z"/>',
  flex: '<path d="M4 19.5c1.5-5.5 3.5-10 6.5-12.5l2.2 2-1.7 2.3.8 2c2.3-2 5.7-2.6 7.7-.6 1.2 2.6-.2 6.8-4 6.8z"/><path d="M12 13.8c1.2.5 2.4.6 3.5.3"/>',
  flag: '<path d="M5.5 21.5V3.5"/><path d="M5.5 4h12.5l-2.6 4 2.6 4H5.5"/>',
  mountain: '<path d="M2 20.5l7.5-13 4.5 7 2.5-3.5 5.5 9.5z"/><path d="M7.5 11l2 1.5 2-1"/>',
  torch: '<path d="M9 11h6l-1.6 10h-2.8z"/><path d="M12 2.5c2.3 2.4 3.4 4.2 3.4 5.6a3.4 3.4 0 0 1-6.8 0c0-1.4 1.1-3.2 3.4-5.6z"/>',
  medal: '<path d="M8 2.5l4 7 4-7"/><circle cx="12" cy="15" r="6"/><path d="M10.6 13.4l1.4-1.1v5.4"/>',
  trophy: '<path d="M7 3.5h10V8a5 5 0 0 1-10 0z"/><path d="M7 5.5H4.2a3 3 0 0 0 3.2 4M17 5.5h2.8a3 3 0 0 1-3.2 4M12 13v4M8.5 21h7M9.5 17h5v4h-5z"/>',
  star: '<path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/>',
  laurel: '<path d="M8.5 20.5C4.5 18 2.8 13 4 8M15.5 20.5C19.5 18 21.2 13 20 8"/><path d="M4.6 16.4l-2.3.2M3.6 12.6l-2.1-.9M4 9l-1.6-1.8M19.4 16.4l2.3.2M20.4 12.6l2.1-.9M20 9l1.6-1.8"/><path d="M12 6.5l1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4z"/>',
  sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/>',
};
// Every level is an enamel pin: plated body in the tier's metal (round bronze, hexagonal silver, scalloped gold),
// a field of its own enamel colour and the icon struck in metal. Locked levels are unplated blanks.
const ENAMEL = ['#2F5FD0', '#1B9AA6', '#1E9E68', '#D8423A', '#7B4FC9', '#262C4A'];
const METAL = ['#F7CFA8', '#F4F7FB', '#FFE9A8'];
const tierOf = i => Math.min(2, Math.floor(i / 6));
const enamelOf = i => ENAMEL[(i + tierOf(i) * 2) % 6];
const f1 = n => +n.toFixed(2);
const circ = r => `M${f1(24 - r)} 24a${r} ${r} 0 1 0 ${f1(2 * r)} 0a${r} ${r} 0 1 0 ${f1(-2 * r)} 0Z`;
const poly = (r, n) => 'M' + Array.from({ length: n }, (_, k) => { const a = (k / n) * 2 * Math.PI - Math.PI / 2; return f1(24 + r * Math.cos(a)) + ' ' + f1(24 + r * Math.sin(a)); }).join('L') + 'Z';
const scallop = (cx, cy, R, n, rs) => {
  const p = k => { const a = (k / n) * 2 * Math.PI - Math.PI / 2; return f1(cx + R * Math.cos(a)) + ' ' + f1(cy + R * Math.sin(a)); };
  return 'M' + p(0) + Array.from({ length: n }, (_, k) => `A${rs} ${rs} 0 0 1 ${p(k + 1)}`).join('') + 'Z';
};
const SHAPE = [
  { body: circ(22.4), field: circ(18.2), wire: circ(15.8) },
  { body: poly(22.6, 6), field: poly(18.4, 6), wire: poly(15.9, 6) },
  { body: scallop(24, 24, 20.2, 16, 4.6), field: circ(17), wire: circ(14.8) },
];
function pinInner(i, off) {
  const t = tierOf(i), s = SHAPE[t], ic = ICONS[RG.LEVELS[i][2]];
  if (off) return `<path d="${s.body}" style="fill:var(--surface2);stroke:var(--seam);stroke-width:1.4;stroke-linejoin:round"/><g transform="translate(12 12)" style="fill:none;stroke:#59639C;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round">${ic}</g>`;
  return `<path d="${s.body}" fill="url(#pl${t})" stroke="url(#pl${t})" stroke-width="1.6" stroke-linejoin="round"/>`
    + `<path d="${s.field}" fill="${enamelOf(i)}"/><path d="${s.field}" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="1.3"/>`
    + `<path d="${s.wire}" fill="none" stroke="${METAL[t]}" stroke-opacity=".5" stroke-width=".8"/>`
    + `<path d="M11.4 18.6A14 14 0 0 1 19.6 10.6" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="2.4" stroke-linecap="round"/>`
    + `<g transform="translate(12 12.7)" style="fill:none;stroke:rgba(0,0,0,.32);stroke-width:2.1;stroke-linecap:round;stroke-linejoin:round">${ic}</g>`
    + `<g transform="translate(12 12)" style="fill:none;stroke:${METAL[t]};stroke-width:2;stroke-linecap:round;stroke-linejoin:round">${ic}</g>`;
}
const pin = (i, size, off) => `<svg class="pin" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true">${pinInner(i, off)}</svg>`;
// a red silk bookmark ribbon; an empty one is a dashed outline waiting to be earned
const ribbon = on => `<svg viewBox="0 0 18 40" aria-hidden="true">${on ? '<path d="M1 0h16v38l-8-7-8 7z" fill="url(#silk)"/><path d="M5.5 0v31" stroke="rgba(255,255,255,.22)" stroke-width="1.2"/>' : '<path d="M1.75 0v36.4l7.25-6.3 7.25 6.3V0" fill="none" stroke="#3A4580" stroke-width="1.5" stroke-dasharray="3 2.4"/>'}</svg>`;
const IC = {
  plus: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  prev: '<svg class="ic" viewBox="0 0 24 24"><path d="M14.5 6l-6 6 6 6"/></svg>',
  next: '<svg class="ic" viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6"/></svg>',
  tick: '<svg class="ic" viewBox="0 0 24 24" style="width:18px;height:18px"><circle cx="12" cy="12" r="10" style="fill:currentColor;stroke:none"/><path d="M7.5 12.5l3 3 6-6.5" style="stroke:#04170D;stroke-width:2.4"/></svg>',
};
const TOAST_IC = {
  tick: '<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" fill="#34C27E"/><path d="M8 13.5l3.4 3.4L18.5 9.5" fill="none" stroke="#04170D" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ribbon: '<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M8 1h10v23l-5-4.3L8 24z" fill="url(#silk)"/></svg>',
  pr: '<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" fill="#E4483F"/><text x="13" y="17.2" text-anchor="middle" style="font:700 11px var(--display);fill:#fff">PR</text></svg>',
};
const initials = b => (bookName(b).match(/[\p{L}\p{N}]+/gu) || ['?']).slice(0, 2).map(w => w[0].toUpperCase()).join('');
// Without a photo a book gets a cloth binding in one of six colours, picked from its id, with its initials in gold foil.
const CLOTH = ['#7A2532', '#22346E', '#1F5A45', '#7D5A1E', '#4E2D66', '#1D5660'];
const clothOf = b => { let h = 7; for (const ch of b ? b.id + bookName(b) : '?') h = (h * 31 + ch.charCodeAt(0)) >>> 0; return CLOTH[h % CLOTH.length]; };
function cover(b, w) {
  const fill = w === 'fill', st = fill ? '' : `width:${w}px;height:${Math.round(w * 1.45)}px;`;
  if (b && covers[b.id]) return `<img class="cover" src="${covers[b.id]}" alt="" style="${st}">`;
  return `<span class="cover cloth" style="${st}background:${clothOf(b)};font-size:${fill ? 'clamp(1.1rem, 7vw, 1.8rem)' : Math.round(w / 2.7) + 'px'}"><span>${esc(initials(b))}</span></span>`;
}
function ring(sec, goalMin, size) {
  const C = 2 * Math.PI * 26, f = Math.min(1, sec / (goalMin * 60)), done = f >= 1;
  return `<svg class="ring${done ? ' done' : ''}" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><circle class="trk" cx="32" cy="32" r="26"/><circle class="arc" cx="32" cy="32" r="26" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}" transform="rotate(-90 32 32)" style="stroke-opacity:${f > 0 ? 1 : 0}"/>`
    + (done ? `<g${freshTick ? ' class="tickdisc"' : ''}><circle cx="32" cy="32" r="17" style="fill:var(--green)"/><path d="M24.5 32.5l5 5 10-11" style="fill:none;stroke:var(--on-green);stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round"/></g>`
      : `<text class="num1" x="32" y="35.5" text-anchor="middle">${Math.floor(sec / 60)}</text><text class="u" x="32" y="45" text-anchor="middle">min</text>`) + '</svg>';
}
const STATUS = { tick: 'Goal reached', saved: 'Saved by a bookmark', miss: 'Missed', open: 'Today, not done yet' };
// Day marks differ in shape, not only colour: full disc, ribbon, dashed ring, gold ring.
const MARK = {
  tick: '<circle cx="17" cy="17" r="15" style="fill:var(--green)"/><path d="M11 17.5l4 4 8-8.5" style="fill:none;stroke:var(--on-green);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round"/>',
  saved: '<circle cx="17" cy="17" r="14.2" style="fill:none;stroke:var(--scarlet);stroke-width:1.6"/><path d="M12.6 9.5h8.8v15l-4.4-3.8-4.4 3.8z" fill="url(#silk)"/>',
  miss: '<circle cx="17" cy="17" r="14.2" style="fill:none;stroke:var(--faint);stroke-width:1.5;stroke-dasharray:2.6 3"/>',
  open: '<circle cx="17" cy="17" r="14.2" style="fill:none;stroke:var(--gold);stroke-width:1.8"/><circle cx="17" cy="17" r="3" style="fill:var(--gold)"/>',
  none: '<circle cx="17" cy="17" r="14.2" style="fill:none;stroke:var(--seam);stroke-width:1.4"/>',
};
function dayDot(k, s, isToday) {
  if (isToday && !s) s = 'open';
  return `<div class="wd${isToday ? ' is-today' : ''}"><svg class="mk" viewBox="0 0 34 34" role="img" aria-label="${esc(wd(k) + ': ' + (STATUS[s] || 'no goal yet'))}">${MARK[s] || MARK.none}</svg>${wd(k)}</div>`;
}
const PLAY = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 3.8v12.4c0 .7.8 1.1 1.4.7l9.6-6.2c.6-.4.6-1.2 0-1.5L6.9 3.1c-.6-.4-1.4 0-1.4.7z" fill="currentColor"/></svg>';
function bookCard(b, t, play) {
  const sub = b.status === 'finished' ? 'Finished ' + fmtDay(b.done) + (t ? ' · ' + fmtMin(t.sec) : '') : t ? fmtMin(t.sec) + ' read' : 'Not started';
  return `<div class="book" data-act="open" data-id="${b.id}" role="button" tabindex="0">${cover(b, 48)}<div style="min-width:0; display:grid; gap:2px"><h3>${esc(bookName(b))}</h3>${b.author ? `<p>${esc(b.author)}</p>` : ''}<p class="t">${sub}</p></div>${play ? `<button class="play" data-act="start" data-id="${b.id}" aria-label="Start reading ${esc(bookName(b))}">${PLAY}</button>` : ''}</div>`;
}
const shelfItem = (b, t) => `<button class="shelf" data-act="open" data-id="${b.id}">${cover(b, 'fill')}<b>${esc(bookName(b))}</b><small>${b.done ? fmtDay(b.done) : ''}${t ? '<br>' + fmtMin(t.sec) : ''}</small></button>`;
// empty state: an open book with its red ribbon and the first (bronze) pin resting beside it
const EMPTY_ART = `<svg viewBox="0 0 170 116" aria-hidden="true"><ellipse cx="82" cy="104" rx="62" ry="6" fill="rgba(0,0,0,.35)"/>
  <path d="M18 30Q83 17 148 30V98Q83 87 18 98Z" fill="#22346E"/>
  <path d="M24 27Q55 18 82 30V93Q55 83 24 91Z" fill="#F1EBDB"/><path d="M84 30Q111 18 142 27V91Q111 83 84 93Z" fill="#E6DDC6"/>
  <path d="M83 30V93" stroke="#C9BD9F" stroke-width="1.5"/>
  <path d="M32 40Q53 34 74 41M32 49Q53 43 74 50M32 58Q53 52 74 59M32 67Q53 61 64 66M92 41Q113 34 134 40M92 50Q113 43 134 49M92 59Q113 52 134 58M92 68Q113 61 124 64" fill="none" stroke="#CDBF9F" stroke-width="2.2" stroke-linecap="round"/>
  <path d="M87 24h8v84l-4-4.6-4 4.6z" fill="url(#silk)"/>
  <g transform="translate(116 64) scale(.92)">${pinInner(0)}</g></svg>`;

// ---------- screens
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function installCard() {
  if (standalone() || DEMO || lsGet('rg-install-hide')) return '';
  const how = isIOS ? 'In Safari, tap the Share button (the square with an arrow), then <b>Add to Home Screen</b>. Do it before you start: on iPhone the browser and the home-screen app keep separate data.'
    : installEvt ? 'Install it and it gets its own icon, like any other app.' : 'Open the browser menu (⋮) and tap <b>Add to Home screen</b> or <b>Install app</b>.';
  return `<section class="panel install"><h2>Put Reading Gym on your home screen</h2><p>${how}</p><div class="btns${installEvt ? ' two' : ''}">${installEvt ? '<button class="btn primary" data-act="install">Install</button>' : ''}<button class="btn ghost" data-act="install-hide">Hide this</button></div></section>`;
}
// The level reached last time the pin case was open. A newer pin glints on Today until the case is opened.
const seenLvl = () => { const v = lsGet('rg-seen-lvl'); return v == null ? null : Number(v); };
const emptyBooks = () => `<section class="panel empty">${EMPTY_ART}<h2>Your first book</h2><p>Add the book you’re reading. A photo of the cover or just the title is enough.</p><button class="btn primary" data-act="add">Add a book</button></section>`;
function vToday() {
  const tot = totalSec(), L = RG.level(tot), st = streakNow(), t = today(), tsec = daySec(t), goal = goalNow(), done = tsec >= goal * 60;
  const reading = S.books.filter(b => b.status === 'reading'), BT = RG.bookTotals(S.sessions);
  const left = L.next != null ? L.next * 3600 - tot : 0, toMark = RG.MARK_EVERY - st.earn;
  const week = Array.from({ length: 7 }, (_, i) => RG.addDays(t, i - 6));
  const fresh = DEMO ? location.hash === '#demo-new' : seenLvl() != null && L.i > seenLvl();
  return `${DEMO ? '<p class="demo">Example data, nothing is saved</p>' : ''}${installCard()}
  <button class="lvl" data-act="tab" data-tab="stats" data-to="ladder" aria-label="${esc(L.name)}, level ${L.i + 1} of ${RG.LEVELS.length}. Open the pin case.">
    <span class="pin-wrap${fresh ? ' glint' : ''}">${pin(L.i, 76)}</span>
    <div style="min-width:0"><h1>${esc(L.name)}</h1><p class="meta"><span>Level ${L.i + 1} of ${RG.LEVELS.length}</span><span aria-hidden="true">·</span><span>${tot < 3600 ? fmtMin(tot) : fmtHours(tot)} read</span>${fresh ? '<span class="chip new">New pin</span>' : ''}</p>
    ${L.next != null ? `<div class="trackrow"><div class="track"><i style="width:${(L.frac * 100).toFixed(1)}%"></i></div>${pin(L.i + 1, 30, true)}</div><p class="sub"><b>${left < 3600 ? Math.ceil(left / 60) + ' min' : fmtHours(left)}</b> to ${esc(L.nextName)}</p>` : '<p class="sub">The top of the ladder. Every pin is yours.</p>'}</div></button>
  ${S.books.length ? '' : emptyBooks()}
  <section class="panel today">${ring(tsec, goal, 96)}<div><h2>${done ? 'Goal done today' : 'Today'}</h2><p><b>${fmtMin(tsec)}</b> ${done ? 'read' : 'of ' + goal + ' min'}</p><p>${done ? 'Goal ' + goal + ' min. See you tomorrow.' : Math.ceil((goal * 60 - tsec) / 60) + ' min to go'}</p></div></section>
  <section class="panel streak"><div class="ribbons" role="img" aria-label="Bookmarks: ${st.marks} of ${RG.MARK_MAX}">${[0, 1, 2].map(i => ribbon(i < st.marks)).join('')}</div>
    <div class="streak-top"><b>${st.cur}</b><span>day streak</span></div>
    <p class="hint">${st.marks >= RG.MARK_MAX ? 'All 3 bookmarks earned. Each one saves your streak on a day off.' : toMark + ' more goal ' + (toMark === 1 ? 'day' : 'days') + ' to earn a bookmark. A bookmark saves your streak on a day off.'}</p>
    <div class="week">${week.map(k => dayDot(k, st.days[k], k === t)).join('')}</div></section>
  ${reading.length ? `<h2 class="sec">Reading now <span>${reading.length}</span></h2><div class="books">${reading.map(b => bookCard(b, BT[b.id], true)).join('')}</div><button class="add" data-act="add">${IC.plus}Add a book</button>`
    : S.books.length ? `<h2 class="sec">Reading now</h2><section class="panel empty"><p>No book on the go. Pick one up again from Books, or add a new one.</p><button class="btn primary" data-act="add">Add a book</button></section>` : ''}`;
}
function vBooks() {
  const BT = RG.bookTotals(S.sessions), g = st => S.books.filter(b => b.status === st);
  const fin = g('finished').sort((a, b) => (b.done || '').localeCompare(a.done || ''));
  const year = String(new Date().getFullYear()), finYear = fin.filter(b => (b.done || '').startsWith(year)).length;
  const list = (title, arr, play) => arr.length ? `<h2 class="sec">${title} <span>${arr.length}</span></h2><div class="books">${arr.map(b => bookCard(b, BT[b.id], play)).join('')}</div>` : '';
  if (!S.books.length) return `<h1 class="title">Books</h1>${emptyBooks()}`;
  return `<h1 class="title">Books</h1><p class="lede">${fin.length ? fin.length + ' finished · ' + finYear + ' in ' + year : 'Nothing finished yet'}</p>
  ${list('Reading now', g('reading'), true)}
  <button class="add" data-act="add">${IC.plus}Add a book</button>
  <h2 class="sec">Finished${fin.length ? ` <span>${fin.length}</span>` : ''}</h2>
  ${fin.length ? `<div class="wall">${fin.map(b => shelfItem(b, BT[b.id])).join('')}</div>` : '<p class="shelf-empty">Finished books land here, cover by cover.</p>'}
  ${list('Put aside', g('aside'), false)}`;
}
function weekChart(t, goal) {
  const mon = RG.addDays(t, -((RG.keyDate(t).getDay() + 6) % 7));
  const keys = Array.from({ length: 7 }, (_, i) => RG.addDays(mon, i)), mins = keys.map(k => daySec(k) / 60);
  const lastWeek = Array.from({ length: 7 }, (_, i) => daySec(RG.addDays(mon, i - 7))).reduce((a, b) => a + b, 0);
  const W = 320, H = 150, top = 22, base = 124, CW = 290, max = Math.max(goal, ...mins) * 1.15, y = v => base - (v / max) * (base - top), bw = 24, step = CW / 7;
  const bars = keys.map((k, i) => {
    const x = i * step + (step - bw) / 2, v = mins[i], hit = v >= RG.goalFor(S.goals, k), h = base - y(v);
    return (v > 0 ? `<path d="M${f1(x)} ${base}V${f1(y(v) + 6)}q0-6 6-6h${bw - 12}q6 0 6 6V${base}Z" style="fill:${hit ? 'var(--green)' : 'var(--cobalt)'}"/>${h > 0 ? `<text class="v" x="${f1(x + bw / 2)}" y="${f1(y(v) - 6)}" text-anchor="middle">${Math.round(v)}</text>` : ''}` : '')
      + `<text x="${f1(x + bw / 2)}" y="${base + 18}" text-anchor="middle"${k === t ? ' class="v"' : ''}>${wd(k)}</text>`;
  }).join('');
  return `<section class="panel chart"><div class="head"><h2>This week</h2><span class="muted num" style="font-size:.85rem">${fmtMin(mins.reduce((a, b) => a + b, 0) * 60)} · last week ${fmtMin(lastWeek)}</span></div>
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Minutes read each day this week"><line x1="0" x2="${CW}" y1="${base}" y2="${base}" style="stroke:var(--seam)"/>${bars}<line x1="0" x2="${CW}" y1="${f1(y(goal))}" y2="${f1(y(goal))}" style="stroke:var(--gold-lt);stroke-opacity:.75;stroke-dasharray:4 4"/><text class="g" x="${CW + 5}" y="${f1(y(goal) + 3.5)}">goal</text></svg>
  <p class="hint">Minutes a day. Green: goal reached. Blue: read, but under the goal of ${goal} min.</p></section>`;
}
function calendar(st) {
  const t = today(), now = RG.keyDate(t), DT = RG.dayTotals(S.sessions);
  if (!calMonth) calMonth = [now.getFullYear(), now.getMonth()];
  const [y, m] = calMonth, first = new Date(y, m, 1), n = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
  const cells = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(h => `<span class="h">${h}</span>`);
  for (let i = 0; i < lead; i++) cells.push('<span></span>');
  for (let d = 1; d <= n; d++) {
    const k = RG.dayKey(new Date(y, m, d)), s = k > t ? 'future' : st.days[k] || (k === t ? 'today' : ''), min = (DT[k] || 0) / 60;
    // minutes under the goal show as a blue dot that grows with the time read
    const dot = s !== 'tick' && s !== 'future' && min > 0 ? `<i style="width:${f1(3 + 5 * Math.min(1, min / RG.goalFor(S.goals, k)))}px;height:${f1(3 + 5 * Math.min(1, min / RG.goalFor(S.goals, k)))}px"></i>` : '';
    cells.push(`<span class="c ${s}" title="${esc((STATUS[s] || '') + (min >= 1 ? (STATUS[s] ? ', ' : '') + Math.round(min) + ' min' : ''))}">${d}${s === 'saved' ? '<svg viewBox="0 0 9 16" aria-hidden="true"><path d="M0 0h9v16l-4.5-3.6L0 16z" fill="url(#silk)"/></svg>' : ''}${dot}</span>`);
  }
  const atNow = y === now.getFullYear() && m === now.getMonth();
  return `<section class="panel"><div class="cal-head"><button data-act="cal" data-d="-1" aria-label="Previous month">${IC.prev}</button><h2>${first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2><button data-act="cal" data-d="1" aria-label="Next month"${atNow ? ' disabled' : ''}>${IC.next}</button></div>
  <div class="cal">${cells.join('')}</div><div class="legend"><span><i style="background:var(--green)"></i>goal reached</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--scarlet)"></i>saved by a bookmark</span><span><i style="background:var(--cobalt); width:8px; height:8px"></i>read, under the goal</span></div></section>`;
}
function pinCase(L) {
  const TIERS = ['Bronze', 'Silver', 'Gold'], SW = ['var(--bronze)', 'var(--silver)', 'var(--gold)'];
  return `<section class="panel" id="ladder"><div class="head"><h2>Pin case</h2><span class="muted num" style="font-size:.85rem">${L.i + 1} of ${RG.LEVELS.length} pins</span></div>
  ${TIERS.map((name, tr) => `<div class="tier"><p class="tier-h"><i style="background:${SW[tr]}"></i>${name}<small>${RG.LEVELS[tr * 6][0]}–${RG.LEVELS[tr * 6 + 5][0]} h</small></p><div class="case">${RG.LEVELS.slice(tr * 6, tr * 6 + 6).map((x, j) => {
    const i = tr * 6 + j, now = i === L.i, off = i > L.i;
    return `<div class="cell${now ? ' now' : off ? ' locked' : ''}">${pin(i, 56, off)}<b>${esc(x[1])}</b><small>${now ? 'You are here' : x[0] + ' h'}</small></div>`;
  }).join('')}</div></div>`).join('')}</section>`;
}
function vStats() {
  const tot = totalSec(), st = streakNow(), L = RG.level(tot), t = today(), goal = goalNow(), pr = RG.longestRun(S.sessions);
  const readDays = Object.values(RG.dayTotals(S.sessions)).filter(v => v > 0).length;
  return `<h1 class="title">Stats</h1>
  <section class="panel board" aria-label="Records">
    <div class="rec"><span>Read in total</span><b>${fmtHours(tot)}</b></div>
    <div class="rec"><span>Best streak</span><b>${st.best} ${st.best === 1 ? 'day' : 'days'}</b></div>
    <div class="rec"><span>Longest session <span class="chip pr">PR</span></span><b>${pr ? fmtMin(pr) : '–'}</b></div>
    <div class="rec"><span>Average reading day</span><b>${readDays ? fmtMin(tot / readDays) : '–'}</b></div>
  </section>
  ${weekChart(t, goal)}
  ${calendar(st)}
  ${pinCase(L)}
  <section class="panel" style="display:grid; gap:12px"><h2 style="font-size:1.15rem">Daily goal</h2><div class="goal"><button data-act="goal" data-d="-5" aria-label="5 minutes less">${IC.minus}</button><div><b class="num">${goal}</b> <span class="muted">min a day</span></div><button data-act="goal" data-d="5" aria-label="5 minutes more">${IC.plus}</button></div><p class="hint">A new goal counts from today. Earlier days keep the goal they had.</p></section>
  <section class="panel" style="display:grid; gap:12px"><h2 style="font-size:1.15rem">Backup</h2><p class="hint" style="margin-top:0">Everything is kept on this phone only. Save a backup now and then, so a new phone doesn’t mean starting over.</p><div class="btns two"><button class="btn" data-act="export">Save backup</button><button class="btn" data-act="import">Load backup</button></div><div id="imp" style="display:grid; gap:10px"></div></section>`;
}
function render() {
  if (!S) return;
  $('#view').innerHTML = view === 'books' ? vBooks() : view === 'stats' ? vStats() : vToday();
  if (!DEMO && (view === 'stats' || seenLvl() == null)) lsSet('rg-seen-lvl', String(RG.level(totalSec()).i));
  document.querySelectorAll('#tabs button').forEach(b => { if (b.dataset.tab === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
}

// ---------- sheets: add / edit a book, book details, time by hand
function openSheet(title, body) {
  $('#sheet').innerHTML = `<div class="row"><h2>${esc(title)}</h2><button class="link" data-act="close">Close</button></div>${body}`;
  $('#scrim').hidden = false;
}
function closeSheet() { $('#scrim').hidden = true; $('#sheet').innerHTML = ''; pendingCover = null; }
const CAM = '<svg width="40" height="40" viewBox="0 0 24 24" style="fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round"><path d="M4 7.5h3l1.5-2h7L17 7.5h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
function sheetBook(id) {
  const b = id ? bookById(id) : null; pendingCover = null;
  openSheet(b ? 'Edit book' : 'Add a book', `
    <label class="photo" for="f-photo"><span id="f-prev">${b && covers[b.id] ? `<img src="${covers[b.id]}" alt="">` : CAM}</span><span>${b && b.cover ? 'Change the cover photo' : 'Take a photo of the cover'}</span></label>
    <input type="file" id="f-photo" accept="image/*" hidden>
    <label for="f-title">Title<input type="text" id="f-title" value="${esc(b ? b.title : '')}" autocomplete="off" enterkeyhint="next"></label>
    <label for="f-author">Author (optional)<input type="text" id="f-author" value="${esc(b ? b.author : '')}" autocomplete="off" enterkeyhint="done"></label>
    <p class="err" id="f-err" hidden>Add a title or a photo of the cover.</p>
    <button class="btn primary" data-act="savebook" data-id="${b ? b.id : ''}">${b ? 'Save' : 'Add book'}</button>`);
}
function shrink(file) {
  return new Promise((res, rej) => {
    const img = new Image(), u = URL.createObjectURL(file);
    img.onload = () => {
      const k = Math.min(1, 640 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
      c.toBlob(b => b ? res(b) : rej(new Error('no image')), 'image/jpeg', 0.82);
    };
    img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('no image')); };
    img.src = u;
  });
}
async function saveBook(id) {
  const title = $('#f-title').value.trim(), author = $('#f-author').value.trim(), b = id ? bookById(id) : null;
  if (!title && !pendingCover && !(b && b.cover)) { $('#f-err').hidden = false; return; }
  const book = b || { id: uid(), added: today(), status: 'reading', done: null, cover: false };
  book.title = title; book.author = author;
  if (pendingCover) {
    book.cover = true;
    if (!DEMO) { try { await idb.set('cover:' + book.id, pendingCover); } catch (e) {} }
    if (covers[book.id]) URL.revokeObjectURL(covers[book.id]);
    covers[book.id] = URL.createObjectURL(pendingCover);
  }
  if (!b) S.books.push(book);
  save(); closeSheet(); render(); toast(b ? 'Saved.' : 'Book added. Tap the play button when you start reading.');
}
function sheetDetail(id) {
  const b = bookById(id); if (!b) return;
  const t = RG.bookTotals(S.sessions)[id];
  const facts = [['Time read', t ? fmtMin(t.sec) : '0 min'], ['Sessions', t ? t.runs.size : 0], ['Started', t ? fmtDay(t.first) : 'Not yet'],
    b.status === 'finished' ? ['Finished', fmtDay(b.done)] : ['Last read', t ? fmtDay(t.last) : '–']];
  const acts = {
    reading: `<button class="btn primary" data-act="start" data-id="${id}">Start reading</button><button class="btn" data-act="manual" data-id="${id}">Add time by hand</button><div class="btns two"><button class="btn" data-act="finishbook" data-id="${id}">Finished it</button><button class="btn" data-act="aside" data-id="${id}">Put aside</button></div>`,
    finished: `<button class="btn" data-act="reread" data-id="${id}">Read it again</button>`,
    aside: `<div class="btns two"><button class="btn primary" data-act="reread" data-id="${id}">Back to reading</button><button class="btn" data-act="finishbook" data-id="${id}">Finished it</button></div>`,
  }[b.status];
  openSheet('', `<div class="detail">${cover(b, 84)}<div style="min-width:0; display:grid; gap:6px; justify-items:start"><h2>${esc(bookName(b))}</h2>${b.author ? `<p class="muted">${esc(b.author)}</p>` : ''}<span class="chip st">${{ reading: 'Reading now', finished: 'Finished', aside: 'Put aside' }[b.status]}</span></div></div>
    <dl class="facts">${facts.map(f => `<div><dt>${f[0]}</dt><dd>${esc(f[1])}</dd></div>`).join('')}</dl>
    <div class="btns">${acts}<button class="btn ghost" data-act="edit" data-id="${id}">Edit title, author or cover</button></div>
    <div class="danger-zone"><button class="del" data-act="delete" data-id="${id}">Delete book</button><p class="err" id="del-note" hidden style="text-align:center">Tap again to delete the book${t ? ' and its ' + fmtMin(t.sec) + ' of reading' : ''}.</p></div>`);
}
// a ribbon rosette for a finished book; the cover sits in its middle
const ROSETTE = `<svg class="rosette" viewBox="0 0 220 252" aria-hidden="true"><path d="M98 150L56 242l19-8 10 17 33-91zM122 150l42 92-19-8-10 17-33-91z" fill="#A92E28"/><path d="M98 150L56 242l19-8M122 150l42 92-19-8" fill="none" stroke="#C9433B" stroke-width="2"/>
  <path d="${scallop(110, 110, 92, 28, 11)}" fill="#C63A33"/><circle cx="110" cy="110" r="82" fill="#E4483F"/><circle cx="110" cy="110" r="74" fill="none" stroke="url(#pl2)" stroke-width="4"/></svg>`;
function setStatus(id, status) {
  const b = bookById(id); if (!b) return;
  b.status = status; b.done = status === 'finished' ? today() : null;
  save(); closeSheet(); render();
  if (status === 'finished') {
    const y = String(new Date().getFullYear()), n = S.books.filter(x => x.status === 'finished' && (x.done || '').startsWith(y)).length, t = RG.bookTotals(S.sessions)[id];
    vibrate([80, 60, 160]);
    party(`<div class="hero award">${ROSETTE}<span style="position:relative">${cover(b, 100)}</span>${sparks()}</div><h2>${esc(bookName(b))}</h2><p>Finished. Book ${n} of ${y}.${t ? ' ' + fmtMin(t.sec) + ' of reading.' : ''}</p>`);
  }
}
function deleteBook(id, btn) {
  if (!btn.classList.contains('armed')) { btn.classList.add('armed'); btn.textContent = 'Delete for good'; $('#del-note').hidden = false; return; }
  S.books = S.books.filter(b => b.id !== id); S.sessions = S.sessions.filter(s => s.book !== id);
  if (!DEMO) idb.del('cover:' + id).catch(() => {});
  if (covers[id]) { URL.revokeObjectURL(covers[id]); delete covers[id]; }
  save(); closeSheet(); render(); toast('Book deleted.');
}
function sheetManual(id) {
  openSheet('Add time by hand', `<p class="muted">For reading you did without the timer, in ${esc(bookName(bookById(id)))}.</p>
    <label for="m-min">Minutes<input type="number" id="m-min" inputmode="numeric" min="1" max="600" value="20"></label>
    <label for="m-day">Day<input type="date" id="m-day" value="${today()}" max="${today()}"></label>
    <p class="err" id="m-err" hidden>Enter 1 to 600 minutes and a day that isn’t in the future.</p>
    <button class="btn primary" data-act="savemanual" data-id="${id}">Add</button>`);
}
function saveManual(id) {
  const min = Number($('#m-min').value), day = $('#m-day').value;
  if (!(min >= 1 && min <= 600) || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today()) { $('#m-err').hidden = false; return; }
  const before = snap();
  S.sessions.push({ id: uid(), run: uid(), book: id, day, sec: Math.round(min * 60), manual: true });
  save(); closeSheet(); render(); cheer(before, min * 60);
}
function changeGoal(d) {
  const t = today(), min = Math.max(5, Math.min(180, goalNow() + d)), last = S.goals[S.goals.length - 1];
  if (last.from === t) last.min = min; else S.goals.push({ from: t, min });
  save(); render();
}

// ---------- backup
const blobToData = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
async function exportData() {
  const cov = {};
  for (const b of S.books) if (b.cover && !DEMO) { try { const blob = await idb.get('cover:' + b.id); if (blob) cov[b.id] = await blobToData(blob); } catch (e) {} }
  const file = new File([JSON.stringify({ app: 'reading-gym', v: 1, saved: new Date().toISOString(), state: Object.assign({}, S, { run: null }), covers: cov })], 'reading-gym-' + today() + '.json', { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Reading Gym backup' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
async function readImport(file) {
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== 'reading-gym' || !d.state || !Array.isArray(d.state.books) || !Array.isArray(d.state.sessions)) throw new Error('not a backup');
    pendingImport = d;
    $('#imp').innerHTML = `<p>Replace everything on this phone with the backup from ${esc(new Date(d.saved).toLocaleString('en-GB'))}? It has ${d.state.books.length} books and ${fmtHours(d.state.sessions.reduce((a, s) => a + s.sec, 0))} of reading.</p><div class="btns two"><button class="btn primary" data-act="import-yes">Replace</button><button class="btn" data-act="import-no">Cancel</button></div>`;
  } catch (e) { toast('That file isn’t a Reading Gym backup.'); }
  $('#f-import').value = '';
}
async function doImport() {
  const d = pendingImport; if (!d) return;
  pendingImport = null;
  S = Object.assign(fresh(), d.state, { run: null });
  for (const [id, url] of Object.entries(d.covers || {})) {
    try { const blob = await (await fetch(url)).blob(); if (!DEMO) await idb.set('cover:' + id, blob); covers[id] = URL.createObjectURL(blob); } catch (e) {}
  }
  save(); render(); toast('Backup loaded.');
}

// ---------- taps
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const id = el.dataset.id;
  switch (el.dataset.act) {
    case 'tab':
      view = el.dataset.tab; closeSheet(); render(); window.scrollTo(0, 0);
      if (el.dataset.to) { const to = document.getElementById(el.dataset.to); if (to) to.scrollIntoView({ block: 'start' }); }
      break;
    case 'add': sheetBook(); break;
    case 'edit': sheetBook(id); break;
    case 'savebook': saveBook(id || null); break;
    case 'open': sheetDetail(id); break;
    case 'start': closeSheet(); startRun(id); break;
    case 'pause': pauseRun('pause'); break;
    case 'resume': resumeRun(); break;
    case 'finish': finishRun(); break;
    case 'discard':
      if (el.classList.contains('armed')) discardRun();
      else { el.classList.add('armed'); el.textContent = 'Tap again to throw it away'; setTimeout(() => { el.classList.remove('armed'); el.textContent = 'Throw this session away'; }, 4000); }
      break;
    case 'still': if (S.run) { S.run.ok = Date.now(); ask = null; save(); paintReader(); } break;
    case 'manual': sheetManual(id); break;
    case 'savemanual': saveManual(id); break;
    case 'finishbook': setStatus(id, 'finished'); break;
    case 'aside': setStatus(id, 'aside'); break;
    case 'reread': setStatus(id, 'reading'); break;
    case 'delete': deleteBook(id, el); break;
    case 'close': closeSheet(); break;
    case 'goal': changeGoal(Number(el.dataset.d)); break;
    case 'cal': { const d = new Date(calMonth[0], calMonth[1] + Number(el.dataset.d), 1); calMonth = [d.getFullYear(), d.getMonth()]; render(); break; }
    case 'export': exportData(); break;
    case 'import': $('#f-import').click(); break;
    case 'import-yes': doImport(); break;
    case 'import-no': pendingImport = null; $('#imp').innerHTML = ''; break;
    case 'install': if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; render(); }); } break;
    case 'install-hide': lsSet('rg-install-hide', '1'); render(); break;
    case 'party-close': $('#party').hidden = true; break;
  }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[role="button"][data-act]')) e.target.click(); });
$('#scrim').addEventListener('click', e => { if (e.target.id === 'scrim') closeSheet(); });
document.addEventListener('change', async e => {
  if (e.target.id === 'f-photo' && e.target.files[0]) {
    try { pendingCover = await shrink(e.target.files[0]); $('#f-prev').innerHTML = `<img src="${URL.createObjectURL(pendingCover)}" alt="">`; }
    catch (err) { toast('That photo couldn’t be read. Try another one.'); }
  }
  if (e.target.id === 'f-import' && e.target.files[0]) readImport(e.target.files[0]);
});
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; render(); });
window.addEventListener('appinstalled', () => { installEvt = null; render(); });

function demoState() {
  const t = today(), books = [
    { id: 'd1', title: 'The Old Man and the Sea', author: 'Ernest Hemingway', added: RG.addDays(t, -40), status: 'reading', done: null, cover: false },
    { id: 'd2', title: 'Meditations', author: 'Marcus Aurelius', added: RG.addDays(t, -20), status: 'reading', done: null, cover: false },
    { id: 'd3', title: 'Walden', author: 'Henry David Thoreau', added: RG.addDays(t, -60), status: 'finished', done: RG.addDays(t, -12), cover: false },
  ];
  const sessions = [];
  for (let i = 45; i >= 0; i--) {
    if (i === 9 || i === 23) continue;
    const min = i === 0 ? 12 : 18 + ((i * 7) % 25);
    sessions.push({ id: 's' + i, run: 'r' + i, book: i > 12 ? 'd3' : i % 2 ? 'd1' : 'd2', day: RG.addDays(t, -i), sec: min * 60, manual: false });
  }
  return { v: 1, goals: [{ from: RG.addDays(t, -60), min: 20 }], books, sessions, run: null };
}

(async () => {
  await load();
  if (DEMO && location.hash === '#demo-reader') { const now = Date.now(); S.run = { id: 'dr', book: 'd2', segs: [], at: now - 431e3, ok: now, beat: now, why: null }; }
  if (DEMO && location.hash === '#demo-paused') { const now = Date.now(); S.run = { id: 'dr', book: 'd2', segs: [[now - 1500e3, now - 300e3]], at: null, ok: now, beat: now, why: 'left' }; }
  render();
  if (S.run) showReader();
  if (DEMO && location.hash === '#demo-detail') sheetDetail('d1');
  if (DEMO && location.hash === '#demo-add') sheetBook();
  if (DEMO && location.hash === '#demo-level') levelUp(6);
  if (DEMO && location.hash === '#demo-finished') setStatus('d1', 'finished');
  if (DEMO && location.hash === '#demo-pins') $('#view').innerHTML = `<div class="case">${RG.LEVELS.map((x, i) => `<div class="cell">${pin(i, 72)}<b>${esc(x[1])}</b></div>`).join('')}</div><div class="case">${[0, 6, 12].map(i => `<div class="cell locked">${pin(i, 72, true)}<b>blank</b></div>`).join('')}</div>`;
  let day = today();
  setInterval(() => { if (today() !== day) { day = today(); render(); } }, 60e3);
  if (!DEMO && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  if (!DEMO && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
