# Remaster graphique (RPG solo)

Le remaster est purement visuel. Il ne touche ni l'histoire, ni les dialogues, ni les quêtes, ni les combats, ni les sauvegardes, ni les collisions.

## Comment le rendu est fait (audit)
| Fichier | Rôle |
|---|---|
| `src/lib/rpg/<carte>.ts` (`quartier.ts`, `cite.ts`…) | Données des cartes : sol case par case, éléments posés (props), portes, PNJ. Ce sont les **collisions**. |
| `src/components/rpg/tiles.ts`, `tiles2.ts` | Pixel art dessiné par le code dans deux calques mis en cache : **BASE** (sous les personnages) et **HAUT** (feuillages, têtes de lampadaires : Sparrow passe derrière). |
| `src/components/rpg/overworld.ts` | Image par image : calques, éléments animés, personnages triés par profondeur, voile de nuit, lumières, particules. |
| `src/components/rpg/remaster404.ts` | **Remaster du Quartier 404** (phase 1). |

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

## Tests
- `tests/remaster.test.ts` : l'empreinte des cases bloquées des 19 cartes est identique à celle d'avant le remaster. Aucun passage n'est bloqué.
- La suite complète passe, ainsi que la non-régression solo et le mode paysage (25 vérifications).
- 60 images/s dans le navigateur de test, comme avant.
- Captures avant/après en paysage iPhone : départ, place, parc, station, ruelle, rue.

## Limites
Tout est dessiné par le code, dans le style existant. Un tileset dessiné à la main par un graphiste (façades uniques, enseignes illustrées, personnages plus détaillés) irait plus loin. Ce serait un travail graphique externe, à intégrer ensuite dans le même système de calques.
