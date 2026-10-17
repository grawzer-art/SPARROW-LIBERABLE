# Moteur de combat — SPARROW : 23:59

Moteur au tour par tour, pur et testé : `src/lib/rpg/combat.ts`. Les données sont dans `src/lib/rpg/bestiary.ts`. L'écran de combat est `src/components/rpg/BattleScreen.tsx`, et les sprites de combat sont dans `src/components/rpg/battlers.ts`.

## Déroulé

1. Un ennemi visible repère Sparrow : il est en ligne droite, à portée, sans obstacle.
   - Une bulle « ! » apparaît ;
   - l'ennemi s'approche et parle ;
   - le dialogue déclenche le combat (`then: { kind: "battle" }`).
   - Il n'y a **aucune rencontre aléatoire**.
2. La transition est animée : éclairs, puis un volet en bandes. Les deux combattants glissent ensuite à leur place.
3. Le joueur choisit dans le menu **ATTAQUER / OBJETS / COMPAGNONS / FUITE** :
   - ATTAQUER : 4 techniques, avec leur puissance (PUI), leur précision (PRÉ) et leur description ;
   - OBJETS : les consommables du sac ;
   - COMPAGNONS : faire entrer un autre équipier. Cela coûte le tour, et l'ennemi frappe le nouvel arrivant ;
   - FUITE : impossible contre un boss ou dans le combat tutoriel.
4. Le moteur joue le tour : il renvoie le nouvel état et une **liste d'événements**. L'écran anime ces événements un par un (élan, effet, clignotement, chiffres, PV qui descendent, sons).
5. Fin du combat :
   - **victoire** : XP (niveau partagé du Sparrowgotchi), FP et butin ;
   - **défaite** : **RÉESSAYER**, avec l'équipe soignée et le sac d'origine, ou **SE RETIRER**. Rien n'est perdu, sauf les objets consommés.
   - L'équipe est soignée après chaque combat.

## Règles

| Élément | Règle |
|---|---|
| Dégâts | `puissance × ATT/DÉF × (niveau + 9) / 60`, ±15 %, critique ×1,5 (6,25 %) |
| Précision | précision de la technique × cran de précision |
| Crans | ATT, DÉF, VIT, PRÉ de −3 à +3 (`(2+n)/2`, précision `(3+n)/3`) |
| États | **Brûlé** : perd 1/14 des PV par tour pendant 3 tours, ATT −15 %. **Étourdi** : perd son prochain tour, et l'attaque qu'il préparait |
| Garde | divise par deux le prochain coup reçu |
| Attaques préparées | annoncées un tour, lancées automatiquement au suivant. On les pare en se mettant en garde, ou on les annule en étourdissant |
| Ordre | priorité (fuite > objet / changement > techniques rapides), puis vitesse |
| Boss | phases à des seuils de PV : nouvelles techniques, soin, bonus, nouveau sprite |
| IA | pondère les dégâts attendus, achève quand c'est possible, se soigne sous 40 % de PV, se renforce en début de combat, se met en garde face à une attaque annoncée. Choix pondéré : elle reste imprévisible |
| Niveau ennemi | il suit celui de Sparrow entre deux bornes : un joueur avancé garde un vrai combat, un débutant n'est jamais écrasé |

## Équipe (4 techniques chacun)

| Équipier | Techniques | Rôle |
|---|---|---|
| Sparrow | Coup de manette, Frite enflammée (brûlure), Micro-sieste (soin), Rage de lag (préparée) | polyvalent ; *Pluie de frites* (2 à 4 coups) remplace Coup de manette une fois apprise au chapitre 2 |
| Chevalier Noir | Lame d'ombre (prioritaire), Fumigène (−PRÉ), Garde silencieuse (garde, +DÉF), Éclipse (préparée, étourdit) | tank, contre des attaques annoncées |
| Gérard la Frite | Sel de mer (−DÉF), Cornet de soin (soigne aussi la réserve), Huile bouillante (brûlure), Frite géante (préparée) | soutien |

## Équilibrage (simulé dans `tests/combat.test.ts`)

Un « joueur raisonnable » simulé se soigne quand ça va mal, se protège des attaques annoncées et frappe fort le reste du temps. Chaque combat est joué 300 fois.

| Combat | Équipe | Victoires | Tours |
|---|---|---|---|
| Éclaireur (tutoriel) | Sparrow + Chevalier, niveau 1 | 100 % | ~5 |
| Brocolis, patates, laitues | niveaux 2 à 5 | 100 % | 5 à 13 |
| Roi de la Salade | niveau 4, sans préparation | ~94 % | ~20 |
| Roi de la Salade | niveau 5, équipé, avec objets | 100 % | ~15 |
| Roi de la Salade | niveau 3 | ~65 % | ~23 |

Un joueur qui répète la même technique met au moins 10 tours à battre le boss.
