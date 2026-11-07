// The friends' server: a Supabase project (server/schema.sql). url = the project's API address + /rest/v1, key = its public
// ("publishable" or "anon") key, which is safe to publish: the tables are closed and every function checks the phone's own key.
// Empty url: the Prijatelji tab says friends aren't switched on yet, everything else works as before.
window.BM_SERVER = { url: '', key: '' };
