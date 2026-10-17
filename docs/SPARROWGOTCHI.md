# Sparrowgotchi — édition console (SPARROW·BOY)

Jeu « animal virtuel » de `/jeu/sparrowgotchi`. Il n'y a ni base de données, ni compte, ni achat réel : tout est enregistré sur le téléphone.

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/gotchi/core.ts` | État v2, temps réel (rattrapage ralenti après 6 h, plafonné à 48 h), humeurs, XP et niveaux, migration v1 → v2 (`restore`) |
| `src/lib/gotchi/engine.ts` | Actions (`act`), événements (`randomEvent`, `applyEvent`, `catchUp`), boutique (`buy`, `equip`), mini-jeu (`farmReward`), objet caché (`cacheSpot`, `findCache`), missions (`claim`) |
| `src/lib/gotchi/items.ts` | Objets (lunettes, tenues, couvre-chefs, déco ; les objets rares ne se trouvent qu'en drop), courbe d'XP, titres |
| `src/lib/gotchi/missions.ts` | 13 missions, 3 tirées par jour (heure de Paris, tirage déterministe) |
| `src/lib/gotchi/achievements.ts` | 27 trophées, dont 6 secrets |
| `src/lib/gotchi/events.ts` | 46 événements aléatoires (communs, rares, légendaires) aux effets réels, jamais bloquants (une panne de PC dure 12 min maximum) |
| `src/lib/gotchi/dialogue.ts` | Répliques contextuelles (humeur, heure, dernière action, habitudes, équipement, absence) avec anti-répétition |
| `src/lib/gotchi/lines.ts` | Répliques des actions |
| `src/lib/gotchi/farm.ts` | Logique pure du mini-jeu de farm (30 s, ressources, monstres inventés, combo, Œuf Dofrite très rare) |
| `src/lib/gotchi/map.ts` | Carte : 5 pièces de 160 × 144 px (cases de 8 px), portes, meubles (zones bloquantes), objets utilisables, collisions, chemins dans une pièce et d'une pièce à l'autre, position sauvegardée, objet caché |
| `src/lib/gotchi/muscu.ts` | Logique pure du mini-jeu de muscu (timing, combos, crampe) |
| `src/lib/gotchi/minigames.ts` | Registre des mini-jeux (un mini-jeu = une entrée + son écran) |
| `src/components/gotchi/world.ts` | Moteur du monde : un écran par pièce, croix 8 directions, portes, déplacement automatique, vie autonome, séquences animées, tri de profondeur |
| `src/components/gotchi/decor.ts` | Dessin des pièces et des meubles (niveaux de meubles, déco, ciel selon l'heure) |
| `src/components/gotchi/DPad.tsx` | Croix directionnelle tactile |
| `src/components/gotchi/Pages.tsx` | Pages du MENU (Actions, Mini-jeux, Missions, Inventaire, Appartement, Profil, Journal, Options) |
| `src/components/gotchi/MuscuGame.tsx` | Écran du mini-jeu de muscu |
| `src/components/gotchi/sprites.ts` | Pixel art : Sparrow (poses, lunettes, tenues, barbe qui pousse), meubles, chapeaux, monstres |
| `src/components/gotchi/FarmGame.tsx` | Écran du mini-jeu |
| `src/components/gotchi/Gotchi.tsx` | Interface : progression, bulle, monde, jauges, actions, panneaux (Missions, Sac, Trophées, Journal, Options) |

## Console

- **Écran** : 160 × 144 px, comme une Game Boy. Une pièce par écran, avec un bandeau qui affiche son nom quand on y entre.
- **Plan de l'appartement** :
  - en haut : Chambre – Salon – Cuisine ;
  - en bas : Coin gaming (sous le salon) et Salle de sport (sous la cuisine).
- **Croix** : marcher dans 8 directions. Les meubles bloquent, et Sparrow contourne les coins. Il passe d'une pièce à l'autre par les portes.
- **A** : utiliser l'objet devant lui, ou parler ; fait aussi avancer les dialogues.
  - Lit : micro-sieste.
  - PC : Dofus, avec le mini-jeu de farm.
  - Friteuse : frites. Frigo : salade.
  - Lavabo et douche : se rafraîchir.
  - Banc : s'entraîner, avec le mini-jeu de muscu.
  - Miroir : il commente ses muscles.
  - Fenêtre et canapé : répliques.
- **B** : annuler ou revenir en arrière. Maintenu : courir.
- **START** : MENU, à parcourir à la croix et avec A/B, ou au doigt. **SELECT** : mini-jeux.
- **Toucher l'écran** :
  - un objet : il y va et l'utilise ;
  - une porte : il la passe ;
  - le sol : il y marche ;
  - Sparrow : il parle.
- **Depuis le menu** : une action ou un mini-jeu envoie Sparrow au bon meuble, même dans une autre pièce. Il passe alors par les portes.
- **Mode autonome** : sans contrôle pendant 14 s, il reprend sa vie et peut changer de pièce tout seul. Les événements ne l'interrompent pas pendant qu'on joue.
- **Clavier** : flèches ou ZQSD, Entrée = A, Échap = B, M = START, Maj = courir.

## Progression

- **Rangs** : Stagiaire du canapé, Rôdeur du salon, Farmeur de Dofus, Athlète du dimanche, Prince de la frite, Samouraï du sujet, Sparrow Doré.
- **Évolution musculaire** :
  - la muscu donne des points de muscle ;
  - stades : Normal, Sec (30), Costaud (90), Bodybuildé (200), SPARROW TITAN (400) ;
  - le corps change dans l'appartement, et le TITAN a une aura.
- **Meubles améliorables**, visibles dans l'appart et toujours avec un bonus :
  - PC : +15 % de FP en farm par niveau ;
  - lit : micro-siestes plus efficaces ;
  - canapé ;
  - salle de sport : +25 % de muscle par niveau.
  - Posséder un niveau suffit : il est installé d'office.
- **Pour le style samouraï, plus tard** : ajouter une tenue dans `ITEMS` (slot `tenue`) et sa recoloration dans `OUTFIT` (`sprites.ts`).

## Sauvegarde

- La clé `localStorage` est `sp.gotchi.v1`, la même qu'en v1. La position de Sparrow (pièce, x, y) est enregistrée à part, sous la clé `sp.gotchi.place`. `restore` reconnaît une sauvegarde v1 et la convertit sans rien perdre (jauges, compteurs, date d'adoption).
- Tous les champs sont vérifiés au chargement. Une valeur abîmée ou un objet équipé mais non possédé ne casse rien.
- Dans **Options**, on peut **exporter** la sauvegarde en fichier JSON (via le partage iOS ou un téléchargement) et l'**importer**, après confirmation.
- Le compte à rebours de l'application n'est ni lu ni modifié par le jeu.

## Équilibrage

- XP pour passer au niveau suivant : `40 + niveau × 30`.
- Récompense de niveau : `20 + niveau × 10` FP.
- Session de farm : environ `score / 8` FP et `score / 12 + 5` XP.
- Le prix maximal en boutique est de 260 FP.
- Sparrow ne meurt jamais. Les jauges ne descendent pas sous 4 avec le seul passage du temps. Au pire, il boude quelques minutes, et les frites le font toujours revenir.

## Ajouter du contenu

- **Événement** : ajouter une entrée dans `EVENTS`, avec `scene` pour choisir l'animation jouée.
- **Mission** : ajouter une entrée dans `MISSIONS`, avec une `key` existante.
- **Trophée** : ajouter une entrée dans `TROPHIES`, avec une fonction `check`.
- **Objet** : ajouter une entrée dans `ITEMS`. Pour qu'il soit visible sur Sparrow, ajouter aussi son rendu dans `sprites.ts` : `GLASSES`, `OUTFIT` ou `HATS`.
