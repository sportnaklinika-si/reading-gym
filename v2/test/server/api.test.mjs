// The friends' server end to end, against the local stack from up.sh (or any URL in BM_URL, with BM_KEY if the server wants one).
// Run: docker run --rm --network bm-test -v "<v2>:/app" -w /app node:24-alpine node test/server/api.test.mjs
import assert from 'node:assert/strict';
const URL_ = process.env.BM_URL || 'http://bm-api:3000', KEY = process.env.BM_KEY || '';
const H = { 'Content-Type': 'application/json', ...(KEY ? { apikey: KEY } : {}), ...(KEY.startsWith('eyJ') ? { Authorization: 'Bearer ' + KEY } : {}) };
async function rpc(fn, args) {
  const r = await fetch(URL_ + '/rpc/' + fn, { method: 'POST', headers: H, body: JSON.stringify(args || {}) });
  const t = await r.text(), d = t ? JSON.parse(t) : null;
  if (!r.ok) { const e = new Error((d && d.message) || r.status); e.status = r.status; throw e; }
  return d;
}
const fails = async (p, msg) => { try { await p; } catch (e) { assert.match(String(e.message), new RegExp(msg)); return; } assert.fail('expected ' + msg); };
const rnd = n => Array.from({ length: n }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
const who = name => ({ p_id: rnd(16), p_key: rnd(32), name });
const A = who('Jan'), B = who('Ana'), C = who('Marko'), D = who('Petra'), id = m => ({ p_id: m.p_id, p_key: m.p_key });
const everyone = [A, B, C, D];

// registering gives a personal code; the same id with another key is refused
let r = await rpc('bm_register', { ...id(A), p_name: '  Jan  ' });
assert.equal(r.name, 'Jan'); assert.equal(r.friends, 0); assert.match(r.code, /^[A-HJ-NP-Z2-9]{8}$/);
A.code = r.code;
for (const m of [B, C, D]) m.code = (await rpc('bm_register', { ...id(m), p_name: m.name })).code;
assert.equal(new Set(everyone.map(m => m.code)).size, 4);
assert.equal((await rpc('bm_register', { ...id(A), p_name: 'Jan V.' })).code, A.code, 'a new name keeps the code');
await rpc('bm_register', { ...id(A), p_name: 'Jan' });
await fails(rpc('bm_register', { p_id: A.p_id, p_key: rnd(32), p_name: 'Thief' }), 'bm:auth');
await fails(rpc('bm_register', { p_id: 'SHORT', p_key: rnd(32), p_name: 'X' }), 'bm:bad');
await fails(rpc('bm_register', { p_id: rnd(16), p_key: rnd(32), p_name: '   ' }), 'bm:name');
await fails(rpc('bm_register', { p_id: rnd(16), p_key: rnd(32), p_name: 'x'.repeat(25) }), 'bm:name');

// the tables are closed: only the functions answer
for (const t of ['bm_members', 'bm_friends', 'bm_messages', 'bm_bravo']) {
  const res = await fetch(URL_ + '/' + t, { headers: H }); assert.ok(res.status === 401 || res.status === 403 || res.status === 404, t + ' answered ' + res.status);
}
for (const f of ['bm__me', 'bm__sees', 'bm__info', 'bm__newcode', 'bm__code']) await fails(rpc(f, {}), '.');

// adding friends by code: both ways, with or without a space, twice is fine
assert.deepEqual(await rpc('bm_peek', { p_code: B.code.slice(0, 4).toLowerCase() + ' ' + B.code.slice(4) }), { name: 'Ana' });
assert.equal(await rpc('bm_peek', { p_code: 'ZZZZZZZZ' }), null);
assert.equal(await rpc('bm_peek', { p_code: B.code.slice(0, 6) }), null);
r = await rpc('bm_add', { ...id(A), p_code: B.code });
assert.equal(r.ok, true); assert.deepEqual(r.friend, { id: B.p_id, name: 'Ana' }); assert.equal(r.me.friends, 1);
r = await rpc('bm_add', { ...id(B), p_code: A.code.slice(0, 4) + '-' + A.code.slice(4) });
assert.equal(r.ok, true); assert.equal(r.me.friends, 1);
assert.deepEqual(await rpc('bm_add', { ...id(A), p_code: A.code }), { ok: false, err: 'self' });
assert.deepEqual(await rpc('bm_add', { ...id(A), p_code: 'ZZZZZZZZ' }), { ok: false, err: 'nocode' });
await fails(rpc('bm_add', { p_id: C.p_id, p_key: 'wrong-key-wrong-key-wrong', p_code: A.code }), 'bm:auth');
await rpc('bm_add', { ...id(B), p_code: C.code });   // Ana and Marko; Jan and Marko are not friends
await rpc('bm_add', { ...id(D), p_code: A.code });   // Petra and Jan

// the board: me first, then my friends; a friend's stats as sent
const stats = { v: 1, total: 36000, level: 4, streak: 6, days: { '2026-11-02': 1500, '2026-11-03': 900 }, since: '2026-11-02' };
await rpc('bm_sync', { ...id(B), p_stats: stats });
r = await rpc('bm_board', { ...id(A) });
assert.deepEqual(r.members.map(m => m.name), ['Jan', 'Ana', 'Petra']);
assert.deepEqual(r.members.find(m => m.id === B.p_id).stats, stats);
r = await rpc('bm_board', { ...id(B) });
assert.deepEqual(r.members.map(m => m.name).sort(), ['Ana', 'Jan', 'Marko']);
assert.deepEqual((await rpc('bm_board', { ...id(C) })).members.map(m => m.name).sort(), ['Ana', 'Marko']);
await fails(rpc('bm_sync', { ...id(B), p_stats: { big: 'x'.repeat(30000) } }), 'bm:big');

// posts: my friends see them, friends of friends don't
const pJ = (await rpc('bm_post', { ...id(A), p_body: '  Kdo bere kaj ta teden?  ' })).id;
const pM = (await rpc('bm_post', { ...id(C), p_body: 'Marko tukaj.' })).id;
await fails(rpc('bm_post', { ...id(A), p_body: '   ' }), 'bm:bad');
await fails(rpc('bm_post', { ...id(A), p_body: 'x'.repeat(501) }), 'bm:bad');
const bodies = async m => (await rpc('bm_feed', { ...id(m) })).map(x => x.body);
assert.deepEqual(await bodies(A), ['Kdo bere kaj ta teden?']);
assert.deepEqual(await bodies(B), ['Kdo bere kaj ta teden?', 'Marko tukaj.']);
assert.deepEqual(await bodies(C), ['Marko tukaj.']);
assert.deepEqual(await bodies(D), ['Kdo bere kaj ta teden?']);

// comments join the post's thread: Ana comments on Jan's post, so Petra (Jan's friend) sees it, Marko doesn't
const cA = (await rpc('bm_post', { ...id(B), p_body: 'Alamut!', p_reply: pJ })).id;
let feed = await rpc('bm_feed', { ...id(D) });
assert.deepEqual(feed.map(x => [x.body, x.re, x.owner]), [['Kdo bere kaj ta teden?', null, A.p_id], ['Alamut!', pJ, A.p_id]]);
assert.equal(feed[1].name, 'Ana');
assert.ok(!(await bodies(C)).includes('Alamut!'));
// Petra may answer Ana's comment (it is in Jan's thread), Marko may not comment on Jan's post
const cD = (await rpc('bm_post', { ...id(D), p_body: 'Tudi jaz!', p_reply: cA })).id;
await fails(rpc('bm_post', { ...id(C), p_body: 'hej', p_reply: pJ }), 'bm:gone');
await fails(rpc('bm_post', { ...id(A), p_body: 'hej', p_reply: pM }), 'bm:gone');
await fails(rpc('bm_post', { ...id(A), p_body: 'hej', p_reply: 99999999 }), 'bm:gone');

// bravo: on and off; only on messages you can see
assert.deepEqual(await rpc('bm_bravo', { ...id(B), p_msg: pJ }), [B.p_id]);
assert.deepEqual(await rpc('bm_bravo', { ...id(B), p_msg: pJ }), []);
await rpc('bm_bravo', { ...id(B), p_msg: pJ });
await fails(rpc('bm_bravo', { ...id(C), p_msg: pJ }), 'bm:gone');
feed = await rpc('bm_feed', { ...id(A) });
assert.deepEqual(feed.find(x => x.id === pJ).bravo, [B.p_id]);
assert.ok(feed[0].id < feed[1].id, 'oldest first');
assert.equal((await rpc('bm_feed', { ...id(A), p_before: cD })).length, 2, 'an older page');

// the unread mark: the newest message from someone else
assert.equal((await rpc('bm_sync', { ...id(A), p_stats: null })).last, cD);
assert.equal((await rpc('bm_sync', { ...id(C), p_stats: null })).last, null, 'Marko only sees his own post');

// deleting: your own message, or a comment in your own thread; not someone else's post
assert.deepEqual(await rpc('bm_unsay', { ...id(B), p_msg: pJ }), { ok: false });
assert.deepEqual(await rpc('bm_unsay', { ...id(A), p_msg: cD }), { ok: true });
assert.deepEqual(await rpc('bm_unsay', { ...id(B), p_msg: cA }), { ok: true });
assert.deepEqual(await bodies(D), ['Kdo bere kaj ta teden?']);

// moments: posted once, seen by friends
assert.deepEqual(await rpc('bm_event', { ...id(B), p_body: { t: 'book', v: 'Alamut' } }), { posted: 1 });
assert.deepEqual(await rpc('bm_event', { ...id(B), p_body: { v: 'Alamut', t: 'book' } }), { posted: 0 });
feed = await rpc('bm_feed', { ...id(C) });
assert.equal(feed.at(-1).kind, 'event'); assert.deepEqual(JSON.parse(feed.at(-1).body), { t: 'book', v: 'Alamut' });
await fails(rpc('bm_event', { ...id(B), p_body: 'x' }), 'bm:bad');

// unfriending hides the threads both ways; a new code stops the old one working
r = await rpc('bm_unfriend', { ...id(D), p_friend: A.p_id });
assert.equal(r.friends, 0);
assert.deepEqual(await bodies(D), []);
assert.deepEqual((await rpc('bm_board', { ...id(A) })).members.map(m => m.name), ['Jan', 'Ana']);
const old = A.code; A.code = (await rpc('bm_newcode', { ...id(A) })).code;
assert.notEqual(A.code, old);
assert.deepEqual(await rpc('bm_add', { ...id(D), p_code: old }), { ok: false, err: 'nocode' });
assert.equal((await rpc('bm_add', { ...id(D), p_code: A.code })).ok, true);
assert.equal((await rpc('bm_board', { ...id(B) })).members.length, 3, 'friends stay after a new code');

// guessing codes: 30 wrong ones a day, then no more tries (a right code too)
for (let i = 0; i < 28; i++) await rpc('bm_add', { ...id(C), p_code: 'ZZZZZZZZ' });   // 1 wrong try was Jan's, these are Marko's 1..28
assert.deepEqual(await rpc('bm_add', { ...id(C), p_code: 'ZZZZZZZZ' }), { ok: false, err: 'nocode' });   // 29
assert.deepEqual(await rpc('bm_add', { ...id(C), p_code: 'ZZZZZZZZ' }), { ok: false, err: 'nocode' });   // 30
await fails(rpc('bm_add', { ...id(C), p_code: D.code }), 'bm:slow');
await fails(rpc('bm_add', { ...id(C), p_code: 'ZZZZZZZZ' }), 'bm:slow');

// too many messages in a minute
const E = who('Hitri'); await rpc('bm_register', { ...id(E), p_name: E.name }); everyone.push(E);
for (let i = 0; i < 20; i++) await rpc('bm_post', { ...id(E), p_body: 'sporočilo ' + i });
await fails(rpc('bm_post', { ...id(E), p_body: 'še eno' }), 'bm:slow');

// backup for a new phone
const state = { v: 1, goals: [{ from: '2026-11-03', min: 20 }], books: [{ id: 'b1', title: 'Alamut' }], sessions: [{ id: 's1', book: 'b1', day: '2026-11-03', sec: 1500 }] };
assert.ok((await rpc('bm_backup_put', { ...id(A), p_data: state })).at);
r = await rpc('bm_backup_get', { ...id(A) });
assert.deepEqual(r.data, state); assert.equal(r.name, 'Jan');
await fails(rpc('bm_backup_get', { p_id: A.p_id, p_key: B.p_key }), 'bm:auth');
assert.ok((await rpc('bm_sync', { ...id(A), p_stats: null })).backup_at);

// forgetting: gone, with the friendships and own threads; comments elsewhere stay without a name
await rpc('bm_post', { ...id(B), p_body: 'Ana piše Janu.', p_reply: pJ });
const pB = (await rpc('bm_post', { ...id(B), p_body: 'Anina objava.' })).id;
await rpc('bm_post', { ...id(A), p_body: 'Jan komentira Ano.', p_reply: pB });
await rpc('bm_forget', { ...id(A) });
await fails(rpc('bm_sync', { ...id(A), p_stats: null }), 'bm:auth');
feed = await rpc('bm_feed', { ...id(B) });
assert.ok(!feed.some(x => x.body === 'Kdo bere kaj ta teden?' || x.body === 'Ana piše Janu.'), "Jan's thread is gone");
const left = feed.find(x => x.body === 'Jan komentira Ano.'); assert.ok(left); assert.equal(left.who, null); assert.equal(left.name, '');
assert.deepEqual((await rpc('bm_board', { ...id(B) })).members.map(m => m.name).sort(), ['Ana', 'Marko']);
assert.equal(await rpc('bm_ping', {}), 'ok');
// leave nothing behind (this test also runs once against the real server)
for (const m of everyone.slice(1)) await rpc('bm_forget', { ...id(m) });
await fails(rpc('bm_sync', { ...id(B), p_stats: null }), 'bm:auth');
console.log('server: all checks passed');
