# HUMANITY REALISM REBOOT — audit technique et artistique (point de validation n°1)

> Périmètre de cette étape, demandée explicitement : **auditer le projet, intégrer un premier vrai humain 3D animé, le faire valider
> avant de reconstruire les environnements.** Rien d'autre n'a été reconstruit.

## 1. Audit du projet existant

### Technique
| Domaine | État actuel | Verdict |
|---|---|---|
| Moteur | Three.js r170, WebGL2, Vite/TypeScript, rendu instancié (`GrowMesh`, `CharSet`) | **à conserver** |
| Personnages | `src/render/Characters.ts` : torses/membres/têtes assemblés par primitives, animation dans le vertex shader (pose par angles), 1 draw call par jeu d'instances | **à abandonner** pour les habitants proches (blocs, pas d'anatomie, pas de visage) |
| Végétation | lobes/cônes instanciés, balancement shader, aucune texture | à remplacer progressivement (assets PBR) |
| Bâtiments | `models.ts` : primitives détaillées (cadres, auvents, cheminées) mais sans matériaux photographiques | à remplacer par une bibliothèque historique documentée |
| Terrain | maillage LOD (quadtree sphérique), couleurs de sommets, aucune texture de sol | à enrichir (matériaux PBR triplanaires) |
| Pipeline d'assets | **inexistant** : aucun chargeur glTF, aucun asset binaire dans le dépôt | créé dans cette étape (`src/render/human/`) |
| Simulation / IA | indépendante du rendu, sauvegardes, mémoire, relations, conversations (PROJECT SENTIENCE) | **inchangée, préservée** |

### Artistique
Écart au cahier des charges : personnages en blocs, visages absents, couleurs de sommets plates, arbres en masses lisses, éclairage sans PBR.
Les systèmes comportementaux (animations liées aux actions, conversations, chantier) sont corrects mais habillés de formes inadaptées.

## 2. Évaluation du pipeline de production
| Option | Décision | Justification |
|---|---|---|
| Garder Three.js + assets glTF | **retenu** | `GLTFLoader` + `SkeletonUtils.clone` + `AnimationMixer` couvrent riggé, clips, morph targets ; démontré ci-dessous |
| Modèles glTF/GLB riggés + retargeting de clips | **retenu et implémenté** | retargeting en espace monde (poses de repos différentes) : `HumanLibrary.retargetAll` |
| Textures PBR optimisées | à faire (KTX2/Basis, atlas) | non nécessaire pour valider le premier humain |
| LOD + instancing | partiel | Three.js n'a pas d'instanciation de maillages **skinnés** : budget d'humains animés proches (≈ 12) + impostors au-delà ; piste pour les foules : textures d'animation de sommets (VAT) |
| Streaming d'environnements | existant pour le terrain (tuiles) | à étendre aux assets |
| Changement de moteur (Babylon, PlayCanvas, Unity WebGL…) | **non justifié** | aucun des besoins ci-dessus n'est hors de portée de Three.js ; la migration coûterait la simulation intégrée sans bénéfice démontré |

## 3. Assets réels disponibles (et légalement exploitables)
Conditions du bac à sable : **seuls `raw.githubusercontent.com` et `npm` sont joignables.** Bloqués : Sketchfab, Quaternius, Kenney,
Poly Haven, Mixamo, itch.io. Inventaire des modèles humains riggés trouvés et inspectés (sommets, os, clips) :

| Asset | Source | Contenu | Licence / limites | Usage retenu |
|---|---|---|---|---|
| `readyplayer.me.glb` | exemples three.js (avatar Ready Player Me) | homme, 15,8 k tri, 67 os, visage détaillé (yeux, dents, moustache), morph `mouthOpen`/`mouthSmile`, **costume de ville** | conditions Ready Player Me : usage dans une application intégrée à leur service ; redistribution à clarifier | **prototype uniquement** |
| `Michelle.glb` | exemples three.js (Mixamo) | femme, 28 k tri, 65 os, PBR (4 textures), vêtements modernes **intégrés au maillage** | conditions Adobe Mixamo : usage libre dans un projet, redistribution des assets seuls interdite ; à retélécharger avec un compte Adobe pour la production | **prototype uniquement** |
| `Xbot.glb` | exemples three.js (Mixamo) | robot, 7 clips de capture de mouvement : idle, walk, run, agree, headShake, sneak, sad | idem Mixamo | **clips seulement** (maillage réduit à 1,5 k tri ; 1,06 Mo) |
| `Soldier.glb` | exemples three.js (Mixamo) | soldat, Idle/Walk/Run | idem Mixamo | écarté (tenue militaire, visage masqué) |
| `CesiumMan.glb` | Khronos glTF-Sample-Assets | homme, 4,7 k tri, 1 clip de marche | CC-BY 4.0 (attribution Cesium) | écarté (qualité trop basse) |
| `LeePerrySmith.glb` | exemples three.js | scan de tête, non riggé | CC-BY 3.0 (Infinite Realities) | écarté |

**Il n'existe, dans les sources accessibles, aucun humain riggé en vêtements préhistoriques, ni aucun modèle réaliste sous licence CC0/permissive
clairement établie.** Je n'ai donc *pas* généré de personnage préhistorique par primitives (exigence du cahier des charges).

## 4. Ce qui a été intégré : un premier vrai humain 3D animé
- `src/render/human/HumanLibrary.ts` : chargement GLB, clonage de squelette, **retargeting des clips mocap en espace monde**
  (corrige les repères d'os différents entre Mixamo et Ready Player Me), mélange de clips avec fondu, morph targets du visage
  (sourire, bouche ouverte pendant la parole), variantes de taille et de teint.
- `src/render/human/viewer.ts` : banc d'essai `human.html` / `?scene=human` (repos, marche, course, conversation, furtif, triste, gros plan visage, jusqu'à 60 humains).
- Résultat : proportions anatomiques humaines, visage identifiable (peau, yeux, moustache, dents), marche et course fluides issues de capture de mouvement,
  gestes de conversation (« agree »), parole animée par la bouche.

## 5. Mesures (émulation Chromium/SwiftShader, 430×932 — **pas un iPhone**)
| Scène | Appels de dessin | Triangles (ombres comprises) | Géométries / textures |
|---|---|---|---|
| 5 humains + sol | 27 | 93 k | 10 / 50 |
| 20 humains + sol | 105 | 371 k | 10 / 128 |

≈ 5 appels de dessin par humain (6 maillages : tête, dents, barbe, corps, vêtements…) et ≈ 9 k triangles par humain avec ombres. Le framerate d'un
rendu logiciel (≈ 10 i/s) n'est **pas représentatif** d'un iPhone et n'est pas un résultat. Budget proposé : ≤ 12 humains animés proches (≈ 60 appels),
fusion des maillages d'un humain (un seul `SkinnedMesh` avec atlas) pour tomber à 1–2 appels, ombres douces uniquement pour les humains proches.

## 6. Limites restantes (honnêtes)
1. **Les costumes sont modernes** (costume de ville pour l'homme, tenue moderne pour la femme) : inacceptable pour une scène préhistorique. Le corps nu du
   modèle Ready Player Me n'existe pas sous les vêtements (bras et jambes absents), donc le costume ne peut pas être retiré. Essayer de « teindre en cuir »
   un costume trois-pièces ne produit pas un vêtement de peau.
2. Un seul visage par sexe, tête chauve pour l'homme, pas d'enfants, pas de personnes âgées : « variations physiques » non satisfaites.
3. Clips disponibles : repos, marche, course, acquiescement, refus, furtif, triste. **Manquent** : couper du bois, porter, construire, s'asseoir/se reposer,
   cueillir, gestes de conversation variés. Les animations de travail ne peuvent pas être fabriquées proprement sans bibliothèque de mocap.
4. Licences à clarifier avant toute publication commerciale (Ready Player Me, Mixamo).
5. Pas d'instanciation GPU de maillages skinnés : les foules exigent un LOD (impostors) et à terme des animations en texture.
6. Aucune mesure sur iPhone réel.
7. Le reste du jeu (terrain, arbres, bâtiments) n'a **pas** été refait, conformément à la consigne de valider d'abord le personnage.

## 7. Décisions demandées (blocage assumé)
Pour continuer vers un campement préhistorique crédible il faut des **assets que je ne peux pas obtenir d'ici** :
- **Personnages** : un lot de GLB riggés (Mixamo-compatibles) en vêtements de peau/lin, hommes, femmes, enfants, anciens, avec cheveux — par exemple
  des modèles Sketchfab CC0/CC-BY ou achetés, des avatars exportés depuis Character Creator / MakeHuman + vêtements modélisés dans Blender, ou une commande
  à un artiste. Déposez-les dans `public/assets/humans/` : la bibliothèque les retarget automatiquement.
- **Animations** : un lot Mixamo (ou équivalent) pour travailler, porter, s'asseoir, s'occuper d'un feu, conversation : à télécharger avec votre compte Adobe.
- **Environnement** : packs PBR libres de droits (Poly Haven : sols, rochers, écorces ; arbres photogrammétriques) — hôte bloqué depuis le bac à sable.
Dites-moi si vous préférez que je prépare plutôt un pipeline Blender (scripts) pour fabriquer ces vêtements à partir d'un corps nu libre de droits.

## 8. Fusion au jeu (étape 2)
Les habitants proches de la caméra (au plus 8 sur mobile, 14 sur bureau, dans un rayon de 20/28 cases) sont rendus en **humains 3D glTF riggés** (`HumanLayer`) ;
les autres restent en silhouettes instanciées (LOD). Homme = Ready Player Me, femme = Mixamo « Michelle » ; taille, teint et corpulence varient. Les animations suivent l'état réel :
marche (vitesse du clip asservie à la vitesse simulée), course en fuite, acquiescement pour celui qui parle (bouche animée), refus en dispute, pose abattue au repos ou malade.
Travail, portage, construction : pas de clip de capture disponible → pose de repos (limite documentée). `?blocks=1` rétablit l'ancien rendu en blocs. Build autonome : `vite.single.config.ts`.
