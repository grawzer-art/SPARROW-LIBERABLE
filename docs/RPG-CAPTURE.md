# Système de capture V1 (SPARROW RPG V2)

## Rencontres
- Les **hautes herbes** sont le sol `potager` du Jardin royal (Cité des Frites Perdues). Elles sont déclarées dans `MapDef.wild` (`cite.ts`), et `wildAt` dit si une case en fait partie.
- À chaque pas sur ces cases, il y a 22 % de chances de rencontre, mais jamais avant le 3ᵉ pas suivant la rencontre précédente. Le tirage se fait dans `overworld.arrive` → `onWild`.
- **Première rencontre :** un dialogue explique la capture (Gérard la présente s'il est dans l'équipe) et offre 5 Capsules d'Écho. Le drapeau `capsules-offertes` évite de recommencer.

## Capture
- La **Capsule d'Écho** est un consommable (`capture: 0.5`). Elle se trouve aussi à l'Herboristerie (40 FP). En combat : OBJETS › Capsule d'Écho.
- **Chance de réussite :** `0,5 × (1,35 − PV/PVmax)` (× 1,35 si Brokito est étourdi ou brûlé), bornée entre 5 et 95 %. Le calcul est dans `catchChance` (`combat.ts`).
- **Combats concernés :** la capture ne marche que dans un combat marqué `wild` (`brokito-sauvage`). Ailleurs, la capsule n'est pas consommée.
- **Animation :** l'événement `capture` (nombre de secousses, réussite) déclenche :
  1. le lancer en cloche ;
  2. l'absorption, avec un flash violet ;
  3. 0 à 3 secousses ;
  4. la fin : étincelles dorées en cas de réussite, sinon la capsule s'ouvre et Brokito réapparaît.
- **Après la capture :** le combat est gagné, avec l'XP mais pas de FP.

## Brokito (N°001, Végétal)
- **Sprites :** de face (sauvage) et de dos (équipier), dans `battlers.ts`.
- **Capacités :** Fouet-tige, Pluie de florets, Racines, Graine surprise.
- **Niveau du Brokito sauvage :** il suit celui de Sparrow, entre 3 et 16.

## Bestiaire et équipe
- **START › BESTIAIRE** (`Pages.tsx`) affiche :
  - le numéro, le type, le sprite, le niveau et l'XP ;
  - les PV et les statistiques ;
  - les capacités ;
  - le bouton « Intégrer à l'équipe » / « Remettre au Bestiaire ».

  Une espèce vue mais pas capturée apparaît en « VU, PAS CAPTURÉ ».
- **Équipier :** une créature capturée est un `MEMBERS` qui combat à **son propre niveau** (`Team.mons`). Une fois intégrée, elle passe en tête de l'équipe.
- **Places de combat :** seuls les 4 premiers compagnons combattent. Les suivants restent dans l'équipe, en réserve : aucun compagnon de l'histoire n'est jamais retiré.
- **Expérience :** une créature active gagne l'XP de chaque victoire. Il faut `30 + 20 × niveau` XP pour monter d'un niveau.

## Sauvegarde
- Les créatures sont stockées dans `rpg.mons` (`{ level, xp, caught }` par espèce). Le champ est optionnel :
  - les anciennes sauvegardes se chargent telles quelles ;
  - les données abîmées sont ignorées (`restoreRpg`).
- Une espèce vue a le drapeau `vu:<espèce>`.

## Tests
- `tests/capture.test.ts` (13 tests) :
  - les données et la zone d'herbes ;
  - un combat sauvage gagnable ;
  - la chance de capture, et une capture réussie dans plus de 85 % des cas avec 5 capsules ;
  - un échec ;
  - le refus de capture hors rencontre sauvage ;
  - Brokito qui combat à son propre niveau ;
  - l'XP et les montées de niveau ;
  - l'équipe pleine ;
  - l'aller-retour JSON de la sauvegarde et les anciennes sauvegardes.
- **Navigateur** (Chromium, iPhone 390×844, tactile) : rencontre, puis dialogue et capsules, capture, Bestiaire, intégration, **rechargement de la page** (capture et équipe conservées), combat avec Brokito (+70 XP sauvegardés).
