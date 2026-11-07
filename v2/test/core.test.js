// node test/core.test.js
const assert = require('assert');
const RG = require('../core.js');
const goals = [{ from: '2026-01-01', min: 20 }];
const s = (day, min, run = day, manual = false) => ({ id: day + run, run, book: 'b1', day, sec: min * 60, manual });
const days = (from, n, min) => Array.from({ length: n }, (_, i) => s(RG.addDays(from, i), min));

// 7 goal days earn a bookmark; the missed day after them spends it and the streak lives on
let st = RG.streak([...days('2026-03-01', 7, 25), ...days('2026-03-09', 2, 25)], goals, '2026-03-10');
assert.deepStrictEqual([st.cur, st.marks, st.days['2026-03-08']], [9, 0, 'saved']);

// no bookmark: a missed day starts the streak again, the best streak stays
st = RG.streak([...days('2026-03-01', 3, 25), ...days('2026-03-05', 2, 25)], goals, '2026-03-06');
assert.deepStrictEqual([st.cur, st.best, st.days['2026-03-04']], [2, 3, 'miss']);

// today without the goal yet doesn't break anything
st = RG.streak([...days('2026-03-01', 3, 25), s('2026-03-04', 5)], goals, '2026-03-04');
assert.deepStrictEqual([st.cur, st.days['2026-03-04']], [3, 'open']);

// a day under the goal counts as missed
st = RG.streak([s('2026-03-01', 25), s('2026-03-02', 10), s('2026-03-03', 25)], goals, '2026-03-03');
assert.deepStrictEqual([st.cur, st.days['2026-03-02']], [1, 'miss']);

// bookmarks cap at 3
st = RG.streak(days('2026-01-01', 35, 30), goals, '2026-02-04');
assert.deepStrictEqual([st.cur, st.marks], [35, 3]);

// a raised goal counts from its day only
const g2 = [{ from: '2026-01-01', min: 20 }, { from: '2026-03-03', min: 40 }];
st = RG.streak(days('2026-03-01', 3, 25), g2, '2026-03-03');
assert.deepStrictEqual([st.days['2026-03-02'], st.days['2026-03-03']], ['tick', 'open']);

// levels
assert.strictEqual(RG.level(0).name, 'Novinec');
assert.strictEqual(RG.level(25 * 3600).name, 'Popotnik');
assert.strictEqual(RG.level(5000 * 3600).name, 'Razsvetljeni');
assert.ok(Math.abs(RG.level(20 * 3600).frac - 0.5) < 1e-9);

// a session across midnight is split between the two days
const a = new Date(2026, 2, 1, 23, 50).getTime(), b = new Date(2026, 2, 2, 0, 20).getTime();
assert.deepStrictEqual(RG.splitByDay([[a, b]]), { '2026-03-01': 600, '2026-03-02': 1200 });

// counting with the screen off: started 20:00, out of sight at 20:30, back at 21:42
const T = (d, h, m) => new Date(2026, 2, d, h, m).getTime(), sum = segs => segs.reduce((x, g) => x + (g[1] - g[0]), 0) / 60e3;
let w = RG.away(T(1, 20, 30), T(1, 21, 42));
assert.deepStrictEqual([w.ms / 60e3, w.ask, w.long], [72, true, false]);
assert.strictEqual(sum(RG.settle([], T(1, 20, 0), T(1, 20, 30), T(1, 21, 42), 'all')), 102);     // count it all
assert.strictEqual(sum(RG.settle([], T(1, 20, 0), T(1, 20, 30), T(1, 21, 42), 'until')), 30);    // only until the screen went off
// earlier parts of the run (before a pause) stay as they are
assert.deepStrictEqual(RG.settle([[T(1, 19, 0), T(1, 19, 10)]], T(1, 20, 0), T(1, 20, 30), T(1, 21, 0), 'until'), [[T(1, 19, 0), T(1, 19, 10)], [T(1, 20, 0), T(1, 20, 30)]]);
// up to 20 minutes away: no question; just over: the question
assert.strictEqual(RG.away(T(1, 20, 0), T(1, 20, 20)).ask, false);
assert.strictEqual(RG.away(T(1, 20, 0), T(1, 20, 21)).ask, true);
// more than 4 hours away: propose "only until the screen went off"
w = RG.away(T(1, 22, 0), T(2, 3, 0));
assert.deepStrictEqual([w.ask, w.long], [true, true]);
assert.strictEqual(RG.away(T(1, 22, 0), T(2, 2, 0)).long, false);
// across midnight: started 23:30, screen off at 23:50, back at 0:40
assert.deepStrictEqual(RG.splitByDay(RG.settle([], T(1, 23, 30), T(1, 23, 50), T(2, 0, 40), 'all')), { '2026-03-01': 1800, '2026-03-02': 2400 });
assert.deepStrictEqual(RG.splitByDay(RG.settle([], T(1, 23, 30), T(1, 23, 50), T(2, 0, 40), 'until')), { '2026-03-01': 1200 });
// a long night: off at 22:15, back at 7:05 the next morning, only until the screen went off
assert.deepStrictEqual(RG.splitByDay(RG.settle([], T(1, 21, 45), T(1, 22, 15), T(2, 7, 5), 'until')), { '2026-03-01': 1800 });
// a paused run (no open part) has nothing to settle
assert.deepStrictEqual(RG.settle([[T(1, 20, 0), T(1, 20, 5)]], null, T(1, 20, 5), T(1, 21, 0), 'all'), [[T(1, 20, 0), T(1, 20, 5)]]);

// record ignores typed-in time, sums the parts of one run
assert.strictEqual(RG.longestRun([s('2026-03-01', 10, 'r1'), s('2026-03-02', 20, 'r1'), s('2026-03-03', 90, 'r2', true)]), 1800);

// ---------- leaderboard points (week of Monday 2 Nov 2026 to Sunday 8 Nov)
assert.strictEqual(RG.weekStart('2026-11-07'), '2026-11-02');
assert.strictEqual(RG.weekStart('2026-11-02'), '2026-11-02');
assert.strictEqual(RG.weekStart('2026-11-08'), '2026-11-02');
const wk = (mins, start = '2026-11-02') => Object.fromEntries(mins.map((m, i) => [RG.addDays(start, i), m * 60]).filter(x => x[1] > 0));
// rules A: 25 min = 10 + 2, 70 min = 10 + 6 (cap), 8 min = short day 0, nothing = -5; Saturday is today: 12 min so far is
// still open (its minute point counts, no penalty), 40 min would already be a reading day
let P = RG.weekPoints('A', wk([25, 70, 8, 0, 15, 12, 0]), '2026-10-01', '2026-11-07');
assert.deepStrictEqual(P.days.map(d => d.kind), ['read', 'read', 'short', 'miss', 'read', 'open', 'future']);
assert.deepStrictEqual(P.days.map(d => d.pts), [12, 16, 0, -5, 11, 1, 0]);
assert.deepStrictEqual([P.total, P.read, P.minutes, P.full], [35, 3, 130, false]);
P = RG.weekPoints('A', wk([0, 0, 0, 0, 0, 40]), '2026-10-01', '2026-11-07');
assert.deepStrictEqual([P.days[5].kind, P.days[5].pts, P.total], ['read', 14, 14 - 25]);
// a full week earns the bonus (Sunday evening)
P = RG.weekPoints('A', wk([20, 20, 20, 20, 20, 20, 20]), '2026-10-01', '2026-11-08');
assert.deepStrictEqual([P.total, P.read, P.full, P.bonus], [7 * 12 + 20, 7, true, 20]);
// rules B: only whether you read (10 min is enough)
P = RG.weekPoints('B', wk([10, 120, 0, 9, 0, 0, 0]), '2026-10-01', '2026-11-08');
assert.deepStrictEqual(P.days.map(d => d.pts), [10, 10, -10, 0, -10, -10, 0]);   // Sunday is today, still open
assert.strictEqual(P.total, -10);
// rules C: one point a minute up to 120 a day
P = RG.weekPoints('C', wk([30, 200, 0]), '2026-10-01', '2026-11-05');
assert.deepStrictEqual(P.days.map(d => d.pts).slice(0, 3), [30, 120, -20]);
// days before the reader started don't count, the start day does; today read counts at once
P = RG.weekPoints('A', wk([0, 0, 0, 30]), '2026-11-05', '2026-11-05');
assert.deepStrictEqual(P.days.map(d => d.kind).slice(0, 5), ['before', 'before', 'before', 'read', 'future']);
assert.strictEqual(P.total, 13);
// last week, looked at from this week: everything has happened
P = RG.weekPoints('A', wk([20, 0, 0, 0, 0, 0, 30], '2026-10-26'), '2026-10-01', '2026-11-04', '2026-10-28');
assert.deepStrictEqual([P.days[0].k, P.days[6].k, P.total], ['2026-10-26', '2026-11-01', 12 - 25 + 13]);
// unknown rules fall back to A; no data at all is all misses
assert.strictEqual(RG.weekPoints('Z', {}, null, '2026-11-03').total, -5);

console.log('core ok');
