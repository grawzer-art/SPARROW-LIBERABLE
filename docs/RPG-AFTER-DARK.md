# SPARROW : 23:59 — AFTER DARK

Contenu optionnel pour adultes (18+, signalétique maison, pas une classification officielle) :
humour noir, combats clandestins, choix moraux. Rien n'est sexuellement explicite. Rien ne bloque
l'histoire principale, et aucune sauvegarde n'est réinitialisée (tout passe par des drapeaux `ad:…`).

## Quête 1 — « Dernier verre avant minuit » (Quartier 404)

- **Entrée** : escalier de la Ruelle du Chat (case 19,3), ouvert une fois le chapitre 1 terminé.
- **Lieux** : bar *Le Dernier Verre* → cave (ring) → ancien local technique.
- **PNJ** : Momo (barman sarcastique), Dédé (pochtron menteur), Bulldozer (videur), La Fouine
  (receleuse), Josiane, l'Habitué, Monsieur Tarif (bookmaker), Kevin, le Gros Bertrand,
  Sœur Ginette, BIG MAMA KIKI (boss, 2 phases).

### Trois façons de faire tomber le tournoi truqué

| Méthode | Comment | Récompense | Conséquence |
| --- | --- | --- | --- |
| Le ring | S'inscrire, battre 4 combattants | Ceinture du Dernier Verre (DÉF +3, PV +12) | `rep-honnete` |
| Le videur (acheter) | Château Pétrole 1987 (histoire de Momo) | Accès au marché noir de La Fouine | |
| Le videur (cogner) | Combat contre Bulldozer | 2 Cafés de minuit | |
| Les preuves → dénoncer | Seringue (tonneau) + carnet (La Fouine) | 3 Gnôles maison + info de l'Habitué | `rep-honnete`, Momo ami |
| Les preuves → chantage | Idem, puis Tarif paie | 260 FP + marché noir | `rep-crapule`, Momo froid |

Ensuite Dédé avoue son mensonge et donne la clé du local : **Montre sans aiguilles**
(ATQ +6, VIT +3, mais DÉF −4, PV −10). Niveau conseillé ≈ 8 avec deux équipiers.

## Technique
- Code : `src/lib/rpg/afterdark.ts` (cartes, PNJ, objets, arrivées, après-combat).
- Combats : `bestiary.ts` (`bg: "club"`, `brutal: true` → gouttes rouges stylisées, combats humains uniquement).
- Tests : `tests/afterdark.test.ts` (parcours des 3 méthodes, textes, équilibrage).

## Quêtes 2 à 5 — les quatre autres régions (`src/lib/rpg/afterdark2.ts`)

Chaque quête s'ouvre par une porte dérobée (néon) sur une façade, une fois le chapitre de la région terminé.

| Région | Quête | Cogner | Ruser | Trahir | Secret |
| --- | --- | --- | --- | --- | --- |
| Cité (bistrot fermé) | La dette de Papi Lardon | Jumeaux Mayo + Gras-Double → 3 Frites du diable | Jeu marqué de Loulou → 180 FP | Voler la recette de Lardon → Chevalière grasse | Congélateur : l'ardoise du Roi de la Salade |
| Mont (arrière du refuge) | La salle du fond | Frères Biscotos + Dr Créatine → Bandeau de Brindille | Registre du frigo → dénoncer à Frère Rotule, 2 Méga-cornets | S'associer au Docteur → 220 FP + 2 Protéines louches | Commande « Coach G. — 40 doses » |
| Kyukei (à côté de l'auberge) | Le Snack Sakura | Sushis de main + Oyabun → Micro d'or | Duel de karaoké (paroles chez Jirō) → 2 Sakés + Micro d'or | Collecter le racket → 300 FP | Jirō a co-écrit la chanson |
| Tour (mur de la Tour) | Le Tic-Tac Club | Videurs Pendule + la Veuve → Jeton de minuit | Roulette : tout sur le zéro → 400 FP | S'associer → 350 FP + Dé pipé (maudit) | Le coffre : la fiche de Sparrow |

Boss réglés pour l'équipe de fin de chapitre (≥ 70 % de victoires simulées), trop durs 4 niveaux plus tôt.
Tests : `tests/afterdark2.test.ts`.
