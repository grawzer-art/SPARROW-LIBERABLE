-- ════════════════════════════════════════════════════════════════════════════
-- SPARROW ONLINE — fondations (comptes, héros, salon Quartier 404, chat)
--
-- Principe de sécurité : le client ne peut RIEN écrire directement dans les tables.
-- Toute modification persistante passe par une fonction serveur (security definer)
-- qui valide les données : pseudo, apparence, invitation, messages (anti-spam).
-- Niveau, monnaie et futurs inventaires ne sont modifiables que côté serveur.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists citext;

-- ─── Bêta privée : invitations ───
create table public.invites (
  code text primary key check (code ~ '^[A-Z0-9-]{6,24}$'),
  max_uses int not null default 1 check (max_uses between 1 and 1000),
  uses int not null default 0 check (uses >= 0),
  created_at timestamptz not null default now()
);

-- ─── Héros (un par compte) ───
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pseudo citext not null unique,
  look jsonb not null,
  -- Progression multijoueur : jamais écrite par le client
  level int not null default 1 check (level between 1 and 99),
  xp int not null default 0 check (xp >= 0),
  coins int not null default 0 check (coins >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pseudo_format check (char_length(pseudo::text) between 3 and 16 and pseudo::text ~ '^[A-Za-z0-9_-]+$')
);

-- ─── Chat ───
create table public.chat_messages (
  id bigint generated always as identity primary key,
  room text not null check (room ~ '^[a-z0-9-]{3,40}$'),
  author uuid not null references public.profiles (id) on delete cascade,
  pseudo citext not null,
  body text not null check (char_length(body) between 1 and 200),
  created_at timestamptz not null default now()
);
create index chat_messages_room_time on public.chat_messages (room, created_at desc);
create index chat_messages_author_time on public.chat_messages (author, created_at desc);

-- ─── Modération ───
create table public.blocks (
  blocker uuid not null references public.profiles (id) on delete cascade,
  blocked uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

create table public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  target uuid not null references public.profiles (id) on delete cascade,
  message_id bigint references public.chat_messages (id) on delete set null,
  reason text not null default '' check (char_length(reason) <= 300),
  created_at timestamptz not null default now(),
  check (reporter <> target)
);

-- ════════════════════════════ Row Level Security ════════════════════════════

alter table public.invites enable row level security;
alter table public.profiles enable row level security;
alter table public.chat_messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

-- Aucun accès anonyme ; les utilisateurs connectés n'écrivent jamais directement.
revoke all on public.invites, public.profiles, public.chat_messages, public.blocks, public.reports from anon;
revoke insert, update, delete on public.invites, public.profiles, public.chat_messages from authenticated;
revoke all on public.invites from authenticated;
grant select on public.profiles, public.chat_messages to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant insert on public.reports to authenticated;

-- Les héros sont visibles par les joueurs connectés (pseudo, apparence, niveau)
create policy "profils visibles par les joueurs" on public.profiles
  for select to authenticated using (true);

-- Le chat n'est lisible que par un joueur qui a un héros, sans les messages des joueurs qu'il a bloqués
create policy "chat lisible par les joueurs" on public.chat_messages
  for select to authenticated using (
    exists (select 1 from public.profiles p where p.id = auth.uid())
    and not exists (select 1 from public.blocks b where b.blocker = auth.uid() and b.blocked = chat_messages.author)
  );

create policy "mes blocages : lire" on public.blocks
  for select to authenticated using (blocker = auth.uid());
create policy "mes blocages : ajouter" on public.blocks
  for insert to authenticated with check (blocker = auth.uid());
create policy "mes blocages : retirer" on public.blocks
  for delete to authenticated using (blocker = auth.uid());

create policy "signaler" on public.reports
  for insert to authenticated with check (reporter = auth.uid());

-- ══════════════════════════ Fonctions serveur validées ══════════════════════════

-- Apparence : uniquement les options réellement proposées par l'éditeur (src/lib/online/hero.ts)
create or replace function public.valid_look(l jsonb) returns boolean
language sql immutable as $$
  select jsonb_typeof(l) = 'object'
    and (select array_agg(k order by k) from jsonb_object_keys(l) k) = array['acc', 'face', 'hair', 'hairColor', 'pants', 'skin', 'top', 'topColor']
    and (select bool_and(jsonb_typeof(v) = 'number' and (v::text)::numeric = floor((v::text)::numeric)) from jsonb_each(l) e(k, v))
    and (l->>'hair')::int between 0 and 3
    and (l->>'hairColor')::int between 0 and 5
    and (l->>'skin')::int between 0 and 3
    and (l->>'face')::int between 0 and 2
    and (l->>'top')::int between 0 and 2
    and (l->>'topColor')::int between 0 and 7
    and (l->>'pants')::int between 0 and 3
    and (l->>'acc')::int between 0 and 3
$$;

-- Création du héros (bêta privée : un code d'invitation valide est nécessaire)
create or replace function public.create_hero(p_invite text, p_pseudo text, p_look jsonb)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  inv public.invites;
  v_name text := btrim(coalesce(p_pseudo, ''));
  v_out public.profiles;
begin
  if me is null then raise exception 'non connecté' using errcode = '28000'; end if;
  if exists (select 1 from public.profiles where id = me) then raise exception 'ce compte a déjà un héros' using errcode = 'P0001'; end if;
  if char_length(v_name) not between 3 and 16 or v_name !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'pseudo invalide : 3 à 16 caractères, lettres, chiffres, - ou _' using errcode = '22023';
  end if;
  if not public.valid_look(p_look) then raise exception 'apparence invalide' using errcode = '22023'; end if;
  select * into inv from public.invites where code = upper(btrim(coalesce(p_invite, ''))) for update;
  if not found or inv.uses >= inv.max_uses then raise exception 'code d''invitation invalide ou épuisé' using errcode = '42501'; end if;
  if exists (select 1 from public.profiles where pseudo = v_name::citext) then raise exception 'pseudo déjà pris' using errcode = '23505'; end if;
  update public.invites set uses = uses + 1 where code = inv.code;
  insert into public.profiles (id, pseudo, look) values (me, v_name, p_look) returning * into v_out;
  return v_out;
end $$;

-- Changer d'apparence (rien d'autre : ni niveau, ni monnaie)
create or replace function public.update_look(p_look jsonb)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_out public.profiles;
begin
  if auth.uid() is null then raise exception 'non connecté' using errcode = '28000'; end if;
  if not public.valid_look(p_look) then raise exception 'apparence invalide' using errcode = '22023'; end if;
  update public.profiles set look = p_look, updated_at = now() where id = auth.uid() returning * into v_out;
  if not found then raise exception 'aucun héros' using errcode = 'P0002'; end if;
  return v_out;
end $$;

-- Envoyer un message : validation, salons autorisés, anti-spam
create or replace function public.send_message(p_room text, p_body text)
returns public.chat_messages
language plpgsql security definer set search_path = public as $$
declare
  me public.profiles;
  v_body text;
  v_last timestamptz;
  v_recent int;
  v_out public.chat_messages;
begin
  if auth.uid() is null then raise exception 'non connecté' using errcode = '28000'; end if;
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'crée d''abord ton héros' using errcode = 'P0002'; end if;
  if p_room not in ('quartier-404') then raise exception 'salon inconnu' using errcode = '42501'; end if;
  -- Nettoyage : caractères de contrôle retirés, espaces regroupés
  v_body := btrim(regexp_replace(regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g'));
  if char_length(v_body) not between 1 and 200 then raise exception 'message vide ou trop long (200 caractères max)' using errcode = '22023'; end if;
  select max(created_at), count(*) filter (where created_at > now() - interval '30 seconds')
    into v_last, v_recent
    from public.chat_messages where author = me.id and created_at > now() - interval '30 seconds';
  if v_last is not null and v_last > now() - interval '1.5 seconds' then raise exception 'doucement : un message toutes les 1,5 s' using errcode = '53400'; end if;
  if v_recent >= 8 then raise exception 'trop de messages : attends quelques secondes' using errcode = '53400'; end if;
  if exists (select 1 from public.chat_messages where author = me.id and chat_messages.body = v_body and created_at > now() - interval '15 seconds') then
    raise exception 'message déjà envoyé' using errcode = '53400';
  end if;
  insert into public.chat_messages (room, author, pseudo, body) values (p_room, me.id, me.pseudo, v_body) returning * into v_out;
  return v_out;
end $$;

revoke all on function public.create_hero(text, text, jsonb), public.update_look(jsonb), public.send_message(text, text) from public, anon;
grant execute on function public.create_hero(text, text, jsonb), public.update_look(jsonb), public.send_message(text, text) to authenticated;
grant execute on function public.valid_look(jsonb) to authenticated;

-- ══════════════════════════ Realtime ══════════════════════════

-- Le chat arrive en temps réel (les règles RLS ci-dessus filtrent ce que chacun reçoit)
alter publication supabase_realtime add table public.chat_messages;

-- Salons privés (présence + déplacements) : seuls les joueurs avec un héros peuvent les rejoindre
create policy "salon quartier : écouter" on realtime.messages
  for select to authenticated using (
    realtime.topic() like 'online:quartier-404:%'
    and exists (select 1 from public.profiles p where p.id = auth.uid())
  );
create policy "salon quartier : parler" on realtime.messages
  for insert to authenticated with check (
    realtime.topic() like 'online:quartier-404:%'
    and exists (select 1 from public.profiles p where p.id = auth.uid())
  );
