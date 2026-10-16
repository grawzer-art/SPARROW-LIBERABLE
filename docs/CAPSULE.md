# Capsule temporelle 2031 — architecture

Onglet `/capsule` (« CAPSULE 2031 » dans la barre d'onglets). Indépendant de l'accueil et du jeu.

## Ce qui existe (v1 — locale)

| Élément | Fichier |
|---|---|
| Modèle, validation, sauvegardes, dates d'ouverture | `src/lib/capsule/model.ts` |
| Stockage (interface + implémentation locale) | `src/lib/capsule/store.ts` |
| Page et expérience | `src/components/capsule/CapsulePage.tsx` |
| Coffre-fort SVG / scanner / bruitages | `Vault.tsx`, `Scanner.tsx`, `sfx.ts` |
| Styles propres à la capsule | `src/app/capsule/capsule.css` |
| Tests | `tests/capsule.test.ts` |

- Les lettres sont stockées dans `localStorage` (clé `sp.capsule.v1`) **uniquement sur l'appareil**.
  Aucune lettre n'est écrite dans le code, envoyée à un serveur ou versionnée dans GitHub.
- Ouverture : `OPEN_MS` = l'instant du compte à rebours (12/10/2031 00:00, Europe/Paris), réutilisé tel quel.
- Archives annuelles : chaque 12 octobre de 2027 à 2031 (`archiveOpensAt`).
- Sauvegarde : fichier JSON `{ kind: "sparrow-capsule-2031", version, exportedAt, letters[] }`.
  L'import valide chaque lettre, ignore les doublons (par `id`) et **interdit d'avancer la date d'ouverture**.
- `navigator.storage.persist()` est demandé après la première lettre pour limiter l'effacement automatique.
- Tester l'ouverture : `/capsule?simuler=2031-10-12T00:00:05`.

### Risque de perte (à rappeler aux utilisateurs)
Effacer les données de Safari, changer de téléphone, ou supprimer l'appli de l'écran d'accueil peut effacer les lettres.
Seule parade en v1 : **exporter régulièrement une sauvegarde** (Fichiers → iCloud Drive).
Le fichier de sauvegarde contient les lettres en clair.

## Évolution prévue : capsule collective privée

L'interface `CapsuleStore` (`load()` / `save()`, `label`, `remote`) isole l'UI du stockage.
Une future `CollectiveCapsuleStore` pourra l'implémenter sans changer l'interface utilisateur.
Champs déjà prévus dans le modèle : `origin: "local" | "collective"`, `openAt` par lettre, `version` du format.

Pistes recommandées pour cette v2 (non implémentées, aucune base de données ajoutée pour l'instant) :
1. **Accès privé** : code de groupe (variable d'environnement Vercel, jamais dans le code), comme `UPLOAD_CODE`.
2. **Chiffrement côté téléphone** (Web Crypto AES-GCM) avant envoi : le serveur ne stocke que du texte chiffré.
   Clé dérivée d'une phrase secrète partagée entre potes (PBKDF2), jamais transmise au serveur.
3. **Stockage** : un fichier par lettre (Vercel Blob en accès privé), comme pour les scores du jeu — pas d'écriture
   concurrente sur un fichier commun.
4. **Verrou temporel côté serveur** : la route d'API refuse de servir le contenu avant `OPEN_MS`.
5. **Migration** : bouton « Verser mes lettres locales dans la capsule collective » à partir des données locales
   ou d'un fichier de sauvegarde (même format).
