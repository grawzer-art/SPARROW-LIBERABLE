# Refonte UX/UI & graphique V2

## 1. Audit (avant)
- **Interface** : bandeau haut de 7 blocs (marque, an, habitants, civilisations, guerres, ennui, temps ×4, Stats, Menu), trois tiroirs (Pouvoirs, Monde, Chroniques) + barre d'onglets opaque, fil d'Ariane permanent, boutons de caméra, barre d'action, bouton rouge de notification.
- **Notifications** : chaque naissance, décès, fondation, changement de dirigeant, guerre… affichait un encadré en haut de l'écran (jusqu'à 3 simultanés, 7 s en grand format sur bureau), y compris pour les régions non observées.
- **Fiche habitant** : 15+ statistiques d'un coup (santé, faim, intelligence, courage, agressivité, foi, fatigue, solitude, traits…).
- **Rendu** : forêts très denses (3–5 arbres/case, tous du même gabarit), frontières de territoire rouges épaisses, vêtements peu lisibles, personnages petits.
- **Performances** : voir §5.

## 2. Direction artistique « Miniature World — stylized 3D diorama »
Lumière chaude (soleil crème, hémisphère légèrement rosée, brume dorée au crépuscule), vignette douce, poussières dorées le jour et lucioles la nuit, forêts aérées avec clairières, métiers lisibles par la couleur des vêtements, frontières discrètes. Interface en « verre chaud » : capsules arrondies, flou, accent doré, serif pour les noms.

## 3. Interface (implémentée)
- **Haut** : une capsule `Nom de la planète · An · population` (toucher = Chroniques/Peuples/Continents) + un bouton rond ⋯ (temps ▶ ❚❚ ×3 ×10, statistiques, sauvegarde, nouveau monde).
- **Bas** : un dock flottant `Interagir · Pouvoirs · Planète`. Pas de barre opaque.
- **Notifications supprimées** : plus aucun encadré d'événement (ni badge rouge). Tout est consigné dans les Chroniques (accessibles par la capsule du haut ou « Planète › Chroniques », filtrables, toutes régions). Seul un micro-retour de 2 s confirme *vos* actions (résultat d'un pouvoir, sauvegarde).
- **Plus de fil d'Ariane** : la navigation Planète → Continent → Région → Village → Habitant se fait au zoom et aux gestes ; « Planète » offre la liste des continents et « Voir le globe » (zoom arrière animé).
- **Carte habitant** : `Bernadette — 17 ans / Fermière · Heureuse · Se repose` + **Observer** (suivi caméra, interrompu par un glissement), **Influencer** (Bénir, Guérir, Inspirer, Foudroyer) et **Détails** (toutes les caractéristiques avancées, dans un panneau coulissant).
- **Carte village** (scène locale ET globe) : nom, civilisation, population, état (paisible / en chantier / assiégé / en flammes) ; Observer, Bénir, Détails.
- **Panneaux coulissants** : un seul composant, fermé par glissement vers le bas, ✕ ou nouveau toucher du dock ; la scène se recentre au-dessus.
- **Pouvoirs** : le plateau horizontal affiche des icônes (recharge visible) ; on choisit un pouvoir puis on **touche directement le monde** (zone en scène locale ; un village depuis le globe), sans confirmation. Nouveau pouvoir **Incendie** ; l'architecture reste une table `POWERS` + `cast()` extensible. Influence individuelle : `DivinePowerSystem.influence()` (modifie réellement l'état de l'habitant, journalisée, sauvegardée avec ses repos).

## 4. Graphisme (implémenté)
Forêts moins compactes (rendu uniquement : la simulation garde ses arbres/bois), clairières et abords des maisons dégagés, tailles/teintes variées ; personnages +20 % avec vêtements teintés par métier (paille, flanelle rouge, ardoise, ocre, bleu savant) ; frontières 2× plus fines et translucides ; éclairage plus chaud ; vignette ; particules d'ambiance (un seul draw call, ≤ 140 points, visibles de près uniquement) ; fumées, feux, eau animée, balancement de végétation, météo, cycle jour/nuit déjà présents et conservés.

## 5. Performances
Mesures Chromium/SwiftShader (rendu logiciel : **les ms ne sont pas représentatives d'un iPhone**) : globe ≈ 220 appels de dessin / 148 k triangles ; région ≈ 64 / 41 k ; village rapproché à ×10 ≈ 360 / 233 k. Simulation indépendante du rendu (inchangée, ×1/×3/×10 intacts). **30 FPS sur iPhone réel non mesuré** ; le globe est le point le plus coûteux en appels (tuiles de niveau ≥ 3) : piste = fusion des tuiles lointaines.

## 6. Validation
- `tsc` OK ; `vitest` : tests existants + `tests/geo.test.ts` + `tests/v2ux.test.ts` (Incendie, influence, humeur/métier, sauvegarde des repos).
- E2E avec vrais toucher (Playwright, émulation mobile 430×932) : toucher un habitant → carte → Détails → glisser pour fermer → armer Foudre → toucher le monde (16 morts) ; aucun `.toast`/`#crumbs` dans le DOM ; 0 erreur console. Scripts dans ce dossier.
- Captures : `apres_navigation_ui.png`, `milieu_ui_avant_graphisme.png`, `apres_graphisme.png`.

## 7. Limites et propositions
- Les pouvoirs de zone ne se lancent pas depuis le globe (seuls les villages sont visés) ; proposition : lancer sur un point du relief via le picking du globe + effets visuels (ring/flash) dans `PlanetView`.
- Le « suivre un habitant » est limité à la scène locale (une région à la fois).
- Pas de vrais modèles d'habitations différenciés par civilisation (couleurs/ères existantes) : nécessiterait de nouveaux modèles par civilisation (`models.ts`).
- Mesure iPhone réelle à faire.
