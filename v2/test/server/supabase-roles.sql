-- Local stand-in for a fresh Supabase project: the API roles and Supabase's default grants (everything open to anon),
-- so the test shows that schema.sql closes the tables itself.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role authenticator login password 'pw' noinherit;
grant anon, authenticated to authenticator;
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
