-- Bralni mentor 2: the friends' server (Postgres 17 + PostgREST, see server/self-host/). Run the whole file; running it
-- again is safe (it only adds what is missing and replaces the functions).
--
-- How it works: the app has no logins. Each phone makes up its own id and a long secret key; the server keeps only a hash
-- of the key. The tables are closed to the outside (row level security on, no policies, no grants), so the API can only
-- call the bm_* functions below, and each of them checks the id and key first.
-- Friends: everyone has a personal code. Entering a friend's code makes the two of you friends (both ways). Each person
-- sees a board of themselves and their friends, and a feed of their own and their friends' posts and reading moments,
-- with comments and bravos. A comment belongs to the thread of the post it answers: whoever can see the post sees it.

create table if not exists bm_members (
  id text primary key,                         -- made up by the phone: 16 letters and digits
  key_hash bytea not null,                     -- sha256 of the phone's secret key
  name text not null check (char_length(name) between 1 and 24),
  code text unique,                            -- personal friend code: 8 characters, no look-alikes (no I, O, 0, 1)
  stats jsonb not null default '{}'::jsonb,    -- what friends see: level, total time, minutes per day of the last weeks
  backup jsonb,                                -- the phone's whole reading log (books, sessions, goals), for a new phone
  backup_at timestamptz,
  fails int not null default 0,                -- wrong friend codes tried in the last day (a limit against guessing codes)
  fails_at timestamptz,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create table if not exists bm_friends (       -- each friendship is stored both ways (a sees b, b sees a)
  a text not null references bm_members(id) on delete cascade,
  b text not null references bm_members(id) on delete cascade,
  since timestamptz not null default now(),
  primary key (a, b),
  check (a <> b)
);
create table if not exists bm_messages (
  id bigint generated always as identity primary key,
  member_id text references bm_members(id) on delete set null,       -- who wrote it
  owner text not null references bm_members(id) on delete cascade,   -- whose thread: the writer of a post; for a comment, the post's writer
  kind text not null default 'msg' check (kind in ('msg', 'event')),   -- event: a book finished, a new level ... (body is a small JSON)
  body text not null check (char_length(body) between 1 and 500),
  reply_to bigint references bm_messages(id) on delete set null,     -- a comment on this message
  created_at timestamptz not null default now()
);
create index if not exists bm_messages_owner on bm_messages (owner, id desc);
create index if not exists bm_messages_member on bm_messages (member_id, created_at desc);
-- the books friends see on my profile: what I am reading, what I have read with my ratings, my favourites (fetched only
-- when a friend opens the profile, so the board that every phone polls stays small)
alter table bm_members add column if not exists shelf jsonb;
alter table bm_members add column if not exists shelf_at timestamptz;
create table if not exists bm_bravo (
  message_id bigint not null references bm_messages(id) on delete cascade,
  member_id text not null references bm_members(id) on delete cascade,
  primary key (message_id, member_id)
);

alter table bm_members enable row level security;
alter table bm_friends enable row level security;
alter table bm_messages enable row level security;
alter table bm_bravo enable row level security;
revoke all on bm_members, bm_friends, bm_messages, bm_bravo from public;
do $$ declare r text; begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on bm_members, bm_friends, bm_messages, bm_bravo from %I', r);
    end if;
  end loop;
end $$;

-- ---------- helpers (not callable from outside)

create or replace function bm__me(p_id text, p_key text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from bm_members where id = p_id and key_hash = sha256(convert_to(coalesce(p_key, ''), 'UTF8'))) then
    raise exception 'bm:auth';
  end if;
end $$;

-- may p_me see the threads of p_owner? (themselves or a friend)
create or replace function bm__sees(p_me text, p_owner text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_me = p_owner or exists (select 1 from bm_friends where a = p_me and b = p_owner)
$$;

create or replace function bm__code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea := uuid_send(gen_random_uuid()); c text := '';
begin
  for i in 0..7 loop c := c || substr(a, get_byte(b, i) % 32 + 1, 1); end loop;
  return c;
end $$;

create or replace function bm__norm(p text) returns text
language sql immutable security definer set search_path = public as $$
  select upper(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function bm__name(p text, maxlen int) returns text
language plpgsql immutable security definer set search_path = public as $$
declare n text := btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'));
begin
  if char_length(n) < 1 or char_length(n) > maxlen then raise exception 'bm:name'; end if;
  return n;
end $$;

-- a fresh personal code for the member
create or replace function bm__newcode(p_member text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare c text;
begin
  loop
    c := bm__code();
    begin
      update bm_members set code = c where id = p_member;
      return c;
    exception when unique_violation then
      -- that code is taken: draw another
    end;
  end loop;
end $$;

-- what the phone needs to know about itself: name, code, number of friends, the newest message from someone else
create or replace function bm__info(p_member text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('name', m.name, 'code', m.code, 'backup_at', m.backup_at,
      'friends', (select count(*) from bm_friends f where f.a = m.id),
      'last', (select max(x.id) from bm_messages x
               where (x.owner = m.id or x.owner in (select f.b from bm_friends f where f.a = m.id)) and x.member_id is distinct from m.id))
  from bm_members m where m.id = p_member
$$;

-- ---------- the API

-- New phone, or a new name for the same phone.
create or replace function bm_register(p_id text, p_key text, p_name text) returns json
language plpgsql volatile security definer set search_path = public as $$
declare n text := bm__name(p_name, 24);
begin
  if coalesce(p_id, '') !~ '^[a-z0-9]{16}$' or char_length(coalesce(p_key, '')) < 24 or char_length(p_key) > 100 then
    raise exception 'bm:bad';
  end if;
  insert into bm_members (id, key_hash, name) values (p_id, sha256(convert_to(p_key, 'UTF8')), n)
    on conflict (id) do nothing;
  perform bm__me(p_id, p_key);   -- the id was taken with another key
  update bm_members set name = n, seen_at = now() where id = p_id;
  if (select code from bm_members where id = p_id) is null then perform bm__newcode(p_id); end if;
  return bm__info(p_id);
end $$;

-- The phone sends what friends see (after each reading and when the app opens).
create or replace function bm_sync(p_id text, p_key text, p_stats jsonb) returns json
language plpgsql volatile security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  if p_stats is not null then
    if jsonb_typeof(p_stats) <> 'object' or pg_column_size(p_stats) > 20000 then raise exception 'bm:big'; end if;
    update bm_members set stats = p_stats, seen_at = now() where id = p_id;
  else
    update bm_members set seen_at = now() where id = p_id;
  end if;
  return bm__info(p_id);
end $$;

-- My books for my friends (null: I don't share them). The phone sends it when its books change.
create or replace function bm_shelf_put(p_id text, p_key text, p_shelf jsonb) returns json
language plpgsql volatile security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  if p_shelf is not null and (jsonb_typeof(p_shelf) <> 'object' or pg_column_size(p_shelf) > 65536) then raise exception 'bm:big'; end if;
  update bm_members set shelf = p_shelf, shelf_at = case when p_shelf is null then null else now() end where id = p_id;
  return json_build_object('at', now());
end $$;

-- A friend's books (or my own), for their profile.
create or replace function bm_shelf(p_id text, p_key text, p_member text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  if not bm__sees(p_id, p_member) or not exists (select 1 from bm_members where id = p_member) then raise exception 'bm:gone'; end if;
  return (select json_build_object('shelf', shelf, 'at', shelf_at) from bm_members where id = p_member);
end $$;

-- Whose code is this? (the invite screen shows the name before adding)
create or replace function bm_peek(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('name', name) from bm_members where code = bm__norm(p_code) and char_length(bm__norm(p_code)) = 8
$$;

-- Add a friend by their code: friends both ways. A wrong code is an answer, not an error, so the try is counted
-- (30 wrong codes a day at most).
create or replace function bm_add(p_id text, p_key text, p_code text) returns json
language plpgsql volatile security definer set search_path = public as $$
declare v text; v_name text; c text := bm__norm(p_code);
begin
  perform bm__me(p_id, p_key);
  if exists (select 1 from bm_members where id = p_id and fails >= 30 and fails_at > now() - interval '1 day') then
    raise exception 'bm:slow';
  end if;
  select id, name into v, v_name from bm_members where code = c and char_length(c) = 8;
  if v is null then
    update bm_members set fails = case when fails_at is null or fails_at < now() - interval '1 day' then 1 else fails + 1 end,
      fails_at = case when fails_at is null or fails_at < now() - interval '1 day' then now() else fails_at end
      where id = p_id;
    return json_build_object('ok', false, 'err', 'nocode');
  end if;
  if v = p_id then return json_build_object('ok', false, 'err', 'self'); end if;
  if not exists (select 1 from bm_friends where a = p_id and b = v) then
    if (select count(*) from bm_friends where a = p_id) >= 100 or (select count(*) from bm_friends where a = v) >= 100 then
      raise exception 'bm:limit';
    end if;
    insert into bm_friends (a, b) values (p_id, v), (v, p_id) on conflict do nothing;
  end if;
  return json_build_object('ok', true, 'friend', json_build_object('id', v, 'name', v_name), 'me', bm__info(p_id));
end $$;

-- No longer friends (both ways).
create or replace function bm_unfriend(p_id text, p_key text, p_friend text) returns json
language plpgsql volatile security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  delete from bm_friends where (a = p_id and b = p_friend) or (a = p_friend and b = p_id);
  return bm__info(p_id);
end $$;

-- A new personal code (the old one stops working; friends stay friends).
create or replace function bm_newcode(p_id text, p_key text) returns json
language plpgsql volatile security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  perform bm__newcode(p_id);
  return bm__info(p_id);
end $$;

-- The leaderboard: me and my friends, each with name and stats (each phone works out the points itself, see core.js).
create or replace function bm_board(p_id text, p_key text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  return json_build_object(
    'last', (bm__info(p_id))->'last',
    'members', (select json_agg(x order by x.ord, x.since) from (
        select m.id, m.name, m.stats, m.created_at as since, m.seen_at as seen, 0 as ord from bm_members m where m.id = p_id
        union all
        select m.id, m.name, m.stats, f.since, m.seen_at, 1 from bm_friends f join bm_members m on m.id = f.b where f.a = p_id) x));
end $$;

-- The feed: the newest 60 messages I may see (or the 60 before p_before), oldest first, each with who said bravo.
create or replace function bm_feed(p_id text, p_key text, p_before bigint default null) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  return coalesce((select json_agg(x order by x.id) from (
      select m.id, m.member_id as who, coalesce(mm.name, '') as name, m.owner, m.kind, m.body, m.created_at as at, m.reply_to as re,
        coalesce((select json_agg(b.member_id) from bm_bravo b where b.message_id = m.id), '[]'::json) as bravo
      from bm_messages m left join bm_members mm on mm.id = m.member_id
      where (m.owner = p_id or m.owner in (select f.b from bm_friends f where f.a = p_id)) and (p_before is null or m.id < p_before)
      order by m.id desc limit 60) x), '[]'::json);
end $$;

-- A post to my friends, or with p_reply a comment on a message I can see (it joins that message's thread).
create or replace function bm_post(p_id text, p_key text, p_body text, p_reply bigint default null) returns json
language plpgsql volatile security definer set search_path = public as $$
declare b text := btrim(coalesce(p_body, '')); v_id bigint; o text := p_id;
begin
  perform bm__me(p_id, p_key);
  if char_length(b) < 1 or char_length(b) > 500 then raise exception 'bm:bad'; end if;
  if p_reply is not null then
    select owner into o from bm_messages where id = p_reply;
    if o is null or not bm__sees(p_id, o) then raise exception 'bm:gone'; end if;
  end if;
  if (select count(*) from bm_messages where member_id = p_id and created_at > now() - interval '1 minute') >= 20 then raise exception 'bm:slow'; end if;
  insert into bm_messages (member_id, owner, kind, body, reply_to) values (p_id, o, 'msg', b, p_reply) returning id into v_id;
  return json_build_object('id', v_id);
end $$;

-- A moment worth a bravo (a finished book, a new level, a streak) for my friends. The same moment is posted once
-- (the phone may report it twice).
create or replace function bm_event(p_id text, p_key text, p_body jsonb) returns json
language plpgsql volatile security definer set search_path = public as $$
declare b text := p_body::text;
begin
  perform bm__me(p_id, p_key);
  if jsonb_typeof(p_body) <> 'object' or char_length(b) > 500 then raise exception 'bm:bad'; end if;
  if exists (select 1 from bm_messages where owner = p_id and member_id = p_id and kind = 'event' and body::jsonb = p_body) then
    return json_build_object('posted', 0);
  end if;
  if (select count(*) from bm_messages where member_id = p_id and created_at > now() - interval '1 minute') >= 20 then raise exception 'bm:slow'; end if;
  insert into bm_messages (member_id, owner, kind, body) values (p_id, p_id, 'event', b);
  return json_build_object('posted', 1);
end $$;

-- Bravo on a message, or take it back. Returns who says bravo now.
create or replace function bm_bravo(p_id text, p_key text, p_msg bigint) returns json
language plpgsql volatile security definer set search_path = public as $$
declare o text;
begin
  perform bm__me(p_id, p_key);
  select owner into o from bm_messages where id = p_msg;
  if o is null or not bm__sees(p_id, o) then raise exception 'bm:gone'; end if;
  if exists (select 1 from bm_bravo where message_id = p_msg and member_id = p_id) then
    delete from bm_bravo where message_id = p_msg and member_id = p_id;
  else
    insert into bm_bravo (message_id, member_id) values (p_msg, p_id);
  end if;
  return coalesce((select json_agg(member_id) from bm_bravo where message_id = p_msg), '[]'::json);
end $$;

-- Delete a message: my own, or any comment in my own thread.
create or replace function bm_unsay(p_id text, p_key text, p_msg bigint) returns json
language plpgsql volatile security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  delete from bm_messages where id = p_msg and (member_id = p_id or owner = p_id);
  return json_build_object('ok', found);
end $$;

-- The phone's whole reading log, kept for a new phone (books, sessions, goals; no cover photos).
create or replace function bm_backup_put(p_id text, p_key text, p_data jsonb) returns json
language plpgsql volatile security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  if jsonb_typeof(p_data) <> 'object' or pg_column_size(p_data) > 3000000 then raise exception 'bm:big'; end if;
  update bm_members set backup = p_data, backup_at = now() where id = p_id;
  return json_build_object('at', now());
end $$;

create or replace function bm_backup_get(p_id text, p_key text) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  return (select json_build_object('at', backup_at, 'data', backup, 'name', name) from bm_members where id = p_id);
end $$;

-- Delete me: my name, stats, backup, friendships and my own threads; my comments elsewhere stay without a name.
create or replace function bm_forget(p_id text, p_key text) returns json
language plpgsql volatile security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  delete from bm_members where id = p_id;
  return json_build_object('ok', true);
end $$;

-- A health check (the install script and GitHub's daily check call it).
create or replace function bm_ping() returns text language sql stable as $$ select 'ok'::text $$;

-- Who may call what: the helpers are closed, the API is open to the API's public role.
revoke execute on function bm__me(text, text), bm__sees(text, text), bm__code(), bm__norm(text), bm__name(text, int),
  bm__newcode(text), bm__info(text) from public;
do $$ declare r text; begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on function bm__me(text, text), bm__sees(text, text), bm__code(), bm__norm(text),
        bm__name(text, int), bm__newcode(text), bm__info(text) from %I', r);
      execute format('grant execute on function bm_register(text, text, text), bm_sync(text, text, jsonb), bm_peek(text),
        bm_add(text, text, text), bm_unfriend(text, text, text), bm_newcode(text, text), bm_board(text, text),
        bm_feed(text, text, bigint), bm_post(text, text, text, bigint), bm_event(text, text, jsonb),
        bm_bravo(text, text, bigint), bm_unsay(text, text, bigint), bm_backup_put(text, text, jsonb),
        bm_backup_get(text, text), bm_shelf_put(text, text, jsonb), bm_shelf(text, text, text), bm_forget(text, text), bm_ping() to %I', r);
    end if;
  end loop;
end $$;
