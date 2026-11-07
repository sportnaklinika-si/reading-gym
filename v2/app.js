/* Bralni mentor: screens, the reading timer and storage on the phone. The rules (streak, levels) are in core.js, the kid reader in kid.js. */
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const today = () => RG.dayKey(Date.now());
const CHECK_MS = 45 * 60e3, ANSWER_MS = 3 * 60e3, BEAT_MS = 15e3, MIN_SAVE = 60;
const HASH = location.hash.split('&')[0], DEMO = HASH.startsWith('#demo');   // example data for screenshots (#demo, #demo-stats, #demo-reader), never saved
// Test only: "#demo&theme=B" (or C, D) shows one of the other colour looks Jan compared (test/themes.js overrides the theme block); the app itself never loads it.
// "&clean" leaves the example-data badge out of screenshots.
if (DEMO && /&theme=[A-Z]/.test(location.hash)) { const s = document.createElement('script'); s.src = 'test/themes.js'; document.head.append(s); }

let S = null, view = DEMO && /stats|books/.test(HASH) ? HASH.slice(6) : DEMO && /friends|member|club|welcome|invite|chat/.test(HASH) ? 'friends' : 'today', calMonth = null, installEvt = null, ask = null, tickT = null, pendingCover = null, pendingImport = null;
let swReg = null, reloadAfterRun = false;   // a new version arrived while the timer ran: switch to it once the reading is saved
const covers = {};   // book id -> object URL of the cover photo

// ---------- storage: IndexedDB on the phone, localStorage only if that fails (names unchanged since Reading Gym, so old data keeps working)
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
  return { get: k => run('readonly', s => s.get(k)), set: (k, v) => run('readwrite', s => s.put(v, k)), del: k => run('readwrite', s => s.delete(k)), keys: () => run('readonly', s => s.getAllKeys()) };
})();
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const fresh = () => ({ v: 1, goals: [{ from: today(), min: 20 }], books: [], sessions: [], run: null });

// ---------- keeping the data safe while the old and the new version share it
// Both versions on this phone read and write the same storage ('state'), so all reading counts in both. This version never works
// on old data: it reads the state again whenever it comes back on screen, and before each save it takes in the books and
// readings the other version added meanwhile. What this version adds itself is also kept in its own journal ('bm2-own'): if the
// old version, still open in the background with an older copy, writes over it, the next start of this version puts it back.
// Once a day a copy of the whole state is kept too ('snap:YYYY-MM-DD', the last 7 days).
let own = { s: {}, b: {}, gone: {} };   // readings and books saved by this version; ids deleted in this version
const ownSession = x => { own.s[x.id] = x; };
const ownBook = b => { b.edited = Date.now(); own.b[b.id] = JSON.parse(JSON.stringify(b)); };
const ownGone = id => { own.gone[id] = 1; delete own.s[id]; delete own.b[id]; };
// add what the stored state has and this copy doesn't (unless deleted here)
function absorb(cur) {
  if (!cur || !S) return;
  const sid = new Set(S.sessions.map(x => x.id)), bid = new Set(S.books.map(x => x.id));
  for (const x of cur.sessions || []) if (!sid.has(x.id) && !own.gone[x.id]) S.sessions.push(x);
  for (const b of cur.books || []) if (!bid.has(b.id) && !own.gone[b.id]) S.books.push(b);
}
// put back what this version saved and an older copy wrote over; returns how many came back
function restoreOwn() {
  let n = 0;
  // deleted here, but the old version wrote them back from its older copy
  const nb = S.books.length, ns = S.sessions.length;
  S.books = S.books.filter(b => !own.gone[b.id]); S.sessions = S.sessions.filter(x => !own.gone[x.id]);
  n += nb - S.books.length + ns - S.sessions.length;
  const sid = new Set(S.sessions.map(x => x.id));
  for (const x of Object.values(own.s)) if (!sid.has(x.id) && !own.gone[x.id]) { S.sessions.push(x); n++; }
  for (const b of Object.values(own.b)) {
    if (own.gone[b.id]) continue;
    const i = S.books.findIndex(x => x.id === b.id);
    if (i < 0) { S.books.push(JSON.parse(JSON.stringify(b))); n++; }
    else if ((S.books[i].edited || 0) < b.edited) { S.books[i] = JSON.parse(JSON.stringify(b)); n++; }
  }
  return n;
}
async function readState() {
  let s = null;
  try { s = await idb.get('state'); } catch (e) { try { s = JSON.parse(lsGet('rg-state')); } catch (e2) {} }
  try { const o = await idb.get('bm2-own'); if (o && o.s) own = o; } catch (e) {}
  S = Object.assign(fresh(), s || {});
  if (!S.me) { try { const m = await idb.get('bm2-me'); if (m && m.id) S.me = m; } catch (e) {} }   // an older backup was loaded in the old version
  return restoreOwn();
}
// back on screen with no reading running here: take the state as it is stored now (the old version may have changed it)
async function reread() {
  if (DEMO || !S || S.run) return;
  const keepRun = S.run;
  if (await readState()) save();
  if (keepRun && !S.run) S.run = keepRun;
  for (const b of S.books) if (b.cover && !covers[b.id]) loadCover(b.id);
}
async function snapshot() {
  try {
    const k = 'snap:' + today();
    if (!(await idb.get(k))) await idb.set(k, JSON.parse(JSON.stringify(Object.assign({}, S, { run: null }))));
    const old = RG.addDays(today(), -7);
    for (const key of await idb.keys()) if (typeof key === 'string' && key.startsWith('snap:') && key.slice(5) < old) await idb.del(key);
  } catch (e) {}
}

async function load() {
  let back = 0;
  if (DEMO) S = Object.assign(fresh(), demoState());
  else back = await readState();
  // The app was closed while the timer ran (a phone may close it while the screen is locked). Counting with the screen locked,
  // the run goes on from its start time and the return question asks how much counts; otherwise it keeps the time up to
  // the last moment it was seen running.
  const r = S.run;
  if (r && r.at) {
    if (countOff()) { if (!r.hid) r.hid = Math.max(r.at, r.beat); }
    else { if (r.beat > r.at) r.segs.push([r.at, r.beat]); r.at = null; r.why = 'closed'; }
  }
  if (!DEMO) for (const b of S.books) if (b.cover) loadCover(b.id);
  if (!DEMO) { if (back) save(); snapshot(); }
}
async function loadCover(id) {
  try { const blob = await idb.get('cover:' + id); if (blob) { covers[id] = URL.createObjectURL(blob); render(); } } catch (e) {}
}
let chain = Promise.resolve();
function save() {
  if (DEMO) return;
  chain = chain.then(async () => {
    let cur = null; try { cur = await idb.get('state'); } catch (e) {}
    absorb(cur);   // readings and books the old version added meanwhile
    const snapS = JSON.parse(JSON.stringify(S));
    try { await idb.set('state', snapS); await idb.set('bm2-own', own); } catch (e) { lsSet('rg-state', JSON.stringify(snapS)); }
  }).catch(() => {});
  Club.changed();
}

// ---------- numbers and words in Slovene
// Four forms: 1, 2, 3 and 4, everything else (0, 5 ...). Also 101, 102, 103 follow 1, 2, 3.
const plural = (n, f) => { const m = Math.abs(n) % 100; return f[m === 1 ? 0 : m === 2 ? 1 : m === 3 || m === 4 ? 2 : 3]; };
const DAYS = ['dan', 'dneva', 'dnevi', 'dni'], BOOKS = ['knjiga', 'knjigi', 'knjige', 'knjig'];
const nf = (n, d = 0) => n.toLocaleString('sl-SI', { minimumFractionDigits: d, maximumFractionDigits: d });
const totalSec = () => S.sessions.reduce((a, s) => a + s.sec, 0);
const daySec = k => S.sessions.reduce((a, s) => a + (s.day === k ? s.sec : 0), 0);
const goalNow = () => RG.goalFor(S.goals, today());
const streakNow = () => RG.streak(S.sessions, S.goals, today());
const bookById = id => S.books.find(b => b.id === id);
const bookName = b => b ? (b.title || 'Knjiga brez naslova') : 'Izbrisana knjiga';
const NB = ' ';   // no-break space: "2 h 34 min" never splits over two lines
const fmtMin = sec => { const m = Math.floor(sec / 60); return m < 60 ? m + NB + 'min' : Math.floor(m / 60) + NB + 'h' + (m % 60 ? NB + (m % 60) + NB + 'min' : ''); };
const fmtClock = sec => { sec = Math.floor(sec); const p = n => String(n).padStart(2, '0'), h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return h ? h + ':' + p(m) + ':' + p(sec % 60) : m + ':' + p(sec % 60); };
const fmtHours = sec => { const h = sec / 3600, r = Math.round(h * 10) / 10; return (h < 10 && r % 1 ? nf(r, 1) : nf(Math.round(h))) + NB + 'h'; };
const fmtDay = k => RG.keyDate(k).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short', year: 'numeric' });
const longDay = k => RG.keyDate(k).toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long' });
const WD = ['ned', 'pon', 'tor', 'sre', 'čet', 'pet', 'sob'];
const wd = k => WD[RG.keyDate(k).getDay()];
const stampDate = k => { const d = RG.keyDate(k); return d.getDate() + '.' + (d.getMonth() + 1) + '.'; };
const tilt = k => ((Number(k.slice(8)) * 37 + Number(k.slice(5, 7)) * 11) % 9) - 4;   // every stamp lands a little crooked, the same way each time
const vibrate = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

// ---------- the timer. By default (Jan, 3. 11.: locking the phone by hand or automatically must not stop the timer) it keeps
// counting with the screen locked, from timestamps since the page itself is asleep then; it can't tell a locked screen from
// another app, so it asks on return. Switched off (S.countOff === false): the phone stays awake, the reading screen turns black
// after a few seconds without a touch, and leaving the app pauses the timer.
const countOff = () => S.countOff !== false;   // older states and backups have no field: on
const BLACK_MS = 8e3;
let touchAt = 0;   // last touch on the reading screen
let lock = null;
async function wake(on) {
  on = on && !countOff();   // counting with the screen off, the screen may sleep: it saves the battery
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
  touchAt = now; save(); wake(true); showReader();
}
// While "Še bereš?" is open, time after the question never counts.
function pauseRun(why, end) {
  const r = S.run; if (!r || !r.at) return;
  end = end || ask || Date.now();
  if (end > r.at) r.segs.push([r.at, end]);
  r.at = null; r.why = why; ask = null;
  save(); wake(false); paintReader();
}
function resumeRun() {
  const r = S.run; if (!r) return;
  r.at = r.ok = r.beat = touchAt = Date.now(); r.why = null;
  save(); wake(true); paintReader();
}
function finishRun() {
  const r = S.run; if (!r) return;
  pauseRun('done');
  const parts = RG.splitByDay(r.segs), total = Object.values(parts).reduce((a, b) => a + b, 0), before = snap();
  S.run = null;
  if (total >= MIN_SAVE) for (const [day, sec] of Object.entries(parts)) if (sec >= 1) { const x = { id: uid(), run: r.id, book: r.book, day, sec: Math.round(sec), manual: false }; S.sessions.push(x); ownSession(x); }
  save(); hideReader(); render();
  if (total >= MIN_SAVE) cheer(before, total); else toast('Manj kot minuta branja, zato ni shranjeno.');
}
function discardRun() { S.run = null; ask = null; save(); wake(false); hideReader(); render(); toast('Branje je zavrženo.'); }

// Out of sight (screen locked or another app, a page can't tell which). Counting with the screen locked, the run keeps its start time
// and notes when it went; otherwise it pauses.
// An open "Še bereš?" counts from the moment it was asked.
function outOfSight() {
  const r = S.run; if (!r || !r.at) return;
  if (!countOff()) return pauseRun('left');
  if (!r.hid) r.hid = ask || Date.now();
  ask = null; save();
}
// Back on screen: up to 20 minutes away just goes on; longer, the return question asks how much counts (r.back = when it came back).
function backInSight() {
  const r = S.run; if (!r || !r.at || !r.hid) return;
  const now = Date.now();
  if (r.back || RG.away(r.hid, now).ask) r.back = now; else r.hid = null;
  r.ok = now; ask = null; save(); paintReader();
}
function settleBack(choice) {
  const r = S.run; if (!r || !r.back) return;
  const now = Date.now();
  if (choice === 'until') { r.segs = RG.settle(r.segs, r.at, r.hid, now, 'until'); r.at = null; r.why = 'dark'; }
  r.hid = r.back = null; r.ok = now; save(); paintReader();
}

function tick() {
  const r = S.run; if (!r) return;
  const now = Date.now();
  if (r.at) {
    if (r.hid && !r.back && document.visibilityState === 'visible') backInSight();
    if (now - r.beat >= BEAT_MS) { r.beat = now; save(); }
    // "Še bereš?" only while the app is in sight and no return question is open
    if (r.hid) ask = null;
    else if (!ask && now - r.ok >= CHECK_MS) { ask = now; vibrate([200, 120, 200]); }
    else if (ask && now - ask >= ANSWER_MS) pauseRun('asleep', ask);
    const goal = goalNow() * 60;
    if (!r.hit && daySec(today()) + runSec(r) >= goal) { r.hit = true; vibrate(120); }
  }
  paintReader();
}
function showReader() { $('#reader').hidden = false; touchAt = Date.now(); paintReader(); clearInterval(tickT); tickT = setInterval(tick, 1000); }
function hideReader() { $('#reader').hidden = true; clearInterval(tickT); tickT = null; }
const RD_C = 2 * Math.PI * 54;
const WHY = {
  pause: 'Premor.',
  left: 'Premor: aplikacija ni bila več na zaslonu ali pa se je zaslon ugasnil.',
  closed: 'Aplikacija se je zaprla med branjem. Čas do takrat je shranjen.',
  asleep: 'Nihče ni odgovoril, zato se je štoparica ustavila v trenutku vprašanja.',
  dark: 'Šteto je do trenutka, ko se je zaslon ugasnil.',
};
function paintReader() {
  const r = S.run; if (!r || $('#reader').hidden) return;
  const sec = runSec(r), goal = goalNow() * 60, done = daySec(today()) + sec, f = Math.min(1, done / goal), b = bookById(r.book);
  $('#rd-book').textContent = bookName(b);
  const cv = $('#rd-cover'); if (cv.dataset.book !== r.book + (covers[r.book] || '')) { cv.dataset.book = r.book + (covers[r.book] || ''); cv.innerHTML = cover(b, 52); }
  $('#rd-live').classList.toggle('off', !r.at); $('#rd-livetxt').textContent = r.at ? 'Bereš' : 'Premor';
  $('#rd-clock').textContent = fmtClock(sec);
  $('#rd-state').textContent = r.at ? 'to branje' : 'premor';
  const arc = $('#rd-arc');
  arc.setAttribute('stroke-dasharray', RD_C); arc.setAttribute('stroke-dashoffset', RD_C * (1 - f));
  arc.classList.toggle('done', f >= 1); arc.style.strokeOpacity = f > 0 ? 1 : 0;
  const t = $('#rd-today'); t.classList.toggle('done', f >= 1);
  t.innerHTML = f >= 1 ? IC.tick + '<span>Dnevni cilj dosežen · danes ' + fmtMin(done) + '</span>' : 'Še ' + Math.ceil((goal - done) / 60) + ' min do današnjega cilja';
  $('#rd-run').hidden = !r.at; $('#rd-paused').hidden = !!r.at;
  let why = WHY[r.why] || WHY.pause;
  if (r.why === 'left' && !('wakeLock' in navigator)) why += ' Če se zaslon ugaša sam, mu v nastavitvah telefona podaljšaj čas do samodejnega zaklepanja.';
  $('#rd-why').textContent = why;
  // black screen: after a few seconds without a touch while the timer runs (never over a question); a tap brings the controls back
  const dark = !!r.at && !countOff() && !ask && !r.back && Date.now() - touchAt >= BLACK_MS, m = Math.floor(sec / 60);
  $('#reader').classList.toggle('dark', dark);
  $('#rd-dim').textContent = fmtMin(sec);
  $('#rd-dim').style.transform = 'translate(' + ((m % 5) - 2) * 8 + 'px, ' + ((m % 3) - 1) * 8 + 'px)';   // the dim time drifts a little each minute
  const tip = !countOff() && (DEMO || !lsGet('rg-black-tip'));
  $('#rd-note').hidden = !r.at || !(tip || countOff());
  $('#rd-note').textContent = countOff() ? 'Zaslon lahko zakleneš, štoparica šteje naprej.' : 'Zaslon bo počrnel, telefon ostane buden. Če odpreš drugo aplikacijo, se štetje ustavi.';
  $('#rd-ask').hidden = !ask || !!r.back;
  // the return question: how long the screen was off, what the clock showed when it went off; after 4 hours "until" is proposed
  const back = r.at && r.back ? RG.away(r.hid, r.back) : null;
  $('#rd-back').hidden = !back;
  if (back) {
    $('#rd-back-t').textContent = 'Med ugasnjenim zaslonom je minilo ' + fmtMin(back.ms / 1000) + '.';
    const all = '<button class="btn' + (back.long ? '' : ' primary') + '" data-act="back-all">Da, štej vse</button>';
    const until = '<button class="btn' + (back.long ? ' primary' : '') + '" data-act="back-until">Štej samo do ugasnitve</button>';
    const html = back.long ? until + all : all + until;
    if ($('#rd-back-btns').dataset.html !== html) { $('#rd-back-btns').dataset.html = html; $('#rd-back-btns').innerHTML = html; }
    const upto = RG.settle(r.segs, r.at, r.hid, r.hid, 'until').reduce((a, g) => a + (g[1] - g[0]), 0) / 1000;
    $('#rd-back-n').textContent = back.long ? 'Več kot 4 ure je dolgo, zato predlagam samo čas do ugasnitve: ' + fmtMin(upto) + '.' : 'Do ugasnitve je štoparica kazala ' + fmtMin(upto) + '.';
  }
}
document.addEventListener('visibilitychange', async () => {
  if (!S) return;
  if (reloadAfterRun && !S.run) return location.reload();
  if (document.visibilityState === 'hidden') { outOfSight(); Club.poll(false); }
  else {
    await reread();   // the old version may have changed the data meanwhile
    render(); if (S.run) { showReader(); backInSight(); } if (swReg) swReg.update().catch(() => {});
    Club.wake();
  }
});
window.addEventListener('pagehide', () => { if (S) outOfSight(); });
// a touch on the reading screen keeps it lit a few seconds longer; on the black layer the tap only brings the controls back ("unblack")
$('#reader').addEventListener('pointerdown', () => { if (!$('#reader').classList.contains('dark')) touchAt = Date.now(); }, true);
document.addEventListener('keydown', () => { touchAt = Date.now(); if (S && S.run) paintReader(); });

// ---------- rewards
function snap() { const st = streakNow(); return { lvl: RG.level(totalSec()).i, tick: daySec(today()) >= goalNow() * 60, pr: RG.longestRun(S.sessions), marks: st.marks, cur: st.cur }; }
let freshTick = false;   // the goal was reached a moment ago: today's date stamp presses in once
function cheer(b, sec) {
  const a = snap(), msgs = [];
  if (!b.tick && a.tick) { msgs.push(['Dnevni cilj dosežen. Niz: ' + a.cur + ' ' + plural(a.cur, DAYS) + '.', 'tick']); freshTick = true; render(); freshTick = false; }
  if (a.marks > b.marks) msgs.push(['Nov zaznamek. Reši niz na prost dan.', 'mark']);
  if (a.pr > b.pr && b.pr > 0) msgs.push(['Nov osebni rekord: najdaljše branje doslej, ' + fmtMin(a.pr) + '.', 'pr']);
  if (!msgs.length) msgs.push(['Shranjeno: ' + fmtMin(sec) + '.']);
  msgs.forEach(m => toast(m[0], m[1]));
  if (a.lvl > b.lvl) levelUp(a.lvl);
  Club.moments(b, a);   // a new level or a streak milestone goes to the friends' chat
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
function party(html) { const el = $('#party'); el.innerHTML = html + '<button class="btn primary" data-act="party-close">Super</button>'; el.hidden = false; }
// paper confetti in the stamp-pad colours
const CONFETTI = ['var(--accent)', 'var(--good)', 'var(--mark)', 'var(--under)', 'var(--tier-3)', 'var(--il-cloth-4)'];
const sparks = () => Array.from({ length: 14 }, (_, k) => {
  const a = k / 14 * 2 * Math.PI + 0.2, d = 100 + (k % 3) * 16;
  return `<i class="spark" style="--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d)}px;background:${CONFETTI[k % 6]};animation-delay:${(0.28 + (k % 4) * 0.05).toFixed(2)}s"></i>`;
}).join('');
function levelUp(i) {
  const L = RG.LEVELS[i], n = RG.LEVELS[i + 1];
  vibrate([80, 60, 80, 60, 160]);
  party(`<div class="hero morph">${i > 0 ? `<span class="kid-wrap old">${KID(i - 1, 200)}</span>` : ""}<i class="burst"></i><span class="kid-wrap new">${KID(i, 200, false, true)}</span>${sparks()}</div><h2>${esc(L[1])}</h2><p>${esc(RG.LEVELS[i][2])}</p><p>Stopnja ${i + 1} od ${RG.LEVELS.length}, ${L[0]} h branja.${n ? ' Naslednja:&nbsp;' + esc(n[1]) + ' pri ' + n[0] + '&nbsp;h.' : ' To je vrh poti.'}</p>`);
}

// ---------- drawing bits
const f1 = n => +n.toFixed(2);
// a red paper bookmark; an empty one is a dashed outline waiting to be earned
const mark = on => `<svg viewBox="0 0 18 40" aria-hidden="true">${on ? '<path d="M1 0h16v38l-8-7-8 7z" style="fill:var(--mark)"/><circle cx="9" cy="8" r="2.2" style="fill:var(--bg)"/>' : '<path d="M1.75 0v36.4l7.25-6.3 7.25 6.3V0" style="fill:none;stroke:var(--line);stroke-width:1.5;stroke-dasharray:3 2.4"/>'}</svg>`;
const MINI_MARK = '<svg viewBox="0 0 6 11" aria-hidden="true"><path d="M0 0h6v11l-3-2.6L0 11z" fill="currentColor"/></svg>';
const IC = {
  plus: '<svg class="ic" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg class="ic" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  prev: '<svg class="ic" viewBox="0 0 24 24"><path d="M14.5 6l-6 6 6 6"/></svg>',
  next: '<svg class="ic" viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6"/></svg>',
  tick: '<svg class="ic" viewBox="0 0 24 24" style="width:18px;height:18px"><circle cx="12" cy="12" r="10" style="fill:currentColor;stroke:none"/><path d="M7.5 12.5l3 3 6-6.5" style="stroke:var(--on-good);stroke-width:2.4"/></svg>',
};
const TOAST_IC = {
  tick: '<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" style="fill:var(--good)"/><path d="M8 13.5l3.4 3.4L18.5 9.5" style="fill:none;stroke:var(--on-good);stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round"/></svg>',
  mark: '<svg viewBox="0 0 26 26" aria-hidden="true"><path d="M8 1h10v23l-5-4.3L8 24z" style="fill:var(--mark)"/><circle cx="13" cy="6" r="1.6" style="fill:var(--toast-bg)"/></svg>',
  pr: '<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" style="fill:var(--mark)"/><text x="13" y="17.2" text-anchor="middle" style="font:var(--display-w) 10.5px var(--display);fill:var(--on-accent)">OR</text></svg>',
};
const initials = b => (bookName(b).match(/[\p{L}\p{N}]+/gu) || ['?']).slice(0, 2).map(w => w[0].toUpperCase()).join('');
// Without a photo a book gets a cloth binding in one of six colours, picked from its id, with its initials in foil.
const CLOTH = [1, 2, 3, 4, 5, 6].map(n => 'var(--cloth-' + n + ')');
const clothOf = b => { let h = 7; for (const ch of b ? b.id + bookName(b) : '?') h = (h * 31 + ch.charCodeAt(0)) >>> 0; return CLOTH[h % CLOTH.length]; };
function cover(b, w) {
  const fill = w === 'fill', st = fill ? '' : `width:${w}px;height:${Math.round(w * 1.45)}px;`;
  if (b && covers[b.id]) return `<img class="cover" src="${covers[b.id]}" alt="" style="${st}">`;
  return `<span class="cover cloth" style="${st}background:${clothOf(b)};font-size:${fill ? 'clamp(1.1rem, 7vw, 1.8rem)' : Math.round(w / 2.7) + 'px'}"><span>${esc(initials(b))}</span></span>`;
}
function ring(sec, goalMin, size) {
  const C = 2 * Math.PI * 26, f = Math.min(1, sec / (goalMin * 60)), done = f >= 1;
  return `<svg class="ring${done ? ' done' : ''}" width="${size}" height="${size}" viewBox="0 0 64 64" aria-hidden="true"><circle class="trk" cx="32" cy="32" r="26"/><circle class="arc" cx="32" cy="32" r="26" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - f)}" transform="rotate(-90 32 32)" style="stroke-opacity:${f > 0 ? 1 : 0}"/>`
    + (done ? `<g${freshTick ? ' class="tickdisc"' : ''}><circle cx="32" cy="32" r="17" style="fill:var(--good)"/><path d="M24.5 32.5l5 5 10-11" style="fill:none;stroke:var(--on-good);stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round"/></g>`
      : `<text class="num1" x="32" y="35.5" text-anchor="middle">${Math.floor(sec / 60)}</text><text class="u" x="32" y="45" text-anchor="middle">min</text>`) + '</svg>';
}
const STATUS = { tick: 'cilj dosežen', saved: 'rešeno z zaznamkom', miss: 'cilj ni dosežen', open: 'danes, še ne' };
// A day on the due-date card: an empty ruled slot, or a tilted rubber stamp with its date (green for the goal, red when a bookmark saved it).
function dayDot(k, s, isToday) {
  if (isToday && !s) s = 'open';
  const lab = stampDate(k), r = `--r:${tilt(k)}deg`;
  const slot = s === 'tick' ? `<span class="slot stamp${isToday && freshTick ? ' thunk' : ''}" style="${r}">${lab}</span>`
    : s === 'saved' ? `<span class="slot stamp saved" style="${r}">${MINI_MARK}${lab}</span>`
    : s === 'open' ? `<span class="slot open">${lab}</span>` : `<span class="slot blank">${lab}</span>`;
  return `<div class="wd${isToday ? ' is-today' : ''}" role="img" aria-label="${esc(longDay(k) + ': ' + (STATUS[s] || 'še brez cilja'))}">${slot}<span>${wd(k)}</span></div>`;
}
const PLAY = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5.5 3.8v12.4c0 .7.8 1.1 1.4.7l9.6-6.2c.6-.4.6-1.2 0-1.5L6.9 3.1c-.6-.4-1.4 0-1.4.7z" fill="currentColor"/></svg>';
function bookCard(b, t, play) {
  const sub = b.status === 'finished' ? 'Prebrana ' + fmtDay(b.done) + (t ? ' · ' + fmtMin(t.sec) : '') : t ? fmtMin(t.sec) + ' branja' : 'Še nezačeta';
  return `<div class="book" data-act="open" data-id="${b.id}" role="button" tabindex="0">${cover(b, 48)}<div style="min-width:0; display:grid; gap:2px"><h3>${esc(bookName(b))}</h3>${b.author ? `<p>${esc(b.author)}</p>` : ''}<p class="t">${sub}</p></div>${play ? `<button class="play" data-act="start" data-id="${b.id}" aria-label="Začni brati: ${esc(bookName(b))}">${PLAY}</button>` : ''}</div>`;
}
const shelfItem = (b, t) => `<button class="shelf" data-act="open" data-id="${b.id}">${cover(b, 'fill')}${b.done ? `<span class="done-stamp" aria-hidden="true">PREBRANO<br>${stampDate(b.done)}</span>` : ''}<b>${esc(bookName(b))}</b><small>${b.done ? fmtDay(b.done) : ''}${t ? '<br>' + fmtMin(t.sec) : ''}</small></button>`;

// ---------- screens
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function installCard() {
  if (standalone() || DEMO || lsGet('rg-install-hide')) return '';
  const how = isIOS ? 'V Safariju tapni gumb Deli (kvadrat s puščico) in nato <b>Dodaj na začetni zaslon</b>. Naredi to, preden začneš: na iPhonu brskalnik in aplikacija na začetnem zaslonu hranita ločene podatke.'
    : installEvt ? 'Namesti ga in dobil bo svojo ikono, kot vsaka druga aplikacija.' : 'Odpri meni brskalnika (tri pikice) in tapni <b>Dodaj na začetni zaslon</b> ali <b>Namesti aplikacijo</b>.';
  return `<section class="panel install"><h2>Dodaj Bralnega mentorja na začetni zaslon</h2><p>${how}</p><div class="btns${installEvt ? ' two' : ''}">${installEvt ? '<button class="btn primary" data-act="install">Namesti</button>' : ''}<button class="btn ghost" data-act="install-hide">Skrij</button></div></section>`;
}
// The level reached last time the roster was open. A newer level glows on Today until the roster is opened.
const seenLvl = () => { const v = lsGet('rg-seen-lvl'); return v == null ? null : Number(v); };
const emptyBooks = art => `<section class="panel empty">${art ? KID(0, 168, false, true) : ""}<h2>Tvoja prva knjiga</h2><p>Dodaj knjigo, ki jo bereš. Dovolj je fotografija platnice ali samo naslov.</p><button class="btn primary" data-act="add">Dodaj knjigo</button></section>`;
function vToday() {
  const tot = totalSec(), L = RG.level(tot), st = streakNow(), t = today(), tsec = daySec(t), goal = goalNow(), done = tsec >= goal * 60;
  const reading = S.books.filter(b => b.status === 'reading'), BT = RG.bookTotals(S.sessions);
  const left = L.next != null ? L.next * 3600 - tot : 0, toMark = RG.MARK_EVERY - st.earn;
  const week = Array.from({ length: 7 }, (_, i) => RG.addDays(t, i - 6));
  const fresh = DEMO ? HASH === '#demo-new' : seenLvl() != null && L.i > seenLvl();
  return `${DEMO && !location.hash.includes('&clean') ? '<p class="demo">Vzorčni podatki, nič se ne shrani</p>' : ''}${installCard()}
  <button class="lvl" data-act="tab" data-tab="stats" data-to="ladder" aria-label="${esc(L.name)}, stopnja ${L.i + 1} od ${RG.LEVELS.length}. Odpri pot do razsvetljenja.">
    <span class="kid-wrap${fresh ? ' glow-new' : ''}">${KID(L.i, 132, false, true)}</span>
    <div style="min-width:0"><h1>${esc(L.name)}</h1><p class="meta"><span>Stopnja ${L.i + 1} od ${RG.LEVELS.length}</span><span aria-hidden="true">·</span><span>${tot < 3600 ? fmtMin(tot) : fmtHours(tot)} branja</span>${fresh ? '<span class="chip new">Nova stopnja</span>' : ''}</p>
    ${L.next != null ? `<div class="trackrow"><div class="track"><i style="width:${(L.frac * 100).toFixed(1)}%"></i></div>${KID(L.i + 1, 34, true)}</div><p class="sub">Še <b>${left < 3600 ? Math.ceil(left / 60) + ' min' : fmtHours(left)}</b> do naslednje stopnje: ${esc(L.nextName)}</p>` : '<p class="sub">Vrh poti. Vse stopnje so tvoje.</p>'}</div></button>
  ${S.books.length ? '' : emptyBooks(false)}
  ${Club.todayLine()}
  <section class="panel today">${ring(tsec, goal, 96)}<div><h2>${done ? 'Cilj dosežen' : 'Danes'}</h2><p><b>${fmtMin(tsec)}</b> ${done ? 'branja' : 'od ' + goal + ' min'}</p><p>${done ? 'Dnevni cilj: ' + goal + ' min. Se vidiva jutri.' : 'Še ' + Math.ceil((goal * 60 - tsec) / 60) + ' min'}</p></div></section>
  <section class="panel streak"><div class="marks" role="img" aria-label="Zaznamki: ${st.marks} od ${RG.MARK_MAX}">${[0, 1, 2].map(i => mark(i < st.marks)).join('')}</div>
    <div class="streak-top"><b>${st.cur}</b><span>${plural(st.cur, DAYS)} zapored</span></div>
    <p class="hint">${st.marks >= RG.MARK_MAX ? 'Vsi trije zaznamki so tvoji. Vsak reši niz na prost dan.' : 'Še ' + toMark + ' ' + plural(toMark, DAYS) + ' z doseženim ciljem do novega zaznamka. Zaznamek reši niz na prost dan.'}</p>
    <div class="week">${week.map(k => dayDot(k, st.days[k], k === t)).join('')}</div></section>
  ${reading.length ? `<h2 class="sec">Trenutno berem <span>${reading.length}</span></h2><div class="books">${reading.map(b => bookCard(b, BT[b.id], true)).join('')}</div><button class="add" data-act="add">${IC.plus}Dodaj knjigo</button>`
    : S.books.length ? `<h2 class="sec">Trenutno berem</h2><section class="panel empty"><p>Trenutno ne bereš nobene knjige. Vzemi eno iz Knjig ali dodaj novo.</p><button class="btn primary" data-act="add">Dodaj knjigo</button></section>` : ''}`;
}
function vBooks() {
  const BT = RG.bookTotals(S.sessions), g = st => S.books.filter(b => b.status === st);
  const fin = g('finished').sort((a, b) => (b.done || '').localeCompare(a.done || ''));
  const year = String(new Date().getFullYear()), finYear = fin.filter(b => (b.done || '').startsWith(year)).length;
  const list = (title, arr, play) => arr.length ? `<h2 class="sec">${title} <span>${arr.length}</span></h2><div class="books">${arr.map(b => bookCard(b, BT[b.id], play)).join('')}</div>` : '';
  if (!S.books.length) return `<h1 class="title">Knjige</h1>${emptyBooks(true)}`;
  return `<h1 class="title">Knjige</h1><p class="lede">${fin.length ? fin.length + ' ' + plural(fin.length, ['prebrana', 'prebrani', 'prebrane', 'prebranih']) + ' · ' + finYear + ' v letu ' + year : 'Še nič prebranega'}</p>
  ${list('Trenutno berem', g('reading'), true)}
  <button class="add" data-act="add">${IC.plus}Dodaj knjigo</button>
  <h2 class="sec">Prebrane${fin.length ? ` <span>${fin.length}</span>` : ''}</h2>
  ${fin.length ? `<div class="wall">${fin.map(b => shelfItem(b, BT[b.id])).join('')}</div>` : '<p class="shelf-empty">Prebrane knjige se zbirajo tukaj, platnica za platnico.</p>'}
  ${list('Odložene', g('aside'), false)}`;
}
function weekChart(t, goal) {
  const mon = RG.addDays(t, -((RG.keyDate(t).getDay() + 6) % 7));
  const keys = Array.from({ length: 7 }, (_, i) => RG.addDays(mon, i)), mins = keys.map(k => daySec(k) / 60);
  const lastWeek = Array.from({ length: 7 }, (_, i) => daySec(RG.addDays(mon, i - 7))).reduce((a, b) => a + b, 0);
  const W = 320, H = 150, top = 22, base = 124, CW = 290, max = Math.max(goal, ...mins) * 1.15, y = v => base - (v / max) * (base - top), bw = 24, step = CW / 7;
  const bars = keys.map((k, i) => {
    const x = i * step + (step - bw) / 2, v = mins[i], hit = v >= RG.goalFor(S.goals, k), h = base - y(v);
    return (v > 0 ? `<path d="M${f1(x)} ${base}V${f1(y(v) + 6)}q0-6 6-6h${bw - 12}q6 0 6 6V${base}Z" style="fill:${hit ? 'var(--good)' : 'var(--under)'}"/>${h > 0 ? `<text class="v" x="${f1(x + bw / 2)}" y="${f1(y(v) - 6)}" text-anchor="middle">${Math.round(v)}</text>` : ''}` : '')
      + `<text x="${f1(x + bw / 2)}" y="${base + 18}" text-anchor="middle"${k === t ? ' class="v"' : ''}>${wd(k)}</text>`;
  }).join('');
  return `<section class="panel chart"><div class="head"><h2>Ta teden</h2><span class="muted num" style="font-size:.85rem">${fmtMin(mins.reduce((a, b) => a + b, 0) * 60)} · prejšnji teden ${fmtMin(lastWeek)}</span></div>
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Minute branja po dnevih ta teden"><line x1="0" x2="${CW}" y1="${base}" y2="${base}" style="stroke:var(--line)"/>${bars}<line x1="0" x2="${CW}" y1="${f1(y(goal))}" y2="${f1(y(goal))}" style="stroke:var(--accent);stroke-opacity:.6;stroke-dasharray:4 4"/><text class="g" x="${CW + 5}" y="${f1(y(goal) + 3.5)}">cilj</text></svg>
  <div class="legend"><span><i style="background:var(--good)"></i>cilj dosežen</span><span><i style="background:var(--under)"></i>branje pod ciljem ${goal} min</span></div></section>`;
}
function calendar(st) {
  const t = today(), now = RG.keyDate(t), DT = RG.dayTotals(S.sessions);
  if (!calMonth) calMonth = [now.getFullYear(), now.getMonth()];
  const [y, m] = calMonth, first = new Date(y, m, 1), n = new Date(y, m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
  const cells = ['pon', 'tor', 'sre', 'čet', 'pet', 'sob', 'ned'].map(h => `<span class="h">${h}</span>`);
  for (let i = 0; i < lead; i++) cells.push('<span></span>');
  const past = [];   // the month's days up to today: what the month's numbers count
  for (let d = 1; d <= n; d++) {
    const k = RG.dayKey(new Date(y, m, d)), min = (DT[k] || 0) / 60;
    // a day with no reading at all is marked as such, so the month shows plainly when there was reading and when not
    const s = k > t ? 'future' : st.days[k] || (k === t ? 'today' : '') || (min ? '' : 'zero');
    if (k <= t) past.push(k);
    // minutes under the goal show as a dot that grows with the time read
    const sz = f1(3 + 5 * Math.min(1, min / RG.goalFor(S.goals, k)));
    const dot = s !== 'tick' && s !== 'future' && min > 0 ? `<i style="width:${sz}px;height:${sz}px"></i>` : '';
    cells.push(`<span class="c ${s}"${s === 'tick' || s === 'saved' ? ` style="--r:${tilt(k)}deg"` : ''} title="${esc((STATUS[s] || (s === 'zero' ? 'brez branja' : '')) + (min >= 1 ? (STATUS[s] ? ', ' : '') + Math.round(min) + ' min' : ''))}">${d}${s === 'saved' ? MINI_MARK : ''}${dot}</span>`);
  }
  // the month in numbers: days with reading, total time, goal days and the longest run of goal days (a bookmark day keeps the run going)
  const readDays = past.filter(k => DT[k] > 0).length, total = past.reduce((a, k) => a + (DT[k] || 0), 0), goalDays = past.filter(k => st.days[k] === 'tick').length;
  let best = 0, run = 0;
  for (const k of past) { if (st.days[k] === 'tick') best = Math.max(best, ++run); else if (st.days[k] !== 'saved') run = 0; }
  const atNow = y === now.getFullYear() && m === now.getMonth(), label = first.toLocaleDateString('sl-SI', { month: 'long', year: 'numeric' });
  const stat = (lab, val) => `<div><span>${lab}</span><b>${val}</b></div>`;
  return `<section class="panel" aria-label="Mesec"><div class="cal-head"><button data-act="cal" data-d="-1" aria-label="Prejšnji mesec">${IC.prev}</button><h2>${label.charAt(0).toUpperCase() + label.slice(1)}</h2><button data-act="cal" data-d="1" aria-label="Naslednji mesec"${atNow ? ' disabled' : ''}>${IC.next}</button></div>
  ${past.length ? `<div class="month">${stat('Bralni dnevi', readDays + ' od ' + past.length)}${stat('Skupaj', total ? fmtMin(total) : '–')}${stat('Cilj dosežen', goalDays + ' ' + plural(goalDays, DAYS))}${stat('Najdaljši niz', best + ' ' + plural(best, DAYS))}</div>` : ''}
  <div class="cal">${cells.join('')}</div><div class="legend"><span><i style="background:var(--good-soft); box-shadow:inset 0 0 0 1.5px var(--good)"></i>cilj dosežen</span><span><i style="background:var(--mark-soft); box-shadow:inset 0 0 0 1.5px var(--mark)"></i>rešeno z zaznamkom</span><span><i style="background:var(--under); width:8px; height:8px; border-radius:50%"></i>branje pod ciljem</span><span><i style="box-shadow:inset 0 -1.5px 0 var(--line); border-radius:0"></i>brez branja</span></div></section>`;
}
// The roster of the kid's 18 stages: name plate, hours and a one-line note; stages not reached yet are silhouettes.
function roster(L) {
  const TIERS = ['Bron', 'Srebro', 'Zlato'];
  return `<section class="panel" id="ladder"><div class="head"><h2>Pot do razsvetljenja</h2><span class="muted num" style="font-size:.85rem">stopnja ${L.i + 1} od ${RG.LEVELS.length}</span></div>
  ${TIERS.map((name, tr) => `<div class="tier"><p class="tier-h"><i style="background:var(--tier-${tr + 1})"></i>${name}<small>${RG.LEVELS[tr * 6][0]}–${RG.LEVELS[tr * 6 + 5][0]} h</small></p><div class="roster">${RG.LEVELS.slice(tr * 6, tr * 6 + 6).map((x, j) => {
    const i = tr * 6 + j, now = i === L.i, off = i > L.i;
    return `<div class="cell${now ? ' now' : off ? ' locked' : ''}">${KID(i, 128, off, now)}<b>${esc(x[1])}</b><small>${now ? 'Tukaj si' : off ? 'pri ' + x[0] + ' h' : x[0] + ' h'}</small>${off ? '' : `<em>${esc(RG.LEVELS[i][2])}</em>`}</div>`;
  }).join('')}</div></div>`).join('')}</section>`;
}
function vStats() {
  const tot = totalSec(), st = streakNow(), L = RG.level(tot), t = today(), goal = goalNow(), pr = RG.longestRun(S.sessions);
  const readDays = Object.values(RG.dayTotals(S.sessions)).filter(v => v > 0).length;
  return `<h1 class="title">Napredek</h1>
  <section class="panel board" aria-label="Rekordi">
    <div class="rec"><span>Skupaj prebrano</span><b>${fmtHours(tot)}</b></div>
    <div class="rec"><span>Najdaljši niz</span><b>${st.best} ${plural(st.best, DAYS)}</b></div>
    <div class="rec"><span>Najdaljše branje <span class="chip pr">OR</span></span><b>${pr ? fmtMin(pr) : '–'}</b></div>
    <div class="rec"><span>Povprečen bralni dan</span><b>${readDays ? fmtMin(tot / readDays) : '–'}</b></div>
  </section>
  ${weekChart(t, goal)}
  ${calendar(st)}
  ${roster(L)}
  <section class="panel" style="display:grid; gap:12px"><h2 style="font-size:1.15rem">Dnevni cilj</h2><div class="goal"><button data-act="goal" data-d="-5" aria-label="5 minut manj">${IC.minus}</button><div><b class="num">${goal}</b> <span class="muted">min na dan</span></div><button data-act="goal" data-d="5" aria-label="5 minut več">${IC.plus}</button></div><p class="hint">Nov cilj velja od danes. Prejšnji dnevi obdržijo svoj cilj.</p></section>
  <section class="panel" style="display:grid; gap:6px" aria-label="Štoparica"><h2 style="font-size:1.15rem">Štoparica</h2><button class="switch" role="switch" aria-checked="${countOff()}" data-act="countoff"><span>Štej tudi, ko je zaslon zaklenjen</span><i></i></button><p class="hint" style="margin-top:0">${countOff() ? 'Šteje tudi čas, ko si v drugih aplikacijah; če te ni več kot 20 minut, te ob vrnitvi vpraša, koliko naj šteje.' : 'Med branjem zaslon počrni in telefon ostane buden. Če ga zakleneš ali odpreš drugo aplikacijo, se štetje ustavi.'}</p></section>
  <section class="panel" style="display:grid; gap:12px"><h2 style="font-size:1.15rem">Varnostna kopija</h2><p class="hint" style="margin-top:0">${Club.me() && (Club.enabled() || DEMO) ? 'Branje je shranjeno na tem telefonu in v oblaku. Kopija v datoteki hrani tudi fotografije platnic.' : 'Vse je shranjeno samo na tem telefonu. Občasno shrani varnostno kopijo, da ti z novim telefonom ne bo treba začeti znova.'}</p><div class="btns two"><button class="btn" data-act="export">Shrani kopijo</button><button class="btn" data-act="import">Naloži kopijo</button></div><div id="imp" style="display:grid; gap:10px"></div>${Club.backupBlock()}</section>
  ${Club.profileBlock()}
  <p class="version">Bralni mentor 2, preizkusna različica s prijatelji. Na tem telefonu uporablja iste podatke kot prvi Bralni mentor, zato se branje šteje v obeh.</p>`;
}
function render() {
  if (!S) return;
  $('#view').innerHTML = view === 'books' ? vBooks() : view === 'stats' ? vStats() : view === 'friends' ? Club.view() : vToday();
  if (!DEMO && (view === 'stats' || seenLvl() == null)) lsSet('rg-seen-lvl', String(RG.level(totalSec()).i));
  document.querySelectorAll('#tabs button').forEach(b => { if (b.dataset.tab === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  Club.after();
}

// ---------- sheets: add / edit a book, book details, time by hand
function openSheet(title, body) {
  $('#sheet').innerHTML = `<div class="row"><h2>${esc(title)}</h2><button class="link" data-act="close">Zapri</button></div>${body}`;
  $('#scrim').hidden = false;
}
function closeSheet() { $('#scrim').hidden = true; $('#sheet').innerHTML = ''; pendingCover = null; }
const CAM = '<svg width="40" height="40" viewBox="0 0 24 24" style="fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round"><path d="M4 7.5h3l1.5-2h7L17 7.5h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
function sheetBook(id) {
  const b = id ? bookById(id) : null; pendingCover = null;
  openSheet(b ? 'Uredi knjigo' : 'Dodaj knjigo', `
    <label class="photo" for="f-photo"><span id="f-prev">${b && covers[b.id] ? `<img src="${covers[b.id]}" alt="">` : CAM}</span><span>${b && b.cover ? 'Zamenjaj fotografijo platnice' : 'Fotografiraj platnico'}</span></label>
    <input type="file" id="f-photo" accept="image/*" hidden>
    <label for="f-title">Naslov<input type="text" id="f-title" value="${esc(b ? b.title : '')}" autocomplete="off" enterkeyhint="next"></label>
    <label for="f-author">Avtor (neobvezno)<input type="text" id="f-author" value="${esc(b ? b.author : '')}" autocomplete="off" enterkeyhint="done"></label>
    <p class="err" id="f-err" hidden>Dodaj naslov ali fotografijo platnice.</p>
    <button class="btn primary" data-act="savebook" data-id="${b ? b.id : ''}">${b ? 'Shrani' : 'Dodaj knjigo'}</button>`);
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
  ownBook(book);
  save(); closeSheet(); render(); toast(b ? 'Shranjeno.' : 'Knjiga je dodana. Ko začneš brati, tapni okrogli gumb ob njej.');
}
function sheetDetail(id) {
  const b = bookById(id); if (!b) return;
  const t = RG.bookTotals(S.sessions)[id];
  const facts = [['Čas branja', t ? fmtMin(t.sec) : '0 min'], ['Število branj', t ? t.runs.size : 0], ['Začeta', t ? fmtDay(t.first) : 'Še ne'],
    b.status === 'finished' ? ['Prebrana', fmtDay(b.done)] : ['Zadnjič brana', t ? fmtDay(t.last) : '–']];
  const acts = {
    reading: `<button class="btn primary" data-act="start" data-id="${id}">Začni brati</button><button class="btn" data-act="manual" data-id="${id}">Dodaj čas ročno</button><div class="btns two"><button class="btn" data-act="finishbook" data-id="${id}">Zaključi knjigo</button><button class="btn" data-act="aside" data-id="${id}">Odloži</button></div>`,
    finished: `<button class="btn" data-act="reread" data-id="${id}">Beri znova</button>`,
    aside: `<div class="btns two"><button class="btn primary" data-act="reread" data-id="${id}">Nazaj k branju</button><button class="btn" data-act="finishbook" data-id="${id}">Zaključi knjigo</button></div>`,
  }[b.status];
  openSheet('', `<div class="detail">${cover(b, 84)}<div style="min-width:0; display:grid; gap:6px; justify-items:start"><h2>${esc(bookName(b))}</h2>${b.author ? `<p class="muted">${esc(b.author)}</p>` : ''}<span class="chip st">${{ reading: 'Trenutno berem', finished: 'Prebrana', aside: 'Odložena' }[b.status]}</span></div></div>
    <dl class="facts">${facts.map(f => `<div><dt>${f[0]}</dt><dd>${esc(f[1])}</dd></div>`).join('')}</dl>
    <div class="btns">${acts}<button class="btn ghost" data-act="edit" data-id="${id}">Uredi naslov, avtorja ali platnico</button></div>
    <div class="danger-zone"><button class="del" data-act="delete" data-id="${id}">Izbriši knjigo</button><p class="err" id="del-note" hidden style="text-align:center">Tapni še enkrat, da izbrišeš knjigo${t ? ' in ' + fmtMin(t.sec) + ' branja' : ''}.</p></div>`);
}
function setStatus(id, status) {
  const b = bookById(id); if (!b) return;
  b.status = status; b.done = status === 'finished' ? today() : null;
  ownBook(b);
  save(); closeSheet(); render();
  if (status === 'finished') {
    Club.finished(b);
    const y = String(new Date().getFullYear()), n = S.books.filter(x => x.status === 'finished' && (x.done || '').startsWith(y)).length, t = RG.bookTotals(S.sessions)[id];
    vibrate([80, 60, 160]);
    party(`<div class="hero">${cover(b, 124)}<span class="big-stamp">PREBRANO<small>${esc(fmtDay(b.done))}</small></span>${sparks()}</div><h2>${esc(bookName(b))}</h2><p>To je ${n}. prebrana knjiga v letu ${y}.${t ? ' ' + fmtMin(t.sec) + ' branja.' : ''}</p>`);
  }
}
function deleteBook(id, btn) {
  if (!btn.classList.contains('armed')) { btn.classList.add('armed'); btn.textContent = 'Izbriši za vedno'; $('#del-note').hidden = false; return; }
  ownGone(id); for (const s of S.sessions) if (s.book === id) ownGone(s.id);
  S.books = S.books.filter(b => b.id !== id); S.sessions = S.sessions.filter(s => s.book !== id);
  if (!DEMO) idb.del('cover:' + id).catch(() => {});
  if (covers[id]) { URL.revokeObjectURL(covers[id]); delete covers[id]; }
  save(); closeSheet(); render(); toast('Knjiga je izbrisana.');
}
function sheetManual(id) {
  openSheet('Dodaj čas ročno', `<p class="muted">Za branje brez štoparice. Knjiga: ${esc(bookName(bookById(id)))}.</p>
    <label for="m-min">Minute<input type="number" id="m-min" inputmode="numeric" min="1" max="600" value="20"></label>
    <label for="m-day">Dan<input type="date" id="m-day" value="${today()}" max="${today()}"></label>
    <p class="err" id="m-err" hidden>Vpiši od 1 do 600 minut in dan, ki ni v prihodnosti.</p>
    <button class="btn primary" data-act="savemanual" data-id="${id}">Dodaj</button>`);
}
function saveManual(id) {
  const min = Number($('#m-min').value), day = $('#m-day').value;
  if (!(min >= 1 && min <= 600) || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today()) { $('#m-err').hidden = false; return; }
  const before = snap();
  const x = { id: uid(), run: uid(), book: id, day, sec: Math.round(min * 60), manual: true };
  S.sessions.push(x); ownSession(x);
  save(); closeSheet(); render(); cheer(before, min * 60);
}
function changeGoal(d) {
  const t = today(), min = Math.max(5, Math.min(180, goalNow() + d)), last = S.goals[S.goals.length - 1];
  if (last.from === t) last.min = min; else S.goals.push({ from: t, min });
  save(); render();
}

// ---------- backup (the file keeps app: 'reading-gym', so older and newer backups load either way)
const blobToData = b => new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });
async function exportData() {
  const cov = {};
  for (const b of S.books) if (b.cover && !DEMO) { try { const blob = await idb.get('cover:' + b.id); if (blob) cov[b.id] = await blobToData(blob); } catch (e) {} }
  const file = new File([JSON.stringify({ app: 'reading-gym', v: 1, saved: new Date().toISOString(), state: Object.assign({}, S, { run: null }), covers: cov })], 'bralni-mentor-' + today() + '.json', { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Varnostna kopija Bralnega mentorja' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
async function readImport(file) {
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== 'reading-gym' || !d.state || !Array.isArray(d.state.books) || !Array.isArray(d.state.sessions)) throw new Error('not a backup');
    pendingImport = d;
    const nb = d.state.books.length;
    $('#imp').innerHTML = `<p>Zamenjam vse na tem telefonu s kopijo z dne ${esc(new Date(d.saved).toLocaleString('sl-SI'))}? V njej ${plural(nb, ['je', 'sta', 'so', 'je'])} ${nb} ${plural(nb, BOOKS)} in ${fmtHours(d.state.sessions.reduce((a, s) => a + s.sec, 0))} branja.</p><div class="btns two"><button class="btn primary" data-act="import-yes">Zamenjaj</button><button class="btn" data-act="import-no">Prekliči</button></div>`;
  } catch (e) { toast('Ta datoteka ni varnostna kopija Bralnega mentorja.'); }
  $('#f-import').value = '';
}
async function doImport() {
  const d = pendingImport; if (!d) return;
  pendingImport = null;
  // "replace everything": what isn't in the backup must not come back from the stored state or the journal
  const keepMe = S.me, ids = new Set(d.state.books.map(b => b.id).concat(d.state.sessions.map(s => s.id)));
  for (const x of S.books.concat(S.sessions)) if (!ids.has(x.id)) ownGone(x.id);
  own.s = {}; own.b = {};
  S = Object.assign(fresh(), d.state, { run: null });
  if (!S.me && keepMe) S.me = keepMe;   // a backup from the old version has no friends' profile: keep this one
  for (const [id, url] of Object.entries(d.covers || {})) {
    try { const blob = await (await fetch(url)).blob(); if (!DEMO) await idb.set('cover:' + id, blob); covers[id] = URL.createObjectURL(blob); } catch (e) {}
  }
  save(); render(); toast('Varnostna kopija je naložena.');
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
      else { el.classList.add('armed'); el.textContent = 'Tapni še enkrat, da ga zavržeš'; setTimeout(() => { el.classList.remove('armed'); el.textContent = 'Zavrzi to branje'; }, 4000); }
      break;
    case 'still': if (S.run) { S.run.ok = Date.now(); ask = null; save(); paintReader(); } break;
    case 'unblack': touchAt = Date.now(); if (!DEMO) lsSet('rg-black-tip', '1'); paintReader(); break;
    case 'back-all': settleBack('all'); break;
    case 'back-until': settleBack('until'); break;
    case 'countoff': S.countOff = !countOff(); save(); if (S.run && S.run.at) wake(true); render(); break;
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
    default: if (el.dataset.act.startsWith('fr-')) Club.act(el);
  }
  if (el.dataset.act === 'tab') { Club.poll(view === 'friends'); if (view === 'friends') Club.wake(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[role="button"][data-act]')) e.target.click(); });
$('#scrim').addEventListener('click', e => { if (e.target.id === 'scrim') closeSheet(); });
document.addEventListener('change', async e => {
  if (e.target.id === 'f-photo' && e.target.files[0]) {
    try { pendingCover = await shrink(e.target.files[0]); $('#f-prev').innerHTML = `<img src="${URL.createObjectURL(pendingCover)}" alt="">`; }
    catch (err) { toast('Te fotografije ni bilo mogoče prebrati. Poskusi z drugo.'); }
  }
  if (e.target.id === 'f-import' && e.target.files[0]) readImport(e.target.files[0]);
});
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; render(); });
window.addEventListener('appinstalled', () => { installEvt = null; render(); });

function demoState() {
  const t = today(), books = [
    { id: 'd1', title: 'Alamut', author: 'Vladimir Bartol', added: RG.addDays(t, -40), status: 'reading', done: null, cover: false },
    { id: 'd2', title: 'Na klancu', author: 'Ivan Cankar', added: RG.addDays(t, -20), status: 'reading', done: null, cover: false },
    { id: 'd3', title: 'Martin Krpan', author: 'Fran Levstik', added: RG.addDays(t, -60), status: 'finished', done: RG.addDays(t, -12), cover: false },
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
  if (Club.init()) view = 'friends';   // opened from an invite link
  if (DEMO && view === 'friends') Club.demo(HASH);
  if (DEMO && HASH === '#demo-reader') { const now = Date.now(); S.run = { id: 'dr', book: 'd2', segs: [], at: now - 431e3, ok: now, beat: now, why: null }; }
  if (DEMO && HASH === '#demo-paused') { const now = Date.now(); S.run = { id: 'dr', book: 'd2', segs: [[now - 1500e3, now - 300e3]], at: null, ok: now, beat: now, why: 'left' }; }
  // the return question after 1 h 12 min with the screen off (30 min read before), and after 5 h 12 min (a night)
  if (DEMO && /^#demo-back4?$/.test(HASH)) { const now = Date.now(), off = (HASH === '#demo-back' ? 72 : 312) * 60e3; S.countOff = true; S.run = { id: 'dr', book: 'd2', segs: [], at: now - off - 1800e3, ok: now - off, beat: now - off, hid: now - off, why: null }; }
  if (DEMO && HASH === '#demo-black') { const now = Date.now(); S.run = { id: 'dr', book: 'd2', segs: [], at: now - 431e3, ok: now, beat: now, why: null }; }
  render();
  if (S.run) { showReader(); if (document.visibilityState === 'visible') backInSight(); }
  if (DEMO && HASH === '#demo-black') { touchAt = 0; paintReader(); }
  if (DEMO && HASH === '#demo-detail') sheetDetail('d1');
  if (DEMO && HASH === '#demo-add') sheetBook();
  if (DEMO && HASH === '#demo-level') levelUp(6);
  if (DEMO && HASH === '#demo-finished') setStatus('d1', 'finished');
  if (DEMO && HASH === '#demo-levels') $('#view').innerHTML = `<div class="roster" style="grid-template-columns:repeat(3,minmax(0,1fr))">${RG.LEVELS.map((x, i) => `<div class="cell">${KID(i, 112)}<b>${esc(x[1])}</b><small>${x[0]} h</small></div>`).join('')}</div><div class="roster" style="grid-template-columns:repeat(3,minmax(0,1fr))">${[3, 9, 16].map(i => `<div class="cell locked">${KID(i, 112, true)}<b>${esc(RG.LEVELS[i][1])}</b><small>zaklenjeno</small></div>`).join('')}</div>`;
  // last month's numbers and calendar (a full month of example data)
  if (DEMO && HASH === '#demo-month') { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); calMonth = [d.getFullYear(), d.getMonth()]; view = 'stats'; render();
    // scroll again once web fonts (demo themes) have settled, with a little room above the month
    const go = () => { document.querySelector('[aria-label="Mesec"]').scrollIntoView(); window.scrollBy(0, -14); }; go(); setTimeout(go, 1500); setTimeout(go, 3500); }
  // the timer setting in Napredek
  if (DEMO && HASH === '#demo-timer') { view = 'stats'; render(); const go = () => $('[aria-label="Štoparica"]').scrollIntoView({ block: 'center' }); go(); setTimeout(go, 1500); }
  // levels 1, 4, 7, 10, 13, 16 and 18 side by side, for judging the character as it grows up
  if (DEMO && HASH === '#demo-ages') { document.body.style.background = 'var(--bg)'; document.body.innerHTML = `<div style="display:flex; gap:18px; padding:20px">${[0, 3, 6, 9, 12, 15, 17].map(i => `<figure style="margin:0; display:grid; gap:6px; justify-items:center; font:600 14px var(--font)">${KID(i, 210)}<b style="font:var(--display-w) 15px var(--display)">${esc(RG.LEVELS[i][1])}</b><span style="color:var(--muted)">${RG.LEVELS[i][0]} h</span></figure>`).join('')}</div>`; }
  // the friends' screens: a friend's details, the club settings, the chat
  if (DEMO && HASH === '#demo-member') Club.sheetMember('demoana00000000a');
  if (DEMO && HASH === '#demo-club') Club.sheetSettings();
  if (DEMO && HASH === '#demo-chat') { const go = () => document.getElementById('fr-chat').scrollIntoView(); go(); setTimeout(go, 1500); }
  if (DEMO && HASH === '#demo-today-club') { Club.demo('#demo-friends'); view = 'today'; render(); }
  if (DEMO && HASH === '#demo-backup') { Club.demo('#demo-friends'); view = 'stats'; render(); const go = () => window.scrollTo(0, document.body.scrollHeight); go(); setTimeout(go, 1500); }
  Club.poll(view === 'friends'); Club.wake();
  let day = today();
  setInterval(() => { if (today() !== day) { day = today(); render(); } }, 60e3);
  // updates: look for a new version every time the app comes back to the screen (a home-screen app often resumes without
  // reloading) and switch to it at once, unless the timer is running; then right after the reading is saved or thrown away
  if (!DEMO && 'serviceWorker' in navigator && location.protocol === 'https:') {
    // On the first visit the first version's worker (one folder up) may be in charge; this version's own taking over is not an update.
    const hadCtrl = !!(navigator.serviceWorker.controller && /\/v2\/sw\.js$/.test(navigator.serviceWorker.controller.scriptURL));
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadCtrl) return; if (S && S.run) reloadAfterRun = true; else location.reload(); });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => { swReg = r; }).catch(() => {});
  }
  if (!DEMO && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
})();
