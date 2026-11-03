# World Expansion V1 — audit et première tranche (deux continents réellement accessibles, trois régions locales)

Point de retour Git : tag `pre-world-expansion` (commit `a4…` du dépôt, local ; le push de tags vers GitHub échoue dans cet environnement). Graphismes de la vue locale inchangés (une seule retouche : la teinte du sol suit le biome dans les régions dérivées du globe ; Terre Première garde exactement ses couleurs).

## A. Audit — réponses mesurées (version précédente, `docs/world/audit_before.png`)

| Question | Constat |
|---|---|
| Les autres continents existent-ils dans les données ? | **Oui** : 4 continents (11,6 / 6,4 / 4,1 / 3,5 % de la surface) + 5 îles, 30 % de terres. Mais petits, déséquilibrés, et un seul dominait. |
| Absents, masqués, hors champ ? | **Visibles mais illisibles** : 2 des 4 continents étaient presque entièrement blancs (neige trop répandue), les autres beige délavé ; palette peu contrastée avec l'océan. |
| Rotation limitée ? | **Non** : rotation libre sur 360° (quaternion cumulé, inertie) ; vérifié par 8 glissés distincts → 8 orientations distinctes. |
| Le raycasting sélectionne-t-il les autres surfaces ? | **Oui** (fiche « Torath », « Merora »…), mais la fiche n'offrait aucune action : un continent sans civilisation était un cul-de-sac. |
| Transition PLANET → REGION → LOCAL seulement pour Terre Première ? | **Oui** : une seule région (`this.region`) et un seul `World` côté moteur. |
| Le générateur local dépend-il de coordonnées fixes ? | **Oui** : `World.generate(seed)` produit une île sans lien avec le relief du globe (le globe affichait cette île à la place de la mer, pas à partir de la planète). |
| Des civilisations dans plusieurs régions ? | **Non** : un moteur = un monde = 3 civilisations sur la même île. |

## B. Ce qui est implémenté

**Planète v2 (versionnée)** — `Planet.gen` : 1 = ancienne planète (conservée à l'identique pour les parties existantes, testée sur valeurs d'or), 2 = nouvelle partie.
- 6 masses continentales réparties régulièrement (points de Fibonacci tournés par la graine, tailles variées), **maximum** et non somme des contributions → océans continus, aucun continent soudé ; 4 archipels de 3–4 îles ; 29–39 % de terres ; 5 à 6 continents > 2,5 % de la surface.
- Biomes lisibles : neige réservée aux pôles et aux sommets (< 14 % des terres), désert, savane, plaine, forêt, jungle, taïga, toundra, collines, montagnes ; palette plus saturée, océan plus profond.
- Nuages discrets (couverture partielle, peu opaques, disparaissent près du sol) ; halo atmosphérique atténué ; contour doré des territoires habités ; noms sans superposition.

**Régions explorables partout** — toute terre émergée appartient à une région (grille déterministe, cellules de 26°, identifiants stables) :
- `Planet.ensureRegionAt` / `previewRegionAt` : toucher n'importe quelle terre propose « Explorer cette région » (nom lisible : « Collines de Merora », « Savanes de Torath »…). Aucun continent n'est inaccessible faute de civilisation.
- **Terrain local dérivé du globe** (`WorldGen.generateRegionWorld`) : chaque case échantillonne l'altitude et le biome de la planète à sa position ; fertilité, forêts, pierre et rivières en découlent (forêt/jungle du globe → région boisée ; désert → sable stérile ; glace → sol stérile). Reproductible (graine de région). Le globe affiche CE terrain : même maillage (relief réel à l'échelle d'une case), bord fondu dans le relief voisin.
- Régions persistantes : chaque région garde son moteur (terrain modifié, bâtiments, habitants, chroniques) quand on la quitte ; une région n'est créée qu'à la première visite.

**Plusieurs civilisations indépendantes** — `PlanetSim` : une simulation complète par région, une horloge commune, une planète partagée.
- Nouvelle partie : R1 « Terre Première » (inchangée : 3 civilisations) + une région habitée sur un autre continent (2 civilisations) → 5 civilisations, couleurs uniques sur la planète.
- Toutes les régions habitées avancent à chaque tick, observées ou non (test : deux parties identiques, l'une observant l'autre continent, finissent dans le même état). Les régions inhabitées ne coûtent aucun calcul.
- Une seule scène locale détaillée à la fois : changer de région décharge la précédente (`Renderer.setSim`) ; le globe n'utilise que des maillages légers, détaillés seulement pour la région survolée.

**Navigation** — rotation 360° au doigt (inertie), pincement, sélecteur discret de continents (puces en bas), bouton de recentrage, fils d'Ariane Planète › Région › Local, toucher une ville avec zone de 44 px ; transition PLANET → REGION continue, REGION → LOCAL par voile de 0,4 s avec pose de caméra identique ; retour par pincement vers l'extérieur ou les fils d'Ariane.

**Interface mobile** — en vue planète/région : une seule notification compacte à la fois (les suivantes regroupées « +N »), placée sous les fils d'Ariane (jamais sur le centre du globe), safe areas respectées ; bouton Chroniques de la planète (événements de toutes les régions) ; pause et vitesses inchangées et valables pour toutes les régions ; l'en-tête affiche les totaux de la planète.

**Sauvegardes** — format multi-régions (`format: 2`) : planète (graine, génération, régions), région active, un moteur par région. Anciennes sauvegardes (une région, planète de génération 1) : **Terre Première, ses habitants et sa planète restent identiques** (vérifié) ; un nouveau peuple est ajouté sur un autre continent avec annonce explicite (migration), sans toucher aux identifiants existants.

## C. Limites (honnêtes)

- **Pas encore d'interaction entre régions** (commerce, guerre, migrations, découverte par navigation) : chaque région vit sa propre histoire. Une seule région inhabitée est créée à la demande ; la population d'une région inhabitée reste nulle (aucun peuplement spontané).
- Seulement 2 régions habitées au départ (5 civilisations) ; la constante `START_INHABITED_REGIONS` permet d'en fonder davantage, mais chaque région coûte une simulation complète (mesuré : ≈ 0,4–0,5 ms/tick pour 2 régions, 180 habitants ; la population mondiale plafonne par région, pas globalement).
- Régions habitées proposées surtout près de l'équateur (critères de fertilité) : peu de variété de biomes de départ ; les régions inhabitées couvrent tous les biomes.
- Pas de ressources affichées en surcouche sur le globe (fertilité/pierre : fiche d'une case).
- Terre Première (R1) reste une carte « d'origine » posée au large d'une côte : le globe l'affiche telle quelle, mais son relief n'est pas dérivé du globe (conservée par choix : village validé).
- Pas de LOD par distance du maillage régional (2 niveaux : bas pour les régions éloignées, haut pour la région survolée).
- **Aucune mesure sur un vrai iPhone** : émulation navigateur, rendu logiciel.

## D. Tests

- `tests/world.test.ts` (13) : continents 4–7 et îles, océans continus, biomes variés / neige rare, **migration de la planète génération 1 (valeurs d'or)**, régions explorables stables, terrain local reproductible et fidèle au relief, forêt du globe = région boisée, civilisations sur plusieurs continents (couleurs uniques), indépendance vis-à-vis de la caméra, région inhabitée persistante (modification conservée après sauvegarde), sauvegarde/rechargement à l'identique (régions, populations, identités, reprise déterministe), ancienne sauvegarde intacte + ajout d'un peuple, coût de calcul.
- 108 tests au total, tous verts ; `tsc` propre.
- E2E navigateur (Playwright, `docs/world/e2e/`), bureau et iPhone 430×932, vrais gestes, sans erreur console : la démonstration en 12 étapes ; migration d'une vraie sauvegarde de la version précédente ; régression UI mobile (3 tailles) en mode `?local`.

## E. Mesures (émulation, rendu logiciel — non représentatives d'un GPU d'iPhone)

| | Bureau | Mobile émulé |
|---|---|---|
| Création d'une région (terrain + moteur) | 136 ms | 115 ms |
| Construction du globe | 342 ms | 283 ms |
| Changement de région locale | 76–145 ms | 71–95 ms |
| Coût JS d'une image planète/région | 0,04–0,09 ms | 0,02–0,07 ms |
| Appels de dessin (3 régions) | 18–20 | 18–20 |
| Triangles planète / région | 73 k / 146–170 k | 61 k / 120–145 k |
| Simulation, 2 régions habitées | 0,38 ms/tick | 0,54 ms/tick |

## F. Démonstration (12 étapes, `docs/world/we_demo_*.png`)

1. Partie lancée : 5 civilisations sur 2 régions. 2. Six continents nettement distincts. 3. Rotation 360° (8 glissés → 8 orientations). 4. Terre Première sélectionnée (3 civilisations). 5. Descente dans le village (Berrober). 6. Retour au globe. 7. Autre continent (Merora) sélectionné via le sélecteur. 8. Région inhabitée explorée (« Collines de Merora » : 31 % collines, forêts, rivière). 9. Autre civilisation découverte (« Savanes de Torath » : Dusguluk et Ukuk, terrain de savane). 10–11. ×10 puis retour à Terre Première : An 17 → 53, 90 → 151 habitants ; l'autre région : 61 → 103. 12. Sauvegarde/rechargement : mêmes régions, mêmes populations (comparaison avant le premier tick).
