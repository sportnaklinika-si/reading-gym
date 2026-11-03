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
  const sec = runSec(r), goal = goalNow() * 60, done = daySec(today()) + sec, f = Math.min(1, done / goal);
  $('#rd-book').textContent = bookName(bookById(r.book));
  $('#rd-clock').textContent = fmtClock(sec);
  $('#rd-state').textContent = r.at ? 'this session' : 'paused';
  const arc = $('#rd-arc');
  arc.setAttribute('stroke-dasharray', RD_C); arc.setAttribute('stroke-dashoffset', RD_C * (1 - f));
  arc.classList.toggle('done', f >= 1); arc.style.strokeOpacity = f > 0 ? 1 : 0;
  const t = $('#rd-today'); t.classList.toggle('done', f >= 1);
  t.textContent = f >= 1 ? 'Daily goal done ✓ ' + fmtMin(done) + ' today' : Math.ceil((goal - done) / 60) + ' min to today’s goal';
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
function cheer(b, sec) {
  const a = snap(), msgs = [];
  if (!b.tick && a.tick) msgs.push('Daily goal done ✓ Streak: ' + a.cur + (a.cur === 1 ? ' day.' : ' days.'));
  if (a.marks > b.marks) msgs.push('You earned a bookmark. It saves your streak on a day off.');
  if (a.pr > b.pr && b.pr > 0) msgs.push('New PR: your longest session yet, ' + fmtMin(a.pr) + '.');
  if (!msgs.length) msgs.push('Saved ' + fmtMin(sec) + '.');
  msgs.forEach(toast);
  if (a.lvl > b.lvl) levelUp(a.lvl);
}
const toasts = []; let toastOn = false;
function toast(m) { toasts.push(m); if (!toastOn) nextToast(); }
function nextToast() {
  const m = toasts.shift(), el = $('#toast');
  if (!m) { el.hidden = true; toastOn = false; return; }
  toastOn = true; el.textContent = m; el.hidden = false;
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  setTimeout(nextToast, 3200);
}
function party(html) { const el = $('#party'); el.innerHTML = html + '<button class="btn primary" data-act="party-close" style="width:auto; padding-inline:36px">Nice</button>'; el.hidden = false; }
function levelUp(i) {
  const L = RG.LEVELS[i], n = RG.LEVELS[i + 1];
  vibrate([80, 60, 80, 60, 160]);
  party(`${badge(i, 140)}<p class="eyebrow">Level up · ${i + 1} of ${RG.LEVELS.length}</p><h2>${esc(L[1])}</h2><p>${L[0]} hours of reading.${n ? ' Next: ' + esc(n[1]) + ' at ' + n[0] + '&nbsp;h.' : ' This is the top of the ladder.'}</p>`);
}

// ---------- drawing bits
const TIER = ['var(--bronze)', 'var(--silver)', 'var(--gold)'];
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
function badge(i, size, locked) {
  const c = locked ? 'var(--line)' : TIER[Math.min(2, Math.floor(i / 6))], ic = locked ? 'var(--faint)' : c;
  return `<svg class="badge" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" style="fill:${c};fill-opacity:${locked ? 0 : 0.14};stroke:${c};stroke-width:2"/><circle cx="24" cy="24" r="17.5" style="fill:none;stroke:${c};stroke-opacity:.4"/><g transform="translate(12 12)" style="fill:none;stroke:${ic};stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round">${ICONS[RG.LEVELS[i][2]]}</g></svg>`;
}
const initials = b => (bookName(b).match(/[\p{L}\p{N}]+/gu) || ['?']).slice(0, 2).map(w => w[0].toUpperCase()).join('');
function cover(b, w) {
  const h = Math.round(w * 1.45), st = `width:${w}px;height:${h}px`;
  return b && covers[b.id] ? `<img class="cover" src="${covers[b.id]}" alt="" style="${st}">` : `<span class="cover" style="${st};font-size:${Math.round(w / 2.6)}px">${esc(initials(b))}</span>`;
}
function ring(sec, goalMin, size) {
  const C = 2 * Math.PI * 26, f = Math.min(1, sec / (goalMin * 60)), done = f >= 1;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><circle class="trk" cx="32" cy="32" r="26"/><circle class="arc${done ? ' done' : ''}" cx="32" cy="32" r="26" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}" transform="rotate(-90 32 32)" style="stroke-opacity:${f > 0 ? 1 : 0}"/>${done ? '<path class="chk" d="M21 33l7.5 7.5L44 25"/>' : `<text x="32" y="34" text-anchor="middle">${Math.floor(sec / 60)}</text><text class="u" x="32" y="44" text-anchor="middle">min</text>`}</svg>`;
}
const STATUS = { tick: 'Goal reached', saved: 'Saved by a bookmark', miss: 'Missed', open: 'Today, not done yet' };
function dayDot(k, s, isToday) {
  const ic = s === 'tick' ? '<svg viewBox="0 0 16 16" style="fill:none;stroke:#08130D;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round"><path d="M3.5 8.5l3 3 6-7"/></svg>'
    : s === 'saved' ? '<svg viewBox="0 0 16 16"><path d="M4.5 2.5h7v11l-3.5-2.6-3.5 2.6z" style="fill:var(--lamp)"/></svg>' : '';
  return `<div class="wd${isToday ? ' is-today' : ''}"><span class="dot ${s || ''}" title="${esc(STATUS[s] || '')}">${ic}</span>${wd(k)}</div>`;
}
function bookCard(b, t, play) {
  const sub = b.status === 'finished' ? 'Finished ' + fmtDay(b.done) + (t ? ' · ' + fmtMin(t.sec) : '') : t ? fmtMin(t.sec) + ' read' : 'Not started';
  return `<div class="book" data-act="open" data-id="${b.id}" role="button" tabindex="0">${cover(b, 48)}<div style="min-width:0"><h3>${esc(bookName(b))}</h3>${b.author ? `<p>${esc(b.author)}</p>` : ''}<p>${sub}</p></div>${play ? `<button class="play" data-act="start" data-id="${b.id}" aria-label="Start reading ${esc(bookName(b))}"><svg viewBox="0 0 20 20"><path d="M5 3.5v13l11-6.5z" fill="currentColor"/></svg></button>` : ''}</div>`;
}

// ---------- screens
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function installCard() {
  if (standalone() || DEMO || lsGet('rg-install-hide')) return '';
  const how = isIOS ? 'In Safari, tap the Share button (the square with an arrow), then <b>Add to Home Screen</b>. Do it before you start: on iPhone the browser and the home-screen app keep separate data.'
    : installEvt ? 'Install it and it gets its own icon, like any other app.' : 'Open the browser menu (⋮) and tap <b>Add to Home screen</b> or <b>Install app</b>.';
  return `<section class="card install"><h2 style="font-size:1.05rem">Put Reading Gym on your home screen</h2><p>${how}</p><div class="btns${installEvt ? ' two' : ''}">${installEvt ? '<button class="btn primary" data-act="install">Install</button>' : ''}<button class="btn ghost" data-act="install-hide">Hide this</button></div></section>`;
}
function vToday() {
  const tot = totalSec(), L = RG.level(tot), st = streakNow(), t = today(), tsec = daySec(t), goal = goalNow(), done = tsec >= goal * 60;
  const reading = S.books.filter(b => b.status === 'reading'), BT = RG.bookTotals(S.sessions);
  const left = L.next != null ? L.next * 3600 - tot : 0, toMark = RG.MARK_EVERY - st.earn;
  const week = Array.from({ length: 7 }, (_, i) => RG.addDays(t, i - 6));
  return `${DEMO ? '<p class="tag" style="justify-self:start">Example data, nothing is saved</p>' : ''}${installCard()}
  <button class="lvl" data-act="tab" data-tab="stats" data-to="ladder">${badge(L.i, 64)}<div style="min-width:0"><p class="eyebrow">Level ${L.i + 1} of ${RG.LEVELS.length}</p><h1>${esc(L.name)}</h1><div class="bar"><i style="width:${(L.frac * 100).toFixed(1)}%"></i></div><p class="sub">${fmtHours(tot)} read${L.next != null ? ' · ' + (left < 3600 ? Math.ceil(left / 60) + ' min' : fmtHours(left)) + ' to ' + esc(L.nextName) : ''}</p></div></button>
  <section class="card today">${ring(tsec, goal, 84)}<div><h2>${done ? 'Done for today' : 'Today'}</h2><p>${fmtMin(tsec)} of ${goal} min${done ? '' : ' · ' + Math.ceil((goal * 60 - tsec) / 60) + ' min to go'}</p></div></section>
  <section class="card"><div class="streak-top"><b class="num">${st.cur}</b><span>${st.cur === 1 ? 'day' : 'days'} streak</span><span class="marks" title="Bookmarks">${[0, 1, 2].map(i => `<span class="mark${i < st.marks ? ' on' : ''}"></span>`).join('')}</span></div>
    <p class="hint">${st.marks >= RG.MARK_MAX ? 'All 3 bookmarks saved. Each one saves your streak on a day off.' : toMark + ' more goal ' + (toMark === 1 ? 'day' : 'days') + ' to earn a bookmark. A bookmark saves your streak on a day off.'}</p>
    <div class="week">${week.map(k => dayDot(k, st.days[k], k === t)).join('')}</div></section>
  <h2 class="sec">Reading now</h2>
  ${reading.length ? `<div class="books">${reading.map(b => bookCard(b, BT[b.id], true)).join('')}</div><button class="add" data-act="add">+ Add a book</button>`
    : '<section class="card empty"><p>Add the book you’re reading. A photo of the cover or the title is enough.</p><button class="btn primary" data-act="add">Add a book</button></section>'}`;
}
function vBooks() {
  const BT = RG.bookTotals(S.sessions), g = st => S.books.filter(b => b.status === st);
  const fin = g('finished').sort((a, b) => (b.done || '').localeCompare(a.done || ''));
  const year = String(new Date().getFullYear()), finYear = fin.filter(b => (b.done || '').startsWith(year)).length;
  const list = (title, arr, play) => arr.length ? `<h2 class="sec">${title} · ${arr.length}</h2><div class="books">${arr.map(b => bookCard(b, BT[b.id], play)).join('')}</div>` : '';
  return `<h1 style="font-size:1.6rem">Books</h1>
  <div class="tiles"><div class="tile"><b>${fin.length}</b><span>books finished</span></div><div class="tile"><b>${finYear}</b><span>finished in ${year}</span></div></div>
  ${list('Reading now', g('reading'), true)}
  <button class="add" data-act="add">+ Add a book</button>
  ${list('Finished', fin, false)}
  ${list('Put aside', g('aside'), false)}`;
}
function weekChart(t, goal) {
  const mon = RG.addDays(t, -((RG.keyDate(t).getDay() + 6) % 7));
  const keys = Array.from({ length: 7 }, (_, i) => RG.addDays(mon, i)), mins = keys.map(k => daySec(k) / 60);
  const lastWeek = Array.from({ length: 7 }, (_, i) => daySec(RG.addDays(mon, i - 7))).reduce((a, b) => a + b, 0);
  const W = 320, H = 150, top = 20, base = 124, max = Math.max(goal, ...mins) * 1.15, y = v => base - (v / max) * (base - top), bw = 26, step = W / 7;
  const bars = keys.map((k, i) => {
    const x = i * step + (step - bw) / 2, v = mins[i], hit = v >= RG.goalFor(S.goals, k);
    return (v > 0 ? `<rect x="${x}" y="${y(v)}" width="${bw}" height="${base - y(v)}" rx="5" style="fill:${hit ? 'var(--tick)' : 'var(--lamp)'}"/><text class="v" x="${x + bw / 2}" y="${y(v) - 6}" text-anchor="middle">${Math.round(v)}</text>` : '')
      + `<text x="${x + bw / 2}" y="${base + 18}" text-anchor="middle"${k === t ? ' class="v"' : ''}>${wd(k)}</text>`;
  }).join('');
  return `<section class="card chart"><div class="row" style="margin-bottom:8px; flex-wrap:wrap"><h2 style="font-size:1.15rem">This week</h2><span class="muted num" style="font-size:.85rem">${fmtMin(mins.reduce((a, b) => a + b, 0) * 60)} · last week ${fmtMin(lastWeek)}</span></div>
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Minutes read each day this week"><line x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}" style="stroke:var(--muted);stroke-dasharray:4 4"/><line x1="0" x2="${W}" y1="${base}" y2="${base}" style="stroke:var(--line)"/>${bars}</svg>
  <p class="hint">Minutes a day. Dashed line: your goal of ${goal} min. Green: goal reached.</p></section>`;
}
function calendar(st) {
  const t = today(), now = RG.keyDate(t);
  if (!calMonth) calMonth = [now.getFullYear(), now.getMonth()];
  const [y, m] = calMonth, first = new Date(y, m, 1), n = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
  const cells = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(h => `<span class="h">${h}</span>`);
  for (let i = 0; i < lead; i++) cells.push('<span></span>');
  for (let d = 1; d <= n; d++) {
    const k = RG.dayKey(new Date(y, m, d)), s = k > t ? 'future' : st.days[k] || (k === t ? 'today' : '');
    cells.push(`<span class="c ${s}" title="${esc(STATUS[s] || '')}">${d}</span>`);
  }
  const atNow = y === now.getFullYear() && m === now.getMonth();
  return `<section class="card"><div class="cal-head"><button data-act="cal" data-d="-1" aria-label="Previous month">‹</button><h2 style="font-size:1.1rem">${first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2><button data-act="cal" data-d="1" aria-label="Next month"${atNow ? ' disabled style="opacity:.3"' : ''}>›</button></div>
  <div class="cal">${cells.join('')}</div><div class="legend"><span><i style="background:var(--tick)"></i>goal reached</span><span><i style="box-shadow:inset 0 0 0 1.5px var(--lamp)"></i>saved by a bookmark</span></div></section>`;
}
function vStats() {
  const tot = totalSec(), st = streakNow(), L = RG.level(tot), t = today(), goal = goalNow(), pr = RG.longestRun(S.sessions);
  const readDays = Object.values(RG.dayTotals(S.sessions)).filter(v => v > 0).length;
  return `<h1 style="font-size:1.6rem">Stats</h1>
  <div class="tiles">
    <div class="tile"><b>${fmtHours(tot)}</b><span>read in total</span></div>
    <div class="tile"><b>${st.best}</b><span>best streak, days</span></div>
    <div class="tile"><b>${pr ? fmtMin(pr) : '–'}</b><span>longest session</span></div>
    <div class="tile"><b>${readDays ? fmtMin(tot / readDays) : '–'}</b><span>on an average reading day</span></div>
  </div>
  ${weekChart(t, goal)}
  ${calendar(st)}
  <section class="card" id="ladder"><h2 style="font-size:1.15rem; margin-bottom:10px">The ladder</h2><div class="ladder">${RG.LEVELS.map((x, i) => `<div class="rung${i === L.i ? ' now' : i > L.i ? ' locked' : ''}">${badge(i, 44, i > L.i)}<div style="min-width:0"><b>${esc(x[1])}</b>${i === L.i ? '<br><small>You are here</small>' : ''}</div><small>${x[0]} h</small></div>`).join('')}</div></section>
  <section class="card" style="display:grid; gap:12px"><h2 style="font-size:1.15rem">Daily goal</h2><div class="goal"><button data-act="goal" data-d="-5" aria-label="5 minutes less">−</button><div><b class="num">${goal}</b> <span class="muted">min a day</span></div><button data-act="goal" data-d="5" aria-label="5 minutes more">+</button></div><p class="hint">A new goal counts from today. Earlier days keep the goal they had.</p></section>
  <section class="card" style="display:grid; gap:12px"><h2 style="font-size:1.15rem">Backup</h2><p class="hint">Everything is kept on this phone only. Save a backup now and then, so a new phone doesn’t mean starting over.</p><div class="btns two"><button class="btn" data-act="export">Save backup</button><button class="btn" data-act="import">Load backup</button></div><div id="imp" style="display:grid; gap:10px"></div></section>`;
}
function render() {
  if (!S) return;
  $('#view').innerHTML = view === 'books' ? vBooks() : view === 'stats' ? vStats() : vToday();
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
  save(); closeSheet(); render(); toast(b ? 'Saved.' : 'Book added. Tap ▶ when you start reading.');
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
  openSheet('', `<div class="detail">${cover(b, 84)}<div style="min-width:0; display:grid; gap:6px; justify-items:start"><h2>${esc(bookName(b))}</h2>${b.author ? `<p class="muted">${esc(b.author)}</p>` : ''}<span class="tag">${{ reading: 'Reading now', finished: 'Finished', aside: 'Put aside' }[b.status]}</span></div></div>
    <dl class="facts">${facts.map(f => `<div><dt>${f[0]}</dt><dd>${esc(f[1])}</dd></div>`).join('')}</dl>
    <div class="btns">${acts}<div class="btns two"><button class="btn ghost" data-act="edit" data-id="${id}">Edit</button><button class="btn danger" data-act="delete" data-id="${id}">Delete</button></div></div>
    <p class="err" id="del-note" hidden>Tap again to delete the book${t ? ' and its ' + fmtMin(t.sec) + ' of reading' : ''}.</p>`);
}
function setStatus(id, status) {
  const b = bookById(id); if (!b) return;
  b.status = status; b.done = status === 'finished' ? today() : null;
  save(); closeSheet(); render();
  if (status === 'finished') {
    const y = String(new Date().getFullYear()), n = S.books.filter(x => x.status === 'finished' && (x.done || '').startsWith(y)).length, t = RG.bookTotals(S.sessions)[id];
    vibrate([80, 60, 160]);
    party(`<div class="badge">${cover(b, 110)}</div><p class="eyebrow">Book finished</p><h2>${esc(bookName(b))}</h2><p>Book ${n} of ${y}.${t ? ' ' + fmtMin(t.sec) + ' of reading.' : ''}</p>`);
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
  let day = today();
  setInterval(() => { if (today() !== day) { day = today(); render(); } }, 60e3);
  if (!DEMO && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  if (!DEMO && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
