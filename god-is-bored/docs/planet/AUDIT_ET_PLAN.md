# The Living Planet — audit, architecture et état de la première tranche verticale

Point de retour Git : tag `pre-living-planet` (commit `b07116a`, local ; son push vers GitHub a échoué). Graphismes locaux, Soul Engine et fiches individuelles inchangés.

## A. Audit (avant ce chantier)

| Domaine | État constaté | Conséquence pour la planète |
|---|---|---|
| Simulation | `SimulationEngine` pur TS (aucun import Three/DOM, test dédié), UN `World` 64×64 (tuiles), 3 civilisations sur la même île, ids uniques partagés (`nextId`) | La carte actuelle devient la **région R1** ; les ids existants servent d'adresses persistantes |
| Rendu | `Renderer` : une scène locale (terrain lissé, bâtiments/habitants instanciés, ciel, ombres), contrôles OrbitControls (1 doigt = déplacer, 2 doigts = zoom/pivoter), qualité adaptative | Conservé tel quel ; il reste le mode LOCAL |
| UI | Barre du haut, 3 tiroirs mobiles, fiche habitant, picking de la carte locale | La barre du haut (temps, population) reste utilisable à toutes les échelles ; le picking local est désactivé hors LOCAL |
| Sauvegardes | JSON versionné, migrations | `planet` ajouté (optionnel) ; ancienne sauvegarde → planète régénérée à l'identique depuis la graine |
| Découplage | `advance()` à pas fixe indépendant du rendu | La simulation continue quel que soit le mode de vue (vérifié) |

Tests avant le chantier : 84, tous verts.

## B. Ce qui est implémenté (première tranche verticale)

**Modèle (`src/sim/Planet.ts`, pur, testé)**
- Génération reproductible d'un globe depuis la graine : 5 continents + 12 îles/archipels (bruit 3D, domaine déformé), relief (plaines, collines, montagnes en crêtes, fonds marins), 13 biomes (désert, savane, plaine, forêt, jungle, taïga, toundra, neiges…). ≈ 30 % de terres ; 2 à 5 continents détectés par composantes connexes (longitude cyclique), noms déterministes.
- **Région R1** = la carte actuelle, posée au large d'une côte, à latitude tempérée (≥ 78 % de mer dans l'emprise). Repère local ⇄ global : projection gnomonique, repère **direct** (x : est, y : axe sud de la carte), une case = `spanRad/64`. Aller-retour exact (test).
- **Un seul monde** : le globe ne stocke ni habitant ni ville. `settlements()` et `summary()` relisent le moteur ; une ville détruite côté moteur disparaît du globe (test). Identifiants de ville/bâtiment = ceux du moteur.

**Vue (`src/render/PlanetView.ts`)**
- Globe stylisé (terrain en facettes colorées, océan translucide, halo atmosphérique de Fresnel, nuages procéduraux discrets, étoiles, soleil cohérent avec terminateur).
- **La région est le vrai terrain local** : la géométrie du `Terrain` local (relief lissé, couleurs, territoires, chemins) est copiée et déformée sur la sphère à l'échelle d'une case ; bâtiments (instanciés, par époque/civilisation, relus dans le moteur), forêts (`world.trees`), colonies et étiquettes réels.
- Trois échelles : **PLANET** (glisser = faire tourner avec inertie, pincer/molette = zoom, toucher = sélectionner continent / océan / région, fiche de synthèse), **REGION** (1 doigt = déplacer, 2 doigts = zoom + pivoter + incliner, toucher = colonie ou case ; zone de toucher de 44 px), **LOCAL** (scène existante).
- Transitions : PLANET → REGION = vol continu (le globe pivote, la caméra descend, le ciel passe de l'espace au bleu) ; REGION → LOCAL = voile de 0,4 s, la caméra locale reprend **exactement** la pose régionale (mêmes axes, 1 case = 1 unité) ; retour par le bouton 🌍, les « fils d'Ariane » Planète › Région › Local, ou le pincement vers l'extérieur.
- Mobile/portrait : distances et zoom adaptés au format, safe areas, fiches en bas d'écran.

## C. Ce qui reste simplifié (limites)

- **Une seule région simulée** : le moteur possède un `World` unique. Les autres continents sont du relief **sans population ni ville** (pas de décor habité fictif). Trois régions autonomes demandent de passer `world` / `buildings` / `citizens` en collections par région (un `World` par région, ids déjà globaux) : étape D, à faire avant de généraliser. La région R1 contient déjà 3 civilisations indépendantes (Berrober, Nevava, Flontimel).
- Le globe n'a pas encore d'overlay « ressources » (fertilité, pierre) : elles sont lisibles via la fiche d'une case et les forêts/collines visibles ; frontières = teinte du territoire sur le terrain.
- Le niveau de détail du terrain régional est unique (même maillage que le local : ≈ 74 k triangles bureau / 33 k mobile) ; pas de LOD par distance ni de chargement à la demande (inutile avec une seule région, indispensable avec plusieurs).
- Le terrain local reste en mémoire quand on regarde le globe (une seule région : coût négligeable).
- Pas de transition « géométrique » continue vers le local (choix assumé : voile de 0,4 s).
- **Aucune mesure sur un vrai iPhone** : mesures en émulation navigateur (rendu logiciel) uniquement.

## D. Tests

- 11 tests de planète (`tests/planet.test.ts`) : reproductibilité, continents/îles/relief/biomes, région au large d'une côte, aller-retour local ⇄ global, repère orthonormé direct, colonies = villes du moteur (mêmes ids), ville détruite → disparaît, synthèse suivie sur 80 ans sans caméra, sauvegarde et ancienne sauvegarde.
- 95 tests au total, tous verts ; `tsc` propre.
- E2E navigateur (Playwright, `docs/planet/e2e/`) : la séquence de démonstration complète avec de vrais gestes (glisser, toucher, boutons), desktop et iPhone 430×932, sans erreur console ; régression UI mobile (3 tailles) rejouée en mode `?local` : aucun problème.

## E. Mesures (émulation, rendu logiciel — non représentatives du GPU d'un iPhone)

| | Bureau | Mobile émulé |
|---|---|---|
| Construction du globe | 285 ms | 259 ms |
| Coût JS d'une image (rendu exclu) | 0,03–0,04 ms | 0,06–0,10 ms |
| Appels de dessin | 8–9 | 8–9 |
| Triangles | 132 k | 79 k |

## F. Démonstration (séquence demandée)

1. Ouverture : arrivée dans l'espace (survol d'introduction). 2. Planète visible. 3. Glisser pour la faire tourner. 4. Continents repérés (noms, fiche au toucher : « Torath — continent, 11,6 % de la planète, aucune civilisation connue »). 5. Toucher « Terre Première » → synthèse (3 civilisations, population, ère). 6. Zoomer → région → toucher une ville → « Entrer dans le village ». 7. Scène locale : habitants et fiches (Soul Engine) inchangés. 8. Retour région/globe. 9. Autre civilisation : toucher une autre capitale (Nevava, y compris une colonie fondée entre-temps) et y entrer. 10. ×10 : An 27 → 42, population 107 → 143, Nevava 40 → 64 hab., Flontimel 36 → 52, guerres déclenchées : l'état affiché vient du moteur.
Limite : « deux régions » = deux civilisations de la même région R1 (voir C).
