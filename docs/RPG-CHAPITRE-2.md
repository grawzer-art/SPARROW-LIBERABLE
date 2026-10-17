# Chapitre 2 — La Cité des Frites Perdues

Sparrow et le Chevalier Noir arrivent au Centre-ville. Le Roi de la Salade y a interdit les frites, et un fragment d'horloge brille dans sa couronne.

Durée visée : 30 à 40 minutes, en comptant la quête secondaire, les boutiques et les combats.

## Accès

1. À la fin du chapitre 1, la barrière du Centre-ville se lève.
2. Le **Chevalier Noir** attend à côté. On lui parle et on choisit « En route » : il rejoint l'équipe.
3. Un **Soldat Brocoli** repère Sparrow, ce qui lance le **combat tutoriel**.
4. Après la victoire, la route de l'est mène à la Cité.

## Cartes (`src/lib/rpg/cite.ts`)

| Carte | Taille | Contenu |
|---|---|---|
| Cité des Frites Perdues | 40×32, crépuscule | Place des Cornets (fontaine sèche, statue, décret), Rue du Marché, Ruelle des Friteurs, Cour du Palais, Jardin royal |
| Maison Chou | 9×8 | Madame Chou : l'explication du décret et le mot de passe |
| Herboristerie Persil | 9×8 | Boutique : tisane, soupe, sauce piquante, ketchup, bracelet |
| Armurerie du Navet | 9×8 | Boutique : manette pro, sweat épais, spatule, tablier blindé |
| La Friterie Clandestine | 14×10 | Le marché caché : Gérard, Frida (boutique), la silhouette mystérieuse |
| Égouts de la Cité | 30×18, souterrain | Énigme des trois vannes, Patates Renégates, coffre, sachet |
| Palais du Roi | 24×18 | Caves, dortoir (uniforme), couloirs gardés, salle du trône |

## Quête principale « La Cité des Frites Perdues »

| Étape | Comment |
|---|---|
| Rejoindre la Cité | arriver par la route de l'est |
| Découvrir pourquoi les frites sont interdites | lire le décret sur la place, puis parler à Madame Chou, qui donne le mot de passe |
| Trouver Gérard au marché caché | battre les deux Soldats Brocoli de la ruelle, puis donner le mot de passe à la porte de l'échoppe (dialogue à choix) |
| Réussir le concours des frites parfaites | le mini-jeu de Gérard. Ensuite, Gérard rejoint l'équipe, on apprend *Pluie de frites* et on reçoit la clé des égouts |
| Traverser les égouts | régler les trois vannes (gauche ouverte, milieu fermée, droite ouverte), battre les patates, prendre l'échelle |
| Infiltrer le palais | trouver l'uniforme dans le dortoir pour passer la garde sans combattre. Sans uniforme, il faut un combat |
| Vaincre le Roi de la Salade | boss en 2 phases. À 50 % de PV, il passe en « mode Vinaigrette » : nouvelles techniques, soin, attaque renforcée, nouveau sprite |

## Coup de théâtre

- Le Roi avoue que **Le Cadran**, une organisation qui veut s'approprier le temps des autres, lui a offert la pierre de sa couronne.
- Ce fragment n°2 lui avait été remis par un homme en costume qui signe « M ».
- **Lili**, la voleuse en capuche violette croisée à la friterie, vole la lettre du Cadran et disparaît.
- Il ne reste qu'un coin de page : un cadran sans aiguilles et le mot « PROTOCOLE ».

Récompenses de fin : Fragment d'horloge n°2, Fourchette sacrée (arme), 2 Méga-cornets, +300 XP, +250 FP. La carte de fin annonce le chapitre 3.

## Quête secondaire « Les Graines de Mamie Tubercule »

Il faut retrouver trois sachets, dans n'importe quel ordre :

- dans la fontaine sèche ;
- dans le tonneau de la ruelle ;
- dans une caisse des égouts.

Récompense : Bracelet de sel (+3 vitesse), +120 XP, +120 FP.

## Ennemis et combats

| Combat | Où | Remarque |
|---|---|---|
| Soldat Brocoli (patrouille) | Rue du Marché | repère Sparrow s'il passe dans son champ de vision |
| 2 Soldats Brocoli | entrée de la ruelle | ils bloquent le passage |
| Patate Renégate | égouts | devient ensuite une « patate repentie » qui offre un pin's |
| 2 Patates Renégates | devant l'échelle du palais | — |
| Garde Laitue (ronde) | couloir du palais | — |
| Garde Laitue + Soldat Brocoli | porte du trône | évitable avec l'uniforme |
| **Roi de la Salade** | salle du trône | boss, 2 phases, fuite impossible |

## Mini-jeu « Frites parfaites » (`CookGame.tsx`, logique dans `shop.ts`)

Il y a cinq fournées, et elles cuisent de plus en plus vite. On sort le panier avec A :

- jauge dans le vert : PARFAIT, 2 points ;
- jauge dans le blanc : DORÉ, 1 point ;
- sinon : 0 point.

Il faut 6 points sur 10. En cas d'échec, on peut réessayer sans limite en reparlant à Gérard.

## Tests

- `tests/ch2.test.ts` :
  - chaque porte mène à une case libre ;
  - tout est atteignable, et les blocages scénarisés tiennent : ruelle gardée, courant des égouts ;
  - chaque PNJ et chaque objet a un texte ;
  - **une partie complète simulée**, de la route jusqu'au Roi, avec la quête secondaire ;
  - boutiques et équipement ;
  - aucun texte n'évoque le compte à rebours réel ni ses circonstances.
- Parcours de bout en bout dans un navigateur simulant un iPhone, joué au clavier : il ramasse, combat, cuisine et voyage d'une carte à l'autre, comme un joueur.
