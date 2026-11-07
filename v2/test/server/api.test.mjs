// The friends' server end to end, against the local stack from up.sh (or any URL in BM_URL, with BM_KEY as the public key).
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
const A = who('Jan'), B = who('Ana'), C = who('Marko'), id = m => ({ p_id: m.p_id, p_key: m.p_key });

// registering, and the same id with another key is refused
let r = await rpc('bm_register', { ...id(A), p_name: '  Jan  ' });
assert.equal(r.name, 'Jan'); assert.deepEqual(r.clubs, []);
await rpc('bm_register', { ...id(B), p_name: 'Ana' });
await rpc('bm_register', { ...id(C), p_name: 'Marko' });
await fails(rpc('bm_register', { p_id: A.p_id, p_key: rnd(32), p_name: 'Thief' }), 'bm:auth');
await fails(rpc('bm_register', { p_id: 'SHORT', p_key: rnd(32), p_name: 'X' }), 'bm:bad');
await fails(rpc('bm_register', { p_id: rnd(16), p_key: rnd(32), p_name: '   ' }), 'bm:name');
await fails(rpc('bm_register', { p_id: rnd(16), p_key: rnd(32), p_name: 'x'.repeat(25) }), 'bm:name');

// the tables are closed: only the functions answer
for (const t of ['bm_members', 'bm_clubs', 'bm_messages', 'bm_club_members', 'bm_bravo']) {
  const res = await fetch(URL_ + '/' + t, { headers: H }); assert.ok(res.status === 401 || res.status === 403 || res.status === 404, t + ' answered ' + res.status);
}
for (const f of ['bm__me', 'bm__clubs', 'bm__code']) await fails(rpc(f, {}), '.');

// a club: create, peek by code, join
r = await rpc('bm_create_club', { ...id(A), p_name: 'Bralni klub', p_rules: 'A' });
const club = r.id, code = r.code;
assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/);
assert.equal(r.clubs.length, 1); assert.equal(r.clubs[0].owner, A.p_id); assert.equal(r.clubs[0].n, 1);
assert.deepEqual(await rpc('bm_peek', { p_code: code.toLowerCase() + ' ' }), { name: 'Bralni klub', n: 1 });
assert.equal(await rpc('bm_peek', { p_code: 'ZZZZZZ' }), null);
r = await rpc('bm_join', { ...id(B), p_code: code });
assert.equal(r.id, club); assert.equal(r.clubs[0].n, 2);
r = await rpc('bm_join', { ...id(B), p_code: code });   // twice is fine
assert.equal(r.clubs[0].n, 2);
await fails(rpc('bm_join', { ...id(C), p_code: 'AAAAAA' }), 'bm:nocode');
await fails(rpc('bm_join', { p_id: C.p_id, p_key: 'wrong-key-wrong-key-wrong', p_code: code }), 'bm:auth');

// stats and the board; a stranger can't read it
const stats = { v: 1, total: 36000, level: 4, streak: 6, days: { '2026-11-02': 1500, '2026-11-03': 900 }, since: '2026-11-02' };
r = await rpc('bm_sync', { ...id(B), p_stats: stats });
assert.equal(r.clubs[0].id, club);
r = await rpc('bm_board', { ...id(A), p_club: club });
assert.equal(r.club.name, 'Bralni klub'); assert.equal(r.members.length, 2);
assert.deepEqual(r.members.find(m => m.id === B.p_id).stats, stats);
assert.equal(r.members[0].name, 'Jan');
await fails(rpc('bm_board', { ...id(C), p_club: club }), 'bm:notmember');
await fails(rpc('bm_sync', { ...id(B), p_stats: { big: 'x'.repeat(30000) } }), 'bm:big');

// chat: the join event is there, posting, bravo on and off, deleting
let feed = await rpc('bm_feed', { ...id(A), p_club: club });
assert.equal(feed.length, 1); assert.equal(feed[0].kind, 'event'); assert.deepEqual(JSON.parse(feed[0].body), { t: 'join' }); assert.equal(feed[0].name, 'Ana');
const m1 = (await rpc('bm_post', { ...id(A), p_club: club, p_body: '  Kdo bere kaj ta teden?  ' })).id;
await rpc('bm_post', { ...id(B), p_club: club, p_body: 'Alamut!' });
await fails(rpc('bm_post', { ...id(C), p_club: club, p_body: 'hej' }), 'bm:notmember');
await fails(rpc('bm_post', { ...id(A), p_club: club, p_body: '   ' }), 'bm:bad');
await fails(rpc('bm_post', { ...id(A), p_club: club, p_body: 'x'.repeat(501) }), 'bm:bad');
assert.deepEqual(await rpc('bm_bravo', { ...id(B), p_msg: m1 }), [B.p_id]);
assert.deepEqual(await rpc('bm_bravo', { ...id(B), p_msg: m1 }), []);
await rpc('bm_bravo', { ...id(B), p_msg: m1 });
await fails(rpc('bm_bravo', { ...id(C), p_msg: m1 }), 'bm:notmember');
feed = await rpc('bm_feed', { ...id(B), p_club: club });
assert.deepEqual(feed.map(m => m.body).slice(1), ['Kdo bere kaj ta teden?', 'Alamut!']);
assert.deepEqual(feed[1].bravo, [B.p_id]);
assert.ok(feed[1].id < feed[2].id, 'oldest first');
// older page
const older = await rpc('bm_feed', { ...id(B), p_club: club, p_before: feed[2].id });
assert.equal(older.length, 2);
// Ana can't delete Jan's message, Jan (owner) can delete Ana's
assert.deepEqual(await rpc('bm_unsay', { ...id(B), p_msg: m1 }), { ok: false });
assert.deepEqual(await rpc('bm_unsay', { ...id(A), p_msg: feed[2].id }), { ok: true });
assert.equal((await rpc('bm_feed', { ...id(A), p_club: club })).length, 2);

// events go to every club of the member, once per moment
const club2 = (await rpc('bm_create_club', { ...id(B), p_name: 'Družina' })).id;
assert.deepEqual(await rpc('bm_event', { ...id(B), p_body: { t: 'book', v: 'Alamut' } }), { posted: 2 });
assert.deepEqual(await rpc('bm_event', { ...id(B), p_body: { v: 'Alamut', t: 'book' } }), { posted: 0 });
feed = await rpc('bm_feed', { ...id(A), p_club: club });
assert.deepEqual(JSON.parse(feed.at(-1).body), { t: 'book', v: 'Alamut' });

// one club only (the week's win), and a comment on a message
assert.deepEqual(await rpc('bm_event', { ...id(B), p_body: { t: 'win', v: 112, w: '2026-11-02' }, p_club: club2 }), { posted: 1 });
assert.ok(!(await rpc('bm_feed', { ...id(A), p_club: club })).some(m => m.body.includes('win')));
const ev = feed.at(-1).id;
const c1 = (await rpc('bm_post', { ...id(A), p_club: club, p_body: 'Bravo, Ana!', p_reply: ev })).id;
feed = await rpc('bm_feed', { ...id(A), p_club: club });
assert.equal(feed.find(m => m.id === c1).re, ev);
assert.equal(feed.find(m => m.id === ev).re, null);
await fails(rpc('bm_post', { ...id(B), p_club: club2, p_body: 'x', p_reply: ev }), 'bm:gone');   // a message of another club

// owner settings: only the owner; rules must be A, B or C
await fails(rpc('bm_club_set', { ...id(B), p_club: club, p_rules: 'B' }), 'bm:owner');
r = await rpc('bm_club_set', { ...id(A), p_club: club, p_name: 'Knjižni molji', p_rules: 'B' });
assert.equal(r[0].name, 'Knjižni molji'); assert.equal(r[0].rules, 'B');
await fails(rpc('bm_club_set', { ...id(A), p_club: club, p_rules: 'Z' }), '.');

// leaving hands the club over; the last one out closes it
await rpc('bm_join', { ...id(C), p_code: code });
await fails(rpc('bm_kick', { ...id(B), p_club: club, p_member: C.p_id }), 'bm:owner');
r = await rpc('bm_kick', { ...id(A), p_club: club, p_member: C.p_id });
assert.equal(r[0].n, 2);
r = await rpc('bm_leave', { ...id(A), p_club: club });
assert.deepEqual(r, []);
r = await rpc('bm_board', { ...id(B), p_club: club });
assert.equal(r.club.owner, B.p_id);
await rpc('bm_leave', { ...id(B), p_club: club });
assert.equal(await rpc('bm_peek', { p_code: code }), null);

// backup for a new phone
const state = { v: 1, goals: [{ from: '2026-11-03', min: 20 }], books: [{ id: 'b1', title: 'Alamut' }], sessions: [{ id: 's1', book: 'b1', day: '2026-11-03', sec: 1500 }] };
assert.ok((await rpc('bm_backup_put', { ...id(A), p_data: state })).at);
r = await rpc('bm_backup_get', { ...id(A) });
assert.deepEqual(r.data, state); assert.equal(r.name, 'Jan');
await fails(rpc('bm_backup_get', { p_id: A.p_id, p_key: B.p_key }), 'bm:auth');
r = await rpc('bm_sync', { ...id(A), p_stats: null });
assert.ok(r.backup_at);

// forgetting: gone, and its club places with it
await rpc('bm_forget', { ...id(B) });
await fails(rpc('bm_sync', { ...id(B), p_stats: null }), 'bm:auth');
assert.equal(await rpc('bm_ping', {}), 'ok');
// leave nothing behind (this test also runs once against the real server)
await rpc('bm_forget', { ...id(A) }); await rpc('bm_forget', { ...id(C) });
await fails(rpc('bm_sync', { ...id(A), p_stats: null }), 'bm:auth');
console.log('server: all checks passed');
