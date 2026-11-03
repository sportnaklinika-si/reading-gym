/* Bralni mentor rules: days, the streak with bookmarks, levels. No page code here, so node can test it (test/core.test.js). */
(function (root) {
  // [hours of reading, name, what the kid has at this level (kid.js draws it)].
  // One kid grows from letter-catcher to the enlightened mentor: bronze ring for the first six, silver for the next six, gold for the last six.
  const LEVELS = [
    [0, 'Črkolovec', 'letters'],
    [1, 'Listalec slikanic', 'picturebook'],
    [3, 'Zlogovalec', 'syllables'],
    [6, 'Mali knjižni molj', 'worm'],
    [10, 'Lovilec zgodb', 'net'],
    [15, 'Bralec pod odejo', 'blanket'],
    [25, 'Knjižni molj z očali', 'glasses'],
    [40, 'Nabiralec knjig', 'backpack'],
    [60, 'Stalni gost knjižnice', 'card'],
    [85, 'Požiralec poglavij', 'stack'],
    [120, 'Popotnik med platnicami', 'hat'],
    [170, 'Varuh bralne lučke', 'lamp'],
    [240, 'Junak v plašču iz strani', 'cape'],
    [330, 'Modri bralec', 'calm'],
    [450, 'Lebdeči bralec', 'float'],
    [600, 'Mojster tišine', 'orbit'],
    [800, 'Bralni mentor', 'owl'],
    [1000, 'Razsvetljeni', 'light'],
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
    return { i, name: LEVELS[i][1], icon: LEVELS[i][2], h, next: next ? next[0] : null, nextName: next ? next[1] : null,
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

  const RG = { LEVELS, MARK_EVERY, MARK_MAX, dayKey, keyDate, addDays, goalFor, dayTotals, streak, level, splitByDay, bookTotals, longestRun };
  if (typeof module !== 'undefined' && module.exports) module.exports = RG; else root.RG = RG;
})(this);
