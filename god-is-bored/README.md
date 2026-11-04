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

## Mobile (iPhone d'abord)

Sur téléphone (≤ 760 px, ou écran tactile ≤ 940 px) l'interface est entièrement repensée : la carte 3D occupe tout l'écran, aucun panneau permanent.

- **Barre du haut** : année, habitants, civilisations, pause/×1/×3/×10, et « ⋯ » pour les statistiques détaillées et le menu (sauvegarde, nouveau monde).
- **Barre d'onglets du bas** : *Pouvoirs*, *Monde*, *Chroniques*. Chaque onglet ouvre un bottom sheet refermable en glissant vers le bas, avec le bouton ×, ou en retouchant l'onglet. Fermés, ils ne masquent rien. Quand un tiroir est ouvert, la scène est recentrée dans la partie visible.
- **Gestes** : 1 doigt = déplacer la caméra ; 2 doigts = zoom (et pivoter en les faisant glisser) ; toucher un habitant, une ville ou un bâtiment = sa fiche ; bouton ◎ = recentrer.
- **Pouvoirs** : toucher un pouvoir (le tiroir se referme), puis toucher la carte pour l'appliquer. Une barre d'action avec un grand bouton **Annuler** reste visible tant qu'un pouvoir est armé. Prophétie : choisir le message puis « Armer la prophétie ».
- **Notifications** : petits bandeaux de 2 lignes max sous la barre du haut, jamais cliquables (la carte reste manipulable) ; tout est conservé dans *Chroniques* (pastille de non-lus sur l'onglet).
- **Zones de sécurité** : `viewport-fit=cover` + `env(safe-area-inset-*)` (Dynamic Island, barre d'accueil, encoche latérale en paysage).
- **Performance Safari iOS** : résolution plafonnée à 2×, ombres 1024 px recalculées 2×/s, eau et étiquettes mises à jour à fréquence réduite, rendu plafonné à 60 i/s (ProMotion 120 Hz), nombre de particules réduit, et **qualité adaptative** : si les images dépassent ~24 ms, la résolution baisse par paliers (1.5×, 1.2×, 1×), puis les ombres, puis le rendu passe à 30 i/s ; la qualité remonte si l'appareil respire.
- Captures : `docs/mobile/`.

## Évolution visuelle des civilisations (six époques)

L'époque d'une civilisation (`civ.era`, 0..5) est un **état réel de la simulation**, jamais une fonction de l'année. Elle exige la technologie découverte, une population minimale, une stabilité minimale et de l'or (dépensé à l'entrée) : `src/sim/TechTree.ts`.

| Époque | Technologies | Conditions (pop · stabilité · or) | Ce qui change dans le monde |
|---|---|---|---|
| 1 Préhistoire | Âge du caillou, Agriculture | départ | huttes (4 styles), tentes, champs, cercle de pierres, feux de camp, lances de pierre, fourrures |
| 2 Antiquité | Maçonnerie, Métallurgie, Écriture | 22 · 25 · 15 | maisons de pierre, temples à colonnes, marchés, routes pavées, **remparts**, toges, boucliers de bronze |
| 3 Moyen Âge | Fer, Médecine, Poudre noire | 45 · 30 · 50 | maisons à colombages, châteaux, moulins, forges, cathédrales, chevaliers, cavalerie, canons |
| 4 Ère industrielle | Vapeur, Électricité | 90 · 35 · 140 | maisons de brique, usines et cheminées (fumée), gares, **voies ferrées et trains**, éclairage public, fusils |
| 5 Ère moderne | Moteur & béton | 150 · 35 · 300 | immeubles, centrales, **réseau électrique (pylônes, câbles)**, routes asphaltées, voitures, chars |
| 6 Ère futuriste | Intelligence artificielle | 220 · 40 · 600 | tours et dômes, laboratoires, **drones**, fusils à énergie, rubans lumineux, véhicules en sustentation |

- **Technologies / bâtiments** : `civ.techs` liste les technologies réellement découvertes ; les bâtiments *disponibles* en découlent (`isUnlocked`) ; les bâtiments *construits* sont dans `sim.buildings`, chacun avec sa propre `era` de construction ; `src/render/*` n'est qu'une représentation de cet état.
- **Modernisation progressive** : un bâtiment passe à l'époque suivante un cran à la fois (chantier d'échafaudage, il reste debout et utilisable), payé en bois/pierre (ou en or), par des bâtisseurs. Certains bâtiments « historiques » ne sont jamais modernisés : une ville mélange plusieurs siècles.
- **Effets réels** : capacité des maisons selon l'époque, marchés/gares/usines/centrales (revenus, ressources), moulins (récoltes), forges (armées), laboratoires (recherche), remparts (défense et points de vie des villes), technologie militaire.
- **Régression** : perte de technologie (effondrement) ou population/stabilité durablement effondrées font reculer l'époque ; les bâtiments avancés restent mais on n'en construit plus.
- **Identité** : chaque civilisation a un style architectural (0..3) qui change la forme des maisons (jusqu'à l'ère médiévale), des halls, temples et châteaux, ainsi que la teinte des murs, à niveau technologique identique.
- **Habitants et armées** : vêtements, coiffes, outils et équipement (6 jeux de géométries), accessoires d'armée par époque (étendard, chariot, cavalerie, canon, char, drone). Chaque habitant adopte la mode de l'époque avec quelques années de décalage.
- **Infrastructures** : l'époque d'une route = min(époque de la civilisation, infrastructures des deux villes reliées). Terre → pavés → voie ferrée → bitume → ruban énergétique. Les trains ne circulent qu'entre deux villes possédant chacune une gare ; voitures dès l'ère moderne, drones à l'ère futuriste.
- **Limites** : les routes, trains, voitures, drones, pylônes, lampadaires, fumées et le sol urbanisé sont une représentation **visuelle** liée à l'état réel (époque, gares, laboratoires...) : ils n'ont pas d'effet de jeu propre (pas de gain de vitesse sur les routes, pas de transport de marchandises). La population mondiale est plafonnée à ~2 500 habitants pour les performances.
- Captures : `docs/evolution/` (montage des six époques, deux époques à l'écran, Antiquité fortifiée, armée futuriste, iPhone).

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
tests/        Vitest (48 tests)
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

`npm test` — 48 tests Vitest (34 de simulation + 14 d'évolution : technologies/époques, bâtiments modernisés sans disparition, modèles distincts par époque et par style, habitants et armées, budget de sommets, sauvegarde et migration d'anciennes sauvegardes, évolution organique) : génération reproductible, 3 civilisations de départ, croissance, mortalité (vieillesse, famine), consommation de ressources, production, construction, découvertes/villes, déclaration de guerre, pertes militaires comptabilisées, issue des combats non aléatoire (la technologie fait la différence), changement de territoire, effets des 7 pouvoirs, vitesses ×1/×3/×10 et pause, équivalence tick/advance, sauvegarde/chargement, simulations de 400 ans sur 3 seeds avec contrôle d'invariants (population/ressources non négatives, positions valides, bâtiments cohérents, armées sans soldats fantômes, civilisations sans adultes), catastrophes à répétition, séparation simulation/rendu.

## Pistes d'amélioration

Sons et musique, commerce et routes fonctionnelles, ponts/navires, héros et dirigeants visibles, plus de prophéties et de pouvoirs (séisme, déluge, miracle ciblé), agents ennemis/espions, saisons, cycle jour/nuit, minimap, historique/arbre généalogique des dynasties, Web Worker pour la simulation, équilibrage fin des guerres, internationalisation, modes de jeu (défis, « rendre l'humanité heureuse »).

## Refonte graphique 3D V2

Rendu semi-réaliste stylisé (sans voxel ni damier) ; la simulation reste pure TypeScript, le rendu ne fait que la lire.

- **Terrain** : surface bicubique continue (`World.heightAt`, utilisée aussi par les habitants), lits de rivière creusés, côtes sinueuses, couleurs par pente/altitude, rochers, écume, AO peinte, chemins peints dans le sol.
- **Urbanisme** (`sim/Layout.ts`) : 4 à 6 rues sinueuses radiales par ville, place centrale dégagée, quartiers, façades tournées vers la rue (`Building.rot`) — *mécanique réelle* (placement de la simulation).
- **Architecture** : variantes de maisons/mairies/temples par époque et culture, détails (fenêtres, portes, cheminées), bâtiments historiques conservés.
- **Habitants** : personnages articulés (tête, tronc, bras, jambes, cheveux), tenues par époque, animations marche/travail/repos/combat dans le vertex shader (variation par instance, coût GPU minimal).
- **Végétation** : espèces variées, LOD lointain, culling, vent. **Eau** : normales de vagues, Fresnel. **Ciel** : cycle jour/nuit, brouillard, éclairage nocturne dépendant de l'ère (feux → torches → lampes → électricité).
- **Particules** : feu, fumée (sprites doux). *Purement cosmétique* : éclairage, particules, accessoires (props), vent.
- **Scène de référence** : `?ref` charge un village primitif, une cité médiévale et une ville moderne côte à côte.
- **Perf (émulation, JS par frame, scène de référence ~1650 habitants / 459 bâtiments)** : desktop 2,2 ms, mobile 4,3 ms ; ~105–115 appels de dessin, 210–320 k triangles ; qualité adaptative (pixel ratio, ombres, repli 30 fps).
- **Tests** : 63 (dont 15 graphiques : continuité du terrain, rivières, urbanisme, personnages, budgets). Captures avant/après : `docs/graphics/`.

## Correction graphique V3 (fusion des meilleures versions)

Diagnostic : la V2 avait de beaux personnages mais des campements clairsemés et peu lisibles, une caméra trop rasante (beaucoup de ciel), des habitants à l'orientation aléatoire et un décor vide. La V3 garde les personnages et le terrain de la V2 et rétablit la lisibilité/densité de la version précédente. Le moteur de simulation n'est pas modifié (voir l'exception ci-dessous).

- **Camp préhistorique** : huttes à l'échelle d'origine, en cercle serré autour du foyer (entrées tournées vers lui), terre battue sous chaque habitation, vêtements plus sombres et saturés que le chaume pour rester lisibles, foyer commun avec sièges en rondins, séchoirs à peaux, piles de bois, paniers, pots, billot + hache près des bûcherons, tas de pierres aux carrières, paniers dans les champs. Chaque accessoire est attaché à un bâtiment réel (test dédié) ; rien n'est ajouté « pour décorer ».
- **Sentiers** : chaque bâtiment réel est relié à la rue ou au foyer par un chemin de terre peint dans le sol (lignes de désir sinueuses).
- **Personnages** : cap lissé (plus de pivotement brusque), orientation vers la tâche réelle (arbre, roche, chantier, champ) ou vers le foyer au repos, fondu de 0,22 s entre animations, nouvelles poses (frappe, bêche/cueillette, lecture, assis, combat) et outils attachés à la main : hache (bûcheron), pioche (mineur), houe/panier (cultivateur), marteau (bâtisseur), tablette (érudit). Mode et outil sont déduits de l'état et du métier **réels** (`animFor`, testé). Variantes (bandeau, barbe, châle), largeur et teintes de vêtements variables.
- **Environnement** : forêts plus fournies (arbres plus grands, silhouettes lointaines plus lisibles), prairies fleuries par plaques, fougères en lisière, souches là où le bois peut repousser, rochers moins sombres. Les clairières restent celles de la simulation.
- **Caméra** : cadrage automatique de l'ensemble des villes (centre + distance selon l'écran), inclinaison maximale réduite avec le zoom (moins de ciel de loin, vue rasante possible de près), cible qui suit le relief, caméra jamais sous le terrain, ciblage en glissement fluide avec inclinaison ramenée dans une plage lisible. Gestes tactiles inchangés.
- **Lumière/matières** : ombres du soleil qui suivent la cible et le zoom (plus nettes de près, calées sur la grille de texels), grain de matière fin sur les bâtiments (bois, pierre, enduit) estompé avec la distance.
- **Exception « simulation »** : `CivilizationSystem.findSite` (pondération du choix d'emplacement des huttes de l'ère 0/1 : en cercle autour du foyer, orientées vers lui). Aucune règle, aucun compteur ni aucune sauvegarde n'est modifié ; les anciennes sauvegardes se chargent (vérifié avec une sauvegarde du commit précédent).
- **Mesures** (émulation, JS par image, scène de référence ~1660 habitants / 453 bâtiments) : desktop 2,2 ms, mobile 3,5 ms ; ~114 / 106 appels de dessin ; 323 k / 219 k triangles. Aucun test sur un vrai iPhone.
- **Tests** : 68 (dont 20 graphiques). Captures avant/après : `docs/graphics-v3/`.

## The Living Planet (première tranche verticale)

Le jeu s'ouvre sur un globe 3D : continents, océans, atmosphère, nuages. La carte d'origine en est la région « Terre Première » (vrai terrain, vraies villes, vrais habitants du moteur) ; on peut zoomer de la planète à la région puis au village, et revenir. Voir [`docs/planet/AUDIT_ET_PLAN.md`](docs/planet/AUDIT_ET_PLAN.md) (audit, architecture, limites, mesures) et les captures `docs/planet/`. Ouvrir avec `?local` pour démarrer directement dans la scène locale.

## World Expansion V1

Planète complète (6 continents, biomes lisibles), régions explorables partout (terrain local dérivé du relief du globe), plusieurs civilisations indépendantes (une simulation par région sur une horloge commune), sauvegardes multi-régions avec migration des anciennes parties. Audit, limites, tests et mesures : [`docs/world/AUDIT_ET_PLAN.md`](docs/world/AUDIT_ET_PLAN.md).

## The Living Planet V2 — échelle et continuité
Planète → continent → région → local sur une seule géographie continue (`Geo`), terrain en tuiles à niveaux de détail (`TerrainLOD`), zoom comme navigation principale. Voir `docs/planet-v2/AUDIT_ET_ARCHITECTURE.md`.

## Refonte UX/UI & graphique V2
Interface minimaliste (capsule haut, dock Interagir/Pouvoirs/Planète, cartes contextuelles, panneaux coulissants), plus aucune notification d'événement (Chroniques), pouvoirs par toucher du monde, nouveau pouvoir Incendie et influence individuelle, rendu plus chaud et plus aéré. Voir `docs/ux-v2/REFONTE_UX_UI_GRAPHIQUE_V2.md`.
