# La Gazette du Chaos — guide de la rédaction

Onglet `/gazette`. Journal **100 % parodique** : tous les titres sont inventés, aucun ne décrit un fait réel,
et aucune personne réelle n'est nommée. La mention « parodie » figure sur la page, le partage et les images.

## Fichiers à modifier (aucune modification d'interface nécessaire)

| Quoi | Où |
|---|---|
| Titres, brèves, bandeaux URGENT, chiffres du jour, noms des rubriques | `src/data/gazette/titres.json` |
| Éditions spéciales datées (Noël, anniversaires…) | `src/data/gazette/speciales.json` |
| Éditions DERNIÈRE MINUTE des paliers du compte à rebours | automatiques (`PALIERS` dans `src/lib/gazette/edition.ts`) |

### Ajouter un titre depuis l'iPhone
1. github.com → dépôt → `src/data/gazette/titres.json` → crayon (Modifier).
2. Copier une ligne de `"titres"` et la modifier :
   ```json
   { "id": "fr-017", "rubrique": "france", "ajout": "2026-11-02", "titre": "Mon nouveau titre" },
   ```
   - `id` unique · `rubrique` : `france`, `monde`, `tech`, `vdm`, `sparrow`
   - `ajout` : date de publication (le titre n'apparaît qu'à partir de ce jour)
   - facultatif : `"chapo"` (une phrase), `"flash": true` (Flash spécial), `"tampon"` (`EXCLUSIF`, `URGENT`, `À LA UNE`, `RÉVÉLATION`)
3. Commit → Vercel publie automatiquement. Les tests vérifient les identifiants, les rubriques et la longueur des titres.

Règles de la maison : titres courts (≤ 150 caractères), une idée comique forte, une chute ; viser les absurdités,
les puissants et les situations grotesques, jamais des victimes réelles ; aucun nom de personne réelle.
Rubrique Dossier Sparrow : ne jamais évoquer la raison privée du compte à rebours.

## Comment les éditions sont composées
- **Déterministe** : une date donne la même édition sur tous les téléphones (n° 1 = 16/10/2026).
- **Rotation** : chaque titre occupe une position fixe ; chaque jour, la sélection tourne du nombre d'or.
  La une change tous les jours, et au plus 2 titres d'une même rubrique par édition.
- **Archives stables** : un titre ajouté avec une date `ajout` future ne modifie jamais les éditions passées.
- Une édition = 1 une + 7 titres + 4 brèves + 1 bandeau URGENT + 1 chiffre du jour (+ un Flash spécial s'il y en a un).

## Évolution future (non activée) : actualités réelles → satire validée

Rien de payant n'est branché, aucune clé d'API n'existe dans le code ni côté navigateur.
Architecture proposée, à activer uniquement avec accord explicite :

1. **Collecte** (route serveur programmée, ex. tâche Vercel quotidienne) : titres de flux RSS publics de sources
   autorisant la reprise de leurs titres, uniquement les titres et les liens, jamais les articles.
2. **Proposition** : génération de 3 variantes satiriques par information, par un modèle d'IA dont la clé reste
   **côté serveur** (variable d'environnement), avec un plafond de dépense défini.
3. **File de validation** : les propositions sont stockées en « brouillon » ; rien n'est publié automatiquement.
   Une page d'administration protégée par `ADMIN_CODE` permet d'accepter, modifier ou rejeter chaque titre.
4. **Publication** : un titre validé rejoint la même structure que `titres.json` (avec `ajout` = date de validation),
   toujours marqué comme parodie, avec la source d'inspiration en note si elle est citée.
