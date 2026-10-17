# SPARROW ONLINE — mode multijoueur (bêta privée)

Mode distinct du jeu solo, accessible depuis `/jeu` avec la carte « SPARROW ONLINE ». Il vit à l'adresse `/jeu/online`.

Le jeu solo, ses sauvegardes et le reste de l'application ne sont pas touchés. Le moteur de carte gagne seulement deux réglages, inactifs par défaut : le sprite du joueur et les autres joueurs.

## Ce qui est livré (V1)

| Fonction | Détail |
|---|---|
| Compte | E-mail et mot de passe (Supabase Auth). La session est restaurée à la réouverture de l'app. |
| Héros | Éditeur pixel art avec 8 catégories : 4 coiffures, 6 couleurs de cheveux, 4 peaux, 3 visages (neutre, lunettes, barbe), 3 hauts en 8 couleurs, 4 pantalons, 4 accessoires (rien, casquette, casque audio, bandeau). |
| Pseudo | 3 à 16 caractères, unique sans tenir compte des majuscules. |
| Bêta privée | Un code d'invitation est obligatoire pour créer un héros. |
| Monde | Le Quartier 404 partagé : même décor que le jeu solo, mais les portes de l'aventure solo sont fermées. Sparrow y est présent comme PNJ, avec ses dialogues. |
| Temps réel | Présence, déplacements, pseudo au-dessus de chaque joueur, collisions entre joueurs. A face à un joueur ouvre sa fiche (bloquer, signaler). |
| Réseau | Envoi seulement au changement de case, plus un battement toutes les 5 s. Interpolation des mouvements. Instances de 20 joueurs. Départ en arrière-plan iPhone, retour, et reconnexion. |
| Chat | Salon général du Quartier 404 : pseudo, heure, 50 derniers messages, temps réel. Anti-spam : 1,5 s entre deux messages, 8 messages par 30 s, pas de doublon. Bloquer et signaler. |

## Sécurité (côté serveur)

Le schéma est dans `supabase/migrations/20261018000000_sparrow_online.sql`.

- **Row Level Security sur toutes les tables.** Aucun accès anonyme.
- **Le client n'écrit jamais directement.** Héros, apparence et messages passent par des fonctions serveur qui valident tout : `create_hero`, `update_look`, `send_message`.
  - L'apparence n'accepte que les options de l'éditeur.
  - Le pseudo est vérifié.
  - L'invitation est consommée une fois.
  - L'anti-spam est appliqué côté serveur.
- **Progression protégée.** Niveau, XP et monnaie ne sont modifiables par aucun client.
- **Chat.** Il n'est lisible que par les joueurs qui ont un héros. Les messages des joueurs bloqués sont filtrés par la base, temps réel compris.
- **Modération.** Chacun ne voit et ne gère que ses propres blocages. Les signalements ne sont lisibles qu'en administration.
- **Salons temps réel privés.** Seuls les joueurs avec un héros peuvent rejoindre `online:quartier-404:*` (policies sur `realtime.messages`).
- **Pseudos et apparences affichés.** Ils viennent de la base, jamais de ce qu'un client annonce.
- **Clés.** Seule la clé publique (anon / publishable) est dans le frontend. Aucune clé secrète.

**Limite connue :** les positions en temps réel ne sont pas « autoritaires ». Un client modifié pourrait annoncer une fausse position. Rien de persistant n'en dépend aujourd'hui. Les futures récompenses devront être validées côté serveur.

## Configuration en place

- Projet Supabase **sparrow-online**, réf. `mtbsuhllfsvhdafuaqtr`. Plan Free (0 €), région Paris (eu-west-3).
  - Il est distinct du projet JARVIS, qui n'est pas touché.
- **Migration appliquée.**
  - Le conseiller de sécurité Supabase signale seulement deux choix assumés : `invites` sans règle, car illisible pour les clients, et les 3 fonctions serveur appelables par les joueurs, qui sont la seule porte d'écriture.
  - Les règles ont été vérifiées sur la vraie base, dans une transaction annulée.
- **Code d'invitation de la bêta :** `SPARROW-404-BETA`, valable pour 20 héros.
- **L'app utilise ce projet par défaut.** L'URL et la clé publiable sont publiques par conception. Les variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`, si elles sont définies sur Vercel, ont la priorité.
- **Réglages facultatifs du tableau de bord.** Le connecteur ne permet pas de les changer :
  - **Authentication → Sign In / Providers → Email → « Confirm email »** : le désactiver permet de jouer sans cliquer sur un e-mail.
  - **Authentication → URL Configuration → Site URL** : y mettre l'adresse du site. Les liens de confirmation s'ouvrent alors au bon endroit.

## Refaire la configuration sur un autre projet

1. **Créer un projet Supabase gratuit** sur supabase.com, avec le plan Free (pas de carte bancaire). Choisir une région proche, par exemple Paris ou Francfort.
2. **SQL Editor → New query :** coller tout le fichier `supabase/migrations/20261018000000_sparrow_online.sql`, puis Run.
3. **Codes d'invitation** (SQL Editor). Par exemple :
   ```sql
   insert into public.invites (code, max_uses) values ('SPARROW-BETA', 10);
   ```
4. **Authentication → Providers → Email :** activé.
   - Pour une bêta entre amis, on peut désactiver « Confirm email ». Sinon, chaque joueur clique sur le lien reçu par e-mail avant de se connecter.
   - Dans Authentication → URL Configuration, mettre l'adresse du site Vercel en « Site URL ».
5. **Realtime → Settings :** désactiver « Allow public access ». Ainsi, seuls les salons privés, protégés par les règles, sont utilisables.
6. **Vercel → Project → Settings → Environment Variables :**
   - `NEXT_PUBLIC_SUPABASE_URL` : l'URL du projet (Project Settings → API).
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` : la clé **anon / publishable**, jamais la clé `service_role`.

   Puis redéployer.

Sans ces variables, la page en ligne affiche simplement que le mode n'est pas encore branché.

**Limites du plan gratuit Supabase.** Elles suffisent largement pour une bêta :
- 200 connexions temps réel simultanées ;
- 2 millions de messages temps réel par mois ;
- 500 Mo de base de données ;
- le projet se met en pause après 7 jours sans activité, et un clic dans le tableau de bord le relance.

**Modération :** Table Editor → `reports` pour les signalements. On peut aussi supprimer un message dans `chat_messages`.

## Tests

| Commande | Ce qu'elle vérifie |
|---|---|
| `bash scripts/test-online-db.sh` | 41 tests de sécurité sur un vrai PostgreSQL 16, avec émulation de `auth.uid()`, des rôles `anon` / `authenticated` et de `realtime.messages`. |
| `npx vitest run tests/online.test.ts` | Héros (toutes les combinaisons, validation identique au SQL), politique d'envoi, interpolation, instances, anti-spam, carte et cases d'apparition. |
| Test à deux navigateurs (contextes iPhone séparés) | Via le relais local `scripts/online-dev-relay.mjs`, qui reproduit les règles du serveur. Voir le détail ci-dessous. |

Le test à deux navigateurs couvre :
- les 2 inscriptions et les 2 héros ;
- la connexion simultanée ;
- les déplacements, les cases exactes et l'interpolation ;
- les collisions et la fiche joueur ;
- le chat, la notification et l'anti-spam ;
- le blocage ;
- l'arrière-plan iPhone ;
- la fermeture de l'app, la réouverture, et la session et l'apparence restaurées.

Le test réel avec Supabase reste à faire une fois le projet configuré : deux iPhone, deux comptes.

Pour lancer le relais local :
```bash
node scripts/online-dev-relay.mjs
NEXT_PUBLIC_ONLINE_DEV_RELAY=ws://localhost:8787 npx next build && npx next start
```
Ouvrir ensuite deux navigateurs, avec le code `BETA-404`. Le relais n'est jamais déployé.

## Architecture prévue pour la suite (non développée)

- **`profiles`** porte déjà `level`, `xp` et `coins`, modifiables uniquement côté serveur.
- **Inventaire et monstres :** des tables dédiées, écrites seulement par des fonctions serveur (récompenses, échanges en deux étapes avec confirmation des deux joueurs).
- **Salons :** le nom `online:<lieu>:<instance>` est extensible aux appartements visitables, aux groupes et aux événements.
- **Missions coopératives :** le type `CoopQuest` existe déjà dans `src/lib/online/world.ts`. Les étapes seront validées côté serveur.
- **Combats multijoueurs au tour par tour :** ils réutiliseront le moteur pur `combat.ts`, avec un état de combat tenu par le serveur (fonction ou Edge Function) et diffusé dans un salon privé.
