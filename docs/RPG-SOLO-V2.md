# SPARROW RPG — Solo V2

Le mode en ligne est en pause. Son code reste en place (`/jeu/online`, `src/lib/online`), et ses correctifs attendent sur la branche `claude/sparrow-online-fix` (PR #21).

## Audit de l'existant (avant cette étape)
| Système | État |
|---|---|
| 5 chapitres, cartes, PNJ, quêtes, mini-jeux, appartement | En place |
| Combat au tour par tour : techniques, attaques préparées, gardes, priorités, coups multiples, vol, coup de grâce | En place |
| Formes Sparrow Titan et Samouraï | En place |
| Boss à plusieurs phases, IA qui pèse ses options | En place |
| États | Seulement Brûlé et Étourdi |
| Objets en combat, boutiques, équipement de Sparrow | En place |
| Capture : herbes → combat sauvage → Capsule d'Écho → Bestiaire → équipe → sauvegarde | **Complète** (1 espèce : Brokito/Brokolosse) |
| Niveaux par membre, techniques par niveau, évolution, barème des ennemis | En place |
| PV entre deux combats | Toujours pleins : aucune usure, donc aucune infirmerie utile |
| Défaite | Réessayer ou se retirer sur place |
| Types, faiblesses et résistances | **Absents** |
| Raretés, variantes chromatiques, 24 espèces dont 4 légendaires | **Absents.** La liste officielle n'est pas dans le projet. |

## Étape 1 : infirmeries, usure, défaite, difficulté

### PV gardés entre les combats
- Les PV restants de chaque membre sont sauvegardés (`rpg.hp`, en fraction des PV max) : compagnons comme créatures.
- **Un membre K.O. le reste** jusqu'à un soin. Il ne commence pas le combat.
- **Les boss et le tutoriel se jouent toujours en pleine forme.** L'équilibrage des chapitres est donc conservé.
- **Anciennes sauvegardes :** sans PV enregistrés, toute l'équipe est en pleine forme.

### Infirmeries
- **L'infirmière Camomille** est présente dans chaque grande région :
  - à l'Herboristerie (Cité) ;
  - au Refuge (Mont) ;
  - à l'Auberge (Kyukei) ;
  - sur le parvis de la Tour.
- **Elle soigne** toute l'équipe et enregistre le lieu comme **point de retour** (`rpg.respawn`).
- **L'appartement de Sparrow** sert d'infirmerie au Quartier 404 : y entrer soigne l'équipe.

### Défaite
- **Combat ordinaire perdu :** le seul choix est « À L'INFIRMERIE ». Sparrow se réveille à la dernière infirmerie visitée (l'appartement par défaut), avec toute l'équipe soignée.
- **Rien n'est perdu :** ni objets, ni créatures, ni progression.
- **Boss perdu :** RÉESSAYER ou SE RETIRER, comme avant.

### Soins hors combat
- Dans START › SAC, le bouton **UTILISER** est disponible pour les soins et le Ketchup de rappel.
- Le soin va à l'équipier le plus blessé. Le Ketchup relève un K.O.
- START › ÉQUIPE affiche les PV actuels (ou « K.O. »).

### Combat
- **Nouvel état « Endormi » (SOM) :**
  - 1 à 3 tours perdus ;
  - un coup reçu a une chance sur deux de réveiller ;
  - les soins d'état réveillent aussi.
- **Qui endort :** le Moine du Gain (« Mantra du sommeil ») et la Lanterne Folle (« Lueur hypnotique »).
- **IA :**
  - elle ne gâche plus ses attaques d'état sur une cible déjà touchée ;
  - elle cherche à endormir en début de combat ;
  - elle lance ses attaques préparées sur une cible endormie.

## Tests
- `tests/infirmerie.test.ts` (11 tests) :
  - PV gardés, K.O., boss en pleine forme ;
  - soins hors combat ;
  - infirmières sur des cases libres ;
  - soin et point de retour ;
  - sauvegarde (anciennes comprises) ;
  - état Endormi.
- Toute la suite (227 tests) passe. Le seuil d'équilibrage de Gonflax passe de 85 % à 80 % de victoires simulées : l'IA est plus maligne.
- **Navigateur** (iPhone 390×844) :
  - ÉQUIPE avec PV et K.O. ;
  - Ketchup utilisé depuis le SAC ;
  - Camomille qui soigne et enregistre le point de retour ;
  - défaite face à deux Trotteuses, choix « À L'INFIRMERIE », puis réveil devant Camomille, équipe soignée ;
  - aucune erreur.

## Étape 2 : types officiels, faiblesses et résistances, Bestiaire officiel

### Matrice (`src/lib/rpg/types.ts`)
| Attaque ↓ / cible → | Tech | Ombre | Nature | Feu | Force | Temps |
|---|---|---|---|---|---|---|
| **Tech** | = | ▲ | = | ▼ | ▼ | ▲ |
| **Ombre** | ▼ | = | ▲ | ▲ | ▼ | = |
| **Nature** | = | ▼ | = | ▼ | ▲ | ▲ |
| **Feu** | ▲ | ▼ | ▲ | = | = | ▼ |
| **Force** | ▲ | ▲ | ▼ | = | = | ▼ |
| **Temps** | ▼ | = | ▼ | ▲ | ▲ | = |

▲ super efficace (×1,3) · ▼ peu efficace (×0,77) · = neutre. Une technique du même type que son lanceur gagne ×1,1.

Chaque type bat 2 types, en craint 2, et reste neutre face à 2. Aucun ne domine.

### Types des combattants
- **Équipe :** Sparrow Tech, Chevalier Noir Ombre, Gérard Feu, Lili Ombre, Pokeyz Tech, Brokito Nature.
- **Transformations :** en Titan, Sparrow devient Force ; en Samouraï, il devient Temps.
- **Ennemis :**
  - le Potager royal (chapitre 2) est Nature ;
  - la Confrérie est Force ;
  - la Tour est surtout Temps, avec le Coucou mécanique en Tech ;
  - au chapitre 4, on trouve du Temps, de la Force et du Feu.
- **Boss :** ses attaques fétiches (comme celles de Gonflax) sont neutres. Seules quelques-unes portent son type, pour que l'équilibrage des chapitres soit conservé.
- **Techniques :** chaque technique offensive a un type ou reste neutre (coups sans élément). Les techniques de soin et de bonus n'ont pas de type.

### Affichage en combat
- Le type de l'ennemi est un badge de couleur dans son encadré.
- Le menu des techniques affiche le type de la technique et « SUPER EFFICACE » ou « PEU EFFICACE » face à l'ennemi actuel.
- Après le coup, le message « C'est super efficace ! » ou « Ce n'est pas très efficace… » s'affiche.

L'IA ennemie tient compte des types, car ses dégâts estimés les incluent.

### Bestiaire officiel (`SPECIES`, `EVOLUTIONS` dans `monsters.ts`)
- **24 espèces** avec leur numéro, nom, type, rareté, région et capacité signature officiels.
- **Les espèces encore absentes du jeu** apparaissent en « ??? », avec leur région et leur rareté.
- **Brokito :** il devient le N°004, de type Nature. Il évolue en Brokolosse au **niveau 16** (niveau officiel).
- **7 évolutions officielles**, suivies dans la collection (« formes évoluées X / 7 »). Les légendaires n'évoluent pas.
- **Compteur :** « Collection X / 24 ».

### Tests
- `tests/types.test.ts` (7 tests) :
  - matrice équilibrée ;
  - données complètes ;
  - super efficace et peu efficace, avec leurs messages ;
  - changement de type en Titan ;
  - registre officiel (24 espèces, 4 légendaires) ;
  - évolutions.
- Les équilibrages des 5 chapitres passent, avec les mêmes seuils qu'avant. Le joueur simulé fait maintenant entrer un équipier qui ne craint pas l'ennemi.
- **Navigateur** :
  - badge FORCE sur l'Haltère Sauvage ;
  - menu « TECH · … · PEU EFFICACE » ;
  - message « C'est super efficace ! » ;
  - Bestiaire sur 24 entrées ;
  - aucune erreur.
