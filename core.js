/* Bralni mentor rules: days, the streak with bookmarks, levels. No page code here, so node can test it (test/core.test.js). */
(function (root) {
  // THE LEVEL TABLE: [hours of reading, name, one-line note]. The names (the set "Pot mojstra") and notes live only here.
  // kid.js draws the reader growing up across these 18 levels (bronze ring for the first six, silver for the next six, gold for the last six).
  const LEVELS = [
    [0, 'Novinec', 'Prva slikanica in prvi muc. Oba grizeta vogale.'],
    [1, 'Vajenec', 'Muc zaspi po prvi strani. Ti po drugi.'],
    [3, 'Pridni vajenec', 'Muc se igra z volno, ti z besedami.'],
    [6, 'Učenec', 'Ob oknu: ti bereš črke, muc gleda ptice.'],
    [10, 'Marljivi učenec', 'Muc se je ulegel na knjigo. Pravi, da je zanimiva.'],
    [15, 'Pomočnik', 'Muc ima škatlo, ti imaš novo poglavje.'],
    [25, 'Popotnik', 'Slušalke so tvoje, muc jih ima raje.'],
    [40, 'Raziskovalec', 'Muc preverja, ali knjige padajo. Padajo.'],
    [60, 'Iskalec', 'Muc spet leži na knjigi. Tokrat na tvoji.'],
    [85, 'Poznavalec', 'Fotelj, kava in muc v naročju. Ne premikaj se.'],
    [120, 'Pripovedovalec', 'Muc na naslonjalu bere čez ramo.'],
    [170, 'Mojster', 'Kava se hladi, ker je zgodba boljša.'],
    [240, 'Učitelj', 'Muc na oknu šteje ptice, ti strani.'],
    [330, 'Svetovalec', 'Muc je osvojil vrh knjižne omare.'],
    [450, 'Mentor', 'Lučka greje knjigo in muca hkrati.'],
    [600, 'Modrec', 'Muc ima zdaj svoja očala. In svojo knjigo.'],
    [800, 'Veliki modrec', 'Stari prijatelji: ti, muc in prva slikanica.'],
    [1000, 'Razsvetljeni', 'Tisoč ur kasneje: soba je polna knjig in svetlobe.'],
  ];
  const MARK_EVERY = 7, MARK_MAX = 3;

  const pad = n => String(n).padStart(2, '0');
  const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const keyDate = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (k, n) => { const d = keyDate(k); d.setDate(d.getDate() + n); return dayKey(d); };

  // The goal that applied on day k: a change of goal counts from the day it was made, older days keep theirs.
  function goalFor(goals, k) { let g = goals[0].min; for (const x of goals) if (x.from <= k) g = x.min; return g; }

  function dayTotals(sessions) { const t = {}; for (const s of sessions) t[s.day] = (t[s.day] || 0) + s.sec; return t; }

  // Every 7 days with the goal reached earn a bookmark (up to 3). A missed day spends one and the streak goes on;
  // with none left the streak starts again. Today only counts once the goal is reached, so it can't break the streak.
  function streak(sessions, goals, today) {
    const tot = dayTotals(sessions), days = {};
    const keys = Object.keys(tot).filter(k => tot[k] > 0).sort();
    let cur = 0, best = 0, marks = 0, earn = 0;
    if (!keys.length) return { cur, best, marks, earn, days };
    for (let k = keys[0]; k <= today; k = addDays(k, 1)) {
      const hit = (tot[k] || 0) >= goalFor(goals, k) * 60;
      if (k === today && !hit) { days[k] = 'open'; break; }
      if (hit) { cur++; days[k] = 'tick'; if (++earn === MARK_EVERY) { earn = 0; marks = Math.min(MARK_MAX, marks + 1); } }
      else if (marks > 0) { marks--; days[k] = 'saved'; }
      else { cur = 0; earn = 0; days[k] = 'miss'; }
      best = Math.max(best, cur);
    }
    return { cur, best, marks, earn, days };
  }

  function level(sec) {
    const h = sec / 3600; let i = 0;
    while (i + 1 < LEVELS.length && h >= LEVELS[i + 1][0]) i++;
    const next = LEVELS[i + 1];
    return { i, name: LEVELS[i][1], note: LEVELS[i][2], h, next: next ? next[0] : null, nextName: next ? next[1] : null,
      frac: next ? (h - LEVELS[i][0]) / (next[0] - LEVELS[i][0]) : 1 };
  }

  // A reading session can run past midnight: each part counts for its own day. segs = [[startMs, endMs], ...]
  function splitByDay(segs) {
    const out = {};
    for (let [a, b] of segs) {
      while (a < b) {
        const d = new Date(a), mid = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
        const e = Math.min(b, mid), k = dayKey(a);
        out[k] = (out[k] || 0) + (e - a) / 1000; a = e;
      }
    }
    return out;
  }

  // The timer can keep counting while the screen is off. A web app doesn't run then, so the running part is only its start time and
  // the clock catches up from timestamps. Back after more than 20 minutes out of sight, the reader is asked how much counts;
  // after more than 4 hours the proposal is "only until the screen went off".
  const AWAY_ASK = 20 * 60e3, AWAY_LONG = 4 * 3600e3;
  function away(hid, back) { const ms = Math.max(0, back - hid); return { ms, ask: ms > AWAY_ASK, long: ms > AWAY_LONG }; }
  // The segments that count when the answer is given: 'all' runs the open part on to now, 'until' ends it where the app went out of sight.
  // at = start of the open part, hid = when the app went out of sight.
  function settle(segs, at, hid, now, choice) {
    const end = choice === 'until' ? Math.min(hid, now) : now;
    return at && end > at ? segs.concat([[at, end]]) : segs.slice();
  }

  function bookTotals(sessions) {
    const t = {};
    for (const s of sessions) {
      const b = t[s.book] = t[s.book] || { sec: 0, runs: new Set(), first: s.day, last: s.day };
      b.sec += s.sec; b.runs.add(s.run);
      if (s.day < b.first) b.first = s.day;
      if (s.day > b.last) b.last = s.day;
    }
    return t;
  }

  // Longest timed session (time typed in by hand doesn't count as a record).
  function longestRun(sessions) {
    const r = {};
    for (const s of sessions) if (!s.manual) r[s.run] = (r[s.run] || 0) + s.sec;
    let m = 0; for (const v of Object.values(r)) if (v > m) m = v;
    return m;
  }

  // ---------- the friends' leaderboard: points per week (Monday to Sunday)
  // Three sets of rules; the friends' board uses A (Jan's pick, B and C stay for later). For every day of the week up to yesterday, and today once it counts:
  //   a reading day (at least `min` minutes) earns `day` points, every `per` minutes earn 1 point (at most `cap` a day),
  //   a day without any reading costs `miss` points, and seven reading days in the week add `week`.
  //   A short day (some reading, under `min`) earns only its minute points: something is better than nothing.
  //   Days before the reader started with the app (`since`) don't count, and neither do days still to come.
  const RULES = {
    A: { name: 'Uravnoteženo', note: 'Vsak dan šteje in vsaka minuta malo pomaga.', min: 15, day: 10, per: 10, cap: 6, miss: -5, week: 20 },
    B: { name: 'Vsak dan', note: 'Šteje samo, ali bereš vsak dan. Dolžina ni pomembna.', min: 10, day: 10, per: 0, cap: 0, miss: -10, week: 30 },
    C: { name: 'Minute', note: 'Vsaka minuta je točka. Prazen dan pa boli.', min: 15, day: 0, per: 1, cap: 120, miss: -20, week: 50 },
  };
  const weekStart = k => addDays(k, -((keyDate(k).getDay() + 6) % 7));   // the Monday of day k's week
  // days = { 'YYYY-MM-DD': seconds }, since = first day with the app, today = the viewer's day, week = any day in the week to score.
  // Returns the total and one entry per day: { k, min, kind: 'read' | 'short' | 'miss' | 'open' | 'before' | 'future', pts }.
  function weekPoints(rules, days, since, today, week) {
    const R = RULES[rules] || RULES.A, mon = weekStart(week || today), out = [];
    let total = 0, read = 0, minutes = 0;
    for (let i = 0; i < 7; i++) {
      const k = addDays(mon, i), min = Math.floor(((days && days[k]) || 0) / 60);
      let kind, pts = 0;
      if (k > today) kind = 'future';
      else if (since && k < since) kind = 'before';
      else {
        const tp = R.per ? Math.min(R.cap, Math.floor(min / R.per)) : 0;
        if (min >= R.min) { kind = 'read'; pts = R.day + tp; read++; }
        else if (k === today) { kind = 'open'; pts = tp; }   // today isn't over: no penalty yet
        else if (min > 0) { kind = 'short'; pts = tp; }
        else { kind = 'miss'; pts = R.miss; }
      }
      if (kind !== 'future' && kind !== 'before') minutes += min;
      total += pts; out.push({ k, min, kind, pts });
    }
    const full = read === 7;
    if (full) total += R.week;
    return { total, days: out, read, minutes, full, bonus: full ? R.week : 0 };
  }

  const RG = { LEVELS, MARK_EVERY, MARK_MAX, AWAY_ASK, AWAY_LONG, RULES, dayKey, keyDate, addDays, goalFor, dayTotals, streak, level, splitByDay, away, settle, bookTotals, longestRun, weekStart, weekPoints };
  if (typeof module !== 'undefined' && module.exports) module.exports = RG; else root.RG = RG;
})(this);
