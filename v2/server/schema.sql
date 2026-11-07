-- Bralni mentor 2: the friends' server (Supabase, Postgres). Paste the whole file into the Supabase SQL editor and run it;
-- running it again is safe (it only adds what is missing and replaces the functions).
--
-- How it works: the app has no logins. Each phone makes up its own id and a long secret key; the server keeps only a hash
-- of the key. The tables are closed to the outside (row level security on, no policies), so the public API key can only
-- call the bm_* functions below, and each of them checks the id and key first.
-- A bralni klub (reading club) is a group of friends who share a leaderboard and a chat; a 6-letter code invites others.

create table if not exists bm_members (
  id text primary key,                         -- made up by the phone: 16 letters and digits
  key_hash bytea not null,                     -- sha256 of the phone's secret key
  name text not null check (char_length(name) between 1 and 24),
  stats jsonb not null default '{}'::jsonb,    -- what friends see: level, total time, minutes per day of the last weeks
  backup jsonb,                                -- the phone's whole reading log (books, sessions, goals), for a new phone
  backup_at timestamptz,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now()
);
create table if not exists bm_clubs (
  id bigint generated always as identity primary key,
  code text not null unique,                   -- 6 characters, no look-alikes (no I, O, 0, 1)
  name text not null check (char_length(name) between 1 and 40),
  rules text not null default 'A' check (rules in ('A', 'B', 'C')),   -- the points rules, see core.js RULES
  owner text references bm_members(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists bm_club_members (
  club_id bigint not null references bm_clubs(id) on delete cascade,
  member_id text not null references bm_members(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (club_id, member_id)
);
create index if not exists bm_club_members_member on bm_club_members (member_id);
create table if not exists bm_messages (
  id bigint generated always as identity primary key,
  club_id bigint not null references bm_clubs(id) on delete cascade,
  member_id text references bm_members(id) on delete set null,
  kind text not null default 'msg' check (kind in ('msg', 'event')),   -- event: a book finished, a new level ... (body is a small JSON)
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
alter table bm_messages add column if not exists reply_to bigint references bm_messages(id) on delete set null;   -- a comment on another message
create index if not exists bm_messages_club on bm_messages (club_id, id desc);
create index if not exists bm_messages_member on bm_messages (member_id, created_at desc);
create table if not exists bm_bravo (
  message_id bigint not null references bm_messages(id) on delete cascade,
  member_id text not null references bm_members(id) on delete cascade,
  primary key (message_id, member_id)
);

alter table bm_members enable row level security;
alter table bm_clubs enable row level security;
alter table bm_club_members enable row level security;
alter table bm_messages enable row level security;
alter table bm_bravo enable row level security;
revoke all on bm_members, bm_clubs, bm_club_members, bm_messages, bm_bravo from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on bm_members, bm_clubs, bm_club_members, bm_messages, bm_bravo from anon, authenticated;
  end if;
end $$;

-- ---------- helpers (not callable from outside)

create or replace function bm__me(p_id text, p_key text) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from bm_members where id = p_id and key_hash = sha256(convert_to(coalesce(p_key, ''), 'UTF8'))) then
    raise exception 'bm:auth';
  end if;
end $$;

create or replace function bm__in(p_member text, p_club bigint) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from bm_club_members where club_id = p_club and member_id = p_member) then
    raise exception 'bm:notmember';
  end if;
end $$;

create or replace function bm__code() returns text
language plpgsql volatile security definer set search_path = public as $$
declare a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; b bytea := uuid_send(gen_random_uuid()); c text := '';
begin
  for i in 0..5 loop c := c || substr(a, get_byte(b, i) % 32 + 1, 1); end loop;
  return c;
end $$;

create or replace function bm__name(p text, maxlen int) returns text
language plpgsql immutable security definer set search_path = public as $$
declare n text := btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g'));
begin
  if char_length(n) < 1 or char_length(n) > maxlen then raise exception 'bm:name'; end if;
  return n;
end $$;

-- the member's clubs, oldest first, with the newest message id (for the unread dot)
create or replace function bm__clubs(p_member text) returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
      'id', c.id, 'code', c.code, 'name', c.name, 'rules', c.rules, 'owner', c.owner,
      'n', (select count(*) from bm_club_members x where x.club_id = c.id),
      'last', (select max(m.id) from bm_messages m where m.club_id = c.id)
    ) order by cm.joined_at), '[]'::json)
  from bm_club_members cm join bm_clubs c on c.id = cm.club_id
  where cm.member_id = p_member
$$;

-- ---------- the API

-- New phone, or a new name for the same phone. Returns the member's clubs.
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
  return json_build_object('name', n, 'clubs', bm__clubs(p_id));
end $$;

-- The phone sends what friends see (after each reading and when the app opens). Returns the clubs.
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
  return (select json_build_object('name', m.name, 'backup_at', m.backup_at, 'clubs', bm__clubs(p_id)) from bm_members m where m.id = p_id);
end $$;

-- A club's name and size by its code, before joining (the invite screen).
create or replace function bm_peek(p_code text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('name', c.name, 'n', (select count(*) from bm_club_members x where x.club_id = c.id))
  from bm_clubs c where c.code = upper(btrim(coalesce(p_code, '')))
$$;

create or replace function bm_create_club(p_id text, p_key text, p_name text, p_rules text default 'A') returns json
language plpgsql volatile security definer set search_path = public as $$
declare n text := bm__name(p_name, 40); v_code text; v_id bigint;
begin
  perform bm__me(p_id, p_key);
  if (select count(*) from bm_club_members where member_id = p_id) >= 5 then raise exception 'bm:limit'; end if;
  loop
    v_code := bm__code();
    begin
      insert into bm_clubs (code, name, rules, owner) values (v_code, n, coalesce(p_rules, 'A'), p_id) returning id into v_id;
      exit;
    exception when unique_violation then
      -- that code is taken: draw another
    end;
  end loop;
  insert into bm_club_members (club_id, member_id) values (v_id, p_id);
  return json_build_object('id', v_id, 'code', v_code, 'clubs', bm__clubs(p_id));
end $$;

create or replace function bm_join(p_id text, p_key text, p_code text) returns json
language plpgsql volatile security definer set search_path = public as $$
declare v_id bigint;
begin
  perform bm__me(p_id, p_key);
  select id into v_id from bm_clubs where code = upper(btrim(coalesce(p_code, '')));
  if v_id is null then raise exception 'bm:nocode'; end if;
  if not exists (select 1 from bm_club_members where club_id = v_id and member_id = p_id) then
    if (select count(*) from bm_club_members where member_id = p_id) >= 5 then raise exception 'bm:limit'; end if;
    if (select count(*) from bm_club_members where club_id = v_id) >= 50 then raise exception 'bm:full'; end if;
    insert into bm_club_members (club_id, member_id) values (v_id, p_id);
    insert into bm_messages (club_id, member_id, kind, body) values (v_id, p_id, 'event', '{"t":"join"}');
  end if;
  return json_build_object('id', v_id, 'clubs', bm__clubs(p_id));
end $$;

-- Leaving: the last one out closes the club; if the owner leaves, the longest member takes over.
create or replace function bm_leave(p_id text, p_key text, p_club bigint) returns json
language plpgsql volatile security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  delete from bm_club_members where club_id = p_club and member_id = p_id;
  if not exists (select 1 from bm_club_members where club_id = p_club) then
    delete from bm_clubs where id = p_club;
  elsif (select owner from bm_clubs where id = p_club) is not distinct from p_id then
    update bm_clubs set owner = (select member_id from bm_club_members where club_id = p_club order by joined_at limit 1) where id = p_club;
  end if;
  return bm__clubs(p_id);
end $$;

-- Owner only: rename the club, change its points rules, or remove a member.
create or replace function bm_club_set(p_id text, p_key text, p_club bigint, p_name text default null, p_rules text default null) returns json
language plpgsql volatile security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  update bm_clubs set name = case when p_name is null then name else bm__name(p_name, 40) end, rules = coalesce(p_rules, rules)
    where id = p_club and owner = p_id;
  if not found then raise exception 'bm:owner'; end if;
  if p_rules is not null then
    insert into bm_messages (club_id, member_id, kind, body) values (p_club, p_id, 'event', json_build_object('t', 'rules', 'v', p_rules)::text);
  end if;
  return bm__clubs(p_id);
end $$;

create or replace function bm_kick(p_id text, p_key text, p_club bigint, p_member text) returns json
language plpgsql volatile security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  if not exists (select 1 from bm_clubs where id = p_club and owner = p_id) or p_member = p_id then raise exception 'bm:owner'; end if;
  delete from bm_club_members where club_id = p_club and member_id = p_member;
  return bm__clubs(p_id);
end $$;

-- The leaderboard: the club and every member's name and stats (each phone works out the points itself, see core.js).
create or replace function bm_board(p_id text, p_key text, p_club bigint) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  perform bm__in(p_id, p_club);
  return (select json_build_object(
      'club', json_build_object('id', c.id, 'code', c.code, 'name', c.name, 'rules', c.rules, 'owner', c.owner),
      'last', (select max(m.id) from bm_messages m where m.club_id = c.id),
      'members', (select json_agg(json_build_object('id', m.id, 'name', m.name, 'stats', m.stats, 'joined', cm.joined_at, 'seen', m.seen_at) order by cm.joined_at)
                  from bm_club_members cm join bm_members m on m.id = cm.member_id where cm.club_id = c.id))
    from bm_clubs c where c.id = p_club);
end $$;

-- The chat: the newest 60 messages (or the 60 before p_before), oldest first, each with the ids of who said bravo.
create or replace function bm_feed(p_id text, p_key text, p_club bigint, p_before bigint default null) returns json
language plpgsql stable security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  perform bm__in(p_id, p_club);
  return coalesce((select json_agg(x order by x.id) from (
      select m.id, m.member_id as who, coalesce(mm.name, '') as name, m.kind, m.body, m.created_at as at, m.reply_to as re,
        coalesce((select json_agg(b.member_id) from bm_bravo b where b.message_id = m.id), '[]'::json) as bravo
      from bm_messages m left join bm_members mm on mm.id = m.member_id
      where m.club_id = p_club and (p_before is null or m.id < p_before)
      order by m.id desc limit 60) x), '[]'::json);
end $$;

-- A chat message, or with p_reply a comment on another message of the same club.
create or replace function bm_post(p_id text, p_key text, p_club bigint, p_body text, p_reply bigint default null) returns json
language plpgsql volatile security definer set search_path = public as $$
declare b text := btrim(coalesce(p_body, '')); v_id bigint;
begin
  perform bm__me(p_id, p_key);
  perform bm__in(p_id, p_club);
  if char_length(b) < 1 or char_length(b) > 500 then raise exception 'bm:bad'; end if;
  if p_reply is not null and not exists (select 1 from bm_messages where id = p_reply and club_id = p_club) then raise exception 'bm:gone'; end if;
  if (select count(*) from bm_messages where member_id = p_id and created_at > now() - interval '1 minute') >= 20 then raise exception 'bm:slow'; end if;
  insert into bm_messages (club_id, member_id, kind, body, reply_to) values (p_club, p_id, 'msg', b, p_reply) returning id into v_id;
  return json_build_object('id', v_id);
end $$;

-- A moment worth a bravo (a finished book, a new level, a streak), posted to all the member's clubs, or with p_club to one
-- (the week's win). The same moment from the same member is posted once per club (the phone may report it twice).
create or replace function bm_event(p_id text, p_key text, p_body jsonb, p_club bigint default null) returns json
language plpgsql volatile security definer set search_path = public as $$
declare b text := p_body::text; n int := 0; r record;
begin
  perform bm__me(p_id, p_key);
  if jsonb_typeof(p_body) <> 'object' or char_length(b) > 500 then raise exception 'bm:bad'; end if;
  for r in select club_id from bm_club_members where member_id = p_id and (p_club is null or club_id = p_club) loop
    if not exists (select 1 from bm_messages where club_id = r.club_id and member_id = p_id and kind = 'event' and body::jsonb = p_body) then
      insert into bm_messages (club_id, member_id, kind, body) values (r.club_id, p_id, 'event', b);
      n := n + 1;
    end if;
  end loop;
  return json_build_object('posted', n);
end $$;

-- Bravo on a message, or take it back. Returns who says bravo now.
create or replace function bm_bravo(p_id text, p_key text, p_msg bigint) returns json
language plpgsql volatile security definer set search_path = public as $$
declare v_club bigint;
begin
  perform bm__me(p_id, p_key);
  select club_id into v_club from bm_messages where id = p_msg;
  if v_club is null then raise exception 'bm:gone'; end if;
  perform bm__in(p_id, v_club);
  if exists (select 1 from bm_bravo where message_id = p_msg and member_id = p_id) then
    delete from bm_bravo where message_id = p_msg and member_id = p_id;
  else
    insert into bm_bravo (message_id, member_id) values (p_msg, p_id);
  end if;
  return coalesce((select json_agg(member_id) from bm_bravo where message_id = p_msg), '[]'::json);
end $$;

-- Delete a message: your own, or any in a club you own.
create or replace function bm_unsay(p_id text, p_key text, p_msg bigint) returns json
language plpgsql volatile security definer set search_path = public as $$
begin
  perform bm__me(p_id, p_key);
  delete from bm_messages m where m.id = p_msg
    and (m.member_id = p_id or exists (select 1 from bm_clubs c where c.id = m.club_id and c.owner = p_id));
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

-- Delete me: my name, stats, backup and club places; my messages stay without a name.
create or replace function bm_forget(p_id text, p_key text) returns json
language plpgsql volatile security definer set search_path = public as $$
declare r record;
begin
  perform bm__me(p_id, p_key);
  for r in select club_id from bm_club_members where member_id = p_id loop
    perform bm_leave(p_id, p_key, r.club_id);
  end loop;
  delete from bm_members where id = p_id;
  return json_build_object('ok', true);
end $$;

-- Keeps a free Supabase project awake (a daily call from GitHub Actions, see .github/workflows/keep-awake.yml).
create or replace function bm_ping() returns text language sql stable as $$ select 'ok'::text $$;

-- Who may call what: the helpers are closed, the API is open to the public key.
revoke execute on function bm__me(text, text), bm__in(text, bigint), bm__code(), bm__name(text, int), bm__clubs(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function bm__me(text, text), bm__in(text, bigint), bm__code(), bm__name(text, int), bm__clubs(text) from anon, authenticated;
    grant execute on function bm_register(text, text, text), bm_sync(text, text, jsonb), bm_peek(text),
      bm_create_club(text, text, text, text), bm_join(text, text, text), bm_leave(text, text, bigint),
      bm_club_set(text, text, bigint, text, text), bm_kick(text, text, bigint, text), bm_board(text, text, bigint),
      bm_feed(text, text, bigint, bigint), bm_post(text, text, bigint, text, bigint), bm_event(text, text, jsonb, bigint),
      bm_bravo(text, text, bigint), bm_unsay(text, text, bigint), bm_backup_put(text, text, jsonb),
      bm_backup_get(text, text), bm_forget(text, text), bm_ping() to anon, authenticated;
  end if;
end $$;
