# V3 — The Living World

## 1. Audit
- **Démographie** : naissances tirées à la naissance (p = 0,75 × bonus), aucun couple durable, aucune condition de logement/vivres autre que `food ≥ 8` et la capacité de la ville ; enfance 14 ans. Résultat mesuré (5 graines, 100 ans) : **52 → 200–295 habitants**, ≈ 350 naissances par monde.
- **Âmes (V2)** : besoins (fatigue, solitude, confort, peur), traits et utilité d'action (travailler, manger, se reposer, discuter) — mais **aucune mémoire, aucune relation individuelle, aucun projet** : l'habitant n'avait pas de passé.

## 2. Priorité 1 — démographie (`src/sim/tuning.ts`)
Tous les réglages sont dans un objet modifiable (`applyTuning`) ; `LEGACY_TUNING` reproduit la V2 pour les mesures.
- `birthRate = 0,30` ; `childGrowth = 0,30` (l'enfance dure 3,3× plus longtemps ; les risques par tick de l'enfance sont ramenés à la même mortalité par vie).
- Âge minimal des parents 17 (mère ≤ 40, père ≤ 60), **délai de 2,5 ans minimum entre deux naissances**, conception seulement dans un **couple établi**, vivres (`food ≥ 0,35 × pop`), stabilité ≥ 30, santé ≥ 60 ; sans toit la probabilité est divisée par 2.
- Tirage à la conception (un échec ne bloque la mère qu'un an) et **régulation naturelle** (`densityBoost`) : la natalité remonte quand la civilisation est loin de la capacité de ses villages — sinon une population de 20 personnes s'éteint (génération perdue de 50 ans).
- Les seuils de population (époques, technologies, bâtiments avancés, expansion) sont mis à l'échelle (`popThresholdScale = 0,5`) et la recherche par habitant compense, sinon les civilisations restent à l'âge de pierre.
- Ces réglages portent sur des **ticks simulés** : ×1, ×3, ×10 donnent exactement la même histoire (test).
- **Mesure avant/après** (3 graines × 80 ans, test `v3.test.ts`) : naissances **−79 %** au total, naissances pour 100 habitants-années **2,30 → 1,04**, population ≈ +35 % en 100 ans (contre +400 %), aucune civilisation éteinte sur 300 ans (4 graines). Les réglages V3 de la natalité par tête (−55 %) sont inférieurs à −70 % **à cause de la régulation naturelle**, qui évite l'extinction ; le multiplicateur `birthRate` reste bien 0,30.
- Sauvegardes : les enfants existants grandissent au nouveau rythme, les esprits sont créés à la demande, le format est compatible (testé).

## 3. Priorités 2 et 3 — `MindSystem` (`src/sim/MindSystem.ts`)
Par habitant (≈ 300 octets, sauvegardé) : **émotions** (peur, joie, tristesse, colère, espoir), **8 souvenirs** pondérés qui s'estompent lentement, **7 relations** (connaissance, ami, rival, partenaire, parenté) avec affinité, **confiance envers le dirigeant**, **idées** transmissibles (défiance, désir d'ailleurs, foi, crainte du ciel), **projet** (rester, partir, fonder une famille, se révolter, rancune, dévotion) et ses **raisons**.
- **Utility AI** : une délibération par an et par habitant (échelonnée par identifiant), scores = personnalité × souvenirs × confiance × attaches × attrait des autres villages ; hystérésis et engagement des départs. Hachage déterministe, **aucun appel externe**.
- **Cause → souvenir → décision → monde** : famine (individuelle ou civile) → souvenir → confiance qui baisse → idée de défiance → projet de départ → **la famille est persuadée selon l'affinité** → les habitants **marchent vraiment** jusqu'à un autre village (changent de ville, parfois de civilisation, de métier, de foyer) → exode relaté dans les Chroniques et stabilité entamée.
- **Vie sociale** : amitiés et rivalités par conversations (compatibilité), disputes (coups parfois) et réconciliations (empathie), couples durables, **trahisons** (ambitieux peu empathique dans un couple distendu : rupture, rancune, rivalité), transmission d'idées entre amis, **rébellions** (≥ 22 % d'adultes déterminés : renversement par le meneur qui devient dirigeant, ou écrasement avec morts, confiance détruite), **ferveur collective** (≥ 30 % d'adeptes), décisions collectives (exodes).
- Mort d'un proche, violence, catastrophes et incendies laissent des souvenirs aux témoins et à l'entourage.

## 4. Priorité 4 — gameplay de dieu (`DivinePowerSystem`)
Observer → comprendre (fiche : pensée, intention, pourquoi, souvenirs) → influencer → conséquences. Chaque intervention est **interprétée** (foi, intelligence, signes passés, peur) :
- **Rêve** (4 messages) ; compris → effet sur confiance/idées/projets et rumeur chez les proches ; mal compris → cauchemar, crainte du ciel ou oubli.
- **Rapprocher** : réconcilie un rival (selon l'empathie), noue une amitié ou un couple.
- **Inspirer** (individu) et **Découverte** (érudits : progrès technologique réel), **Foi** (idée de foi + progrès de la foi), **Dirigeant** (paix / guerre / générosité, selon son intelligence et sa vanité), **Protéger** (guérison, immunité, stabilité), **Punir** (vivres divisées par 2 ; les fidèles blâment le chef, les sceptiques s'indignent), plus **Bénir**, **Guérir**, **Foudroyer**, **Incendie** et les pouvoirs de zone existants (qui laissent désormais des souvenirs de peur).

## 5. Priorités 5 et 6 — rendu et interface
Forêts aérées (clairières, abords de maisons dégagés, tailles/teintes variées), patine propre à chaque maison, habitants plus grands avec métier lisible par la couleur, frontières discrètes, lumière chaude, particules d'ambiance, **bulle d'intention** au-dessus de l'habitant sélectionné/suivi. Plus aucune notification flottante ; Chroniques consultables (capsule du haut) ; carte simple d'un habitant (nom, âge, métier, humeur, action, intention, pensée) + « Détails » (pensée, intention et pourquoi, souvenirs, relations, émotions, puis santé et caractère) ; **Suivre** un habitant pendant sa vie (pastille « Suivi », mort annoncée discrètement).

## 6. Tests (`tests/v3.test.ts`, 23)
Réglages centraux ; croissance à 30 % ; naissance (âge, couple, délai) ; avant/après multi-graines ; ×1/×3/×10 identiques ; famine → souvenir → méfiance ; souvenirs qui changent le choix ; départ réel avec famille ; changement de projet ; amitiés/couples/disputes émergents ; trahison ; rébellion ; transmission d'idées ; rêves interprétés ; rapprochement ; punir/protéger ; foi/découverte/dirigeant ; conséquences d'une catastrophe ; sauvegarde (souvenirs, relations, intentions, idées) ; ancienne sauvegarde ; toutes les régions évoluent quand on change de continent ; **598 habitants : 1,5 ms/tick** (Node).
Les suites technologies/graphismes s'exécutent avec la démographie V2 (`LEGACY_TUNING`) : elles testent des systèmes qui ne dépendent pas du rythme démographique.

## 7. Limites honnêtes
- Les religions sont un attribut de la civilisation : le « changement de religion » est modélisé par la **foi individuelle et collective** et l'adoption des croyances du nouveau foyer à la migration, pas par des religions concurrentes dans un même village.
- Les dirigeants ne sont pas des habitants : un coup d'État remplace le dirigeant par le meneur, mais les conflits entre dirigeants restent ceux de la diplomatie existante (aucune intrigue de cour individuelle).
- Les migrations se font entre villages d'une même région/simulation ; pas encore d'émigration entre continents.
- Mesures faites en Node et en émulation Chromium (**pas d'iPhone réel**).
- La progression des civilisations est plus lente qu'en V2 (population divisée par ≈ 3) malgré la compensation : à régler dans `tuning.ts`.
