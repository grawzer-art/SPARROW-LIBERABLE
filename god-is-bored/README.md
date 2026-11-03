# GOD IS BORED — V0.1

> « L'humanité était une erreur. Heureusement, elle est divertissante. »

God game / simulation de civilisations en 3D miniature (Vite + TypeScript + Three.js). Trois civilisations vivent, se disputent et s'entretuent sur une petite île. Le joueur est un dieu qui s'ennuie.

## Lancer

```bash
cd god-is-bored
npm install
npm run dev        # → http://localhost:5173
```

Autres commandes : `npm test` (tests de simulation), `npm run build` (typecheck + build de production dans `dist/`), `npm run preview`.

## Commandes en jeu

| Action | Commande |
|---|---|
| Pivoter | clic gauche glissé · Q/E |
| Déplacer la vue | clic droit glissé · WASD/flèches · 2 doigts (tactile) |
| Zoom | molette · pincement · boutons +/− |
| Sélectionner | clic sur un territoire, une ville, un bâtiment ou un habitant |
| Pouvoir | choisir dans le panneau de gauche puis cliquer sur la carte (Échap pour annuler) |
| Temps | Espace = pause · 1/2/3 = ×1/×3/×10 |

## Architecture

```
src/sim/      Simulation pure (aucune dépendance à Three.js ni au DOM — vérifié par un test)
  World.ts               terrain procédural reproductible (seed), cratères, feu, repousse
  SimulationEngine.ts    état + boucle à pas fixe (30 ticks = 1 an, 100 ms de temps de jeu / tick)
  CitizenSystem.ts       besoins, travail, déplacements, reproduction, maladie, mort
  CivilizationSystem.ts  création, métiers, planification des bâtiments, territoire, dirigeant, tech, effondrement
  EconomySystem.ts       ressources, rendements, coûts, revenus, météo
  DiplomacySystem.ts     opinions, rancunes, alliances, déclarations de guerre
  WarSystem.ts           armées, combats calculés, sièges, conquête, paix
  DivinePowerSystem.ts   les 7 pouvoirs et leurs effets réels
  EventSystem.ts         chroniques + moteur narratif satirique
  SaveManager.ts         sérialisation JSON / LocalStorage
src/render/   Three.js : Renderer (terrain low-poly, instancing), Fx (particules, éclairs, météo), geo (modèles procéduraux)
src/ui/       UI DOM : barre du haut, pouvoirs, panneau civilisation, chroniques, notifications, stats, menu
tests/        Vitest (34 tests)
```

Le rendu ne fait que lire l'état de la simulation. Les meshes ne sont jamais source de vérité.
Le temps est découplé : `advance(dt)` accumule `dt × vitesse` et exécute autant de ticks à durée fixe que nécessaire (×10 = vraiment 10× plus de ticks, pas un compteur plus rapide).

## Mécaniques réellement implémentées

- **Monde** : carte 64×64 générée depuis une seed (relief, collines, montagnes, lacs, rivières franchissables, forêts qui repoussent, pierre), vérification qu'une seule grande masse terrestre accueille les 3 civilisations.
- **Habitants** (~50 au départ, plusieurs centaines à milliers ensuite) : id, nom, âge, civ, position, santé, faim, métier, intelligence, courage, agressivité, foi, état comportemental. Ils cherchent de la nourriture (mangent réellement dans le stock, cueillent sinon), travaillent (fermiers, bûcherons, mineurs, bâtisseurs, érudits, soldats), se reproduisent par couples, vieillissent, tombent malades, fuient les dangers (foudre, armées, feu) et combattent. Leurs déplacements sont leur état réel (A* en cas de blocage).
- **Civilisations** : 7 personnalités qui modifient réellement les décisions, religion, dirigeant (parfois une chèvre), lois absurdes aux effets chiffrés, stabilité, technologie à 8 niveaux, ressources (vivres/bois/pierre/or) avec stockage limité. Elles planifient seules maisons, fermes, camps, carrières, casernes, temples, châteaux, fondent des villes, étendent leur territoire (influence par ville), subissent des sécheresses, des famines, des sécessions (une ville fait sécession et fonde une nouvelle civilisation), des effondrements et peuvent disparaître. Si le monde se vide, une nouvelle tribu apparaît.
- **Diplomatie & guerre** : opinions, rancunes mémorisées, alliances (les alliés rejoignent les guerres), équilibre des puissances (un hégémon inquiète les autres). Six casus belli (conquête, ressources, vengeance, alliance, provocation, ego). Mobilisation (conscription de non-soldats), rassemblement, marche (A*), batailles dont l'issue vient de la technologie, des effectifs, du courage, de la santé, du moral, du terrain/territoire, des casernes et des bénédictions ; sièges (remparts, garnison, châteaux), capture ou rasage de villes (le territoire change réellement de propriétaire), butin, paix (victoire, paix blanche, effondrement) suivie d'une trêve.
- **Pouvoirs divins** : Foudre (dégâts, morts, panique, incendies de forêt, dirigeant parfois tué), Météorite (cratère qui modifie la carte, voire crée un lac, rase la zone, retombées, tension diplomatique entre voisins), Pluie divine (zone météo pluvieuse : récoltes ×1,5 pendant 8 ans, éteint feux et sécheresses, régénère sols et forêts), Peste (contagion par proximité, immunité, mortalité selon âge/faim/médecine), Bénédiction (20 ans de prospérité), Colère divine (tempête de foudres + secousses + incendies), Prophétie (5 messages ; compréhension calculée à partir de l'intelligence, de la foi, du dirigeant et de la personnalité ; interprétation parfois créative et catastrophique).
- **Chroniques satiriques** : chaque texte est déclenché par un fait de la simulation (accusation de vol du soleil après une famine, charrette → interdiction des roues, chèvre élue après crise, prières exaucées de travers, guerre dont personne ne se souvient de l'origine avec le vrai nombre de morts, etc.). Journal filtrable par type et par civilisation, plus notifications.
- **Temps** : pause, ×1, ×3, ×10, compteur d'années, statistiques mondiales (+ courbe de population).
- **Sauvegarde** : LocalStorage (autosave toutes les 45 s, à la fermeture, manuelle, export .json) ; la seed et l'état du RNG sont sauvegardés.
- **Mobile** : panneaux repliables, contrôles tactiles (rotation 1 doigt, déplacement/zoom 2 doigts, tap = sélection ou pouvoir).

## Limites et simplifications connues de la V0.1

- **Routes** : purement décoratives (tracé A* entre les villes d'une même civilisation) ; elles n'accélèrent pas les déplacements.
- **Pas de commerce, de marine, de ponts** : les rivières sont franchissables lentement, mer et montagnes bloquent. Les civilisations d'îles séparées ne pourraient pas se rencontrer (le générateur garantit une grande île commune).
- **Économie simplifiée** : 4 ressources, un seul type de ferme, pas de saisons ni d'échanges, or = impôts − solde.
- **Armées** : une armée par belligérant et par guerre, formation en cercle, pas de types d'unités ni de machines de siège. Les civils fuient mais ne combattent pas.
- **Dirigeant abstrait** : ce n'est pas un habitant simulé (il peut être tué par foudre/météorite/accident mais n'est pas visible sur la carte).
- **Religion** : une par civilisation (schismes possibles), pas de missionnaires ni de conversion entre civilisations.
- **Prophéties** : 5 messages prédéfinis.
- **Rendu** : habitants minuscules à fort dézoom (compensés par un facteur de zoom), pas d'animation de marche détaillée, pas de cycle jour/nuit, pas de son.
- **Déterminisme après chargement** : l'état est restauré à l'identique, mais l'historique des modèles de phrases déjà utilisés (anti-répétition) n'est pas sauvegardé ; le monde évolue donc légèrement différemment après un rechargement.
- Le jeu n'est pas calibré pour de très grandes populations (> 4 000 habitants).

## Tests

`npm test` — 34 tests Vitest : génération reproductible, 3 civilisations de départ, croissance, mortalité (vieillesse, famine), consommation de ressources, production, construction, découvertes/villes, déclaration de guerre, pertes militaires comptabilisées, issue des combats non aléatoire (la technologie fait la différence), changement de territoire, effets des 7 pouvoirs, vitesses ×1/×3/×10 et pause, équivalence tick/advance, sauvegarde/chargement, simulations de 400 ans sur 3 seeds avec contrôle d'invariants (population/ressources non négatives, positions valides, bâtiments cohérents, armées sans soldats fantômes, civilisations sans adultes), catastrophes à répétition, séparation simulation/rendu.

## Pistes d'amélioration

Sons et musique, commerce et routes fonctionnelles, ponts/navires, héros et dirigeants visibles, plus de prophéties et de pouvoirs (séisme, déluge, miracle ciblé), agents ennemis/espions, saisons, cycle jour/nuit, minimap, historique/arbre généalogique des dynasties, Web Worker pour la simulation, équilibrage fin des guerres, internationalisation, modes de jeu (défis, « rendre l'humanité heureuse »).
