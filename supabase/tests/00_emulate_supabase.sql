-- Émulation minimale de Supabase pour tester le schéma sur un PostgreSQL local
-- (rôles, auth.uid() lu dans le JWT simulé, schéma realtime, publication).
-- NE PAS exécuter sur un vrai projet Supabase : ces objets y existent déjà.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema realtime;
create table realtime.messages (id bigserial primary key, topic text, payload jsonb);
alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$
  select current_setting('realtime.topic', true)
$$;
grant usage on schema realtime to authenticated;
grant select, insert on realtime.messages to authenticated;
grant usage on sequence realtime.messages_id_seq to authenticated;
grant execute on function realtime.topic() to authenticated;
create publication supabase_realtime;
grant usage on schema public to anon, authenticated;
-- Supabase donne par défaut tous les droits sur les tables publiques ; les règles RLS font le tri
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
