-- =====================================================================
-- Loy Krathong Contest — database schema for Supabase
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Then run storage.sql.
--
-- Every rule lives here, so it holds even if someone bypasses the web UI:
--   * only @villacartegroup.com and @lagreenhotel.com accounts
--   * one admin: patomporn.k@villacartegroup.com
--   * registration / voting switches per contest
--   * 1 vote per user per contest, never for your own entry or team
--   * scores hidden from non-admins until results are announced
-- Clients never read entry or vote tables directly; they call the RPCs
-- below and read the single `settings` row (which also drives realtime).
-- =====================================================================

-- ---------- helpers ----------
create or replace function public.current_email() returns text
language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.is_company_email(p_email text) returns boolean
language sql immutable as $$
  select lower(coalesce(p_email, '')) ~ '^[^@\s]+@(villacartegroup|lagreenhotel)\.com$'
$$;

create or replace function public.is_company_user() returns boolean
language sql stable as $$
  select public.is_company_email(public.current_email())
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select public.current_email() = 'patomporn.k@villacartegroup.com'
$$;

-- ---------- tables ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  costume_registration_open boolean not null default false,
  costume_voting_open boolean not null default false,
  krathong_registration_open boolean not null default false,
  krathong_voting_open boolean not null default false,
  costume_results_published boolean not null default false,
  krathong_results_published boolean not null default false,
  data_version bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.costume_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  email text not null,
  display_name text not null,
  title text not null default '',
  image_path text not null,
  admin_adjustment int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.krathong_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  krathong_image_path text not null,
  team_image_path text not null,
  created_by uuid not null,
  created_by_email text not null,
  admin_adjustment int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.krathong_team_members (
  team_id uuid not null references public.krathong_teams(id) on delete cascade,
  email text not null unique check (email = lower(email)),
  name text not null,
  primary key (team_id, email)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  contest text not null check (contest in ('costume', 'krathong')),
  entry_id uuid not null,
  created_at timestamptz not null default now(),
  unique (user_id, contest)
);
create index if not exists votes_entry_idx on public.votes (contest, entry_id);

-- ---------- privileges & RLS ----------
alter table public.settings enable row level security;
alter table public.costume_entries enable row level security;
alter table public.krathong_teams enable row level security;
alter table public.krathong_team_members enable row level security;
alter table public.votes enable row level security;

revoke all on public.settings, public.costume_entries, public.krathong_teams,
  public.krathong_team_members, public.votes from anon, authenticated;
grant select on public.settings to authenticated;

drop policy if exists "company users read settings" on public.settings;
create policy "company users read settings" on public.settings
  for select to authenticated using (public.is_company_user());

-- ---------- triggers ----------
-- Any change to entries or votes bumps settings.data_version so every open
-- page (subscribed to settings via realtime) knows to refetch.
create or replace function public.bump_data_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.settings set data_version = data_version + 1, updated_at = now() where id = 1;
  return null;
end $$;

drop trigger if exists bump_costume on public.costume_entries;
create trigger bump_costume after insert or update or delete on public.costume_entries
  for each statement execute function public.bump_data_version();
drop trigger if exists bump_teams on public.krathong_teams;
create trigger bump_teams after insert or update or delete on public.krathong_teams
  for each statement execute function public.bump_data_version();
drop trigger if exists bump_members on public.krathong_team_members;
create trigger bump_members after insert or update or delete on public.krathong_team_members
  for each statement execute function public.bump_data_version();
drop trigger if exists bump_votes on public.votes;
create trigger bump_votes after insert or update or delete on public.votes
  for each statement execute function public.bump_data_version();

-- Deleting an entry deletes the votes cast for it (those voters may vote again).
create or replace function public.delete_entry_votes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.votes where contest = tg_argv[0] and entry_id = old.id;
  return old;
end $$;

drop trigger if exists costume_votes_cleanup on public.costume_entries;
create trigger costume_votes_cleanup after delete on public.costume_entries
  for each row execute function public.delete_entry_votes('costume');
drop trigger if exists krathong_votes_cleanup on public.krathong_teams;
create trigger krathong_votes_cleanup after delete on public.krathong_teams
  for each row execute function public.delete_entry_votes('krathong');

-- Block non-company accounts at sign-up.
create or replace function public.enforce_company_signup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_company_email(new.email) then
    raise exception 'NOT_COMPANY';
  end if;
  return new;
end $$;

drop trigger if exists enforce_company_signup on auth.users;
create trigger enforce_company_signup before insert on auth.users
  for each row execute function public.enforce_company_signup();

-- ---------- internal checks ----------
create or replace function public.require_company() returns void
language plpgsql stable as $$
begin
  if auth.uid() is null or not public.is_company_user() then
    raise exception 'NOT_COMPANY';
  end if;
end $$;

create or replace function public.require_admin() returns void
language plpgsql stable as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
end $$;

create or replace function public.check_image(p_path text) returns void
language plpgsql stable as $$
begin
  if coalesce(p_path, '') = '' then
    raise exception 'IMAGE_REQUIRED';
  end if;
  if p_path not like auth.uid()::text || '/%' then
    raise exception 'BAD_IMAGE';
  end if;
end $$;

-- ---------- read RPCs ----------
create or replace function public.get_leaderboard(p_contest text)
returns table (
  id uuid, name text, subtitle text, image_path text, team_image_path text,
  members jsonb, is_mine boolean, score int, rank int
)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_show boolean;
  v_uid uuid := auth.uid();
  v_email text := public.current_email();
  v_admin boolean := public.is_admin();
begin
  perform public.require_company();

  if p_contest = 'costume' then
    select s.costume_results_published into v_show from public.settings s where s.id = 1;
    v_show := v_show or v_admin;
    return query
      with s as (
        select c.id, c.display_name, c.title, c.image_path, c.user_id, c.created_at,
          (10 * (select count(*) from public.votes v where v.contest = 'costume' and v.entry_id = c.id)
            + c.admin_adjustment)::int as sc
        from public.costume_entries c
      )
      select s.id, s.display_name, s.title, s.image_path, null::text, '[]'::jsonb,
        s.user_id = v_uid,
        case when v_show then s.sc end,
        case when v_show then (rank() over (order by s.sc desc))::int end
      from s
      order by case when v_show then s.sc end desc nulls last, s.created_at;

  elsif p_contest = 'krathong' then
    select s.krathong_results_published into v_show from public.settings s where s.id = 1;
    v_show := v_show or v_admin;
    return query
      with s as (
        select t.id, t.name, t.krathong_image_path, t.team_image_path, t.created_at, t.created_by_email,
          exists (select 1 from public.krathong_team_members m where m.team_id = t.id and m.email = v_email) as mine,
          (select count(*) from public.krathong_team_members m where m.team_id = t.id)::int as n,
          (10 * (select count(*) from public.votes v where v.contest = 'krathong' and v.entry_id = t.id)
            + t.admin_adjustment)::int as sc
        from public.krathong_teams t
      )
      select s.id, s.name,
        s.n::text || case when s.n = 1 then ' member' else ' members' end,
        s.krathong_image_path, s.team_image_path,
        coalesce((
          select jsonb_agg(
            case when s.mine or v_admin
              then jsonb_build_object('name', m.name, 'email', m.email)
              else jsonb_build_object('name', m.name) end
            order by (m.email = s.created_by_email) desc, m.name)
          from public.krathong_team_members m where m.team_id = s.id
        ), '[]'::jsonb),
        s.mine,
        case when v_show then s.sc end,
        case when v_show then (rank() over (order by s.sc desc))::int end
      from s
      order by case when v_show then s.sc end desc nulls last, s.created_at;
  else
    raise exception 'BAD_CONTEST';
  end if;
end $$;

create or replace function public.get_my_votes()
returns table (contest text, entry_id uuid)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.require_company();
  return query select v.contest, v.entry_id from public.votes v where v.user_id = auth.uid();
end $$;

-- ---------- voting ----------
create or replace function public.cast_vote(p_contest text, p_entry_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := public.current_email();
  v_open boolean;
begin
  perform public.require_company();

  if p_contest = 'costume' then
    select costume_voting_open into v_open from public.settings where id = 1;
    if not v_open then raise exception 'VOTING_CLOSED'; end if;
    if not exists (select 1 from public.costume_entries where id = p_entry_id) then
      raise exception 'NOT_FOUND';
    end if;
    if exists (select 1 from public.costume_entries where id = p_entry_id and user_id = v_uid) then
      raise exception 'OWN_ENTRY';
    end if;
  elsif p_contest = 'krathong' then
    select krathong_voting_open into v_open from public.settings where id = 1;
    if not v_open then raise exception 'VOTING_CLOSED'; end if;
    if not exists (select 1 from public.krathong_teams where id = p_entry_id) then
      raise exception 'NOT_FOUND';
    end if;
    if exists (select 1 from public.krathong_team_members where team_id = p_entry_id and email = v_email) then
      raise exception 'OWN_ENTRY';
    end if;
  else
    raise exception 'BAD_CONTEST';
  end if;

  if exists (select 1 from public.votes where user_id = v_uid and contest = p_contest) then
    raise exception 'ALREADY_VOTED';
  end if;

  begin
    insert into public.votes (user_id, contest, entry_id) values (v_uid, p_contest, p_entry_id);
  exception when unique_violation then
    raise exception 'ALREADY_VOTED';
  end;
end $$;

-- ---------- costume entries ----------
create or replace function public.save_costume_entry(p_title text, p_image_path text, p_display_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_open boolean;
  v_id uuid;
begin
  perform public.require_company();
  select costume_registration_open into v_open from public.settings where id = 1;
  if not v_open then raise exception 'REGISTRATION_CLOSED'; end if;
  perform public.check_image(p_image_path);
  if coalesce(trim(p_display_name), '') = '' then raise exception 'NAME_REQUIRED'; end if;

  insert into public.costume_entries (user_id, email, display_name, title, image_path)
  values (auth.uid(), public.current_email(), left(trim(p_display_name), 80),
          left(coalesce(trim(p_title), ''), 80), p_image_path)
  on conflict (user_id) do update
    set display_name = excluded.display_name, title = excluded.title, image_path = excluded.image_path
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.delete_my_costume_entry() returns void
language plpgsql security definer set search_path = public as $$
declare v_open boolean;
begin
  perform public.require_company();
  select costume_registration_open into v_open from public.settings where id = 1;
  if not v_open then raise exception 'REGISTRATION_CLOSED'; end if;
  delete from public.costume_entries where user_id = auth.uid();
end $$;

-- ---------- krathong teams ----------
-- p_team_id null = create, otherwise update (creator only).
-- p_members: [{"name": "...", "email": "..."}], must include the creator.
create or replace function public.save_krathong_team(
  p_team_id uuid, p_name text, p_members jsonb, p_krathong_image_path text, p_team_image_path text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := public.current_email();
  v_open boolean;
  v_id uuid;
begin
  perform public.require_company();
  select krathong_registration_open into v_open from public.settings where id = 1;
  if not v_open then raise exception 'REGISTRATION_CLOSED'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'NAME_REQUIRED'; end if;
  perform public.check_image(p_krathong_image_path);
  perform public.check_image(p_team_image_path);

  create temp table if not exists _members (email text primary key, name text) on commit drop;
  truncate _members;
  insert into _members (email, name)
    select distinct on (lower(trim(x.email))) lower(trim(x.email)), left(trim(x.name), 80)
    from jsonb_to_recordset(coalesce(p_members, '[]'::jsonb)) as x(name text, email text);

  if exists (select 1 from _members where not public.is_company_email(email)) then
    raise exception 'NOT_COMPANY_MEMBER';
  end if;
  if exists (select 1 from _members where coalesce(name, '') = '') then
    raise exception 'NAME_REQUIRED';
  end if;
  if not exists (select 1 from _members where email = v_email) then
    raise exception 'CREATOR_REQUIRED';
  end if;

  if p_team_id is null then
    if exists (select 1 from public.krathong_team_members where email = v_email) then
      raise exception 'ALREADY_IN_TEAM';
    end if;
    if exists (select 1 from public.krathong_team_members m join _members n on n.email = m.email) then
      raise exception 'MEMBER_IN_OTHER_TEAM';
    end if;
    insert into public.krathong_teams (name, krathong_image_path, team_image_path, created_by, created_by_email)
      values (left(trim(p_name), 80), p_krathong_image_path, p_team_image_path, v_uid, v_email)
      returning id into v_id;
  else
    if not exists (select 1 from public.krathong_teams where id = p_team_id) then
      raise exception 'NOT_FOUND';
    end if;
    if not exists (select 1 from public.krathong_teams where id = p_team_id and created_by = v_uid) then
      raise exception 'NOT_OWNER';
    end if;
    if exists (select 1 from public.krathong_team_members m join _members n on n.email = m.email
               where m.team_id <> p_team_id) then
      raise exception 'MEMBER_IN_OTHER_TEAM';
    end if;
    v_id := p_team_id;
    update public.krathong_teams
      set name = left(trim(p_name), 80), krathong_image_path = p_krathong_image_path,
          team_image_path = p_team_image_path
      where id = v_id;
    delete from public.krathong_team_members where team_id = v_id;
  end if;

  begin
    insert into public.krathong_team_members (team_id, email, name)
      select v_id, email, name from _members;
  exception when unique_violation then
    raise exception 'MEMBER_IN_OTHER_TEAM';
  end;
  return v_id;
end $$;

create or replace function public.delete_my_krathong_team(p_team_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_open boolean;
begin
  perform public.require_company();
  select krathong_registration_open into v_open from public.settings where id = 1;
  if not v_open then raise exception 'REGISTRATION_CLOSED'; end if;
  if not exists (select 1 from public.krathong_teams where id = p_team_id and created_by = auth.uid()) then
    raise exception 'NOT_OWNER';
  end if;
  delete from public.krathong_teams where id = p_team_id;
end $$;

-- ---------- admin ----------
create or replace function public.admin_set_flag(p_flag text, p_value boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  case p_flag
    when 'costume_registration_open' then update public.settings set costume_registration_open = p_value, updated_at = now() where id = 1;
    when 'costume_voting_open' then update public.settings set costume_voting_open = p_value, updated_at = now() where id = 1;
    when 'krathong_registration_open' then update public.settings set krathong_registration_open = p_value, updated_at = now() where id = 1;
    when 'krathong_voting_open' then update public.settings set krathong_voting_open = p_value, updated_at = now() where id = 1;
    when 'costume_results_published' then update public.settings set costume_results_published = p_value, updated_at = now() where id = 1;
    when 'krathong_results_published' then update public.settings set krathong_results_published = p_value, updated_at = now() where id = 1;
    else raise exception 'BAD_FLAG';
  end case;
end $$;

create or replace function public.admin_adjust_score(p_contest text, p_entry_id uuid, p_delta int) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if p_contest = 'costume' then
    update public.costume_entries set admin_adjustment = admin_adjustment + p_delta where id = p_entry_id;
  elsif p_contest = 'krathong' then
    update public.krathong_teams set admin_adjustment = admin_adjustment + p_delta where id = p_entry_id;
  else
    raise exception 'BAD_CONTEST';
  end if;
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

create or replace function public.admin_delete_entry(p_contest text, p_entry_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if p_contest = 'costume' then
    delete from public.costume_entries where id = p_entry_id;
  elsif p_contest = 'krathong' then
    delete from public.krathong_teams where id = p_entry_id;
  else
    raise exception 'BAD_CONTEST';
  end if;
end $$;

create or replace function public.admin_stats()
returns table (contest text, entries int, votes int)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public.require_admin();
  return query
    select 'costume'::text, (select count(*) from public.costume_entries)::int,
           (select count(*) from public.votes v where v.contest = 'costume')::int
    union all
    select 'krathong'::text, (select count(*) from public.krathong_teams)::int,
           (select count(*) from public.votes v where v.contest = 'krathong')::int;
end $$;

-- ---------- function privileges ----------
-- Only signed-in users may call the RPCs; helpers stay internal.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.current_email(), public.is_company_email(text), public.is_company_user(), public.is_admin(),
  public.get_leaderboard(text), public.get_my_votes(), public.cast_vote(text, uuid),
  public.save_costume_entry(text, text, text), public.delete_my_costume_entry(),
  public.save_krathong_team(uuid, text, jsonb, text, text), public.delete_my_krathong_team(uuid),
  public.admin_set_flag(text, boolean), public.admin_adjust_score(text, uuid, int),
  public.admin_delete_entry(text, uuid), public.admin_stats()
to authenticated;

-- ---------- realtime ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settings'
  ) then
    alter publication supabase_realtime add table public.settings;
  end if;
end $$;
