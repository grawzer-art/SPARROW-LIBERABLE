# Aventure en paysage immersif (iPhone)

Cela concerne uniquement l'aventure (`/jeu/sparrowgotchi`). Le reste de l'application garde son interface en portrait.

## Quand le mode s'active
| Contexte | Affichage |
|---|---|
| Téléphone tactile en **paysage** | Mode immersif plein écran |
| Téléphone tactile en **portrait** | Écran « TOURNE TON IPHONE POUR COMMENCER L'AVENTURE » (téléphone pixel art qui pivote). Secours : « JOUER EN PORTRAIT » ou RETOUR. |
| Ordinateur, tablette | Console classique (inchangée) |

**Orientation sur iPhone :**
- Le jeu essaie le plein écran et `screen.orientation.lock("landscape")` (Android et tablettes), sans jamais en dépendre.
- Safari iPhone et les PWA iOS ne permettent ni l'un ni l'autre.
- Dès que l'iPhone est tourné, le jeu reprend tout seul.

## Écran de jeu
- **Monde plein écran**, à l'échelle entière ×2 (×3 sur grand écran). Les pixels sont nets et rien n'est étiré.
- **Vue plus large**, par exemple 422 × 195 pixels de jeu sur un iPhone 14. Elle montre beaucoup plus de carte.
- **Supprimés :**
  - le cadre de console ;
  - le bandeau des statistiques ;
  - l'aide des commandes ;
  - la barre de navigation de l'application.
- **Zones sûres** (encoche, coins arrondis) respectées. Pas de défilement de la page.

## Commandes en surimpression
- **Placement :**
  - croix en bas à gauche ;
  - A et B en diagonale en bas à droite ;
  - START et SELECT petits, en bas au centre.
- **Opacité :**
  - 30 % au repos, réglable de 20 à 70 % dans START › Options ;
  - 70 % pendant l'appui ;
  - un contour discret garde les commandes visibles sur les cartes sombres.
  - L'opacité ne change que l'apparence : les zones tactiles restent entières.
- **Multitouch :** chaque commande suit son propre doigt. On peut maintenir la croix, appuyer sur B (courir) ou sur A, puis relâcher l'un sans couper l'autre.
- **Commandes masquées :** pendant les pages du menu et les cinématiques (cartes de chapitre, générique, intro).
- **START et SELECT masqués :** pendant les combats, la boutique et les mini-jeux de cuisine.

## Intro GRAW STUDIO
- **Contenu :** logo pixel art (une main insolente dessinée pixel par pixel, sans emoji), « GRAW STUDIO » avec STUDIO en rouge, éclat rouge et petit bruitage.
- **Durée :** environ 1,7 s.
- **Passer :** un tap ou A la coupe tout de suite. On peut la désactiver dans START › Options.
- **Moment :** elle se joue une fois par lancement, après l'écran « tourne ton iPhone ». La partie se charge pendant ce temps.

## Reprise et sortie
- **Reprise :** la sauvegarde existante est rechargée comme avant (carte, case, quêtes, équipe, PV, créatures, sac, réglages). Aucune nouvelle partie n'est créée.
- **START › QUITTER L'AVENTURE :** tout est enregistré, le verrouillage d'orientation est relâché, puis retour à l'accueil.

## Écrans adaptés
- **Combat :** la scène est au centre (rapport ≈ 1,3), la croix et A/B dans les marges sans la couvrir. Le menu des attaques, les objets, la capture, la victoire et la défaite fonctionnent.
- **Placés entre la croix et les boutons :** dialogues, choix, menu START, boutique.
- **Plein écran :** pages du menu et mini-jeux.

## Tests
- `tests/immersif.test.ts` : réglages (30 % par défaut, bornes 20–70 %, intro désactivable, données abîmées ignorées).
- **Chromium mobile en paysage 844×390** (tactile, multitouch par le protocole CDP) : 25 vérifications.
  - Intro et passage au tap.
  - Plein écran à ×2, reprise de la position, barre de navigation masquée.
  - Opacité à 30 %, disposition des commandes.
  - Croix maintenue, croix + B simultanés, relâchement indépendant, retour visuel.
  - Aucun défilement.
  - Combat centré, START › Quitter, réglage de l'opacité enregistré, retour à l'accueil avec la position enregistrée.
  - En portrait : « Tourne ton iPhone », puis rotation, puis jeu et intro ; secours « Jouer en portrait ».
  - Sur ordinateur : interface inchangée.
- **Passage sur les autres écrans :** menu, Bestiaire, boutique, objets de combat, capture, défaite, carte de chapitre, appartement, mini-jeux. Aucun débordement, aucune erreur.

**À vérifier sur un vrai iPhone** (un navigateur simulé ne remplace pas l'appareil) :
- rotation dans Safari et dans la PWA ;
- encoche et Dynamic Island ;
- multitouch réel avec deux pouces ;
- bruitage de l'intro (iOS bloque parfois le son avant un premier toucher) ;
- retour en portrait après « Quitter ».
