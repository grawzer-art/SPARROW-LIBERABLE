# Sparrowgotchi 3.0

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
| `src/lib/gotchi/room.ts` | Géométrie de l'appartement : obstacles, collisions avec contournement des coins, chemins, objets interactifs, position sauvegardée |
| `src/components/gotchi/world.ts` | Rendu canvas de l'appartement (4 pièces, caméra, déplacement libre au joystick, vie autonome, séquences animées) |
| `src/components/gotchi/Joystick.tsx` | Joystick tactile |
| `src/components/gotchi/sprites.ts` | Pixel art : Sparrow (poses, lunettes, tenues, barbe qui pousse), meubles, chapeaux, monstres |
| `src/components/gotchi/FarmGame.tsx` | Écran du mini-jeu |
| `src/components/gotchi/Gotchi.tsx` | Interface : progression, bulle, monde, jauges, actions, panneaux (Missions, Sac, Trophées, Journal, Options) |

## Contrôle (3.0)

- **Joystick** (ou les flèches / ZQSD du clavier) : Sparrow se déplace librement. Les meubles bloquent le passage, et il contourne tout seul les coins.
- **Toucher l'écran** :
  - un objet : il y va, puis l'utilise ;
  - le sol : il y marche ;
  - Sparrow : il parle.
- **Bouton A** : il est contextuel. À côté d'un objet, il affiche ce qu'on peut faire (« Jouer au PC », « Faire des frites »…) ; sinon, il fait parler Sparrow.
- **Boucle complète** : on va au PC, on joue la session de farm, on gagne des FP et de l'XP, et tout est sauvegardé.
- **Mode autonome** : sans contrôle pendant 14 s, Sparrow reprend sa vie. Les événements ne l'interrompent pas pendant que le joueur le dirige.
- **Répliques** : elles réagissent à ce que fait le joueur (prise en main, collisions, longues marches, pièce visitée, objets utilisés).

## Sauvegarde

- La clé `localStorage` est `sp.gotchi.v1`, la même qu'en v1. La position de Sparrow est enregistrée à part, sous la clé `sp.gotchi.pos`. `restore` reconnaît une sauvegarde v1 et la convertit sans rien perdre (jauges, compteurs, date d'adoption).
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
