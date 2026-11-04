# SENTIENCE × VISUAL EXPERIENCE — scène témoin

> Principe : la qualité visuelle compte autant que la profondeur de simulation. Chaque comportement doit se **voir**, et chaque
> animation doit découler d'un état réel de la simulation (jamais l'inverse).

## 1. Ce qui a été construit

### Conversations simulées (`src/sim/Talk.ts`)
- Une conversation est une **donnée de simulation** : initiateur (celui qui a le plus à dire), répondant, **sujet** tiré de leur esprit
  (la faim, le chef, partir, la foi, la famille, une rancune, le quotidien), **ton** (tranquille, tendu, chaleureux), répliques alternées
  (une toutes les 2,2 s à ×1, six répliques), **effet** lisible.
- Les répliques sont générées **localement et de façon déterministe** (gabarits + hachage) : aucun modèle de langage, aucun appel externe,
  rien à chaque frame.
- Les effets sont réels : le répondant approuve ou conteste selon SON esprit (confiance, affinité, caractère, idées) ; s'il approuve, il
  adopte l'idée (défiance, désir d'ailleurs, foi), gagne un **souvenir persistant** (`MEM.TALK`), l'affinité change, sa prochaine
  délibération est avancée. Une dispute change l'affinité et laisse un souvenir de querelle. Une conversation sur le départ peut
  **engager** les deux interlocuteurs : projet de départ commun, famille rassemblée (`rally`), départ concerté.
- Les paroles pèsent ensuite sur les décisions : les souvenirs de conversations sont un terme de l'utilité de départ/révolte.
- Mise en scène : les deux s'arrêtent à ≈ 1 case, **se tournent l'un vers l'autre**, et la conversation n'est plus coupée au milieu
  (la décision d'action la maintient jusqu'à la fin, sauf faim, fatigue extrême ou danger).

### Animations liées aux actions (`actionMode`, `src/render/CitizenLayer.ts`, shader `Characters.ts`)
Modes ajoutés : **7 parle** (gestes amples alternés), **8 écoute** (attentif, hoche), **9 dispute** (gestes brusques), **10 porte** (bras tendus,
planches du bâtisseur vers son chantier, fagot du bûcheron). Les modes existants (hache, pioche, houe, marteau, panier, lecture, repos assis,
combat, fuite) sont inchangés. `actionMode` est une fonction pure testée : aucune animation de marche à l'arrêt, aucun outil en marchant,
parole = conversation réelle, repos = assis.

### Personnages et végétation moins primitifs
Torses ovales effilés, membres coniques, têtes sphériques avec nez et yeux, pieds et mains arrondis ; conifères en étages de feuillage
souples (plus de cônes empilés), chênes et bouleaux en lobes multiples avec branches. Pas de glTF fourni : **aucun asset 3D autorisé et
embarqué n'était disponible hors ligne**. La géométrie reste procédurale (sans droit à clarifier) ; l'architecture accepte des GLB
(les modèles sont des `BufferGeometry` instanciées), à brancher dès qu'un pack libre de droits est choisi.

### Caméra
Vue générale du village (orbite lente), rapprochement de profil sur une conversation (`Renderer.glide`), suivi d'un habitant ou d'un groupe
qui part, retour fluide à la caméra libre. Toucher une conversation ouvre une carte (sujet, ton, deux dernières répliques) avec
**Écouter** (cadrage automatique discret, qui se défait seul à la fin), **Échanges** (transcription lisible dans un panneau, avec ce
que la conversation change et ce que chacun en retient) et **Détails**. Aucune bulle de dialogue permanente. Un glissement du doigt
reprend la main immédiatement.

### Scène témoin (`src/sim/WitnessScene.ts`, URL `?scene=sentience[&speed=2][&ui=1]`)
Un village à deux autres villages voisins, **cinq habitants** aux identités et mémoires distinctes (Mira, survivante de la famine, méfiante ;
Ysa, jeune mère et nièce de Mira ; Tobias, bâtisseur loyal ; Garen, bûcheron ambitieux ; Lenn, ancien pieux) plus Pip, l'enfant d'Ysa ;
trois maisons en chantier ; le village ne colonise pas et reste en paix pendant la scène. Seul l'**état initial** est posé ; tout le reste
vient des systèmes réels :
1. Mira et Ysa discutent (leur intention initiale est de se parler) ; Mira a le plus à dire : le sujet est **partir**.
2. Ysa, à qui la faim a laissé des souvenirs, approuve ; la conversation lui laisse un souvenir et **fait basculer sa décision**.
3. Ils décident de partir ensemble ; Pip suit sa mère ; la famille se rassemble puis marche **ensemble** jusqu'à l'autre village (action
   collective visible), pendant que Tobias et les autres bâtisseurs construisent les maisons (planches portées vers le chantier).
4. Une caméra sans interface (le « réalisateur ») cadre la conversation de près, suit le groupe qui part, regarde le chantier,
   puis revient à la vue générale. Un toucher reprend la main ; un double toucher bascule l'interface.
5. Le joueur peut toucher Lenn, lui envoyer un rêve, lire la conversation en cours ou suivre n'importe qui.

## 2. Budgets de rendu mesurables (`src/render/budgets.ts`)
| Budget | Valeur | Vérifié par |
|---|---|---|
| sommets par habitant (LOD proche) | < 1 500 | test `v4` |
| sommets d'un habitant lointain | < 160 | test `v4` |
| habitants animés simultanément | ≤ 600 (au-delà : silhouettes) | code `CitizenLayer` |
| distance de détail | 95 cases (mobile) | code |
| particules d'ambiance / effets | 140 / 1 400, un draw call chacun | code |
| ombres | une carte 1 024² sur mobile, arbres hauts + bâtiments | code |
| scène locale | ≤ 260 appels de dessin, ≤ 420 k triangles | script de démonstration |
| simulation, 600 habitants | ≤ 8 ms/tick (mesuré ≈ 1,5 ms sous Node) | test `v3` |

La simulation (agents, conversations, décisions) est **séparée du rendu** : elle tourne à pas fixe (30 ticks/an), indépendante du framerate ;
le rendu ne fait que lire l'état. Aucun modèle de langage n'est exécuté, ni par image ni par décision.

## 3. Tests (`tests/v4.test.ts`, 14)
Identités et mémoires issues du moteur ; scène déterministe ; conversation spontanée à distance naturelle, face à face, alternée ;
conversation → décision persistante → famille qui part ensemble et arrive ; chantier collectif qui progresse ; dispute réelle ; sauvegarde
(souvenirs, relations, intentions) ; animations connectées aux actions (`actionMode`) ; budgets de géométrie ; génération locale
déterministe des conversations.

## 4. Limites honnêtes
- Les mesures de rendu viennent d'une émulation Chromium logicielle (SwiftShader), **pas d'un iPhone** : le 30 FPS stable reste à valider sur l'appareil de test.
- Pas d'assets glTF : modèles procéduraux améliorés mais pas encore du niveau « Tiny Glade » (matériaux, lumière globale, végétation dense animée par vent) ; la prochaine marche est un pack d'assets libres + atlas de matériaux.
- Les répliques sont des gabarits variés (une trentaine) : elles disent des choses vraies de la simulation mais restent répétitives sur de longues durées.
- Les conversations sont limitées à deux personnes ; pas encore de groupes ni de rumeurs qui circulent de bouche en bouche autrement que par les idées.
- La scène témoin est jouée dans la région locale ; la généralisation à toute la planète est automatique côté simulation (les systèmes sont ceux de toutes les régions) mais la mise en scène (réalisateur) ne couvre que la scène locale observée.
