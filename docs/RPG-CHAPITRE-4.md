# Chapitre 4 — La Voie du Samouraï (SPARROW : 23:59)

La liste du Cadran désigne le prochain porteur de fragment : **Maître Katsu**, au dojo du village de Kyūkei. Au village, la fête des lanternes ne s'arrête plus. Le **Métronome** impose un tempo sans fin et interdit toute pause entre les morceaux. Derrière les platines, il y a **Pokeyz**, le pote DJ de Sparrow, forcé de passer la même boucle à 136 BPM.

Le thème du chapitre : **on ne bat pas le Cadran en allant plus vite que lui, mais en choisissant son moment** (« la seconde juste »).

Durée visée : 35 à 45 minutes.

## Accès

Après le chapitre 3, la **sortie est** du parvis du temple, en (25,10) et (25,11), s'ouvre sur le Chemin des Cerisiers. Avant cela, le passage est fermé (texte `porte-est`). Un écran titre annonce le chapitre 4.

## Cartes (`src/lib/rpg/kyukei.ts`)

| Carte | Taille | Contenu |
|---|---|---|
| Chemin des Cerisiers | 36×18, crépuscule | cerisiers en fleurs, portique, Sbire en patrouille, Lanterne Folle, pèlerin |
| Village de Kyūkei | 34×28, nuit | grande scène du festival, platines de Pokeyz, Métronome, danseurs en boucle, 4 lampions, jardin du Tambour, auberge, dojo (fermé tant que le Métronome tient la fête) |
| Auberge du Thé Tiède | 10×8 | Madame Sencha (boutique : thé vert, boulette de riz, sabre de bois, hakama…), un voyageur |
| Dojo de Maître Katsu | 18×14 | Maître Katsu, un disciple, coffre, râteliers |

## Quête principale « La Voie du Samouraï » (8 étapes)

| Étape | Comment |
|---|---|
| Suivre le Chemin des Cerisiers | entrer sur la carte |
| Arriver au village | entrer sur la carte |
| Retrouver Pokeyz | lui parler, derrière ses platines |
| Récupérer les trois vinyles | dans n'importe quel ordre : battre les deux sbires de la place (« Pause Café »), battre le Tambour possédé (« Grasse Matinée »), parler à Madame Sencha (« Dimanche Soir », tombé dans sa théière) |
| Réussir le mix | **nouveau mini-jeu de rythme** (`RythmeGame`) : taper A quand chaque vinyle touche la ligne, au moins 70 % de notes. En cas d'échec on recommence sans pénalité |
| Vaincre le Métronome | le combat suit le mix. En cas de défaite, on peut le relancer en lui parlant. Pokeyz rejoint l'équipe et donne son casque. Le dojo s'ouvre |
| Affronter Maître Katsu | boss en deux phases. À 50 % de PV, il retire son chapeau : des lunettes, une barbe grise… |
| Éveiller SPARROW SAMOURAÏ | la scène du twist : Katsu est **un Sparrow plus âgé**, venu d'un futur où le Cadran a gagné. Il donne le fragment n°4, la technique SPARROW SAMOURAÏ et son ruban |

Récompense : +600 XP, +450 FP, Fragment d'horloge n°4.

Si le joueur quitte le dojo entre la victoire et la scène, Katsu rejoue la scène à la prochaine discussion.

## Quête secondaire « Les Lampions de Mamie Matcha »

Le Métronome a soufflé les quatre lampions aux coins de la place. Gérard les rallume en frottant deux frites. Mamie Matcha donne en retour 3 boulettes de riz et 2 thés verts (+160 XP, +160 FP).

## Pokeyz

- Compagnon n°4 (l'équipe va jusqu'à 5 avec Sparrow).
- Techniques : Drop de basse, Scratch, Boucle infinie, Remix.
- Sprite de carte : sweat à capuche violet, casque sur les oreilles. Sprite de combat de dos.

## SPARROW SAMOURAÏ

C'est une deuxième transformation, à côté de SPARROW TITAN. **Une seule transformation par combat** : il faut choisir l'une ou l'autre.

| | Titan | Samouraï |
|---|---|---|
| Profil | force et défense | vitesse et précision |
| Techniques | celles du Titan | Iaï éclair, Lame du temps, Garde du sabre, Méditation |

Les deux boutons apparaissent dans le menu de combat dès qu'ils sont disponibles.

## Ennemis et combats (`bestiary.ts`)

| Combat | Ennemis | Décor |
|---|---|---|
| sbire-1 | Sbire du Métronome | cerisiers |
| sbires-2 | 2 Sbires | festival |
| tambour-1 | Tambour possédé | festival |
| lanterne-1 | Lanterne Folle | cerisiers |
| metronome (boss) | Le Métronome | festival |
| katsu (boss, 2 phases) | Maître Katsu | dojo |

Équilibrage simulé (`tests/combat-policy.ts`, joueur raisonnable) :

| Combat | Victoires | Durée |
|---|---|---|
| Métronome | 96 à 100 % | 12 à 18 tours |
| Katsu | 91 à 95 % | 17 à 20 tours |

## Fichiers

| Fichier | Contenu |
|---|---|
| `src/lib/rpg/kyukei.ts` | cartes |
| `src/lib/rpg/ch4.ts` | dialogues, scènes et `CH4_CARD` |
| `src/lib/rpg/rythme.ts` | logique pure du mini-jeu de rythme |
| `src/components/rpg/RythmeGame.tsx` | interface du mini-jeu de rythme |
| `src/lib/rpg/bestiary.ts` | `FORMS` (titan et samourai), ennemis, objets, boutique de l'auberge |
| `src/components/rpg/battlers.ts` | sprites de combat |
| `src/components/rpg/actors.ts` | sprites de carte |
| `src/components/rpg/tiles2.ts` | décors : cerisier, portique, scène, platines, lampion, râtelier, lanterne de pierre |

## Validation

- `tests/ch4.test.ts` vérifie :
  - les portes et l'accessibilité ;
  - les verrous (sortie est, dojo) ;
  - une partie complète sans interface ;
  - la reprise de la scène de Katsu ;
  - qu'aucun texte n'évoque autre chose que la fiction.
- Une partie complète a été jouée dans Chromium (Playwright, 390×844), du parvis jusqu'à la carte de fin, avec :
  - le mix réussi ;
  - Métronome et Katsu battus ;
  - les lampions rallumés ;
  - un combat test avec SPARROW SAMOURAÏ et Pokeyz.

  Aucune erreur console.
