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
assert.strictEqual(RG.level(0).name, 'Črkolovec');
assert.strictEqual(RG.level(25 * 3600).name, 'Knjižni molj z očali');
assert.strictEqual(RG.level(5000 * 3600).name, 'Razsvetljeni');
assert.ok(Math.abs(RG.level(20 * 3600).frac - 0.5) < 1e-9);

// a session across midnight is split between the two days
const a = new Date(2026, 2, 1, 23, 50).getTime(), b = new Date(2026, 2, 2, 0, 20).getTime();
assert.deepStrictEqual(RG.splitByDay([[a, b]]), { '2026-03-01': 600, '2026-03-02': 1200 });

// record ignores typed-in time, sums the parts of one run
assert.strictEqual(RG.longestRun([s('2026-03-01', 10, 'r1'), s('2026-03-02', 20, 'r1'), s('2026-03-03', 90, 'r2', true)]), 1800);

console.log('core ok');
