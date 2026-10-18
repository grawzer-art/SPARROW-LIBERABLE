# Progression V2 (SPARROW RPG)

## Niveaux individuels
- **Sparrow** garde le niveau du Sparrowgotchi.
- **Chaque compagnon** (et chaque créature) a son propre niveau et son XP. Ils sont stockés dans `rpg.levels` pour les compagnons et dans `rpg.mons` pour les créatures.
- **Qui gagne de l'XP :** seuls les équipiers **entrés au combat** (`Battle.fought`, Sparrow au départ, puis chaque changement) gagnent l'XP du combat (`teamGainXp`). Il faut `30 + 20 × niveau` XP pour monter d'un niveau.
- **Nouveau compagnon :** il arrive au niveau de Sparrow (effet `join`).
- **Anciennes sauvegardes :** au chargement, chaque compagnon reçoit le niveau actuel de Sparrow (`fixLevels`). Personne n'est affaibli.

## Techniques par niveau (toujours 4 en combat)
`Member.learn` : au niveau indiqué, une technique remplace la plus faible. Le message « X apprend Y ! » s'affiche à la montée de niveau.

| Équipier | Niveaux |
|---|---|
| Sparrow | 12 Frite volcan · 20 Rage ultime |
| Chevalier Noir | 10 Lame de minuit · 18 Éclipse totale |
| Gérard | 10 Fleur de sel · 18 Frite colossale |
| Lili | 12 Dague fantôme · 18 Coup de maître |
| Pokeyz | 18 Drop sismique · 22 Scratch suprême |
| Brokito | 8 Fouet épineux · 14 Tempête de florets (évolue au niveau 16) |

Les techniques de l'histoire, comme Pluie de frites, restent en place.

## Évolution
`Member.evo` : Brokito devient **Brokolosse** au niveau 16 (niveau officiel).
- Il change de nom et de sprites (face et dos).
- Ses statistiques gagnent +12 %.
- Le message « Quoi ? Brokito évolue en Brokolosse ! » s'affiche.
- Le Bestiaire indique à quel niveau la créature évolue.

## Barème des ennemis
Un ennemi a le niveau de sa zone (`lv[0]` de `FOES`), avec une petite variation. Il ne suit plus Sparrow.

| Ennemi | Niveau |
|---|---|
| Ennemi ordinaire | `lv[0]` ou `lv[0]` + 1 |
| Boss | `lv[0]` + 1 |
| Tutoriel | `lv[0]` |

S'entraîner rend donc vraiment plus fort. Monsieur Minuit a été renforcé pour rester le combat le plus dur avec les nouvelles techniques.

## Menu des objets en combat
- Une colonne compacte avec les noms complets et les quantités.
- Défilement qui suit la sélection.
- Une ligne de description fixe, comme pour les techniques.
- Les **capsules** n'apparaissent que face à une créature sauvage, en tête de liste.

## Tests
- `tests/progression.test.ts` (8 tests) :
  - l'XP réservée aux équipiers qui ont combattu ;
  - les niveaux propres en combat ;
  - le suivi des équipiers entrés au combat ;
  - le niveau d'arrivée d'un nouveau compagnon et la migration des anciennes sauvegardes ;
  - les techniques apprises ;
  - l'évolution ;
  - le barème des ennemis.
- Les tests d'équilibrage ont été mis à jour.
