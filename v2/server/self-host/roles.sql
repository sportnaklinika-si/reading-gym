-- The two roles PostgREST needs (run by install.sh with -v api_pw=...): "authenticator" logs in, "anon" is what every
-- request runs as. anon gets nothing here; schema.sql lets it call the bm_* functions and nothing else.
select 'create role anon nologin noinherit' where not exists (select 1 from pg_roles where rolname = 'anon') \gexec
select format('create role authenticator login noinherit password %L', :'api_pw')
  where not exists (select 1 from pg_roles where rolname = 'authenticator') \gexec
alter role authenticator password :'api_pw';
grant anon to authenticator;
grant usage on schema public to anon;
