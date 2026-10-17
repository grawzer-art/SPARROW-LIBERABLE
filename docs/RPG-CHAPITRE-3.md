# Chapitre 3 — La Confrérie du Muscle (SPARROW : 23:59)

Les fragments tirent vers le Mont Biscotto. Au sommet, le Coach Gonflax fait s'entraîner la Confrérie sans jamais s'arrêter. Son haltère d'or porte le fragment n°3.

Le thème du chapitre est la sagesse oubliée de la Confrérie : **le muscle grandit pendant le repos**. Sparrow, expert en sieste, est le seul à l'avoir compris.

Durée visée : 30 à 40 minutes.

## Accès

Après le chapitre 2, le **portail nord** de la Cité, au Jardin royal, s'ouvre sur le sentier. Un écran titre annonce le chapitre 3.

## Cartes (`src/lib/rpg/mont.ts`)

| Carte | Taille | Contenu |
|---|---|---|
| Sentier du Mont Biscotto | 24×40, aube | sentier en lacets, rivière et pont étroit (gardé par le Protéinator), col du sommet (gardé par deux Haltères), randonneur |
| Refuge du Mont Biscotto | 10×8 | Brenda (boutique : soupe, barres protéinées, gants de fonte, survêt' pro), un vieil alpiniste |
| Parvis du Temple | 26×22, aube | haltère d'or géant, gong, moines à l'entraînement, Frère Haltère à la porte, Lili |
| Temple de la Confrérie | 30×22 | hall, Salle de la Force, Arène de l'Endurance, Bibliothèque de l'Esprit, dortoir, réserve gardée, sanctuaire fermé par une grille |

## Quête principale « La Confrérie du Muscle » (8 étapes)

| Étape | Comment |
|---|---|
| Prendre le sentier | passer le portail nord |
| Faire une pause au refuge | parler à Brenda |
| Entrer dans le Temple | **choix** : accepter le marché de Lili, qui éloigne Frère Haltère, ou refuser et battre Frère Haltère |
| Épreuve de la Force | le **vrai mini-jeu de muscu** du Sparrowgotchi, au banc : au moins 12 répétitions, sans crampe. Les muscles gagnés comptent aussi pour le Sparrowgotchi |
| Épreuve de l'Endurance | trois adversaires d'affilée, sans fuite possible |
| Épreuve de l'Esprit | quiz en 3 questions avec le Sage Mollet. Une erreur renvoie au début. Les bonnes réponses parlent toutes de repos |
| Éveiller SPARROW TITAN | une fois les trois épreuves réussies (dans n'importe quel ordre), le Sage Mollet éveille le Titan, et la grille du sanctuaire s'ouvre |
| Vaincre Coach Gonflax | boss en 2 phases. Sous 50 % de PV : « GONFLÉ AU MAX », avec une attaque préparée dévastatrice, une défense renforcée et un nouveau sprite |

## SPARROW TITAN (transformation)

- Elle apparaît dans le menu des techniques : « ★ SPARROW TITAN ». Utilisable **une fois par combat**, elle passe avant l'ennemi.
- Effets : attaque ×1,5, défense ×1,4, vitesse ×1,15 et PV +30 %, pendant 3 tours.
- Sparrow change de sprite (aura dorée) et a quatre techniques de Titan :
  - Développé cosmique ;
  - Biceps sismique (peut étourdir) ;
  - Cri du Titan ;
  - Sieste du Titan.
- **Lien avec le Sparrowgotchi** : si Sparrow est déjà au stade « SPARROW TITAN » dans l'appartement (400 de muscle), la transformation dure **4 tours**.
- Elle prend fin à la fin de sa durée, à un K.O. ou à un changement d'équipier.

## Coup de théâtre

- Gonflax avoue qu'un certain « M » lui avait promis un corps éternel. En échange, il récoltait chaque minute de repos que les moines ne prenaient pas, dans un sablier destiné à « la Tour ».
- Les trois fragments réunis font parler la lettre volée par Lili. C'est la liste des porteurs de fragments, et en bas figure « LILI — À SUPPRIMER APRÈS LIVRAISON ».
- **Lili rejoint l'équipe**. Le prochain nom sur la liste est « MAÎTRE KATSU — Voie du Samouraï ».

## Lili (nouvelle compagne)

| Technique | Effet |
|---|---|
| Dague éclair | frappe en premier |
| Vol à la tire | vole un objet à l'ennemi, une fois par combat ; l'objet est gardé |
| Poudre violette | précision et attaque de l'ennemi en baisse |
| Coup de grâce | dégâts ×2,5 sur un ennemi sous 40 % de PV |

## Quête secondaire « Le Sommeil de Frère Flemme »

1. Écouter Frère Flemme au dortoir : il n'a pas dormi depuis trois ans.
2. Battre les deux gardiens de la réserve, puis ouvrir le coffre des objets confisqués et prendre l'oreiller.
3. Rapporter l'oreiller : Frère Flemme s'endort et laisse son **Masque de nuit** (PV +25).

## Récompenses

- Fragment d'horloge n°3, Ceinture du Titan, Liste du Cadran, Lili, +450 XP et +350 FP.
- Équipements en boutique : Gants de fonte, Survêt' pro.
- Coffres : celui de l'arène, celui de la réserve.

## Équilibrage (simulation, `tests/combat.test.ts`)

- Combats normaux du chapitre 3 au niveau 7 : plus de 90 % de victoires.
- Gonflax au niveau 8 avec Titan : environ 94 % de victoires, en environ 12 tours. Sans le Titan : environ 82 %.
- Le niveau des ennemis suit celui de Sparrow à raison de +7 % par niveau. C'était +10 % auparavant, et les ennemis finissaient par distancer l'équipe aux hauts niveaux.

## Tests

`tests/ch3.test.ts` vérifie :
- les cartes et les portes ;
- les blocages du pont, du col, du sanctuaire et de la réserve ;
- l'accès aux trois salles d'épreuves avant l'éveil du Titan ;
- une partie complète simulée (refus de Lili, combat contre Frère Haltère, quiz, muscu, arène, Titan, Frère Flemme, Gonflax) ;
- le marché de Lili ;
- le quiz.

`tests/combat.test.ts` vérifie la transformation, le vol, le coup de grâce et l'équilibrage.
