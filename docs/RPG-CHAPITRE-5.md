# Chapitre 5 — Protocole Minuit (SPARROW : 23:59)

Le dernier nom de la liste du Cadran est **Monsieur Minuit**, l'horloger de la ville. Il a lancé le Protocole Minuit : arrêter le monde à 23:59, la minute où tout le monde se dit « encore une minute », et garder toutes ces minutes pour lui.

L'Inconnu du chapitre 1 se révèle. Il s'appelle **Seconde** : c'est l'ancien apprenti de Minuit, celui qui a brisé le Cadran à la station électrique. Sparrow est l'Élu parce qu'il ne regarde jamais l'heure : le Protocole n'a pas de prise sur ceux qui savent s'arrêter.

Durée visée : 30 à 40 minutes, plus l'épilogue.

## Accès

Après le chapitre 4, la **sortie nord** du village de Kyūkei, en (15..17, 0), mène au parvis de la Tour. Avant cela, le passage est fermé (texte `porte-tour`). Un écran titre annonce le chapitre 5.

## Cartes (`src/lib/rpg/tour.ts`)

| Carte | Taille | Contenu |
|---|---|---|
| Parvis de la Tour de Minuit | 24×20, nuit | Seconde, distributeur (boutique), Trotteuse en patrouille, Coucou mécanique, coffre (aiguille n°1). La porte s'ouvre après avoir parlé à Seconde |
| Salle des Rouages | 20×16, palais | Moitié sud : 2 Trotteuses gardent un coffre (aiguille n°2). Le **Grand Sablier** bloque le seul passage vers le nord. Moitié nord : 4 cadrans, une plaque-indice, un coffre (aiguille n°3), un Coucou et une Trotteuse, et la grille de l'escalier |
| Sommet de la Tour | 16×14, nuit | Monsieur Minuit devant la grande horloge (figée sur 23:59 jusqu'à la victoire). En mode libre, l'Écho de Minuit |

## Quête principale « Protocole Minuit » (7 étapes)

| Étape | Comment |
|---|---|
| Rejoindre le parvis | entrer sur la carte |
| L'inconnu du quartier | parler à Seconde (la révélation). La porte de la Tour s'ouvre |
| Vaincre le Grand Sablier | mini-boss en 2 phases (il se retourne à 40 % de PV) |
| Les quatre cadrans | **énigme** : tourner un cadran fait aussi tourner ses voisins. Il faut les mettre tous sur 00:00. La solution est de tourner les deux cadrans des bords (la plaque le suggère). Une fois résolue, l'énigme ne peut plus se défaire |
| Atteindre le sommet | monter l'escalier |
| Vaincre Monsieur Minuit | **boss final en 3 phases** : le gentleman, puis le cœur-cadran à 66 %, puis Minuit Éternel à 33 %, qui lance PROTOCOLE MINUIT, une attaque préparée |
| Faire passer la minute | scène finale avec un choix : rendre toutes les minutes, ou en garder une pour une sieste. Les deux mènent à la même fin |

Récompense : +800 XP, +600 FP, le Cadran réparé.

## Fin de l'aventure

1. La carte « CHAPITRE 5 TERMINÉ ».
2. Le **générique** défile. A permet de le passer.
3. Retour au **Quartier 404** pour l'épilogue, à 00:11, avec toute l'équipe :
   - Nico, Madame Bouchon et Raymond ont des répliques nouvelles ;
   - l'affiche « CHAT PERDU » devient « CHAT RETROUVÉ » ;
   - la grande horloge tourne.
4. Le **mode libre** s'active (drapeau `mode-libre`) :
   - toutes les cartes restent accessibles ;
   - les quêtes secondaires restent faisables ;
   - l'**Écho de Minuit**, au sommet, propose une revanche (combat `minuit-revanche`, avec possibilité de fuite).
   - Le journal affiche « AVENTURE TERMINÉE — Mode libre ».

## Quête secondaire « Les Aiguilles de Seconde »

Il faut trouver 3 aiguilles dans 3 coffres : une sur le parvis, deux dans la Salle des Rouages. On les rapporte ensuite à Seconde, qui donne la **Montre de Seconde** (Vitesse +6, Attaque +4, PV +10).

## Ennemis et combats (`bestiary.ts`)

| Combat | Ennemis | Remarque |
|---|---|---|
| trotteuse | Trotteuse | |
| trotteuses | 2 Trotteuses | |
| coucou | Coucou mécanique | |
| coucous | Coucou mécanique + Trotteuse | |
| sablier (boss) | Le Grand Sablier | |
| minuit (boss) | Monsieur Minuit | combat final, 3 phases |
| minuit-revanche | Monsieur Minuit | mode libre |

Les niveaux des ennemis sont calés sur le niveau attendu du joueur, environ 17 à 18.

Nouveaux objets en boutique (distributeur de la Tour) :
- le Café de minuit : tous les PV et les états soignés ;
- l'Aiguille d'or : arme, Attaque +14 ;
- l'Armure de rouages : Défense +10, PV +32.

Équilibrage simulé (`tests/combat-policy.ts`, équipe complète, équipement du chapitre 4) :

| Combat | Niveau | Victoires | Durée |
|---|---|---|---|
| Ennemis normaux | 17 | 100 % | 3 à 10 tours |
| Grand Sablier | 17 | 100 % | environ 14 tours |
| Monsieur Minuit | 18 | environ 89 % | environ 24 tours |
| Monsieur Minuit, équipement de la Tour | 18 | environ 96 % | |
| Revanche | 25 | environ 40 % | |

La revanche est le vrai défi de fin de jeu.

## Fichiers

| Fichier | Contenu |
|---|---|
| `src/lib/rpg/tour.ts` | cartes, `rouagesOk`, `porteTour`, `modeLibre` |
| `src/lib/rpg/ch5.ts` | dialogues, énigme, scènes, épilogue (`EPILOGUE_NPCS`), `CH5_CARD`, `CREDITS` |
| `src/components/rpg/battlers.ts` | sprites de combat : Trotteuse, Coucou, Grand Sablier (2 états), Monsieur Minuit (3 formes) |
| `src/components/rpg/actors.ts` | sprites de carte |
| `src/components/rpg/tiles2.ts` | cadran animé (rouge sur 23:59, vert sur 00:00) |
| `src/components/rpg/BattleScreen.tsx` | décors « tour » (engrenages) et « sommet » (ciel étoilé et grand cadran), effet « temps » |
| `src/components/gotchi/Gotchi.tsx` | générique de fin puis retour au quartier |

## Validation

- `tests/ch5.test.ts` vérifie :
  - les portes et l'accessibilité ;
  - les verrous (route, porte, Sablier, grille) ;
  - une partie complète sans interface, jusqu'à l'épilogue et au mode libre ;
  - les deux choix de la fin ;
  - le quartier inchangé avant la fin ;
  - qu'aucun texte n'évoque autre chose que la fiction.
- `tests/combat.test.ts` vérifie l'équilibrage du chapitre 5.
- Une partie complète a été jouée dans Chromium (Playwright, 390×844), du village jusqu'à l'épilogue :
  - Seconde, la boutique, les 3 coffres ;
  - le Grand Sablier, l'énigme (avec un faux essai) ;
  - la montre rendue ;
  - Monsieur Minuit, la carte de fin, le générique ;
  - l'épilogue, le mode libre et l'Écho au sommet.

  Aucune erreur console.
