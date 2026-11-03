# The Living Planet V2 — échelle, continuité géographique, exploration

## 1. Audit (avant)
- Une région = carte de 64×64 cases couvrant **26°** (un « continent » de la carte locale ≈ un îlot du globe). Les cartes locales n'étaient pas des tranches du globe : le terrain local était dérivé du globe à basse résolution, puis lissé ; le globe, lui, ne montrait que des patchs de 26°.
- Transitions : PLANÈTE ⇄ RÉGION ⇄ LOCAL = trois scènes distinctes avec voile ; entrer en « région » montrait la carte entière de la région (donc tout un continent miniature).
- Pas de hiérarchie continent → région → village : une ville occupait une fraction visible de la carte, la carte occupait une fraction visible du globe.

## 2. Architecture (après)
Hiérarchie (rayon planète = 1) :
| Échelle | Taille | Contenu |
|---|---|---|
| Planète | 4π | continents identifiables, marqueurs discrets |
| Continent | ≈ 0,9 rad | relief étendu, fleuves, biomes, villes espacées |
| Région | 8×8 cartes = 13,6° | villages à l'échelle, nature sauvage |
| Local | 64×64 cases = 1,7° (≈ 3 km/case) | scène détaillée inchangée (personnages, bâtiments) |

- `src/sim/scale.ts` : constantes d'échelle. `Planet.scale` (1 = anciennes cartes de 26°, 2 = hiérarchie) ; `Planet.upgradeScale()` = migration explicite des anciennes sauvegardes (la carte d'origine est incrustée à son emplacement, villes/habitants/identités intacts).
- `src/sim/Geo.ts` : **une seule fonction `sample(direction, finesse)`** (relief macro + octaves de détail + chaînes de montagnes + rivières stylisées + biome). Globe, tuiles de continent/région et cartes locales (`generateGeoWorld`) échantillonnent la même fonction : une montagne, une côte, un fleuve ne bougent pas quand on zoome. Déterministe (graine de la planète), aucune île indépendante par zoom.
- `src/sim/terrainChunk.ts` + `src/render/terrain.worker.ts` + `src/render/TerrainLOD.ts` : quadtree sur sphère « cube », tuiles de 17×17 sommets générées à la demande dans un worker (repli synchrone), cache LRU, culling horizon + frustum, jupes anti-fissures, océan et côte tracés par le shader, canopée procédurale à fondu anti-scintillement, plage tracée par le shader.
- `src/render/PlanetView.ts` : **une caméra orbitale continue** (point de surface P, distance d, inclinaison, azimut). Le zoom est la navigation principale ; le niveau affiché (Planète/Continent/Région/Local) est dérivé de d. Les boutons du fil d'Ariane lancent un zoom animé (`flyTo`), jamais un changement de scène brusque. Descendre sous d = 0,022 crée la scène locale de la carte visée ; le retour reprend la même pose.
- Simulation indépendante de la caméra (inchangé). Seule la scène locale détaillée est chargée (une région à la fois) ; les tuiles lointaines sont évincées.
- Interface iPhone : planète occupant l'écran, chip de continents, nom de lieu discret (`#place`), notifications compactes, fiche fermée automatiquement quand on change d'échelle.

## 3. Validation
- `npx tsc --noEmit` OK ; `npx vitest run` : tests existants + `tests/geo.test.ts` (déterminisme, cohérence multi-échelle, tuiles voisines sans fissure, carte locale = tranche de Geo, hiérarchie, plusieurs graines, aller-retour de sauvegarde, migration d'une ancienne sauvegarde sans déplacer villes/habitants).
- Captures : `echelles_seed42.png` (planète → continent → région → zone → approche → abords du village), `demo_calia_tharmak.png` (parcours en 9 étapes, `demo.cjs`).
- Démonstration (seed 478, mobile 430×932, **émulation Chromium/SwiftShader — pas un iPhone réel**) : globe → continent Merion → région → autre zone → approche de **Tharmak-Ville** → descente par la molette dans le village → retour progressif (fil d'Ariane) → autre région du même continent → retour planète. Position de la ville (56,57 dans sa carte) et direction géographique identiques avant/après ; population totale inchangée (89), aucune erreur console.
- Note : « Calia » et « Tharmak » de votre partie dépendent de votre graine ; ici Calia existe dans la graine 478 mais Tharmak-Ville est sur Merion. La démonstration utilise donc Merion/Tharmak.
- Performances mesurées : génération d'une tuile ≈ 1 ms (Node ; ≈ 3–4× sur iPhone attendu, hors thread principal via worker). Éléments dessinés (SwiftShader, mobile) : globe ≈ 215 tuiles (≈ 140 k triangles), continent ≈ 80, région ≈ 60–150, abords de village ≈ 300–420 appels de dessin. **Le 30 FPS sur iPhone réel n'a pas été mesuré** ; le nombre d'appels de dessin près du sol est le point à surveiller (fusion de tuiles = piste).

## 4. Limites connues
- Rivières stylisées (lignes de niveau déformées), sans bassin versant hydrologique.
- Les cartes d'anciennes parties sont incrustées telles quelles (non dérivées de Geo) avec fondu de bord.
- Une seule scène locale détaillée à la fois ; pas d'interaction entre régions.
- Biomes colorés par sommet : aspect un peu « facetté » à l'échelle continent (la côte est lissée par le shader).
- Worker inline : à vérifier dans l'artifact publié (repli synchrone prévu).
