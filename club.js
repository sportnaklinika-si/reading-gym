/* Bralni mentor 2: friends. Everyone has a personal code; entering a friend's code (or opening their link) makes the two
   of you friends. Each person sees a weekly leaderboard of themselves and their friends (points for reading days, core.js
   RULES A) and a feed of their own and their friends' posts and reading moments, with comments and bravos.
   The server is server/schema.sql (Postgres + PostgREST on our own server, see server/self-host/); its address is in config.js.
   Uses app.js (S, save, render, toast, the Slovene helpers), which is loaded after this file. */
'use strict';
const Club = (() => {
  const CFG = window.BM_SERVER || {};
  let API = (CFG.url || '').replace(/\/$/, ''), KEY = CFG.key || '';
  const enabled = () => !!API;
  const POLL_MS = 15e3, RULE = 'A';

  // ---------- talking to the server
  let online = true;
  async function rpc(fn, args) {
    const h = { 'Content-Type': 'application/json' };
    if (KEY) { h.apikey = KEY; if (KEY.startsWith('eyJ')) h.Authorization = 'Bearer ' + KEY; }
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12e3);
    try {
      const r = await fetch(API + '/rpc/' + fn, { method: 'POST', headers: h, body: JSON.stringify(args || {}), signal: ctl.signal });
      const txt = await r.text(); let d = null; try { d = txt ? JSON.parse(txt) : null; } catch (e) {}
      if (!r.ok) { const e = new Error((d && d.message) || 'http ' + r.status); e.code = d && /^bm:/.test(d.message || '') ? d.message.slice(3) : 'server'; throw e; }
      online = true; return d;
    } catch (e) { if (!e.code) { e.code = 'net'; online = false; } throw e; }
    finally { clearTimeout(t); }
  }
  const ERR = {
    auth: 'Tvojega profila na strežniku ni več. Vpiši ime in začni znova.',
    nocode: 'Te kode ni. Preveri jo in poskusi znova.',
    self: 'To je tvoja koda. Vpiši kodo prijatelja.',
    limit: 'Prijateljev je lahko največ 100.',
    name: 'Ime naj ima od 1 do 24 znakov.',
    slow: 'Preveč poskusov. Poskusi znova pozneje.',
    gone: 'To sporočilo je bilo izbrisano.',
    net: 'Ni povezave. Poskusi znova, ko boš na spletu.',
  };
  const errText = e => ERR[e && e.code] || 'Nekaj je šlo narobe na strežniku. Poskusi znova.';

  // ---------- who I am: an id and a secret key made up by this phone, kept in the state (so backups carry them) and on their own
  const ALPHA = 'abcdefghijklmnopqrstuvwxyz0123456789', B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const rand = (n, a) => Array.from(crypto.getRandomValues(new Uint8Array(n)), x => a[x % a.length]).join('');
  const me = () => (S && S.me && S.me.id && S.me.key ? S.me : null);
  const auth = () => ({ p_id: S.me.id, p_key: S.me.key });
  let draftMe = null;   // made up before the first answer from the server, kept for a retry
  function keepMe() { if (!DEMO && S.me) { idb.set('bm2-me', S.me).catch(() => {}); } }
  // the transfer code moves the profile (and the cloud backup) to a new phone
  const codeOf = m => 'BM2-' + m.id + '-' + m.key;
  const parseCode = s => { const m = String(s || '').trim().match(/^BM2-([a-z0-9]{16})-([A-Za-z0-9_-]{24,100})$/); return m ? { id: m[1], key: m[2] } : null; };
  // a friend code: 8 characters, shown as two groups of four
  const normCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const fmtCode = c => (c ? c.slice(0, 4) + ' ' + c.slice(4) : '');

  // ---------- what the screens show (kept in localStorage so the board shows at once and offline)
  const EMPTY = () => ({ info: null, board: null, feed: [] });
  let cache = EMPTY();
  const keepCache = () => { if (!DEMO) lsSet('bm2-cache', JSON.stringify(cache)); };
  let ui = { step: 'start', mode: 'week', busy: false, err: '', invite: null, peek: null, reply: null, more: false, armed: null };
  let draft = '';
  const seen = () => Number(lsGet('bm2-seen')) || 0;
  const markSeen = last => { if (!DEMO && last && seen() < last) lsSet('bm2-seen', String(last)); };
  const unread = () => !!(cache.info && cache.info.last && cache.info.last > seen());
  const friendsN = () => (cache.board && cache.board.members ? cache.board.members.length - 1 : (cache.info && cache.info.friends) || 0);

  // ---------- what friends see about me
  function currentTitle() {
    if (S.run) return bookName(bookById(S.run.book));
    const reading = S.books.filter(b => b.status === 'reading'); if (!reading.length) return null;
    const BT = RG.bookTotals(S.sessions);
    reading.sort((a, b) => ((BT[b.id] && BT[b.id].last) || b.added || '').localeCompare((BT[a.id] && BT[a.id].last) || a.added || ''));
    return bookName(reading[0]);
  }
  const shareTitle = () => S.shareTitle !== false;
  function myStats() {
    const t = today(), tot = totalSec(), L = RG.level(tot), st = streakNow(), DT = RG.dayTotals(S.sessions);
    const from = RG.addDays(RG.weekStart(t), -14), days = {}; let first = null;
    for (const k of Object.keys(DT)) { if (DT[k] <= 0) continue; if (!first || k < first) first = k; if (k >= from) days[k] = Math.round(DT[k]); }
    const since = [first, S.me && S.me.since].filter(Boolean).sort()[0] || t;
    const fin = S.books.filter(b => b.status === 'finished'), y = t.slice(0, 4);
    return { v: 1, at: new Date().toISOString(), day: t, total: Math.round(tot), level: L.i, streak: st.cur, best: st.best, goal: goalNow(),
      finished: fin.length, year: fin.filter(b => (b.done || '').startsWith(y)).length, reading: shareTitle() ? currentTitle() : null,
      run: S.run && S.run.at ? S.run.at : 0, days, since, shelf: shareTitle() ? 1 : 0 };
  }
  // my bookshelf for my friends' view of my profile (null when I don't share my books)
  const lastRead = () => { const BT = RG.bookTotals(S.sessions), L = {}; for (const id of Object.keys(BT)) L[id] = BT[id].last; return L; };
  const myShelf = () => (shareTitle() ? RG.shelfOf(S.books, lastRead()) : null);

  // ---------- sync: after every change (a few seconds later) and when the app opens, send my stats; then the cloud backup
  let syncT = null, lastSent = '', lastSync = 0;
  function changed() { if (!me() || !enabled() || DEMO) return; clearTimeout(syncT); syncT = setTimeout(sync, 2500); }
  function useInfo(r) {
    if (!r) return;
    cache.info = r; keepCache();
    if (r.name && S.me && S.me.name !== r.name) { S.me.name = r.name; save(); keepMe(); }
  }
  async function sync() {
    if (!me() || !enabled() || DEMO) return;
    clearTimeout(syncT);
    const st = myStats(), sig = JSON.stringify(Object.assign({}, st, { at: 0 }));
    try {
      const r = await rpc('bm_sync', Object.assign(auth(), { p_stats: sig === lastSent ? null : st }));
      lastSent = sig; lastSync = Date.now();
      const before = JSON.stringify(cache.info); useInfo(r);
      paintDot(); if (view === 'friends' && before !== JSON.stringify(cache.info)) render();
      shelfPut(); backup();
    } catch (e) { if (e.code === 'auth') lost(); }
  }
  // the bookshelf goes up only when it changed (a new book, a rating, a favourite, sharing switched on or off)
  async function shelfPut() {
    const d = myShelf(), sig = (d ? hash(JSON.stringify(d)) : 'none') + S.me.id;
    if (lsGet('bm2-shelf-sig') === sig) return;
    try { await rpc('bm_shelf_put', Object.assign(auth(), { p_shelf: d })); lsSet('bm2-shelf-sig', sig); } catch (e) {}
  }
  // the whole reading log (no cover photos) in the cloud, for a new phone; only when something changed
  const hash = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) >>> 0; return s.length + '.' + h; };
  function logOnly() { const d = JSON.parse(JSON.stringify(S)); d.run = null; delete d.me; return d; }
  async function backup() {
    if (!me() || !enabled() || DEMO) return;
    const d = logOnly(), sig = hash(JSON.stringify(d));
    if (lsGet('bm2-backup-sig') === sig + S.me.id) return;
    try { const r = await rpc('bm_backup_put', Object.assign(auth(), { p_data: Object.assign({ app: 'reading-gym', saved: new Date().toISOString() }, d) })); lsSet('bm2-backup-sig', sig + S.me.id); lsSet('bm2-backup-at', r.at); }
    catch (e) {}
  }
  function lost() { S.me = null; save(); if (!DEMO) idb.del('bm2-me').catch(() => {}); cache = EMPTY(); keepCache(); toast(ERR.auth); render(); }

  // moments worth a bravo, posted for my friends (the server posts each one once)
  function event(body) {
    if (!me() || !enabled() || DEMO) return;
    rpc('bm_event', Object.assign(auth(), { p_body: body })).catch(() => {});
  }
  const STREAKS = [7, 14, 21, 30, 50, 75, 100, 150, 200, 300, 365, 500, 1000];
  // called by app.js after a reading is saved, with the numbers before and after
  function moments(b, a) {
    if (a.lvl > b.lvl) event({ t: 'level', v: a.lvl });
    for (const n of STREAKS) if (b.cur < n && a.cur >= n) event({ t: 'streak', v: n, d: today() });
  }
  function finished(book) {
    const e = { t: 'book', v: bookName(book).slice(0, 120), d: today() };
    if (shareTitle() && book.rate >= 1 && book.rate <= 5) e.r = Math.round(book.rate);
    if (shareTitle() && book.fav) e.f = 1;
    event(e);
  }

  // ---------- the board and the feed (polled every 15 s while the screen is open)
  let pollT = null;
  async function refresh(full) {
    if (!me() || !enabled() || DEMO) return;
    try {
      const [b, f] = await Promise.all([rpc('bm_board', auth()), rpc('bm_feed', auth())]);
      const before = JSON.stringify([cache.board, cache.feed]);
      cache.board = b; cache.feed = mergeFeed(cache.feed, f, !!ui.more);
      if (cache.info) { cache.info.last = b.last; cache.info.friends = b.members.length - 1; }
      keepCache();
      if (view === 'friends' && document.visibilityState === 'visible') markSeen(b.last);
      paintDot();
      if (full || before !== JSON.stringify([cache.board, cache.feed])) { if (view === 'friends') render(); }
    } catch (e) {
      if (e.code === 'auth') lost();
      else if (full && view === 'friends') render();
    }
  }
  // newest 60 from the server; older pages the reader opened stay
  function mergeFeed(old, fresh, keepOld) {
    if (!keepOld || !old || !old.length || !fresh.length) return fresh;
    const first = fresh[0].id; return old.filter(m => m.id < first).concat(fresh);
  }
  async function older() {
    const f = cache.feed || []; if (!f.length) return;
    try { const o = await rpc('bm_feed', Object.assign(auth(), { p_before: f[0].id })); ui.more = o.length ? true : 'end'; cache.feed = o.concat(f); keepCache(); render(); }
    catch (e) { toast(errText(e)); }
  }
  function poll(onScreen) {
    clearInterval(pollT); pollT = null;
    if (!onScreen || !me() || !enabled() || DEMO) return;
    pollT = setInterval(() => { if (document.visibilityState === 'visible' && view === 'friends') refresh(); }, POLL_MS);
  }

  // ---------- points
  // a friend's stats come from their phone through the server: keep only well-formed numbers, dates and a short title
  const isDay = k => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
  const num = (x, max) => { x = Math.floor(Number(x)); return Number.isFinite(x) && x >= 0 ? Math.min(x, max) : 0; };
  function clean(s) {
    s = s && typeof s === 'object' && !Array.isArray(s) ? s : {};
    const days = {};
    if (s.days && typeof s.days === 'object') for (const k of Object.keys(s.days)) if (isDay(k)) days[k] = num(s.days[k], 86400);
    return { total: num(s.total, 1e9), level: Math.min(num(s.level, 99), RG.LEVELS.length - 1), streak: num(s.streak, 1e5), best: num(s.best, 1e5),
      year: num(s.year, 1e4), finished: num(s.finished, 1e5), goal: num(s.goal, 1000), reading: typeof s.reading === 'string' ? s.reading.slice(0, 120) : null,
      run: num(s.run, 1e14), at: typeof s.at === 'string' ? s.at : null, days, since: isDay(s.since) ? s.since : null,
      shelf: s.shelf === 1 ? 1 : s.shelf === 0 ? 0 : null };   // null: an older app that doesn't send its books yet
  }
  const isMe = id => !!(S.me && id === S.me.id);
  const statsOf = m => (isMe(m.id) ? myStats() : clean(m.stats));
  const members = () => (cache.board && cache.board.members) || [];
  const nameOf = id => { const x = members().find(y => y.id === id); return x ? x.name : ''; };
  function standings(list, week) {
    const t = today();
    return list.map(m => { const s = statsOf(m); return { m, s, P: RG.weekPoints(RULE, s.days || {}, s.since || null, t, week) }; });
  }
  // last week's winner among me and the friends I had by its Sunday (at least two of us)
  function lastWeek() {
    if (!members().length) return null;
    const mon = RG.addDays(RG.weekStart(today()), -7), sun = RG.addDays(mon, 6);
    const there = members().filter(m => m.since && RG.dayKey(new Date(m.since)) <= sun);
    if (there.length < 2) return null;
    const list = standings(there, mon), best = Math.max(...list.map(x => x.P.total));
    if (!(best > 0)) return null;
    const win = list.filter(x => x.P.total === best);
    return { mon, pts: best, ids: win.map(x => x.m.id), names: win.map(x => x.m.name) };
  }
  // 1, 1, 3: the same score shares a place
  function ranked(list, key) {
    list.sort((a, b) => key(b) - key(a) || a.m.name.localeCompare(b.m.name, 'sl'));
    let place = 0, prev = null;
    list.forEach((x, i) => { const v = key(x); if (v !== prev) { place = i + 1; prev = v; } x.place = place; });
    return list;
  }

  // ---------- words
  const PTS = ['točka', 'točki', 'točke', 'točk'], FRIENDS = ['prijatelj', 'prijatelja', 'prijatelji', 'prijateljev'];
  const signed = n => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
  const ago = iso => {
    const d = new Date(iso), k = RG.dayKey(d), t = today(), hm = d.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' });
    return k === t ? hm : k === RG.addDays(t, -1) ? 'včeraj ' + hm : d.getDate() + '. ' + (d.getMonth() + 1) + '. ' + hm;
  };
  const weekLabel = mon => { const a = RG.keyDate(mon), b = RG.keyDate(RG.addDays(mon, 6)); return a.getMonth() === b.getMonth() ? a.getDate() + '.–' + b.getDate() + '. ' + b.toLocaleDateString('sl-SI', { month: 'long' }) : a.getDate() + '. ' + (a.getMonth() + 1) + '. – ' + b.getDate() + '. ' + (b.getMonth() + 1) + '.'; };
  function ruleLines(r) {
    const R = RG.RULES[r] || RG.RULES.A, L = [];
    if (R.day) L.push(['Bralni dan, vsaj ' + R.min + ' min', signed(R.day)]);
    if (R.per) L.push([R.per === 1 ? 'Vsaka minuta branja' : 'Vsakih ' + R.per + ' min branja', '+1' + (R.cap ? ', največ ' + R.cap + ' na dan' : '')]);
    L.push(['Dan brez branja', signed(R.miss)]);
    L.push(['Vseh 7 dni v tednu' + (R.day ? '' : ' (vsaj ' + R.min + ' min)'), signed(R.week)]);
    return L;
  }
  const GONE = 'Izbrisan profil';
  // events are small JSON objects; names go first, verbs in the present tense (no he/she forms needed)
  function eventText(m) {
    // posted by other phones: every field is checked before it is shown
    let e = {}; try { e = JSON.parse(m.body) || {}; } catch (x) {}
    if (!e || typeof e !== 'object') return null;
    const n = '<b>' + esc(m.name || GONE) + '</b>', v = Math.floor(Number(e.v)), ok = Number.isFinite(v) && v >= 0;
    switch (e.t) {
      case 'book': {
        if (typeof e.v !== 'string') return null;
        const r = Math.round(Number(e.r)), rated = r >= 1 && r <= 5;
        return [n + ' konča knjigo <i>' + esc(e.v.slice(0, 120)) + '</i>.' + (rated || e.f ? '<span class="ev-rate">' + (rated ? starsView(r) : '') + (e.f ? favMark(true) : '') + '</span>' : ''), 'book'];
      }
      case 'level': return ok && v < RG.LEVELS.length ? [n + ' napreduje na stopnjo <i>' + esc(RG.LEVELS[v][1]) + '</i>.', 'level', v] : null;
      case 'streak': return ok ? [n + ' bere že ' + v + ' ' + plural(v, DAYS) + ' zapored.', 'streak'] : null;
    }
    return null;
  }

  // ---------- drawing bits
  const SV = (p, extra) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"${extra || ''}>${p}</svg>`;
  const ICF = {
    more: SV('<circle cx="5" cy="12" r="1.6" style="fill:currentColor;stroke:none"/><circle cx="12" cy="12" r="1.6" style="fill:currentColor;stroke:none"/><circle cx="19" cy="12" r="1.6" style="fill:currentColor;stroke:none"/>'),
    send: SV('<path d="M4.5 12h11M11 6.5l5.5 5.5-5.5 5.5"/>'),
    crown: '<svg class="crown" viewBox="0 0 20 14" aria-label="zmaga prejšnjega tedna" role="img"><path d="M1.5 12.5h17l1-9-5 4-4.5-6.5L5.5 7.5l-5-4z" style="fill:var(--tier-3)"/></svg>',
    share: SV('<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 13v6h14v-6"/>'),
    add: SV('<circle cx="10" cy="8.5" r="3.5"/><path d="M3.5 19a6.5 6.5 0 0113 0M18.5 8v6M15.5 11h6"/>'),
    reply: SV('<path d="M9.5 7L4.5 12l5 5M5 12h9a5 5 0 015 5v1"/>'),
    star: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.8l2.4 5.3 5.8.6-4.3 3.9 1.2 5.7L10 14.4l-5.1 2.9 1.2-5.7L1.8 7.7l5.8-.6z" style="fill:currentColor"/></svg>',
  };
  const EV_IC = {
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" style="fill:var(--mark-soft)"/><path d="M7 7.5h6.5a2.5 2.5 0 012.5 2.5v7H9.5A2.5 2.5 0 017 14.5z" style="fill:var(--mark)"/></svg>',
    streak: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" style="fill:var(--good-soft)"/><path d="M8 12.5l2.7 2.7L16.5 9" style="fill:none;stroke:var(--good);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round"/></svg>',
  };
  const KIDS3 = () => `<div class="fr-trio" aria-hidden="true">${[2, 9, 15].map(i => KID(i, 92)).join('')}</div>`;
  const live = s => s && s.run && Date.now() - s.run < 3 * 3600e3 && s.at && Date.now() - Date.parse(s.at) < 3 * 3600e3;
  // the seven days of the week as small slots: green reading day, a dot for a short day, a dash for a day without reading
  const miniWeek = P => `<span class="fr-wk" aria-hidden="true">${P.days.map(d => `<i class="${d.kind}"></i>`).join('')}</span>`;

  // ---------- screens
  const form = (inner) => `<div class="fr-form">${inner}${ui.err ? `<p class="err">${esc(ui.err)}</p>` : ''}</div>`;
  const nameField = (v) => `<label for="fr-name">Tvoje ime (vidijo ga prijatelji)<input type="text" id="fr-name" maxlength="24" autocomplete="nickname" enterkeyhint="done" value="${esc(ui.nameVal != null ? ui.nameVal : v || '')}"></label>`;
  const PRIVACY = 'Prijatelji vidijo tvoje ime, stopnjo, koliko bereš po dnevih in tvoje knjige: kaj bereš zdaj, prebrane knjige z ocenami in najljubše (knjige lahko skriješ).';
  const peekName = () => (ui.peek && ui.peek.name) || '';

  function vOff() {
    return `<h1 class="title">Prijatelji</h1><p class="lede">Bralni prijatelji: tedenska lestvica, točke za vsak bralni dan in komentarji.</p>
    <section class="panel empty">${KIDS3()}<h2>Kmalu</h2><p>Strežnik za prijatelje še ni vklopljen. Vse ostalo deluje kot prej.</p></section>`;
  }
  // no profile yet: an invite from a friend, or the start
  function vStart() {
    const inv = ui.invite, ios = isIOS && !standalone();
    if (ui.step === 'restore') return `<h1 class="title">Prenos s starega telefona</h1><p class="lede">Na starem telefonu odpri Napredek → Varnostna kopija → Koda za prenos in jo prepiši ali prilepi sem.</p>
      ${form(`<label for="fr-transfer">Koda za prenos<input type="text" id="fr-transfer" autocomplete="off" spellcheck="false" placeholder="BM2-…"></label><button class="btn primary" data-act="fr-restore"${ui.busy ? ' disabled' : ''}>Prenesi</button><button class="link" data-act="fr-step" data-step="start">Nazaj</button>`)}`;
    const head = `<h1 class="title">Prijatelji</h1><p class="lede">Berite skupaj: tedenska lestvica, točke za vsak bralni dan in komentarji za pohvale.</p>`;
    if (inv) {
      const n = peekName();
      return `${head}<section class="panel fr-invite">${KIDS3()}<h2>${n ? esc(n) + ' te vabi med bralne prijatelje' : 'Vabilo med bralne prijatelje'}</h2><p class="muted">koda <b class="code">${esc(fmtCode(inv))}</b></p>
        ${ios ? '<p class="hint">Na iPhonu najprej dodaj Bralnega mentorja na začetni zaslon (Deli → Dodaj na začetni zaslon), ga odpri tam in vpiši to kodo. Brskalnik in aplikacija hranita ločene podatke.</p>' : ''}</section>
        ${form(`${nameField('')}<button class="btn primary" data-act="fr-start"${ui.busy ? ' disabled' : ''}>Sprejmi vabilo</button><button class="link" data-act="fr-noinvite">Ne, hvala</button>`)}
        <p class="hint">${PRIVACY}</p>`;
    }
    return `${head}<section class="panel empty">${KIDS3()}<h2>Bralni prijatelji</h2><p>Vpiši ime in dobiš svojo kodo. Pošlji jo prijateljem ali vpiši njihovo, pa ste prijatelji.</p>
      ${form(`${nameField('')}<button class="btn primary" data-act="fr-start"${ui.busy ? ' disabled' : ''}>Začni</button>`)}</section>
      <section class="panel fr-how"><h2>Kako gre</h2><ol><li>Vsak bere s svojim Bralnim mentorjem kot doslej.</li><li>Za vsak bralni dan dobiš točke, za dan brez branja jih nekaj izgubiš. Ob ponedeljkih se začne nov teden.</li><li>Vidiš lestvico s svojimi prijatelji, njihove prebrane knjige in nize. Pohvališ jih z Bravo ali s komentarjem.</li></ol><p class="hint">${PRIVACY}</p>
      <button class="link" data-act="fr-step" data-step="restore">Imaš kodo za prenos s starega telefona?</button></section>`;
  }

  function vMain() {
    const t = today(), mon = RG.weekStart(t), R = RG.RULES[RULE], n = friendsN(), code = cache.info && cache.info.code;
    const inv = ui.invite && code !== ui.invite ? `<section class="panel fr-invite">${KIDS3()}<h2>${peekName() ? esc(peekName()) + ' te vabi med prijatelje' : 'Vabilo med prijatelje'}</h2><p class="muted">koda <b class="code">${esc(fmtCode(ui.invite))}</b></p>
      ${ui.err ? `<p class="err">${esc(ui.err)}</p>` : ''}<div class="btns" style="width:100%"><button class="btn primary" data-act="fr-add" data-code="${esc(ui.invite)}"${ui.busy ? ' disabled' : ''}>Dodaj med prijatelje</button><button class="link" data-act="fr-noinvite">Ne, hvala</button></div></section>` : '';
    let board = '<p class="muted fr-wait">Nalagam lestvico …</p>';
    if (cache.board && cache.board.members) {
      const win = lastWeek(), crown = id => win && win.ids.includes(id), list = standings(members());
      const rows = ui.mode === 'all' ? ranked(list, x => x.s.total || 0) : ranked(list, x => x.P.total * 1e4 + x.P.minutes);
      board = `<div class="fr-board">${rows.map(x => {
        const s = x.s, mine = isMe(x.m.id), L = RG.LEVELS[s.level || 0] ? s.level || 0 : 0;
        const right = ui.mode === 'all' ? `<b>${fmtHours(s.total || 0)}</b><small>skupaj</small>` : `<b>${x.P.total < 0 ? '−' + Math.abs(x.P.total) : x.P.total}</b><small>${plural(Math.abs(x.P.total), PTS)}</small>`;
        const sub = ui.mode === 'all' ? `<span class="fr-sub">${esc(RG.LEVELS[L][1])} · ${s.year || 0} ${plural(s.year || 0, ['knjiga', 'knjigi', 'knjige', 'knjig'])} letos</span>` : `${miniWeek(x.P)}<span class="fr-sub">${fmtMin(x.P.minutes * 60)}</span>`;
        return `<button class="fr-row${mine ? ' me' : ''}" data-act="fr-member" data-id="${esc(x.m.id)}"><span class="fr-place">${x.place}</span><span class="fr-kid">${KID(L, 52)}</span>
          <span class="fr-main"><span class="fr-name"><b>${esc(x.m.name)}</b>${mine ? '<small>ti</small>' : ''}${crown(x.m.id) ? ICF.crown : ''}${live(s) ? '<span class="chip live"><i></i>bere</span>' : ''}</span>${sub}</span>
          <span class="fr-pts">${right}</span></button>`;
      }).join('')}</div>
      ${win ? `<p class="fr-win">${ICF.crown}<span>Zmaga prejšnjega tedna: <b>${esc(win.names.join(', '))}</b> · ${win.pts} ${plural(win.pts, PTS)}</span></p>` : ''}`;
    } else if (!online) board = `<p class="muted fr-wait">${ERR.net}</p>`;
    const alone = cache.board && n === 0 ? `<section class="panel fr-alone"><h2>Dodaj prijatelje</h2><p class="muted">Pošlji jim svojo povezavo ali vpiši njihovo kodo. Ko ste prijatelji, se tu pokaže vaša lestvica.</p>
      <p class="bigcode">${esc(fmtCode(code))}</p><div class="btns two"><button class="btn primary" data-act="fr-share">Pošlji povezavo</button><button class="btn" data-act="fr-addsheet">Vpiši kodo</button></div></section>` : '';
    return `${inv}<div class="fr-head"><div style="min-width:0"><h1 class="title">Prijatelji</h1><p class="lede">${n ? n + ' ' + plural(n, FRIENDS) + ' · ' : ''}točke za vsak bralni dan</p></div><button class="iconbtn" data-act="fr-settings" aria-label="Nastavitve">${ICF.more}</button></div>
    ${alone}
    <section class="panel fr-top">
      <div class="seg" role="tablist"><button role="tab" aria-selected="${ui.mode === 'week'}" data-act="fr-mode" data-mode="week">Ta teden</button><button role="tab" aria-selected="${ui.mode === 'all'}" data-act="fr-mode" data-mode="all">Skupaj</button></div>
      <p class="fr-range">${ui.mode === 'week' ? 'Teden ' + esc(weekLabel(mon)) + ' · točke' : 'Ves čas branja z Bralnim mentorjem'}</p>
      ${board}
      <details class="fr-rules"><summary>Kako se zbirajo točke</summary><p class="hint">${esc(R.note)}</p><dl>${ruleLines(RULE).map(l => `<div><dt>${esc(l[0])}</dt><dd>${esc(l[1])}</dd></div>`).join('')}</dl><p class="hint">Branje, krajše od ${R.min} min, ${R.per ? 'prinese samo točke za minute' : 'ne prinese točk'}, a tudi nič ne odvzame. Današnji dan ne odvzame točk, dokler se ne konča. Nov teden se začne v ponedeljek.</p></details>
      ${n ? `<button class="btn" data-act="fr-addsheet">${ICF.add}Dodaj prijatelja</button>` : ''}
    </section>
    ${chat()}`;
  }

  function chat() {
    const f = cache.feed || [], byId = {}; f.forEach(m => { byId[m.id] = m; });
    const one = m => {
      const mineMsg = isMe(m.who), n = (m.bravo || []).length, on = (m.bravo || []).includes(S.me.id);
      const names = (m.bravo || []).map(nameOf).filter(Boolean).join(', ');
      const bravo = `<button class="bravo${on ? ' on' : ''}" data-act="fr-bravo" data-id="${m.id}" aria-pressed="${on}" title="${esc(names)}">${ICF.star}<span>Bravo${n ? ' ' + n : ''}</span></button>`;
      const reply = `<button class="re-btn" data-act="fr-reply" data-id="${m.id}" aria-label="Komentiraj">${ICF.reply}</button>`;
      const del = mineMsg || (isMe(m.owner) && m.kind === 'msg') ? `<button class="del-msg${ui.armed === m.id ? ' armed' : ''}" data-act="fr-unsay" data-id="${m.id}">${ui.armed === m.id ? 'Izbriši za vedno' : 'Izbriši'}</button>` : '';
      if (m.kind === 'event') {
        const e = eventText(m); if (!e) return '';
        return `<div class="ev" data-kind="${e[1]}">${e[1] === 'level' ? `<span class="ev-kid">${KID(e[2], 34)}</span>` : EV_IC[e[1]] || ''}<p>${e[0]}<time>${ago(m.at)}</time></p><div class="msg-acts">${bravo}${reply}</div></div>`;
      }
      const q = m.re ? byId[m.re] : null, qt = q ? (q.kind === 'event' ? ((eventText(q) || [''])[0].replace(/<[^>]+>/g, '')) : (q.name ? q.name + ': ' : '') + q.body) : m.re ? 'Starejše sporočilo' : '';
      return `<div class="msg${mineMsg ? ' mine' : ''}">${m.re ? `<p class="quote">${esc(qt.length > 90 ? qt.slice(0, 88) + '…' : qt)}</p>` : ''}<p class="msg-h"><b>${esc(m.name || GONE)}</b><time>${ago(m.at)}</time></p><p class="msg-b">${esc(m.body)}</p><div class="msg-acts">${bravo}${reply}${del}</div></div>`;
    };
    const rq = ui.reply ? byId[ui.reply] : null, rqt = rq ? (rq.kind === 'event' ? ((eventText(rq) || [''])[0].replace(/<[^>]+>/g, '')) : (rq.name || '') + ': ' + rq.body) : '';
    return `<section class="panel fr-chat" id="fr-chat"><div class="head"><h2>Klepet</h2><span class="muted" style="font-size:.85rem">pohvale, priporočila, izzivi</span></div>
      ${f.length && ui.more !== 'end' && f.length >= 60 ? '<button class="link" data-act="fr-older">Starejša sporočila</button>' : ''}
      <div class="feed">${f.length ? f.map(one).join('') : `<p class="muted">${friendsN() ? 'Še tiho. Pohvali koga ali povej, kaj bereš.' : 'Tu bodo sporočila, prebrane knjige in nizi tvojih prijateljev.'}</p>`}</div>
      ${rq ? `<div class="replying"><span>Komentar na: ${esc(rqt.length > 70 ? rqt.slice(0, 68) + '…' : rqt)}</span><button class="link" data-act="fr-reply" data-id="">Prekliči</button></div>` : ''}
      <div class="compose"><textarea id="fr-text" rows="1" maxlength="500" placeholder="${rq ? 'Tvoj komentar …' : 'Napiši prijateljem …'}" aria-label="Sporočilo">${esc(draft)}</textarea><button class="send" data-act="fr-send" aria-label="Pošlji">${ICF.send}</button></div>
      <p class="hint" style="margin:0">Sporočila vidijo tvoji prijatelji. Komentar vidijo vsi, ki vidijo sporočilo, na katero odgovarjaš.</p>
    </section>`;
  }

  function view_() {
    if (!enabled() && !DEMO) return vOff();
    return me() && ui.step !== 'restore' ? vMain() : vStart();
  }

  // after each render: keep what's typed and where the cursor was; mark the chat read
  let hadFocus = false;
  function after() {
    const ta = $('#fr-text');
    if (ta) {
      ta.value = draft; grow(ta);
      if (hadFocus) { ta.focus(); try { ta.setSelectionRange(draft.length, draft.length); } catch (e) {} }
    }
    if (view === 'friends' && cache.board) markSeen(cache.board.last);
    paintDot();
  }
  const grow = ta => { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight + 2) + 'px'; ta.style.overflowY = ta.scrollHeight > 158 ? 'auto' : 'hidden'; };
  document.addEventListener('input', e => {
    if (e.target.id === 'fr-text') { draft = e.target.value; grow(e.target); }
    if (e.target.id === 'fr-code') {
      const v = normCode(e.target.value), shown = v.length > 4 ? fmtCode(v) : v;
      if (shown !== e.target.value) e.target.value = shown;
      ui.codeVal = v; const p = $('#fr-peek');
      if (v.length === 8) peek(v); else { ui.peek = null; if (p) p.textContent = ''; }
    }
    if (e.target.id === 'fr-name') ui.nameVal = e.target.value;
  });
  document.addEventListener('focusin', e => { if (e.target.id === 'fr-text') hadFocus = true; });
  document.addEventListener('focusout', e => { if (e.target.id === 'fr-text') setTimeout(() => { if (document.activeElement && document.activeElement.id !== 'fr-text') hadFocus = false; }, 0); });
  document.addEventListener('keydown', e => {
    if (e.target.id === 'fr-text' && e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(hover:hover)').matches) { e.preventDefault(); send(); }
    if (e.key === 'Enter' && ['fr-name', 'fr-transfer'].includes(e.target.id)) { e.preventDefault(); const b = document.querySelector('.fr-form .btn.primary'); if (b) b.click(); }
    if (e.key === 'Enter' && e.target.id === 'fr-code') { e.preventDefault(); const b = document.querySelector('[data-act="fr-add"]'); if (b) b.click(); }
  });

  // the dot on the Prijatelji tab: new messages since the feed was last open
  function paintDot() { const t = document.querySelector('#tabs [data-tab="friends"]'); if (t) t.classList.toggle('has-dot', view !== 'friends' && unread()); }

  // ---------- actions
  const val = id => { const el = $('#' + id); return el ? el.value.trim() : ''; };
  async function busy(fn) {
    if (ui.busy) return; ui.busy = true; ui.err = ''; render();
    try { await fn(); } catch (e) { ui.err = errText(e); if (e.code === 'auth') lost(); }
    ui.busy = false; render();
  }
  async function ensureMe(name) {
    if (me()) { if (name && name !== S.me.name) await rename(name); return; }
    if (!name) { const e = new Error('name'); e.code = 'name'; throw e; }
    draftMe = draftMe || { id: rand(16, ALPHA), key: rand(32, B64), since: today() };
    const r = await rpc('bm_register', { p_id: draftMe.id, p_key: draftMe.key, p_name: name });
    S.me = Object.assign({}, draftMe, { name: r.name }); draftMe = null;
    useInfo(r); save(); keepMe();
  }
  async function rename(name) { useInfo(await rpc('bm_register', { p_id: S.me.id, p_key: S.me.key, p_name: name })); }
  async function peek(code) {
    try {
      const p = await rpc('bm_peek', { p_code: code }); if (normCode(ui.codeVal || ui.invite) !== code) return;
      ui.peek = p; const el = $('#fr-peek');
      if (el) { el.textContent = p ? p.name : 'Te kode ni.'; el.classList.toggle('err', !p); } else if (view === 'friends') render();
    } catch (e) {}
  }
  // the start: a name, then (with an invite) the friend who sent it
  function start() {
    const name = val('fr-name'), code = ui.invite;
    return busy(async () => {
      await ensureMe(name);
      lastSent = ''; await sync();
      if (code) await addCode(code, true);
      ui.step = 'start'; ui.nameVal = null;
      await refresh(true);
    });
  }
  // add a friend by code; true when it worked
  async function addCode(code, quiet) {
    const r = await rpc('bm_add', Object.assign(auth(), { p_code: code }));
    if (!r.ok) { const e = new Error(r.err); e.code = r.err; throw e; }
    useInfo(r.me); ui.invite = null; ui.peek = null; ui.codeVal = ''; lsSet('bm2-invite', '');
    toast(r.friend.name + ' je zdaj med tvojimi prijatelji.');
    return true;
  }
  async function add(el) {
    const code = normCode(el.dataset.code || val('fr-code'));
    const out = $('#fr-add-out');
    if (code.length !== 8) { if (out) { out.textContent = 'Koda ima 8 znakov.'; out.hidden = false; } return; }
    if (el.dataset.code) return busy(async () => { await addCode(code); await refresh(true); });
    el.disabled = true;
    try { await addCode(code); closeSheet(); await refresh(true); }
    catch (e) { if (out) { out.textContent = errText(e); out.hidden = false; } el.disabled = false; if (e.code === 'auth') lost(); }
  }
  async function send() {
    const body = draft.trim(); if (!body || !me()) return;
    const re = ui.reply;
    draft = ''; ui.reply = null; const ta = $('#fr-text'); if (ta) { ta.value = ''; grow(ta); }
    try {
      await rpc('bm_post', Object.assign(auth(), { p_body: body, p_reply: re || null }));
      await refresh(true);
      const f = $('#fr-chat .feed'); if (f && f.lastElementChild) f.lastElementChild.scrollIntoView({ block: 'nearest' });
    } catch (e) { draft = body; ui.reply = re; render(); toast(errText(e)); }
  }
  async function bravo(id) {
    const m = (cache.feed || []).find(x => x.id === id); if (!m) return;
    const on = (m.bravo || []).includes(S.me.id);
    m.bravo = on ? m.bravo.filter(x => x !== S.me.id) : (m.bravo || []).concat(S.me.id); render(); vibrate(on ? 0 : 30);   // at once, then the server's answer
    try { m.bravo = await rpc('bm_bravo', Object.assign(auth(), { p_msg: id })); keepCache(); render(); } catch (e) { toast(errText(e)); refresh(true); }
  }
  async function unsay(id) {
    if (ui.armed !== id) { ui.armed = id; render(); setTimeout(() => { if (ui.armed === id) { ui.armed = null; render(); } }, 4000); return; }
    ui.armed = null;
    try { await rpc('bm_unsay', Object.assign(auth(), { p_msg: id })); cache.feed = (cache.feed || []).filter(m => m.id !== id); keepCache(); render(); }
    catch (e) { toast(errText(e)); }
  }
  const myLink = () => location.origin + location.pathname.replace(/index\.html$/, '') + '#prijatelj=' + cache.info.code;
  async function share() {
    if (!cache.info || !cache.info.code) return;
    const text = 'Dodaj me med bralne prijatelje v Bralnem mentorju. Moja koda: ' + fmtCode(cache.info.code) + ' ';
    if (navigator.share) { try { await navigator.share({ title: 'Bralni mentor', text, url: myLink() }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text + myLink()); toast('Povezava je kopirana. Prilepi jo prijateljem.'); } catch (e) { toast('Tvoja koda: ' + fmtCode(cache.info.code)); }
  }
  async function copy(text, msg) { try { await navigator.clipboard.writeText(text); toast(msg); } catch (e) { toast('Kopiranje ni uspelo. Označi besedilo in ga kopiraj.'); } }

  // ---------- sheets: add a friend, a member, settings, transfer code
  function sheetAdd() {
    const code = cache.info && cache.info.code; ui.codeVal = ''; ui.peek = null;
    openSheet('Dodaj prijatelja', `<div class="fr-set"><h3>Prijateljeva koda</h3><input type="text" id="fr-code" aria-label="Prijateljeva koda" maxlength="9" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="XXXX XXXX">
        <p class="muted" id="fr-peek" style="text-align:center; min-height:1.4em"></p><p class="err" id="fr-add-out" hidden></p><button class="btn primary" data-act="fr-add">Dodaj</button></div>
      <div class="fr-set"><h3>Tvoja koda</h3><p class="bigcode">${esc(fmtCode(code))}</p><p class="hint" style="margin-top:0">Pošlji povezavo ali kodo. Ko jo prijatelj odpre ali vpiše, sta prijatelja.</p>
        <div class="btns two"><button class="btn" data-act="fr-share">Pošlji povezavo</button><button class="btn" data-act="fr-copycode">Kopiraj kodo</button></div></div>`);
    setTimeout(() => { const i = $('#fr-code'); if (i && matchMedia('(hover:hover)').matches) i.focus(); }, 50);
  }
  // ---------- books on a profile: what they read now, their favourites, what they have read with their ratings.
  // A friend's shelf is fetched when their profile opens (the last copy shows at once); mine comes from this phone.
  const shelves = {}, shelfFail = {}, shelfAll = {};
  const SHOW = 10;
  const monthOf = k => { try { return RG.keyDate(k).toLocaleDateString('sl-SI', { month: 'short', year: 'numeric' }); } catch (e) { return k; } };
  const bookRow = (x, withDate) => `<li><span class="bl-main"><b>${esc(x.t)}</b>${x.a ? `<small>${esc(x.a)}</small>` : ''}</span><span class="bl-side">${starsView(x.r)}${favMark(x.f)}${withDate && x.d ? `<small>${esc(monthOf(x.d))}</small>` : ''}</span></li>`;
  function shelfHtml(id) {
    const m = members().find(x => x.id === id); if (!m) return '';
    const mine = isMe(id), s = statsOf(m), who = esc(m.name);
    const sh = mine ? RG.cleanShelf(RG.shelfOf(S.books, lastRead())) : shelves[id];
    const wrap = inner => `<section class="fr-books" id="fr-shelf" data-id="${esc(id)}">${inner}</section>`;
    const old = s.reading ? `<p class="fr-reading">Trenutno bere: <b>${esc(s.reading)}</b></p>` : '';
    if (!mine && s.shelf === 0) return wrap(`<p class="hint">${who} svojih knjig ne deli.</p>`);
    if (!mine && sh === undefined) return wrap(old + `<p class="hint">${shelfFail[id] ? 'Knjig ta hip ni mogoče naložiti.' : 'Nalagam knjige …'}</p>`);
    if (!sh) return wrap(old + (s.shelf === null ? `<p class="hint">Ostale knjige bodo vidne, ko ${who} odpre posodobljeno aplikacijo.</p>` : ''));
    const favs = sh.reading.concat(sh.read).filter(x => x.f), all = shelfAll[id] || sh.read.length <= SHOW + 2, read = all ? sh.read : sh.read.slice(0, SHOW);
    const list = (title, n, items, withDate) => items.length ? `<h3>${title} <span>${n}</span></h3><ul class="blist">${items.map(x => bookRow(x, withDate)).join('')}</ul>` : '';
    let out = list(mine ? 'Trenutno berem' : 'Trenutno bere', sh.reading.length, sh.reading, false)
      + list('Najljubše', favs.length, favs, false)
      + list('Prebrane', sh.n, read, true);
    if (!all) out += `<button class="link" data-act="fr-shelf-all" data-id="${esc(id)}">Pokaži vse prebrane (${sh.read.length})</button>`;
    else if (sh.n > sh.read.length) out += `<p class="hint">Vidnih je zadnjih ${sh.read.length} od ${sh.n} prebranih knjig.</p>`;
    if (!sh.reading.length && !sh.read.length) out = `<p class="hint">Tu še ni knjig.</p>`;
    if (mine && !shareTitle()) out += `<p class="hint">Prijatelji tvojih knjig ne vidijo. To spremeniš v nastavitvah.</p>`;
    return wrap(out);
  }
  function paintShelf(id) { const box = document.getElementById('fr-shelf'); if (box && box.dataset.id === id) box.outerHTML = shelfHtml(id); }
  async function loadShelf(id) {
    if (DEMO || isMe(id) || !me() || !enabled()) return;
    try { const r = await rpc('bm_shelf', Object.assign(auth(), { p_member: id })); shelves[id] = RG.cleanShelf(r && r.shelf); delete shelfFail[id]; }
    catch (e) { if (e.code === 'gone') shelves[id] = null; else shelfFail[id] = true; }
    paintShelf(id);
  }
  function sheetMember(id) {
    const m = members().find(x => x.id === id); if (!m) return;
    loadShelf(id);
    const s = statsOf(m), P = RG.weekPoints(RULE, s.days || {}, s.since || null, today()), L = RG.LEVELS[s.level || 0] ? s.level || 0 : 0, mine = isMe(id);
    const max = Math.max(30, ...P.days.map(d => d.min));
    const seenTxt = m.seen && !mine ? 'Nazadnje v aplikaciji ' + ago(m.seen) + '.' : '';
    const since = !mine && m.since ? 'Med prijatelji od ' + new Date(m.since).toLocaleDateString('sl-SI') + '.' : '';
    openSheet('', `<div class="detail fr-who">${KID(L, 104, false, true)}<div style="min-width:0; display:grid; gap:4px; justify-items:start"><h2>${esc(m.name)}${mine ? ' <small class="muted">(ti)</small>' : ''}</h2><p class="muted">${esc(RG.LEVELS[L][1])} · stopnja ${L + 1} od ${RG.LEVELS.length}</p>${live(s) ? '<span class="chip live"><i></i>bere prav zdaj</span>' : ''}</div></div>
      <dl class="facts"><div><dt>Skupaj prebrano</dt><dd>${fmtHours(s.total || 0)}</dd></div><div><dt>Niz</dt><dd>${s.streak || 0} ${plural(s.streak || 0, DAYS)}</dd></div><div><dt>Prebrane knjige letos</dt><dd>${s.year || 0}</dd></div><div><dt>Najdaljši niz</dt><dd>${s.best || 0} ${plural(s.best || 0, DAYS)}</dd></div></dl>
      ${shelfHtml(id)}
      <div><div class="head" style="margin-bottom:6px"><h2 style="font-size:1.05rem">Ta teden</h2><b class="num">${P.total < 0 ? "−" + Math.abs(P.total) : P.total} ${plural(Math.abs(P.total), PTS)}</b></div>
      <div class="fr-days">${P.days.map(d => `<div class="${d.kind}"><span>${wd(d.k)}</span><i style="--h:${d.min ? Math.max(6, Math.round(Math.min(1, d.min / max) * 100)) : 0}%"></i><b>${d.kind === 'future' || d.kind === 'before' ? '' : signed(d.pts)}</b><small>${d.min ? d.min + ' min' : d.kind === 'miss' ? '0 min' : ''}</small></div>`).join('')}</div>
      ${P.full ? `<p class="hint">Poln teden: ${signed(P.bonus)} točk.</p>` : ''}</div>
      ${seenTxt || since ? `<p class="hint">${[since, seenTxt].filter(Boolean).join(' ')}</p>` : ''}
      ${mine ? '<button class="btn" data-act="fr-settings">Spremeni ime ali nastavitve</button>' : `<div class="danger-zone"><button class="del" data-act="fr-unfriend" data-id="${esc(id)}">Odstrani iz prijateljev</button></div>`}`);
  }
  function sheetSettings() {
    if (!me()) return;
    const code = cache.info && cache.info.code;
    openSheet('Nastavitve', `<div class="fr-set"><h3>Tvoja koda</h3><p class="bigcode">${esc(fmtCode(code))}</p><div class="btns two"><button class="btn" data-act="fr-share">Pošlji povezavo</button><button class="btn" data-act="fr-copycode">Kopiraj kodo</button></div>
        <button class="link" data-act="fr-newcode" style="justify-self:start; padding-left:0">Nova koda</button><p class="hint" id="fr-newcode-note" hidden style="margin-top:0">Tapni še enkrat. Stara koda in povezava ne bosta več delovali, prijatelji ostanejo.</p></div>
      <div class="fr-set"><button class="btn" data-act="fr-addsheet">${ICF.add}Dodaj prijatelja</button></div>
      <div class="fr-set"><label for="fr-myname">Tvoje ime<input type="text" id="fr-myname" maxlength="24" value="${esc(S.me.name)}"></label><button class="btn" data-act="fr-myname">Shrani ime</button>
        <button class="switch" role="switch" aria-checked="${shareTitle()}" data-act="fr-sharetitle"><span>Prijatelji vidijo moje knjige, ocene in najljubše</span><i></i></button></div>
      <div class="fr-set"><h3>Točke</h3><p class="hint" style="margin-top:0">${esc(RG.RULES[RULE].note)} ${ruleLines(RULE).map(l => esc(l[0]) + ' ' + esc(l[1])).join(' · ')}.</p></div>`);
  }
  function sheetTransfer() {
    if (!me()) return;
    const at = lsGet('bm2-backup-at');
    openSheet('Koda za prenos', `<p class="muted">S to kodo na novem telefonu preneseš knjige, vse branje in svoje prijatelje. Hrani jo zase: kdor jo ima, vidi tvoje branje.</p>
      <p class="transfer" id="fr-code-out">${esc(codeOf(S.me))}</p><button class="btn primary" data-act="fr-copytransfer">Kopiraj kodo</button>
      <p class="hint">${at ? 'Kopija v oblaku je bila nazadnje shranjena ' + ago(at) + '.' : 'Kopija v oblaku se shrani, ko je telefon na spletu.'} Platnic ne prenese, te ostanejo v varnostni kopiji na telefonu.</p>`);
  }
  function sheetRestore() {
    openSheet('Prenos s starega telefona', `<p class="muted">Vpiši kodo s starega telefona (Napredek → Varnostna kopija → Koda za prenos). Branje s kopije se doda temu, kar je že na tem telefonu.</p>
      <label for="fr-transfer">Koda za prenos<input type="text" id="fr-transfer" autocomplete="off" spellcheck="false" placeholder="BM2-…"></label>
      ${me() ? `<p class="hint" style="margin-top:0">Ta telefon že ima profil »${esc(S.me.name)}«. Namesto njega bo pri prijateljih profil s starega telefona.</p>` : ''}<div id="fr-restore-out"></div><button class="btn primary" data-act="fr-restore">Prenesi</button>`);
  }
  // bring the cloud copy in: books and readings are added to what this phone has (nothing is thrown away), the profile comes along
  async function restore() {
    const code = parseCode(val('fr-transfer')); const out = $('#fr-restore-out') || null;
    if (!code) { if (out) out.innerHTML = '<p class="err">Koda se začne z BM2- in je dolga. Prilepi jo celo.</p>'; else { ui.err = 'Koda se začne z BM2- in je dolga. Prilepi jo celo.'; render(); } return; }
    const run = async () => {
      const r = await rpc('bm_backup_get', { p_id: code.id, p_key: code.key });
      const d = r && r.data, added = { b: 0, s: 0 };
      if (d && Array.isArray(d.books) && Array.isArray(d.sessions)) {
        const bid = new Set(S.books.map(b => b.id)), sid = new Set(S.sessions.map(s => s.id));
        for (const b of d.books) if (!bid.has(b.id)) { S.books.push(Object.assign({}, b, { cover: false })); added.b++; }
        for (const s of d.sessions) if (!sid.has(s.id)) { S.sessions.push(s); added.s++; }
        if (!S.sessions.length || (d.goals && d.goals.length && d.goals[0].from < S.goals[0].from)) S.goals = d.goals || S.goals;
        if (typeof d.countOff === 'boolean') S.countOff = d.countOff;
      }
      S.me = { id: code.id, key: code.key, name: r.name, since: (d && d.goals && d.goals[0] && d.goals[0].from) || today() };
      cache = EMPTY(); save(); keepMe(); lastSent = '';
      await sync();
      closeSheet(); ui.step = 'start'; render(); refresh(true);
      toast(added.b || added.s ? 'Preneseno: ' + added.b + ' ' + plural(added.b, BOOKS) + ' in ' + added.s + ' ' + plural(added.s, ['branje', 'branji', 'branja', 'branj']) + '.' : 'Profil je prenesen.');
    };
    try { ui.busy = true; await run(); } catch (e) { const t = errText(e); if (out) out.innerHTML = `<p class="err">${esc(t)}</p>`; else { ui.err = t; render(); } }
    ui.busy = false;
  }

  // the clicks this file handles (app.js passes on every data-act that starts with "fr-")
  async function act(el) {
    const id = el.dataset.id;
    switch (el.dataset.act) {
      case 'fr-step': ui.step = el.dataset.step; ui.err = ''; render(); { const f = document.querySelector('.fr-form input'); if (f) f.focus(); } break;
      case 'fr-noinvite': ui.invite = null; ui.peek = null; ui.err = ''; lsSet('bm2-invite', ''); render(); break;
      case 'fr-start': start(); break;
      case 'fr-add': add(el); break;
      case 'fr-addsheet': closeSheet(); sheetAdd(); break;
      case 'fr-restore': restore(); break;
      case 'fr-mode': ui.mode = el.dataset.mode; render(); break;
      case 'fr-member': sheetMember(id); break;
      case 'fr-settings': sheetSettings(); break;
      case 'fr-share': share(); break;
      case 'fr-copycode': if (cache.info && cache.info.code) copy(fmtCode(cache.info.code), 'Koda ' + fmtCode(cache.info.code) + ' je kopirana.'); break;
      case 'fr-copytransfer': copy(codeOf(S.me), 'Koda za prenos je kopirana. Shrani jo na varno.'); break;
      case 'fr-send': send(); break;
      case 'fr-bravo': bravo(Number(id)); break;
      case 'fr-reply': ui.reply = id ? Number(id) : null; render(); if (id) { const ta = $('#fr-text'); if (ta) { ta.focus(); ta.scrollIntoView({ block: 'center' }); } } break;
      case 'fr-unsay': unsay(Number(id)); break;
      case 'fr-older': older(); break;
      case 'fr-transfer': sheetTransfer(); break;
      case 'fr-restore-open': sheetRestore(); break;
      case 'fr-sharetitle': S.shareTitle = !shareTitle(); save(); el.setAttribute('aria-checked', String(shareTitle())); break;
      case 'fr-shelf-all': shelfAll[id] = true; paintShelf(id); break;
      case 'fr-myname': {
        const n = val('fr-myname'); if (!n) return;
        try { await rename(n); closeSheet(); await refresh(true); toast('Shranjeno.'); } catch (e) { toast(errText(e)); }
        break;
      }
      case 'fr-newcode': {
        if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'Naredi novo kodo'; $('#fr-newcode-note').hidden = false; return; }
        try { useInfo(await rpc('bm_newcode', auth())); closeSheet(); sheetSettings(); toast('Nova koda: ' + fmtCode(cache.info.code) + '.'); } catch (e) { toast(errText(e)); }
        break;
      }
      case 'fr-unfriend': {
        if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'Tapni še enkrat, da odstraniš'; return; }
        try { useInfo(await rpc('bm_unfriend', Object.assign(auth(), { p_friend: id }))); closeSheet(); await refresh(true); } catch (e) { toast(errText(e)); }
        break;
      }
      case 'fr-forget': {
        if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'Tapni še enkrat, da izbrišeš profil'; return; }
        try { await rpc('bm_forget', auth()); lost(); toast('Profil pri prijateljih je izbrisan. Branje na telefonu ostane.'); } catch (e) { toast(errText(e)); }
        break;
      }
    }
  }

  // ---------- a line on Danes: this week's place among friends
  function todayLine() {
    if (!me() || members().length < 2) return '';
    const list = ranked(standings(members()), x => x.P.total * 1e4 + x.P.minutes), my = list.find(x => isMe(x.m.id)); if (!my) return '';
    return `<button class="fr-line" data-act="tab" data-tab="friends"><span>Med prijatelji</span><b>${my.place}. mesto</b><span class="muted">${my.P.total < 0 ? "−" + Math.abs(my.P.total) : my.P.total} ${plural(Math.abs(my.P.total), PTS)} ta teden</span>${IC.next}</button>`;
  }
  // a block in Napredek → Varnostna kopija
  function backupBlock() {
    if (!enabled() && !DEMO) return '';
    if (!me()) return `<p class="hint" style="margin-top:0">Ko se pridružiš prijateljem, se kopija samodejno shranjuje tudi v oblak.</p><button class="link" data-act="fr-restore-open" style="justify-self:start">Prenos s starega telefona</button>`;
    const at = lsGet('bm2-backup-at');
    return `<p class="hint" style="margin-top:0">${at ? 'Kopija v oblaku: shranjena ' + esc(ago(at)) + '.' : 'Kopija v oblaku se shrani, ko je telefon na spletu.'} Na novem telefonu jo preneseš s kodo za prenos.</p><div class="btns two"><button class="btn" data-act="fr-transfer">Koda za prenos</button><button class="btn" data-act="fr-restore-open">Vpiši kodo</button></div>`;
  }
  function profileBlock() {
    if (!me() || (!enabled() && !DEMO)) return '';
    return `<section class="panel" style="display:grid; gap:10px"><h2 style="font-size:1.15rem">Profil pri prijateljih</h2><p class="hint" style="margin-top:0">Ime: <b>${esc(S.me.name)}</b>. ${PRIVACY}</p><div class="danger-zone" style="border:0; margin:0; padding:0"><button class="del" data-act="fr-forget" style="justify-self:start; padding-left:0">Izbriši moj profil pri prijateljih</button></div></section>`;
  }

  // ---------- start: an invite link (#prijatelj=CODE) opens the friends' tab
  function init() {
    // local test server (test/server/up.sh): open the app on localhost with "#api=local" once
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      if (/[#&]api=local/.test(location.hash)) lsSet('bm2-api', 'local');
      if (lsGet('bm2-api') === 'local') { API = 'http://127.0.0.1:3000'; KEY = ''; }
    }
    if (!DEMO) try { const c = JSON.parse(lsGet('bm2-cache')); if (c && typeof c === 'object' && !Array.isArray(c.clubs)) cache = Object.assign(EMPTY(), c); } catch (e) {}
    const got = fromHash();
    if (!got && lsGet('bm2-invite')) ui.invite = lsGet('bm2-invite');
    if (ui.invite && enabled() && !DEMO) { ui.codeVal = ui.invite; peek(ui.invite); }
    return got;
  }
  // an invite in the address (#prijatelj=CODE): kept until it is used or declined
  function fromHash() {
    const m = location.hash.match(/prijatelj=([A-Za-z0-9-]{8,9})/); if (!m || normCode(m[1]).length !== 8) return false;
    ui.invite = normCode(m[1]); ui.err = ''; lsSet('bm2-invite', ui.invite); try { history.replaceState(null, '', location.pathname); } catch (e) {}
    return true;
  }
  // the link opened while the app was already open: only the address changes
  window.addEventListener('hashchange', () => {
    if (DEMO || !fromHash()) return;
    view = 'friends'; if (enabled()) { ui.codeVal = ui.invite; peek(ui.invite); }
    render(); poll(true); wake();
  });
  // when the app opens or comes back: sync if it's been a while
  function wake() { if (me() && enabled() && !DEMO && Date.now() - lastSync > 60e3) sync(); if (view === 'friends') refresh(); }

  function demo(hash) {
    // example friends for screenshots: Jan (the demo reader) and three friends
    const t = today(), past = (n, mins) => Object.fromEntries(mins.map((m, i) => [RG.addDays(t, i - mins.length + 1), m * 60]).filter(x => x[1] > 0));
    S.me = { id: 'demojan000000000', key: 'x'.repeat(32), name: 'Jan', since: RG.addDays(t, -60) };
    const now = Date.now(), iso = ms => new Date(now - ms).toISOString();
    const fr = (id, name, level, total, mins, extra) => ({ id, name, since: iso(30 * 864e5), seen: iso(3600e3), stats: Object.assign({ v: 1, at: iso(600e3), total, level, streak: 9, best: 21, finished: 8, year: 6, reading: null, run: 0, days: past(21, mins), since: RG.addDays(t, -90), shelf: 1 }, extra) });
    const list = [
      { id: S.me.id, name: 'Jan', since: iso(40 * 864e5), seen: iso(0), stats: {} },
      fr('demoana00000000a', 'Ana', 12, 205 * 3600, [30, 45, 25, 60, 20, 35, 40, 50, 30, 25, 45, 70, 30, 40, 25, 35, 30, 45, 25, 60, 22], { reading: 'Mali princ', streak: 34, best: 34, run: now - 1100e3, at: iso(60e3) }),
      fr('demomarko000000a', 'Marko', 7, 47 * 3600, [20, 0, 15, 30, 0, 45, 20, 15, 20, 0, 10, 40, 25, 20, 0, 30, 15, 20, 0, 25, 5], { reading: 'Sapiens', streak: 2, best: 9 }),
      fr('demopetra000000a', 'Petra', 9, 92 * 3600, [25, 30, 20, 0, 45, 30, 25, 30, 35, 20, 25, 0, 60, 90, 40, 30, 25, 20, 0, 15, 0], { reading: 'Igra prestolov', streak: 0, best: 15, year: 9 }),
    ];
    const J = S.me.id, A = 'demoana00000000a', M = 'demomarko000000a', P = 'demopetra000000a';
    cache = { info: { name: 'Jan', code: 'K7M2QX9P', friends: 3, last: 9 }, board: { members: list, last: 9 }, feed: [
      { id: 1, who: P, owner: P, name: 'Petra', kind: 'event', body: '{"t":"streak","v":14}', at: iso(5 * 864e5), bravo: [J] },
      { id: 2, who: M, owner: M, name: 'Marko', kind: 'msg', body: 'Kdo ima priporočilo za kaj kratkega? Sapiens se vleče 😅', at: iso(2 * 864e5), bravo: [] },
      { id: 3, who: A, owner: M, name: 'Ana', kind: 'msg', body: 'Mali princ! Prebereš ga v dveh večerih.', at: iso(2 * 864e5 - 1800e3), bravo: [M], re: 2 },
      { id: 4, who: P, owner: P, name: 'Petra', kind: 'event', body: '{"t":"book","v":"Alamut"}', at: iso(864e5 + 7200e3), bravo: [A, J] },
      { id: 5, who: J, owner: P, name: 'Jan', kind: 'msg', body: 'Bravo Petra! Alamut je na mojem seznamu.', at: iso(864e5), bravo: [P], re: 4 },
      { id: 6, who: A, owner: A, name: 'Ana', kind: 'event', body: '{"t":"streak","v":30}', at: iso(5 * 3600e3), bravo: [P] },
      { id: 7, who: J, owner: J, name: 'Jan', kind: 'event', body: '{"t":"level","v":6}', at: iso(3 * 3600e3), bravo: [A, M] },
      { id: 8, who: M, owner: J, name: 'Marko', kind: 'msg', body: 'Kmalu te ujamem!', at: iso(2 * 3600e3), bravo: [], re: 7 },
      { id: 9, who: M, owner: M, name: 'Marko', kind: 'msg', body: 'Ta teden vas ujamem. Nocoj berem do polnoči.', at: iso(1500e3), bravo: [] },
    ] };
    // their bookshelves (what a friend's phone would send)
    const bk = (t, a, r, f, ago) => ({ t, a, r, f, d: ago == null ? undefined : RG.addDays(t0, -ago) }), t0 = t;
    const anaRead = [['Alamut', 'Vladimir Bartol', 5, 1], ['Mož po imenu Ove', 'Fredrik Backman', 5], ['Čefurji raus!', 'Goran Vojnović', 4], ['Atomske navade', 'James Clear', 4],
      ['1984', 'George Orwell', 5, 1], ['Hiša Marije Pomočnice', 'Ivan Cankar', 4], ['Veliki Gatsby', 'F. Scott Fitzgerald', 3], ['Sapiens', 'Yuval Noah Harari', 4],
      ['Martin Krpan', 'Fran Levstik', 4], ['Jamica', 'Valentina Plaskan', 5], ['Ime rože', 'Umberto Eco', 3], ['Pod svobodnim soncem', 'Fran Saleški Finžgar', 4],
      ['Dekameron', 'Giovanni Boccaccio', 2], ['Na klancu', 'Ivan Cankar', 4]].map((x, i) => bk(x[0], x[1], x[2], x[3], 9 + i * 23));
    shelves[A] = RG.cleanShelf({ reading: [bk('Mali princ', 'Antoine de Saint-Exupéry', 0, 0), bk('Kafka na obrežju', 'Haruki Murakami', 0, 1)], read: anaRead, n: anaRead.length });
    shelves[M] = RG.cleanShelf({ reading: [bk('Sapiens', 'Yuval Noah Harari')], read: [bk('Atomske navade', 'James Clear', 4, 0, 30), bk('Hobit', 'J. R. R. Tolkien', 5, 1, 80)], n: 2 });
    shelves[P] = RG.cleanShelf({ reading: [bk('Igra prestolov', 'George R. R. Martin')], read: [bk('Alamut', 'Vladimir Bartol', 5, 1, 1)], n: 1 });
    cache.feed[3].body = '{"t":"book","v":"Alamut","r":5,"f":1}';
    if (/welcome/.test(hash)) { S.me = null; cache = EMPTY(); }
    if (/invite/.test(hash)) { S.me = null; cache = EMPTY(); ui.invite = 'R4T8WN3K'; ui.peek = { name: 'Ana' }; }
    if (/alone/.test(hash)) { cache.board.members = list.slice(0, 1); cache.info.friends = 0; cache.feed = cache.feed.filter(m => m.owner === J && m.who === J); }
    if (/all/.test(hash)) ui.mode = 'all';
  }

  return { view: view_, after, act, enabled, changed, sync, wake, poll, event, moments, finished, init, todayLine, backupBlock, profileBlock, sheetMember, sheetSettings, sheetAdd, demo, paintDot, me, keepMe };
})();
