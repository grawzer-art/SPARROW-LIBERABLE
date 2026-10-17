# Audit du RPG — avant les chapitres 2 à 5

## Ce qui fonctionne réellement (chapitre 1, testé sur iPhone simulé)

| Système | État | Détail |
|---|---|---|
| Exploration | ✅ | Déplacement case par case, 4 directions, collisions, caméra, deux calques, nuit et lumières |
| Transitions | ✅ | Appartement ↔ Quartier 404 en fondu, sans aller-retour involontaire |
| PNJ | ✅ | 4 PNJ animés, trajets, ils regardent Sparrow et s'arrêtent à côté de lui |
| Dialogues | ✅ (partiel) | Nom du personnage, texte progressif, répliques selon la quête. **Pas de dialogues à choix.** |
| Quête principale | ✅ | « La Ville Figée » en 7 étapes, faisables dans le désordre, scène finale |
| Journal de quêtes | ✅ | Disponible / en cours / terminée, séparé des missions du jour |
| Sauvegarde | ✅ | `state.rpg` dans `sp.gotchi.v1`, position dans `sp.gotchi.where`, reprise dedans ou dehors |
| Inventaire | ⚠️ partiel | Objets de quête uniquement : pas de consommables, pas d'équipement de combat |
| XP / FP | ✅ | Ceux du Sparrowgotchi, partagés |
| Mini-jeux | ✅ | Farm et muscu dans l'appartement |
| **Combats** | ❌ | Inexistants |
| **Compagnons** | ❌ | Inexistants (l'écran Équipe est une maquette) |
| **Boutiques RPG** | ❌ | Seule la boutique de l'appartement existe |
| **Intérieurs** | ❌ | Les portes de la supérette et des maisons ne s'ouvrent pas |
| **Multi-cartes** | ❌ | Le moteur ne connaît qu'une seule carte, codée en dur |
| **Suite** | ❌ | La barrière du Centre-ville se lève, mais ne mène nulle part |

## Ce qui manque pour considérer le chapitre 1 comme terminé

1. **Un premier combat**, qui sert aussi de tutoriel. L'aventure en promet, mais le chapitre 1 n'en contient aucun.
2. **Un vrai passage vers le chapitre 2** : la barrière doit mener à une nouvelle carte.
3. **Le recrutement du premier compagnon** (le Chevalier Noir), indispensable pour que le menu COMPAGNONS ait un sens.

Ces trois points sont traités dans cette étape. Les intérieurs du Quartier 404 (supérette, maisons) restent volontairement fermés : leurs portes répondent par une réplique.

## Architecture retenue pour la suite

Le moteur d'exploration existant, sans dépendance externe, est conservé et **généralisé**.

- **`src/lib/rpg/mapdef.ts`** : description générique d'une carte.
  - sol en cases ;
  - éléments posés (avec des **conditions** : un portail qui s'ouvre, un objet qui disparaît…) ;
  - **portes entre cartes** ;
  - zones et PNJ (avec une condition d'apparition) ;
  - **ennemis visibles**, qui repèrent Sparrow dans leur champ de vision : pas de combats aléatoires.

  Un chapitre = un dossier de cartes, sans toucher au moteur.
- **`src/lib/rpg/script.ts`** : registre de dialogues (`carte:pnj`, `carte:objet`). Il gère :
  - les **choix** ;
  - les effets : quête, objets, drapeaux, recrutement, FP ;
  - les **actions déclenchées** : combat, boutique, mini-jeu, voyage, cinématique.
- **`src/lib/rpg/combat.ts`** : moteur de combat **pur et testé**.
  - dégâts, précision et coups critiques ;
  - statistiques modifiables, états (étourdi, brûlé) ;
  - attaques chargées et annoncées ;
  - phases de boss, IA, objets, compagnons, fuite.
- **`src/lib/rpg/bestiary.ts`** : attaques, ennemis, membres de l'équipe, objets et équipements.
- **`src/components/rpg/BattleScreen.tsx`** : écran de combat façon RPG portable, avec la même palette que l'exploration :
  - transition animée ;
  - Sparrow de dos, l'ennemi de face ;
  - cadres de PV ;
  - menu ATTAQUER / OBJETS / COMPAGNONS / FUITE.
- **Sauvegarde** : `state.rpg` reçoit `bag` (consommables), `party` (compagnons), `gear` (équipement) et `skills` (techniques apprises). Les anciennes sauvegardes reçoivent des valeurs vides, sans rien perdre.

## Choix d'équilibrage

- **Niveau** : les PV et les statistiques de l'équipe suivent le niveau partagé du Sparrowgotchi. L'équipement et les transformations s'y ajoutent.
- **Soins** : l'équipe est soignée après chaque combat. On ne perd donc pas de temps à revenir au point de soin, et rien ne peut bloquer.
- **Défaite** : on peut réessayer immédiatement, ou se retirer pour s'équiper.
- **Durée** : pas de rencontres aléatoires ni de collecte artificielle. Chaque combat est placé à la main.
