-- Minimal stand-ins for the parts of Supabase that schema.sql relies on,
-- so the schema can be tested in PGlite without a real project.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;

create role anon nologin;
create role authenticated nologin;
grant usage on schema public to anon, authenticated;
grant usage on schema auth to anon, authenticated;
grant execute on all functions in schema auth to anon, authenticated;

-- Supabase grants everything on new public tables to the API roles by default;
-- mimic that so the test proves schema.sql revokes it.
alter default privileges in schema public grant all on tables to anon, authenticated;

create publication supabase_realtime;
