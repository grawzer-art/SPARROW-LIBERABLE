# Remaster graphique (RPG solo)

Le remaster est purement visuel. Il ne touche ni l'histoire, ni les dialogues, ni les quêtes, ni les combats, ni les sauvegardes, ni les collisions.

## Comment le rendu est fait (audit)
| Fichier | Rôle |
|---|---|
| `src/lib/rpg/<carte>.ts` (`quartier.ts`, `cite.ts`…) | Données des cartes : sol case par case, éléments posés (props), portes, PNJ. Ce sont les **collisions**. |
| `src/components/rpg/tiles.ts`, `tiles2.ts` | Pixel art dessiné par le code dans deux calques mis en cache : **BASE** (sous les personnages) et **HAUT** (feuillages, têtes de lampadaires : Sparrow passe derrière). |
| `src/components/rpg/overworld.ts` | Image par image : calques, éléments animés, personnages triés par profondeur, voile de nuit, lumières, particules. |
| `src/components/rpg/remaster404.ts` | **Remaster du Quartier 404** (phase 1) et outils de détail du sol partagés. |
| `src/components/rpg/remaster.ts` | **Remaster de toutes les autres cartes** (phases 3 à 5), des arrière-plans de combat et de l'appartement. |

**Règles communes :** grille de 16 px, palette de nuit `P` de `tiles.ts`, pixels nets (aucun flou, aucun lissage), pas de nouvelle collision.

## Phase 1 — Quartier 404
- **Sol :**
  - herbe à grandes taches d'ombre et de lumière, touffes, cailloux ;
  - trottoirs usés, avec fissures, taches et arête de bordure ;
  - asphalte irrégulier, avec traces de pneus, rustines, fissures et ombre de bordure ;
  - **2 passages piétons**, 3 plaques d'égout, 6 flaques ;
  - place pavée avec un **anneau décoratif** autour de la fontaine, de la mousse dans les joints et des pavés manquants ;
  - chemins bordés de petites pierres ;
  - gravier taché d'huile ;
  - papiers dans la ruelle ;
  - ombre douce au pied des bâtiments.
- **Façades :**
  - Résidence : gouttières, petits climatiseurs, balcons fleuris, tag « 404 », affiches ;
  - Supérette : promos en vitrine, **néon « 24h »** ;
  - Madame Bouchon : lierre et **lanterne** allumée ;
  - Maison bleue : lierre, parabole, numéro.
- **Lieux :**
  - ruelle : tag, affiche, grille d'aération, **linge suspendu** (calque haut) ;
  - parc : nénuphars, roseaux, feuilles mortes sous les arbres ;
  - place : marelle à la craie ;
  - station : bandes de sécurité et caniveaux à câbles.
- **Câbles électriques** entre les toits et au-dessus de la station (calque haut).
- **Lumière :** halos des lampadaires chauds, en anneaux tramés en damier. Ils sont calculés une fois par taille, puis réutilisés, sans flou. La lanterne et le néon éclairent leur coin.
- **Animations discrètes :**
  - reflets qui glissent sur les flaques ;
  - vapeur de la ruelle ;
  - papillons de nuit autour des lampadaires ;
  - néon qui grésille ;
  - yeux du chat dans la ruelle.

  Elles sont coupées avec « réduire les animations ». Les lucioles du parc existaient déjà.

## Phases 3 à 5 — toutes les autres cartes, intérieurs, combats

### Moteur commun (`remaster.ts`)
Les détails sont posés par type de sol et par règles de placement, sur les 18 autres cartes :
- **Sol :**
  - herbe, chemins, pavés et gravier (mêmes détails que le Quartier 404) ;
  - dalles usées, fissurées et moussues ;
  - roche moussue ;
  - parquet veiné, avec ses nœuds ;
  - carrelage avec joints et reflets ;
  - tatamis brillants ;
  - marbre aux veines continues, avec reflets ;
  - tapis à bordure dorée, franges et motif ;
  - égouts avec algues et flaques.
- **Ensemble des cartes :**
  - ombres au pied des bâtiments ;
  - tapis sous chaque table ;
  - pétales sous les cerisiers ;
  - flaques sur les places de nuit ;
  - grand cadran gravé au sol de la Tour.
- **Murs d'intérieur :** des objets accrochés sur chaque face de mur libre, une place sur deux ou trois, jamais derrière un meuble haut.

  | Lieu | Objets |
  |---|---|
  | Maison Chou | tableaux, horloge, étagères |
  | Herboristerie | herbes séchées, bocaux |
  | Armurerie | épées, bouclier |
  | Restaurant | casseroles, tableau, vaisselle |
  | Refuge | fenêtre enneigée, bois de cerf |
  | Palais | portraits dorés, appliques, tapisseries |
  | Confrérie | miroirs, affiches haltère, trophées |
  | Auberge et dojo | rouleaux calligraphiés, lanternes en papier, éventail, râtelier |
  | Tour | horloges en laiton, engrenages |
  | Égouts | grilles, tuyaux |
- **Façades :** gouttières, lierre, lanterne allumée près des portes des maisons et des échoppes.
- **Rochers :** mousse sur les rochers du Mont.
- **Calque haut :**
  - guirlandes de fanions entre les lanternes de la Cité ;
  - guirlandes de lampions au village ;
  - chaînes qui pendent dans la Tour.

### Identité animée par région
| Région | Animations |
|---|---|
| Toutes | Scintillements sur l'eau |
| Cité, village | Halos chauds des lanternes et lampions |
| Mont, Confrérie | Brume qui glisse ; poussière de magnésie autour des sacs de frappe |
| Voie du Samouraï | Pétales de cerisier qui tombent ; carpes koï dans les bassins |
| Tour des Heures | Engrenages qui tournent ; pendule doré ; rayons de lumière et poussière |
| Égouts | Gouttes qui tombent des murs |

### Combats et appartement
- **Combats :**
  - étoiles qui scintillent, pétales, brume, gouttes ou poussière selon le décor ;
  - vignette tramée (sans flou) pour la profondeur.

  Rien ne change dans les règles, les menus ou les animations d'attaque.
- **Appartement :** poussière dans la lumière de la pièce et vignette. Les meubles et leurs interactions ne sont pas touchés.

Toutes les animations s'arrêtent si l'option « réduire les animations » est active.

## Tests
- `tests/remaster.test.ts` : l'empreinte des cases bloquées des 19 cartes est identique à celle d'avant le remaster. Aucun passage n'est bloqué. Le test est vérifié après chaque phase.
- **Captures avant/après :** les 18 autres cartes (vue d'ensemble + vue en jeu), combats, appartement. Le passage sur tous les écrans du mode paysage ne montre aucun débordement ni aucune erreur.
- La suite complète passe, ainsi que la non-régression solo et le mode paysage (25 vérifications).
- 60 images/s dans le navigateur de test, comme avant.
- Captures avant/après en paysage iPhone : départ, place, parc, station, ruelle, rue.

## Limites
Tout est dessiné par le code, dans le style existant. Un tileset dessiné à la main par un graphiste (façades uniques, enseignes illustrées, personnages plus détaillés) irait plus loin. Ce serait un travail graphique externe, à intégrer ensuite dans le même système de calques.
