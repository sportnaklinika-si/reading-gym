/* Bralni mentor 2: friends. A bralni klub (reading club) is a small group of friends with a weekly leaderboard, points for
   reading days (core.js RULES) and a chat. The server is Supabase (server/schema.sql), its address is in config.js.
   Uses app.js (S, save, render, toast, the Slovene helpers), which is loaded after this file. */
'use strict';
const Club = (() => {
  const CFG = window.BM_SERVER || {};
  let API = (CFG.url || '').replace(/\/$/, ''), KEY = CFG.key || '';
  const enabled = () => !!API;
  const POLL_MS = 15e3;

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
    nocode: 'Kluba s to kodo ni. Preveri jo in poskusi znova.',
    full: 'Ta klub je poln (50 članov).',
    limit: 'Si že v petih klubih, kar je največ.',
    name: 'Ime naj ima od 1 do 24 znakov (ime kluba do 40).',
    owner: 'To lahko spremeni samo ustanovitelj kluba.',
    notmember: 'Nisi več član tega kluba.',
    slow: 'Prehitro. Poskusi čez minuto.',
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

  // ---------- what the screens show (kept in localStorage so the board shows at once and offline)
  let cache = { clubs: [], boards: {}, feeds: {} };
  const keepCache = () => { if (!DEMO) lsSet('bm2-cache', JSON.stringify(cache)); };
  let ui = { step: 'start', mode: 'week', busy: false, err: '', invite: null, peek: null, reply: null, more: {}, armed: null };
  let draft = '';
  const curId = () => { const id = Number(lsGet('bm2-club')); const c = cache.clubs.find(x => x.id === id) || cache.clubs[0]; return c ? c.id : null; };
  const curClub = () => cache.clubs.find(c => c.id === curId()) || null;
  const seen = () => { try { return JSON.parse(lsGet('bm2-seen')) || {}; } catch (e) { return {}; } };
  const markSeen = (id, last) => { if (DEMO || !last) return; const s = seen(); if ((s[id] || 0) < last) { s[id] = last; lsSet('bm2-seen', JSON.stringify(s)); } };
  const unread = () => cache.clubs.some(c => c.last && c.last > (seen()[c.id] || 0));

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
      run: S.run && S.run.at ? S.run.at : 0, days, since };
  }

  // ---------- sync: after every change (a few seconds later) and when the app opens, send my stats; then the cloud backup
  let syncT = null, lastSent = '', lastSync = 0;
  function changed() { if (!me() || !enabled() || DEMO) return; clearTimeout(syncT); syncT = setTimeout(sync, 2500); }
  async function sync() {
    if (!me() || !enabled() || DEMO) return;
    clearTimeout(syncT);
    const st = myStats(), sig = JSON.stringify(Object.assign({}, st, { at: 0 }));
    try {
      const r = await rpc('bm_sync', Object.assign(auth(), { p_stats: sig === lastSent ? null : st }));
      lastSent = sig; lastSync = Date.now();
      cache.clubs = r.clubs || []; keepCache();
      if (r.name && S.me.name !== r.name) { S.me.name = r.name; save(); keepMe(); }
      paintDot(); if (view === 'friends') render();
      backup();
    } catch (e) { if (e.code === 'auth') lost(); }
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
  function lost() { S.me = null; save(); if (!DEMO) idb.del('bm2-me').catch(() => {}); cache = { clubs: [], boards: {}, feeds: {} }; keepCache(); toast(ERR.auth); render(); }

  // moments worth a bravo, posted to my clubs (the server posts each one once)
  function event(body, club) {
    if (!me() || !enabled() || DEMO) return;
    rpc('bm_event', Object.assign(auth(), { p_body: body, p_club: club || null })).catch(() => {});
  }
  const STREAKS = [7, 14, 21, 30, 50, 75, 100, 150, 200, 300, 365, 500, 1000];
  // called by app.js after a reading is saved, with the numbers before and after
  function moments(b, a) {
    if (a.lvl > b.lvl) event({ t: 'level', v: a.lvl });
    for (const n of STREAKS) if (b.cur < n && a.cur >= n) event({ t: 'streak', v: n, d: today() });
  }
  function finished(book) { event({ t: 'book', v: bookName(book).slice(0, 120), d: today() }); }

  // ---------- the board of the open club, and its chat (polled every 15 s while the screen is open)
  let pollT = null;
  async function refresh(full) {
    const id = curId(); if (!me() || !enabled() || DEMO || id == null) return;
    try {
      const [b, f] = await Promise.all([rpc('bm_board', Object.assign(auth(), { p_club: id })), rpc('bm_feed', Object.assign(auth(), { p_club: id }))]);
      const before = JSON.stringify([cache.boards[id], cache.feeds[id]]);
      cache.boards[id] = b; cache.feeds[id] = mergeFeed(cache.feeds[id], f, !!ui.more[id]);
      const c = cache.clubs.find(x => x.id === id); if (c && b && b.club) Object.assign(c, { name: b.club.name, rules: b.club.rules, owner: b.club.owner, code: b.club.code, last: b.last, n: b.members.length });
      keepCache();
      if (view === 'friends' && document.visibilityState === 'visible') markSeen(id, b && b.last);
      paintDot();
      if (full || before !== JSON.stringify([cache.boards[id], cache.feeds[id]])) { if (view === 'friends') render(); }
      if (b) winCheck(b);
    } catch (e) {
      if (e.code === 'notmember') { cache.clubs = cache.clubs.filter(c => c.id !== id); keepCache(); render(); }
      else if (e.code === 'auth') lost();
      else if (full && view === 'friends') render();
    }
  }
  // newest 60 from the server; older pages the reader opened stay
  function mergeFeed(old, fresh, keepOld) {
    if (!keepOld || !old || !old.length || !fresh.length) return fresh;
    const first = fresh[0].id; return old.filter(m => m.id < first).concat(fresh);
  }
  async function older() {
    const id = curId(), f = cache.feeds[id] || []; if (!f.length) return;
    try { const o = await rpc('bm_feed', Object.assign(auth(), { p_club: id, p_before: f[0].id })); ui.more[id] = true; cache.feeds[id] = o.concat(f); if (!o.length) ui.more[id] = 'end'; keepCache(); render(); }
    catch (e) { toast(errText(e)); }
  }
  function poll(onScreen) {
    clearInterval(pollT); pollT = null;
    if (!onScreen || !me() || !enabled() || DEMO) return;
    pollT = setInterval(() => { if (document.visibilityState === 'visible' && view === 'friends') refresh(); }, POLL_MS);
  }

  // last week's winner posts the win once (from that person's own phone)
  const posted = {};
  function winCheck(b) {
    const w = lastWeek(b); if (!w || !w.ids.includes(S.me.id) || posted[b.club.id + w.mon]) return;
    posted[b.club.id + w.mon] = true; event({ t: 'win', v: w.pts, w: w.mon }, b.club.id);
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
      run: num(s.run, 1e14), at: typeof s.at === 'string' ? s.at : null, days, since: isDay(s.since) ? s.since : null };
  }
  const statsOf = m => (m.id === (S.me && S.me.id) ? myStats() : clean(m.stats));
  function standings(b, week) {
    const t = today(), R = b.club.rules;
    return (b.members || []).map(m => { const s = statsOf(m); return { m, s, P: RG.weekPoints(R, s.days || {}, s.since || null, t, week) }; });
  }
  // last week's winner, among the members who were in the club by its Sunday (at least two of them)
  function lastWeek(b) {
    if (!b || !b.members) return null;
    const mon = RG.addDays(RG.weekStart(today()), -7), sun = RG.addDays(mon, 6);
    const there = b.members.filter(m => m.joined && RG.dayKey(new Date(m.joined)) <= sun);
    if (there.length < 2) return null;
    const list = standings({ club: b.club, members: there }, mon), best = Math.max(...list.map(x => x.P.total));
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
  const PTS = ['točka', 'točki', 'točke', 'točk'], MEMBERS = ['član', 'člana', 'člani', 'članov'];
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
  // events are small JSON objects; names go first, verbs in the present tense (no he/she forms needed)
  function eventText(m) {
    // posted by other phones: every field is checked before it is shown
    let e = {}; try { e = JSON.parse(m.body) || {}; } catch (x) {}
    if (!e || typeof e !== 'object') return null;
    const n = '<b>' + esc(m.name || 'Nekdanji član') + '</b>', v = Math.floor(Number(e.v)), ok = Number.isFinite(v) && v >= 0;
    switch (e.t) {
      case 'join': return [n + ' se pridruži klubu.', 'join'];
      case 'book': return typeof e.v === 'string' ? [n + ' konča knjigo <i>' + esc(e.v.slice(0, 120)) + '</i>.', 'book'] : null;
      case 'level': return ok && v < RG.LEVELS.length ? [n + ' napreduje na stopnjo <i>' + esc(RG.LEVELS[v][1]) + '</i>.', 'level', v] : null;
      case 'streak': return ok ? [n + ' bere že ' + v + ' ' + plural(v, DAYS) + ' zapored.', 'streak'] : null;
      case 'win': return ok && isDay(e.w) ? [n + ' zmaga v tednu ' + esc(weekLabel(e.w)) + ': ' + v + ' ' + plural(v, PTS) + '.', 'win'] : null;
      case 'rules': return ['A', 'B', 'C'].includes(e.v) ? [n + ' izbere nova pravila točk: <i>' + esc(RG.RULES[e.v].name) + '</i>.', 'rules'] : null;
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
    reply: SV('<path d="M9.5 7L4.5 12l5 5M5 12h9a5 5 0 015 5v1"/>'),
    star: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.8l2.4 5.3 5.8.6-4.3 3.9 1.2 5.7L10 14.4l-5.1 2.9 1.2-5.7L1.8 7.7l5.8-.6z" style="fill:currentColor"/></svg>',
  };
  const EV_IC = {
    join: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" style="fill:var(--accent-soft)"/><path d="M12 7.5v9M7.5 12h9" style="stroke:var(--accent);stroke-width:2;stroke-linecap:round"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" style="fill:var(--mark-soft)"/><path d="M7 7.5h6.5a2.5 2.5 0 012.5 2.5v7H9.5A2.5 2.5 0 017 14.5z" style="fill:var(--mark)"/></svg>',
    streak: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" style="fill:var(--good-soft)"/><path d="M8 12.5l2.7 2.7L16.5 9" style="fill:none;stroke:var(--good);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round"/></svg>',
    win: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" style="fill:var(--accent-soft)"/><path d="M5.5 16h13l.8-7-3.8 3-3.5-5-3.5 5-3.8-3z" style="fill:var(--tier-3)"/></svg>',
    rules: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" style="fill:var(--accent-soft)"/><path d="M8 9h8M8 12h8M8 15h5" style="stroke:var(--accent);stroke-width:1.8;stroke-linecap:round"/></svg>',
  };
  const KIDS3 = () => `<div class="fr-trio" aria-hidden="true">${[2, 9, 15].map(i => KID(i, 92)).join('')}</div>`;
  const live = s => s && s.run && Date.now() - s.run < 3 * 3600e3 && s.at && Date.now() - Date.parse(s.at) < 3 * 3600e3;
  // the seven days of the week as small slots: green reading day, a dot for a short day, a dash for a day without reading
  const miniWeek = P => `<span class="fr-wk" aria-hidden="true">${P.days.map(d => `<i class="${d.kind}"></i>`).join('')}</span>`;

  // ---------- screens
  const form = (inner) => `<div class="fr-form">${inner}${ui.err ? `<p class="err">${esc(ui.err)}</p>` : ''}</div>`;
  const nameField = (v) => `<label for="fr-name">Tvoje ime (vidijo ga prijatelji)<input type="text" id="fr-name" maxlength="24" autocomplete="nickname" enterkeyhint="done" value="${esc(ui.nameVal != null ? ui.nameVal : v || '')}"></label>`;
  const codeField = () => `<label for="fr-code">Koda kluba<input type="text" id="fr-code" class="code" maxlength="6" autocapitalize="characters" autocomplete="off" spellcheck="false" inputmode="text" value="${esc(ui.codeVal || '')}" placeholder="K7M2QX"></label>`;
  const PRIVACY = 'Prijatelji vidijo tvoje ime, stopnjo, koliko bereš po dnevih, prebrane knjige in naslov knjige, ki jo bereš (naslov lahko skriješ).';

  function vOff() {
    return `<h1 class="title">Prijatelji</h1><p class="lede">Bralni klub s prijatelji: tedenska lestvica, točke za vsak bralni dan in klepet.</p>
    <section class="panel empty">${KIDS3()}<h2>Kmalu</h2><p>Strežnik za prijatelje še ni vklopljen. Vse ostalo deluje kot prej.</p></section>`;
  }
  function vStart() {
    const inv = ui.invite, ios = isIOS && !standalone();
    if (ui.step === 'restore') return `<h1 class="title">Prenos s starega telefona</h1><p class="lede">Na starem telefonu odpri Napredek → Varnostna kopija → Koda za prenos in jo prepiši ali prilepi sem.</p>
      ${form(`<label for="fr-transfer">Koda za prenos<input type="text" id="fr-transfer" autocomplete="off" spellcheck="false" placeholder="BM2-…"></label><button class="btn primary" data-act="fr-restore"${ui.busy ? ' disabled' : ''}>Prenesi</button><button class="link" data-act="fr-step" data-step="start">Nazaj</button>`)}`;
    const head = `<h1 class="title">Prijatelji</h1><p class="lede">Berite skupaj: tedenska lestvica, točke za vsak bralni dan in klepet za pohvale.</p>`;
    if (inv) {
      const p = ui.peek;
      return `${head}<section class="panel fr-invite">${KIDS3()}<h2>${p ? 'Vabilo v klub »' + esc(p.name) + '«' : 'Vabilo v bralni klub'}</h2><p class="muted">${p ? p.n + ' ' + plural(p.n, MEMBERS) + ' · ' : ''}koda <b class="code">${esc(inv)}</b></p>
        ${ios ? '<p class="hint">Na iPhonu najprej dodaj Bralnega mentorja na začetni zaslon (Deli → Dodaj na začetni zaslon), ga odpri tam in vpiši to kodo. Brskalnik in aplikacija hranita ločene podatke.</p>' : ''}</section>
        ${form(`${nameField(S.me ? S.me.name : '')}<button class="btn primary" data-act="fr-join"${ui.busy ? ' disabled' : ''}>Pridruži se klubu</button><button class="link" data-act="fr-noinvite">Ne, hvala</button>`)}
        <p class="hint">${PRIVACY}</p>`;
    }
    if (ui.step === 'code') return `${head}${form(`${S.me ? '' : nameField('')}${codeField()}<p class="muted" id="fr-peek">${ui.peek ? 'Klub »' + esc(ui.peek.name) + '«, ' + ui.peek.n + ' ' + plural(ui.peek.n, MEMBERS) : ''}</p><button class="btn primary" data-act="fr-join"${ui.busy ? ' disabled' : ''}>Pridruži se</button><button class="link" data-act="fr-step" data-step="start">Nazaj</button>`)}`;
    if (ui.step === 'create') return `${head}${form(`${S.me ? '' : nameField('')}<label for="fr-club">Ime kluba<input type="text" id="fr-club" maxlength="40" autocomplete="off" placeholder="npr. Knjižni molji" value="${esc(ui.clubVal || '')}"></label><button class="btn primary" data-act="fr-create"${ui.busy ? ' disabled' : ''}>Ustvari klub</button><button class="link" data-act="fr-step" data-step="start">Nazaj</button>`)}`;
    return `${head}<section class="panel empty">${KIDS3()}<h2>${S.me ? 'Še nisi v nobenem klubu' : 'Bralni klub'}</h2><p>Ustvari klub in povabi prijatelje s povezavo ali pa se pridruži klubu s kodo, ki ti jo pošljejo.</p>
      <div class="btns" style="width:100%">${ui.err ? `<p class="err">${esc(ui.err)}</p>` : ''}<button class="btn primary" data-act="fr-step" data-step="create">Ustvari bralni klub</button><button class="btn" data-act="fr-step" data-step="code">Imam kodo kluba</button></div></section>
      <section class="panel fr-how"><h2>Kako gre</h2><ol><li>Vsak bere s svojim Bralnim mentorjem kot doslej.</li><li>Za vsak bralni dan dobiš točke, za dan brez branja jih nekaj izgubiš. Ob ponedeljkih se začne nov teden.</li><li>V klepetu si pošiljate pohvale in priporočila.</li></ol><p class="hint">${PRIVACY}</p>
      ${S.me ? '' : '<button class="link" data-act="fr-step" data-step="restore">Imaš kodo za prenos s starega telefona?</button>'}</section>`;
  }

  function vClub(c) {
    const b = cache.boards[c.id], t = today(), mon = RG.weekStart(t), mine = c.owner === S.me.id;
    const chips = cache.clubs.length > 1 ? `<div class="fr-chips" role="tablist">${cache.clubs.map(x => `<button role="tab" aria-selected="${x.id === c.id}" data-act="fr-club" data-id="${x.id}">${esc(x.name)}${x.id !== c.id && x.last > (seen()[x.id] || 0) ? '<i class="dot"></i>' : ''}</button>`).join('')}</div>` : '';
    const R = RG.RULES[c.rules] || RG.RULES.A;
    let board = '<p class="muted fr-wait">Nalagam lestvico …</p>';
    if (b && b.members) {
      const list = standings(b), win = lastWeek(b), crown = id => win && win.ids.includes(id);
      const rows = ui.mode === 'all' ? ranked(list, x => x.s.total || 0) : ranked(list, x => x.P.total * 1e4 + x.P.minutes);
      board = `<div class="fr-board">${rows.map(x => {
        const s = x.s, isMe = x.m.id === S.me.id, L = RG.LEVELS[s.level || 0] ? s.level || 0 : 0;
        const right = ui.mode === 'all' ? `<b>${fmtHours(s.total || 0)}</b><small>skupaj</small>` : `<b>${x.P.total < 0 ? '−' + Math.abs(x.P.total) : x.P.total}</b><small>${plural(Math.abs(x.P.total), PTS)}</small>`;
        const sub = ui.mode === 'all' ? `<span class="fr-sub">${esc(RG.LEVELS[L][1])} · ${s.year || 0} ${plural(s.year || 0, ['knjiga', 'knjigi', 'knjige', 'knjig'])} letos</span>` : `${miniWeek(x.P)}<span class="fr-sub">${fmtMin(x.P.minutes * 60)}</span>`;
        return `<button class="fr-row${isMe ? ' me' : ''}" data-act="fr-member" data-id="${esc(x.m.id)}"><span class="fr-place">${x.place}</span><span class="fr-kid">${KID(L, 52)}</span>
          <span class="fr-main"><span class="fr-name"><b>${esc(x.m.name)}</b>${isMe ? '<small>ti</small>' : ''}${crown(x.m.id) ? ICF.crown : ''}${live(s) ? '<span class="chip live"><i></i>bere</span>' : ''}</span>${sub}</span>
          <span class="fr-pts">${right}</span></button>`;
      }).join('')}</div>
      ${win ? `<p class="fr-win">${ICF.crown}<span>Zmaga prejšnjega tedna: <b>${esc(win.names.join(', '))}</b> · ${win.pts} ${plural(win.pts, PTS)}</span></p>` : ''}
      ${b.members.length < 2 ? `<p class="hint">Sam si v klubu. Povabi prijatelje, da bo lestvica zaživela.</p>` : ''}`;
    } else if (!online) board = `<p class="muted fr-wait">${ERR.net}</p>`;
    return `${chips}<div class="fr-head"><div style="min-width:0"><h1 class="title">${esc(c.name)}</h1><p class="lede">${c.n || 1} ${plural(c.n || 1, MEMBERS)} · točke: ${esc(R.name)}</p></div><button class="iconbtn" data-act="fr-settings" aria-label="Nastavitve kluba">${ICF.more}</button></div>
    <section class="panel fr-top">
      <div class="seg" role="tablist"><button role="tab" aria-selected="${ui.mode === 'week'}" data-act="fr-mode" data-mode="week">Ta teden</button><button role="tab" aria-selected="${ui.mode === 'all'}" data-act="fr-mode" data-mode="all">Skupaj</button></div>
      <p class="fr-range">${ui.mode === 'week' ? 'Teden ' + esc(weekLabel(mon)) + ' · točke' : 'Ves čas branja z Bralnim mentorjem'}</p>
      ${board}
      <details class="fr-rules"><summary>Kako se zbirajo točke</summary><p class="hint">${esc(R.note)}</p><dl>${ruleLines(c.rules).map(l => `<div><dt>${esc(l[0])}</dt><dd>${esc(l[1])}</dd></div>`).join('')}</dl><p class="hint">Branje, krajše od ${R.min} min, ${R.per ? 'prinese samo točke za minute' : 'ne prinese točk'}, a tudi nič ne odvzame. Današnji dan ne odvzame točk, dokler se ne konča. Nov teden se začne v ponedeljek.</p></details>
      <button class="btn" data-act="fr-invite">${ICF.share}Povabi prijatelje</button>
    </section>
    ${chat(c)}`;
  }

  function chat(c) {
    const f = cache.feeds[c.id] || [], byId = {}; f.forEach(m => { byId[m.id] = m; });
    const one = m => {
      const mineMsg = m.who === S.me.id, n = (m.bravo || []).length, on = (m.bravo || []).includes(S.me.id);
      const names = (m.bravo || []).map(id => { const x = (cache.boards[c.id] && cache.boards[c.id].members || []).find(y => y.id === id); return x ? x.name : ''; }).filter(Boolean).join(', ');
      const bravo = `<button class="bravo${on ? ' on' : ''}" data-act="fr-bravo" data-id="${m.id}" aria-pressed="${on}" title="${esc(names)}">${ICF.star}<span>Bravo${n ? ' ' + n : ''}</span></button>`;
      const reply = `<button class="re-btn" data-act="fr-reply" data-id="${m.id}" aria-label="Odgovori">${ICF.reply}</button>`;
      const del = mineMsg ? `<button class="del-msg${ui.armed === m.id ? ' armed' : ''}" data-act="fr-unsay" data-id="${m.id}">${ui.armed === m.id ? 'Izbriši za vedno' : 'Izbriši'}</button>` : '';
      if (m.kind === 'event') {
        const e = eventText(m); if (!e) return '';
        return `<div class="ev" data-kind="${e[1]}">${e[1] === 'level' ? `<span class="ev-kid">${KID(e[2], 34)}</span>` : EV_IC[e[1]] || ''}<p>${e[0]}<time>${ago(m.at)}</time></p><div class="msg-acts">${bravo}${reply}</div></div>`;
      }
      const q = m.re ? byId[m.re] : null, qt = q ? (q.kind === 'event' ? ((eventText(q) || [''])[0].replace(/<[^>]+>/g, '')) : (q.name ? q.name + ': ' : '') + q.body) : m.re ? 'Starejše sporočilo' : '';
      return `<div class="msg${mineMsg ? ' mine' : ''}">${m.re ? `<p class="quote">${esc(qt.length > 90 ? qt.slice(0, 88) + '…' : qt)}</p>` : ''}<p class="msg-h"><b>${esc(m.name || 'Nekdanji član')}</b><time>${ago(m.at)}</time></p><p class="msg-b">${esc(m.body)}</p><div class="msg-acts">${bravo}${reply}${del}</div></div>`;
    };
    const rq = ui.reply ? byId[ui.reply] : null, rqt = rq ? (rq.kind === 'event' ? ((eventText(rq) || [''])[0].replace(/<[^>]+>/g, '')) : (rq.name || '') + ': ' + rq.body) : '';
    return `<section class="panel fr-chat" id="fr-chat"><div class="head"><h2>Klepet</h2><span class="muted" style="font-size:.85rem">pohvale, priporočila, izzivi</span></div>
      ${f.length && ui.more[c.id] !== 'end' && f.length >= 60 ? '<button class="link" data-act="fr-older">Starejša sporočila</button>' : ''}
      <div class="feed">${f.length ? f.map(one).join('') : '<p class="muted">Še tiho. Pohvali koga ali povej, kaj bereš.</p>'}</div>
      ${rq ? `<div class="replying"><span>Odgovor na: ${esc(rqt.length > 70 ? rqt.slice(0, 68) + '…' : rqt)}</span><button class="link" data-act="fr-reply" data-id="">Prekliči</button></div>` : ''}
      <div class="compose"><textarea id="fr-text" rows="1" maxlength="500" placeholder="${rq ? 'Tvoj komentar …' : 'Napiši sporočilo …'}" aria-label="Sporočilo">${esc(draft)}</textarea><button class="send" data-act="fr-send" aria-label="Pošlji">${ICF.send}</button></div>
    </section>`;
  }

  function view_() {
    if (!enabled() && !DEMO) return vOff();
    return me() && cache.clubs.length && !ui.invite && ui.step === 'start' ? vClub(curClub()) : vStart();
  }

  // after each render: keep what's typed and where the cursor was; mark the chat read
  let hadFocus = false;
  function after() {
    const ta = $('#fr-text');
    if (ta) {
      ta.value = draft; grow(ta);
      if (hadFocus) { ta.focus(); try { ta.setSelectionRange(draft.length, draft.length); } catch (e) {} }
    }
    const c = curClub(); if (view === 'friends' && c && cache.boards[c.id]) markSeen(c.id, cache.boards[c.id].last);
    paintDot();
  }
  const grow = ta => { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight + 2) + 'px'; ta.style.overflowY = ta.scrollHeight > 158 ? 'auto' : 'hidden'; };
  document.addEventListener('input', e => {
    if (e.target.id === 'fr-text') { draft = e.target.value; grow(e.target); }
    if (e.target.id === 'fr-code') { const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); if (v !== e.target.value) e.target.value = v; ui.codeVal = v; if (v.length === 6) peek(v); else { ui.peek = null; const p = $('#fr-peek'); if (p) p.textContent = ''; } }
    if (e.target.id === 'fr-club') ui.clubVal = e.target.value;
    if (e.target.id === 'fr-name') ui.nameVal = e.target.value;
  });
  document.addEventListener('focusin', e => { if (e.target.id === 'fr-text') hadFocus = true; });
  document.addEventListener('focusout', e => { if (e.target.id === 'fr-text') setTimeout(() => { if (document.activeElement && document.activeElement.id !== 'fr-text') hadFocus = false; }, 0); });
  document.addEventListener('keydown', e => {
    if (e.target.id === 'fr-text' && e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(hover:hover)').matches) { e.preventDefault(); send(); }
    if (e.key === 'Enter' && ['fr-name', 'fr-code', 'fr-club', 'fr-transfer'].includes(e.target.id)) { e.preventDefault(); const b = document.querySelector('.fr-form .btn.primary'); if (b) b.click(); }
  });

  // the dot on the Prijatelji tab: new messages since the chat was last open
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
    cache.clubs = r.clubs || []; keepCache(); save(); keepMe();
  }
  async function rename(name) {
    const r = await rpc('bm_register', { p_id: S.me.id, p_key: S.me.key, p_name: name });
    S.me.name = r.name; save(); keepMe(); cache.clubs = r.clubs || cache.clubs; keepCache();
  }
  function useClubs(clubs, id) { cache.clubs = clubs || []; if (id != null) lsSet('bm2-club', String(id)); keepCache(); }
  async function peek(code) {
    try { const p = await rpc('bm_peek', { p_code: code }); ui.peek = p; const el = $('#fr-peek'); if (el) el.textContent = p ? 'Klub »' + p.name + '«, ' + p.n + ' ' + plural(p.n, MEMBERS) : 'Kluba s to kodo ni.'; else if (view === 'friends') render(); }
    catch (e) {}
  }
  function join() {
    const code = ui.invite || val('fr-code').toUpperCase(), name = val('fr-name');
    if (code.length !== 6) { ui.err = 'Koda kluba ima 6 znakov.'; return render(); }
    return busy(async () => {
      await ensureMe(name || (S.me && S.me.name));
      const r = await rpc('bm_join', Object.assign(auth(), { p_code: code }));
      useClubs(r.clubs, r.id); ui.invite = null; ui.peek = null; ui.codeVal = ''; ui.step = 'start'; lsSet('bm2-invite', '');
      lastSent = ''; await sync(); await refresh(true); toast('Dobrodošel v klubu. Ob ponedeljkih se začne nov teden.');
    });
  }
  function create() {
    const name = val('fr-name'), club = val('fr-club') || 'Bralni klub';
    return busy(async () => {
      await ensureMe(name || (S.me && S.me.name));
      const r = await rpc('bm_create_club', Object.assign(auth(), { p_name: club, p_rules: 'A' }));
      useClubs(r.clubs, r.id); ui.step = 'start'; ui.clubVal = '';
      lastSent = ''; await sync(); await refresh(true);
      sheetInvite(cache.clubs.find(c => c.id === r.id));
    });
  }
  async function send() {
    const c = curClub(), body = draft.trim(); if (!c || !body) return;
    const re = ui.reply;
    draft = ''; ui.reply = null; const ta = $('#fr-text'); if (ta) { ta.value = ''; grow(ta); }
    try {
      await rpc('bm_post', Object.assign(auth(), { p_club: c.id, p_body: body, p_reply: re || null }));
      await refresh(true);
      const f = $('#fr-chat .feed'); if (f && f.lastElementChild) f.lastElementChild.scrollIntoView({ block: 'nearest' });
    } catch (e) { draft = body; ui.reply = re; render(); toast(errText(e)); }
  }
  async function bravo(id) {
    const c = curClub(), f = cache.feeds[c.id] || [], m = f.find(x => x.id === id); if (!m) return;
    const on = (m.bravo || []).includes(S.me.id);
    m.bravo = on ? m.bravo.filter(x => x !== S.me.id) : (m.bravo || []).concat(S.me.id); render(); vibrate(on ? 0 : 30);   // at once, then the server's answer
    try { m.bravo = await rpc('bm_bravo', Object.assign(auth(), { p_msg: id })); keepCache(); render(); } catch (e) { toast(errText(e)); refresh(true); }
  }
  async function unsay(id, el) {
    if (ui.armed !== id) { ui.armed = id; render(); setTimeout(() => { if (ui.armed === id) { ui.armed = null; render(); } }, 4000); return; }
    ui.armed = null;
    try { await rpc('bm_unsay', Object.assign(auth(), { p_msg: id })); const c = curClub(); cache.feeds[c.id] = (cache.feeds[c.id] || []).filter(m => m.id !== id); keepCache(); render(); }
    catch (e) { toast(errText(e)); }
  }
  async function invite(c) {
    if (!c) return;
    const url = location.origin + location.pathname.replace(/index\.html$/, '') + '#klub=' + c.code;
    const text = 'Pridruži se bralnemu klubu »' + c.name + '« v Bralnem mentorju (koda ' + c.code + '): ';
    if (navigator.share) { try { await navigator.share({ title: 'Bralni mentor', text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(text + url); toast('Povezava je kopirana. Prilepi jo prijateljem.'); } catch (e) { toast('Koda kluba: ' + c.code); }
  }
  async function copy(text, msg) { try { await navigator.clipboard.writeText(text); toast(msg); } catch (e) { toast('Kopiranje ni uspelo. Označi besedilo in ga kopiraj.'); } }

  // ---------- sheets: invite, member, club settings, transfer code
  function sheetInvite(c) {
    if (!c) return;
    openSheet('Povabi prijatelje', `<p class="muted">Pošlji jim povezavo. Ko jo odprejo, vpišejo ime in so v klubu »${esc(c.name)}«. Lahko pa v aplikaciji vpišejo kodo:</p>
      <p class="bigcode">${esc(c.code)}</p>
      <button class="btn primary" data-act="fr-invite">${ICF.share}Pošlji povezavo</button><button class="btn" data-act="fr-copycode">Kopiraj kodo</button>`);
  }
  function sheetMember(id) {
    const c = curClub(), b = c && cache.boards[c.id], m = b && b.members.find(x => x.id === id); if (!m) return;
    const s = statsOf(m), P = RG.weekPoints(c.rules, s.days || {}, s.since || null, today()), L = RG.LEVELS[s.level || 0] ? s.level || 0 : 0, isMe = id === S.me.id;
    const max = Math.max(30, ...P.days.map(d => d.min));
    const seenTxt = m.seen && !isMe ? 'Nazadnje v aplikaciji ' + ago(m.seen) + '.' : '';
    openSheet('', `<div class="detail fr-who">${KID(L, 104, false, true)}<div style="min-width:0; display:grid; gap:4px; justify-items:start"><h2>${esc(m.name)}${isMe ? ' <small class="muted">(ti)</small>' : ''}</h2><p class="muted">${esc(RG.LEVELS[L][1])} · stopnja ${L + 1} od ${RG.LEVELS.length}</p>${live(s) ? '<span class="chip live"><i></i>bere prav zdaj</span>' : ''}</div></div>
      ${s.reading ? `<p class="fr-reading">Trenutno bere: <b>${esc(s.reading)}</b></p>` : ''}
      <dl class="facts"><div><dt>Skupaj prebrano</dt><dd>${fmtHours(s.total || 0)}</dd></div><div><dt>Niz</dt><dd>${s.streak || 0} ${plural(s.streak || 0, DAYS)}</dd></div><div><dt>Prebrane knjige letos</dt><dd>${s.year || 0}</dd></div><div><dt>Najdaljši niz</dt><dd>${s.best || 0} ${plural(s.best || 0, DAYS)}</dd></div></dl>
      <div><div class="head" style="margin-bottom:6px"><h2 style="font-size:1.05rem">Ta teden</h2><b class="num">${P.total < 0 ? "−" + Math.abs(P.total) : P.total} ${plural(Math.abs(P.total), PTS)}</b></div>
      <div class="fr-days">${P.days.map(d => `<div class="${d.kind}"><span>${wd(d.k)}</span><i style="--h:${d.min ? Math.max(6, Math.round(Math.min(1, d.min / max) * 100)) : 0}%"></i><b>${d.kind === 'future' || d.kind === 'before' ? '' : signed(d.pts)}</b><small>${d.min ? d.min + ' min' : d.kind === 'miss' ? '0 min' : ''}</small></div>`).join('')}</div>
      ${P.full ? `<p class="hint">Poln teden: ${signed(P.bonus)} točk.</p>` : ''}</div>
      ${seenTxt ? `<p class="hint">${seenTxt}</p>` : ''}
      ${isMe ? '<button class="btn" data-act="fr-settings">Spremeni ime ali nastavitve</button>' : ''}
      ${!isMe && c.owner === S.me.id ? `<div class="danger-zone"><button class="del" data-act="fr-kick" data-id="${esc(id)}">Odstrani iz kluba</button></div>` : ''}`);
  }
  function sheetSettings() {
    const c = curClub(); if (!c) return;
    const own = c.owner === S.me.id;
    openSheet(c.name, `<div class="fr-set"><h3>Koda kluba</h3><p class="bigcode">${esc(c.code)}</p><div class="btns two"><button class="btn" data-act="fr-invite">Povabi</button><button class="btn" data-act="fr-copycode">Kopiraj kodo</button></div></div>
      <div class="fr-set"><h3>Pravila točk</h3>${own ? '' : '<p class="hint" style="margin-top:0">Pravila izbere ustanovitelj kluba.</p>'}
        <div class="rules">${Object.keys(RG.RULES).map(k => { const R = RG.RULES[k]; return `<button class="rule${c.rules === k ? ' on' : ''}" data-act="fr-rules" data-r="${k}" aria-pressed="${c.rules === k}"${own ? '' : ' disabled'}><b>${esc(R.name)}</b><span>${esc(R.note)}</span><small>${ruleLines(k).map(l => esc(l[0]) + ' ' + esc(l[1])).join(' · ')}</small></button>`; }).join('')}</div></div>
      ${own ? `<div class="fr-set"><label for="fr-clubname">Ime kluba<input type="text" id="fr-clubname" maxlength="40" value="${esc(c.name)}"></label><button class="btn" data-act="fr-clubname">Shrani ime kluba</button></div>` : ''}
      <div class="fr-set"><label for="fr-myname">Tvoje ime<input type="text" id="fr-myname" maxlength="24" value="${esc(S.me.name)}"></label><button class="btn" data-act="fr-myname">Shrani ime</button>
        <button class="switch" role="switch" aria-checked="${shareTitle()}" data-act="fr-sharetitle"><span>Prijatelji vidijo naslov knjige, ki jo bereš</span><i></i></button></div>
      <div class="fr-set"><h3>Še en klub</h3><div class="btns two"><button class="btn" data-act="fr-new" data-step="create">Ustvari nov klub</button><button class="btn" data-act="fr-new" data-step="code">Pridruži se s kodo</button></div></div>
      <div class="danger-zone"><button class="del" data-act="fr-leave">Zapusti klub</button><p class="err" id="fr-leave-note" hidden style="text-align:center">Tapni še enkrat. ${own && (c.n || 1) > 1 ? 'Klub prevzame najstarejši član.' : (c.n || 1) <= 1 ? 'Si zadnji član, zato se klub zapre.' : ''}</p></div>`);
  }
  function sheetTransfer() {
    if (!me()) return;
    const at = lsGet('bm2-backup-at');
    openSheet('Koda za prenos', `<p class="muted">S to kodo na novem telefonu preneseš knjige, vse branje in svoje mesto v klubih. Hrani jo zase: kdor jo ima, vidi tvoje branje.</p>
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
      save(); keepMe(); lastSent = '';
      await sync();
      closeSheet(); ui.step = 'start'; render();
      toast(added.b || added.s ? 'Preneseno: ' + added.b + ' ' + plural(added.b, BOOKS) + ' in ' + added.s + ' ' + plural(added.s, ['branje', 'branji', 'branja', 'branj']) + '.' : 'Profil je prenesen.');
    };
    try { ui.busy = true; await run(); } catch (e) { const t = errText(e); if (out) out.innerHTML = `<p class="err">${esc(t)}</p>`; else { ui.err = t; render(); } }
    ui.busy = false;
  }

  // the clicks this file handles (app.js passes on every data-act that starts with "fr-")
  async function act(el) {
    const id = el.dataset.id, c = curClub();
    switch (el.dataset.act) {
      case 'fr-step': ui.step = el.dataset.step; ui.err = ''; ui.peek = null; render(); { const f = document.querySelector('.fr-form input'); if (f) f.focus(); } break;
      case 'fr-new': closeSheet(); ui.step = el.dataset.step; ui.err = ''; render(); window.scrollTo(0, 0); break;
      case 'fr-noinvite': ui.invite = null; ui.peek = null; lsSet('bm2-invite', ''); render(); break;
      case 'fr-join': join(); break;
      case 'fr-create': create(); break;
      case 'fr-restore': restore(); break;
      case 'fr-club': lsSet('bm2-club', id); ui.reply = null; draft = ''; render(); refresh(true); break;
      case 'fr-mode': ui.mode = el.dataset.mode; render(); break;
      case 'fr-member': sheetMember(id); break;
      case 'fr-settings': sheetSettings(); break;
      case 'fr-invite': invite(c); break;
      case 'fr-copycode': if (c) copy(c.code, 'Koda ' + c.code + ' je kopirana.'); break;
      case 'fr-copytransfer': copy(codeOf(S.me), 'Koda za prenos je kopirana. Shrani jo na varno.'); break;
      case 'fr-send': send(); break;
      case 'fr-bravo': bravo(Number(id)); break;
      case 'fr-reply': ui.reply = id ? Number(id) : null; render(); if (id) { const ta = $('#fr-text'); if (ta) { ta.focus(); ta.scrollIntoView({ block: 'center' }); } } break;
      case 'fr-unsay': unsay(Number(id), el); break;
      case 'fr-older': older(); break;
      case 'fr-transfer': sheetTransfer(); break;
      case 'fr-restore-open': sheetRestore(); break;
      case 'fr-sharetitle': S.shareTitle = !shareTitle(); save(); el.setAttribute('aria-checked', String(shareTitle())); break;
      case 'fr-rules': {
        const r = el.dataset.r; if (!c || c.rules === r) return;
        try { useClubs(await rpc('bm_club_set', Object.assign(auth(), { p_club: c.id, p_rules: r })), c.id); closeSheet(); await refresh(true); toast('Nova pravila: ' + RG.RULES[r].name + '. Veljajo za ves teden.'); } catch (e) { toast(errText(e)); }
        break;
      }
      case 'fr-clubname': {
        const n = val('fr-clubname'); if (!c || !n) return;
        try { useClubs(await rpc('bm_club_set', Object.assign(auth(), { p_club: c.id, p_name: n })), c.id); closeSheet(); render(); toast('Shranjeno.'); } catch (e) { toast(errText(e)); }
        break;
      }
      case 'fr-myname': {
        const n = val('fr-myname'); if (!n) return;
        try { await rename(n); closeSheet(); await refresh(true); toast('Shranjeno.'); } catch (e) { toast(errText(e)); }
        break;
      }
      case 'fr-kick': {
        if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'Tapni še enkrat, da odstraniš'; return; }
        try { useClubs(await rpc('bm_kick', Object.assign(auth(), { p_club: c.id, p_member: id })), c.id); closeSheet(); await refresh(true); } catch (e) { toast(errText(e)); }
        break;
      }
      case 'fr-leave': {
        if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'Zapusti klub'; $('#fr-leave-note').hidden = false; return; }
        try { const r = await rpc('bm_leave', Object.assign(auth(), { p_club: c.id })); delete cache.boards[c.id]; delete cache.feeds[c.id]; useClubs(r); lsSet('bm2-club', ''); closeSheet(); render(); if (cache.clubs.length) refresh(true); toast('Klub je zapuščen.'); } catch (e) { toast(errText(e)); }
        break;
      }
      case 'fr-forget': {
        if (!el.classList.contains('armed')) { el.classList.add('armed'); el.textContent = 'Tapni še enkrat, da izbrišeš profil'; return; }
        try { await rpc('bm_forget', auth()); lost(); toast('Profil pri prijateljih je izbrisan. Branje na telefonu ostane.'); } catch (e) { toast(errText(e)); }
        break;
      }
    }
  }

  // ---------- a line on Danes: this week's place in the club
  function todayLine() {
    if (!me()) return '';
    const c = curClub(), b = c && cache.boards[c.id]; if (!b || !b.members || b.members.length < 2) return '';
    const list = ranked(standings(b), x => x.P.total * 1e4 + x.P.minutes), my = list.find(x => x.m.id === S.me.id); if (!my) return '';
    return `<button class="fr-line" data-act="tab" data-tab="friends"><span>${esc(c.name)}</span><b>${my.place}. mesto</b><span class="muted">${my.P.total < 0 ? "−" + Math.abs(my.P.total) : my.P.total} ${plural(Math.abs(my.P.total), PTS)} ta teden</span>${IC.next}</button>`;
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

  // ---------- start: an invite link (#klub=CODE) opens the friends' tab
  function init() {
    // local test server (test/server/up.sh): open the app on localhost with "#api=local" once
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      if (/[#&]api=local/.test(location.hash)) lsSet('bm2-api', 'local');
      if (lsGet('bm2-api') === 'local') { API = 'http://127.0.0.1:3000'; KEY = ''; }
    }
    if (!DEMO) try { const c = JSON.parse(lsGet('bm2-cache')); if (c && Array.isArray(c.clubs)) cache = Object.assign(cache, c); } catch (e) {}
    const m = location.hash.match(/klub=([A-Za-z0-9]{6})/);
    if (m) { ui.invite = m[1].toUpperCase(); lsSet('bm2-invite', ui.invite); try { history.replaceState(null, '', location.pathname); } catch (e) {} }
    else if (lsGet('bm2-invite')) ui.invite = lsGet('bm2-invite');
    if (ui.invite && me() && cache.clubs.some(c => c.code === ui.invite)) { ui.invite = null; lsSet('bm2-invite', ''); }
    if (ui.invite && enabled() && !DEMO) peek(ui.invite);
    return !!m;
  }
  // when the app opens or comes back: sync if it's been a while
  function wake() { if (me() && enabled() && !DEMO && Date.now() - lastSync > 60e3) sync(); if (view === 'friends') refresh(); }

  function demo(hash) {
    // example club for screenshots: Jan (the demo reader) and three friends
    const t = today(), mon = RG.weekStart(t), d = (i) => RG.addDays(mon, i), past = (n, mins) => Object.fromEntries(mins.map((m, i) => [RG.addDays(t, i - mins.length + 1), m * 60]).filter(x => x[1] > 0));
    S.me = { id: 'demojan000000000', key: 'x'.repeat(32), name: 'Jan', since: RG.addDays(t, -60) };
    const now = Date.now(), iso = ms => new Date(now - ms).toISOString();
    const fr = (id, name, level, total, mins, extra) => ({ id, name, joined: iso(30 * 864e5), seen: iso(3600e3), stats: Object.assign({ v: 1, at: iso(600e3), total, level, streak: 9, best: 21, finished: 8, year: 6, reading: null, run: 0, days: past(21, mins), since: RG.addDays(t, -90) }, extra) });
    const members = [
      { id: S.me.id, name: 'Jan', joined: iso(40 * 864e5), seen: iso(0), stats: {} },
      fr('demoana00000000a', 'Ana', 12, 205 * 3600, [30, 45, 25, 60, 20, 35, 40, 50, 30, 25, 45, 70, 30, 40, 25, 35, 30, 45, 25, 60, 22], { reading: 'Mali princ', streak: 34, best: 34, run: now - 1100e3, at: iso(60e3) }),
      fr('demomarko000000a', 'Marko', 7, 47 * 3600, [20, 0, 15, 30, 0, 45, 20, 15, 20, 0, 10, 40, 25, 20, 0, 30, 15, 20, 0, 25, 5], { reading: 'Sapiens', streak: 2, best: 9 }),
      fr('demopetra000000a', 'Petra', 9, 92 * 3600, [25, 30, 20, 0, 45, 30, 25, 30, 35, 20, 25, 0, 60, 90, 40, 30, 25, 20, 0, 15, 0], { reading: 'Igra prestolov', streak: 0, best: 15, year: 9 }),
    ];
    const club = { id: 1, code: 'K7M2QX', name: 'Knjižni molji', rules: 'A', owner: S.me.id, n: members.length, last: 9 };
    cache = { clubs: [club], boards: { 1: { club, members, last: 9 } }, feeds: { 1: [
      { id: 1, who: 'demopetra000000a', name: 'Petra', kind: 'event', body: '{"t":"join"}', at: iso(5 * 864e5), bravo: [] },
      { id: 2, who: 'demoana00000000a', name: 'Ana', kind: 'event', body: '{"t":"win","v":118,"w":"' + RG.addDays(mon, -7) + '"}', at: iso(4 * 864e5), bravo: [S.me.id, 'demomarko000000a', 'demopetra000000a'] },
      { id: 3, who: 'demomarko000000a', name: 'Marko', kind: 'msg', body: 'Kdo ima priporočilo za kaj kratkega? Sapiens se vleče 😅', at: iso(2 * 864e5), bravo: [] },
      { id: 4, who: 'demoana00000000a', name: 'Ana', kind: 'msg', body: 'Mali princ! Prebereš ga v dveh večerih.', at: iso(2 * 864e5 - 1800e3), bravo: ['demomarko000000a'], re: 3 },
      { id: 5, who: 'demopetra000000a', name: 'Petra', kind: 'event', body: '{"t":"book","v":"Alamut"}', at: iso(864e5 + 7200e3), bravo: ['demoana00000000a', S.me.id] },
      { id: 6, who: S.me.id, name: 'Jan', kind: 'msg', body: 'Bravo Petra! Alamut je na mojem seznamu.', at: iso(864e5), bravo: ['demopetra000000a'], re: 5 },
      { id: 7, who: 'demoana00000000a', name: 'Ana', kind: 'event', body: '{"t":"streak","v":30}', at: iso(5 * 3600e3), bravo: ['demopetra000000a'] },
      { id: 8, who: S.me.id, name: 'Jan', kind: 'event', body: '{"t":"level","v":6}', at: iso(3 * 3600e3), bravo: ['demoana00000000a', 'demomarko000000a'] },
      { id: 9, who: 'demomarko000000a', name: 'Marko', kind: 'msg', body: 'Ta teden vas ujamem. Nocoj berem do polnoči.', at: iso(1500e3), bravo: [] },
    ] } };
    const w = lastWeek(cache.boards[1]); if (w) cache.feeds[1][1].body = JSON.stringify({ t: 'win', v: w.pts, w: w.mon });
    if (/welcome/.test(hash)) { S.me = null; cache.clubs = []; }
    if (/invite/.test(hash)) { S.me = null; ui.invite = 'K7M2QX'; ui.peek = { name: 'Knjižni molji', n: 4 }; }
    if (/all/.test(hash)) ui.mode = 'all';
  }

  return { view: view_, after, act, enabled, changed, sync, wake, poll, event, moments, finished, init, todayLine, backupBlock, profileBlock, sheetMember, sheetSettings, demo, paintDot, me, keepMe };
})();
