-- Tests de sécurité de SPARROW ONLINE (à lancer après 00_emulate_supabase.sql et la migration).
-- Chaque bloc s'exécute « comme » un joueur : rôle authenticated + identifiant dans le JWT simulé.
\set ON_ERROR_STOP on

create schema t;
grant usage on schema t to authenticated, anon;
create function t.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if cond is distinct from true then raise exception 'ÉCHEC : %', label; end if;
  raise notice 'ok — %', label;
end $$;
create function t.fails(q text, label text) returns void language plpgsql as $$
begin
  begin
    execute q;
  exception when others then
    raise notice 'ok — % (refusé : %)', label, sqlerrm;
    return;
  end;
  raise exception 'ÉCHEC : % aurait dû être refusé', label;
end $$;
grant execute on all functions in schema t to authenticated, anon;

-- Deux comptes, un code d'invitation à 2 utilisations
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'a@test'), ('22222222-2222-2222-2222-222222222222', 'b@test'), ('33333333-3333-3333-3333-333333333333', 'c@test');
insert into public.invites (code, max_uses) values ('BETA-404', 2);

-- ─── Création des héros ───
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t.fails($$select public.create_hero('MAUVAIS', 'Alice', '{"hair":0,"hairColor":0,"skin":0,"face":0,"top":0,"topColor":0,"pants":0,"acc":0}')$$, 'code d''invitation inconnu');
select t.fails($$select public.create_hero('BETA-404', 'a', '{"hair":0,"hairColor":0,"skin":0,"face":0,"top":0,"topColor":0,"pants":0,"acc":0}')$$, 'pseudo trop court');
select t.fails($$select public.create_hero('BETA-404', 'Alice<script>', '{"hair":0,"hairColor":0,"skin":0,"face":0,"top":0,"topColor":0,"pants":0,"acc":0}')$$, 'pseudo avec caractères interdits');
select t.fails($$select public.create_hero('BETA-404', 'Alice', '{"hair":9,"hairColor":0,"skin":0,"face":0,"top":0,"topColor":0,"pants":0,"acc":0}')$$, 'option d''apparence inexistante');
select t.fails($$select public.create_hero('BETA-404', 'Alice', '{"hair":0,"hairColor":0,"skin":0,"face":0,"top":0,"topColor":0,"pants":0,"acc":0,"level":99}')$$, 'apparence avec un champ en trop');
select t.ok((select pseudo::text from public.create_hero('beta-404', ' Alice ', '{"hair":1,"hairColor":2,"skin":1,"face":1,"top":2,"topColor":3,"pants":1,"acc":2}')) = 'Alice', 'héros créé (code insensible à la casse, pseudo nettoyé)');
select t.fails($$select public.create_hero('BETA-404', 'Alice2', '{"hair":0,"hairColor":0,"skin":0,"face":0,"top":0,"topColor":0,"pants":0,"acc":0}')$$, 'un seul héros par compte');
-- Aucune écriture directe possible
select t.fails($$update public.profiles set level = 99 where id = auth.uid()$$, 'se donner des niveaux');
select t.fails($$update public.profiles set coins = 999999$$, 'se donner de la monnaie');
select t.fails($$insert into public.profiles (id, pseudo, look) values (gen_random_uuid(), 'Pirate', '{}')$$, 'créer un profil sans passer par le serveur');
select t.fails($$select * from public.invites$$, 'lire les codes d''invitation');
select t.ok((select level from public.update_look('{"hair":3,"hairColor":5,"skin":3,"face":2,"top":1,"topColor":7,"pants":3,"acc":3}')) = 1, 'changer d''apparence ne touche pas au niveau');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select t.fails($$select public.create_hero('BETA-404', 'alice', '{"hair":0,"hairColor":0,"skin":0,"face":0,"top":0,"topColor":0,"pants":0,"acc":0}')$$, 'pseudo déjà pris (insensible à la casse)');
select public.create_hero('BETA-404', 'Bob', '{"hair":0,"hairColor":0,"skin":0,"face":0,"top":0,"topColor":0,"pants":0,"acc":0}');
select t.ok((select count(*) from public.profiles) = 2, 'Bob voit les deux héros');
select t.fails($$select public.update_look('{"hair":0}')$$, 'apparence incomplète refusée');
select t.ok((select look->>'hair' from public.profiles where pseudo = 'Alice') = '3', 'Bob ne peut pas modifier Alice (et l''apparence d''Alice est bien sauvegardée)');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select t.fails($$select public.create_hero('BETA-404', 'Carole', '{"hair":0,"hairColor":0,"skin":0,"face":0,"top":0,"topColor":0,"pants":0,"acc":0}')$$, 'invitation épuisée (2 utilisations)');
select t.fails($$select public.send_message('quartier-404', 'salut')$$, 'pas de chat sans héros');
select t.ok((select count(*) from public.chat_messages) = 0, 'pas de lecture du chat sans héros');
commit;

-- Anonyme : rien
begin;
set local role anon;
select t.fails($$select * from public.profiles$$, 'anonyme : lire les profils');
select t.fails($$select public.send_message('quartier-404', 'spam')$$, 'anonyme : écrire');
commit;

-- ─── Chat ───
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t.ok((select body from public.send_message('quartier-404', E'  Salut   le\tquartier !  ')) = 'Salut le quartier !', 'message nettoyé et envoyé');
select t.fails($$select public.send_message('quartier-404', 'encore')$$, 'anti-spam : 1,5 s entre deux messages');
select t.fails($$select public.send_message('salon-secret', 'hey')$$, 'salon inconnu');
select t.fails($$select public.send_message('quartier-404', repeat('a', 201))$$, 'message trop long');
select t.fails($$select public.send_message('quartier-404', '   ')$$, 'message vide');
select t.fails($$insert into public.chat_messages (room, author, pseudo, body) values ('quartier-404', auth.uid(), 'Alice', 'direct')$$, 'écrire dans le chat sans passer par le serveur');
select t.fails($$insert into public.chat_messages (room, author, pseudo, body) values ('quartier-404', '22222222-2222-2222-2222-222222222222', 'Bob', 'usurpation')$$, 'écrire au nom de Bob');
commit;

-- Le temps passe (2 s)
update public.chat_messages set created_at = created_at - interval '2 seconds';

begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t.fails($$select public.send_message('quartier-404', 'Salut le quartier !')$$, 'anti-spam : même message répété');
select public.send_message('quartier-404', 'Deuxième message');
commit;

-- Rafale : 8 messages dans les 30 dernières secondes → le 9ᵉ est refusé
insert into public.chat_messages (room, author, pseudo, body, created_at)
  select 'quartier-404', '11111111-1111-1111-1111-111111111111', 'Alice', 'rafale ' || g, now() - (g || ' seconds')::interval - interval '3 seconds' from generate_series(1, 7) g;
begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t.fails($$select public.send_message('quartier-404', 'un de trop')$$, 'anti-spam : 8 messages par 30 s');
commit;

-- ─── Blocage et signalement ───
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select t.ok((select count(*) from public.chat_messages where pseudo = 'Alice') > 0, 'Bob lit les messages d''Alice');
insert into public.blocks (blocker, blocked) values (auth.uid(), '11111111-1111-1111-1111-111111111111');
select t.ok((select count(*) from public.chat_messages where pseudo = 'Alice') = 0, 'après blocage, Bob ne reçoit plus Alice');
select t.fails($$insert into public.blocks (blocker, blocked) values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')$$, 'bloquer au nom d''un autre');
insert into public.reports (target, reason) values ('11111111-1111-1111-1111-111111111111', 'test');
select t.fails($$insert into public.reports (reporter, target) values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')$$, 'signaler au nom d''un autre');
select t.ok((select count(*) from public.reports) = 0, 'les signalements ne sont pas lisibles par les joueurs');
delete from public.blocks where blocker = auth.uid();
select t.ok((select count(*) from public.chat_messages where pseudo = 'Alice') > 0, 'débloquer rend les messages');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select t.ok((select count(*) from public.blocks) = 0, 'Alice ne voit pas qui l''a bloquée');
commit;

-- ─── Salons temps réel (présence, déplacements) ───
begin;
set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set local realtime.topic = 'online:quartier-404:1';
insert into realtime.messages (topic, payload) values ('online:quartier-404:1', '{}');
select t.ok((select count(*) from realtime.messages) = 1, 'un joueur avec héros rejoint le salon du quartier');
set local realtime.topic = 'online:salon-prive:1';
select t.fails($$insert into realtime.messages (topic, payload) values ('online:salon-prive:1', '{}')$$, 'salon non autorisé');
commit;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set local realtime.topic = 'online:quartier-404:1';
select t.fails($$insert into realtime.messages (topic, payload) values ('online:quartier-404:1', '{}')$$, 'sans héros, pas d''accès au salon');
select t.ok((select count(*) from realtime.messages) = 0, 'sans héros, rien à écouter');
commit;

\echo 'TOUS LES TESTS DE SÉCURITÉ SONT PASSÉS'
