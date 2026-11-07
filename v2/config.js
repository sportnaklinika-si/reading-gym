// The friends' server: our own (Contabo VPS, server/self-host/). url = https://<server IP>:8443, no key needed: the tables
// are closed and every function checks the phone's own secret key. (A Supabase project works too: its API address +
// /rest/v1 and its public key.)
// Empty url: the Prijatelji tab says friends aren't switched on yet, everything else works as before.
window.BM_SERVER = { url: '', key: '' };
