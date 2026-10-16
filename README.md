# SPARROW EST LIBÉRABLE — Dossier SP-2031

Application web installable (PWA) : compte à rebours cinématographique, à la seconde près, jusqu'au
**12 octobre 2031, 00:00 (heure de Paris)**. Projet indépendant, fait pour les potes. Document fictif, sans valeur juridique.

- Pages pré-générées (statiques), sans compte ni base de données. Une seule petite route d'API sert au dépôt de photos par les potes (stockage Vercel Blob, gratuit en Hobby).
- Tous les téléphones visent le même instant absolu (`2031-10-11T22:00:00Z`), quelle que soit la date d'installation.
- Fonctionne hors ligne après la première visite (service worker).

## Ce que contient l'appli

| Section | Détail |
|---|---|
| En-tête | Dossier classifié, N° SP-2031, statut, horloge de Paris en direct |
| Le sujet | Portrait façon fiche de police (toise, tampon CONFIDENTIEL, scan) |
| Temps restant | Jours / heures / minutes / secondes, chiffres animés, recalés à chaque seconde (pas de dérive) |
| Progression | Barre réelle 12.10.2026 → 12.10.2031 + pourcentage écoulé |
| Fil de surveillance | 40 bulletins humoristiques aléatoires, tapés façon terminal |
| Citations du jour | Une réplique de Batman + une de Kaamelott par jour (minuit, heure de Paris) + note du Ministère |
| Rapport d'analyse | Secondes, réveils, lundis, week-ends, Noëls restants (calculs réels) + estimations signalées |
| Archives du suspect | Galerie tactile avec légendes, emplacements réservés |
| Salle d'arcade | Mini jeu rétro « L'Évasion de Sparrow » (page `/jeu`) : deux persos, record local, défi à partager |
| Pièces des témoins | Les potes déposent des photos du suspect (code des potes requis), galerie + vue agrandie |
| Don pour le Chevalier Noir | Encart + page dédiée `/don` : numéro Wero à copier, barème humoristique, QR code de la page |
| Diffusion | Partage du lien, fiche image (PNG 1080×1350), QR code, instructions d'installation |
| Grand final | Écran spécial à zéro : confettis, photo finale, verdict, partage |

### Easter eggs
- Toucher **4 fois vite la photo** → alerte « TENTATIVE DE LIBÉRATION ANTICIPÉE DÉTECTÉE ».
- Toucher **le compteur** → « Non. Ça ne va pas plus vite en cliquant. » (de plus en plus agacé).
- Toucher 3 fois **STATUT** ou **N° SP-2031** → surprises.
- Caps symboliques annoncés une fois : 1 500, 1 000, 500, 100, 30, 7 jours, dernières 24 h (le compteur passe au rouge).
- Bouton **Effets : activés/désactivés** en bas de page ; la préférence système « réduire les animations » est respectée.

### L'Évasion de Sparrow (`/jeu`)
Jeu de course 8-bit sur les toits de Gotham. Toucher = sauter (double saut possible).
Calendriers, horloges et lundis volants coûtent un masque (3 vies) ; l'agent du Ministère se rapproche à chaque choc.
Kebab = −5 jours, masque = +1 vie, sablier = ralenti. But : faire tomber le compteur de 1 826 à 0 (≈ 5 min sans faute).
Code : `src/components/game/` (moteur testé dans `tests/game.test.ts`, sprites en texte dans `sprites.ts`).

### Tester le final sans attendre 5 ans
Ajouter à l'adresse : `?simuler=2031-10-11T23:59:50` (heure de Paris). Un bandeau « MODE SIMULATION » s'affiche.
Autres exemples : `?simuler=2030-06-01` (cap des 500 jours), `?simuler=2031-10-11T08:00` (dernières 24 h).

## Réglages

- **Heure de fin** : `src/config.ts` → `END.time` (ex. `"14:30"`). Commit → Vercel redéploie.
- **Messages** : `src/data/messages.ts` (ajouter une ligne suffit).
- **Caps** : `src/data/milestones.ts`.
- **Citations du jour** : `src/data/quotes.ts` (Batman) et `src/data/kaamelott.ts` (Kaamelott) — une par jour, dans l'ordre, puis la liste recommence.
- **Liens de don** : `src/config.ts` → `DONATIONS` (`paypal`, `weroUrl`, `weroId`). Une valeur vide masque le bouton.
  Attention : ces informations sont visibles publiquement.

## Activer le dépôt de photos par les potes (une seule fois, depuis l'iPhone)

1. Vercel → projet → onglet **Storage** → **Create Database** → **Blob** → nom `sparrow-temoins` → **Create**,
   puis **Connect** au projet (environnements Production + Preview). Vercel crée `BLOB_READ_WRITE_TOKEN` tout seul.
2. Projet → **Settings → Environment Variables**, ajouter :
   - `UPLOAD_CODE` = le code à donner aux potes (ex. `gotham2031`) ;
   - `ADMIN_CODE` = votre code secret à vous (permet de supprimer des photos).
3. **Deployments** → dernier déploiement → **⋯ → Redeploy**.

Utilisation : section « Pièces des témoins » → *Déposer une photo du suspect* → saisir le code (retenu sur le téléphone).
Les photos sont redimensionnées et réencodées sur le téléphone avant envoi (métadonnées GPS supprimées), 3 Mo max, 300 photos max.
Aucune modération automatique : avec `ADMIN_CODE`, ouvrir une photo → *Détruire la pièce*.
Les photos déposées sont accessibles publiquement à quiconque a le lien de l'appli.

## Ajouter une photo (depuis l'iPhone)

1. Sur github.com (Safari), ouvrir le dépôt → dossier `public/photos` → **Add file → Upload files** → choisir la photo (JPG, idéalement < 500 Ko).
2. Ouvrir `src/data/photos.ts` → icône crayon → remplacer un emplacement `placeholder: true` par :
   ```ts
   { id: "P-04", src: "/photos/MA-PHOTO.jpg", alt: "Description", caption: "Légende drôle.", focus: "50% 30%" },
   ```
3. **Commit changes**. Vercel redéploie en ~1 minute.

Plus simple : envoyer la photo à Claude Code en disant « ajoute cette photo dans les archives avec la légende … ».
Claude la place dans `photos-originaux/`, lance `npm run assets` (recadrage + compression + webp) et met à jour `photos.ts`.

## Déployer gratuitement sur Vercel (uniquement depuis l'iPhone)

1. Dans Safari : **vercel.com** → *Sign Up* → **Continue with GitHub** (plan **Hobby**, gratuit, aucune carte bancaire).
2. **Add New… → Project** → importer le dépôt `sparrow-liberable`.
   (Si le dépôt n'apparaît pas : *Adjust GitHub App Permissions* → autoriser ce dépôt.)
3. Framework détecté : **Next.js**. Ne rien changer → **Deploy**.
4. Si la branche de travail n'est pas encore fusionnée : *Settings → Git → Production Branch* → choisir la branche,
   ou fusionner la pull request dans `main` depuis l'appli GitHub.
5. Récupérer l'adresse `https://….vercel.app` et la partager (bouton **Partager le dossier** ou QR code dans l'appli).
6. Option : *Settings → Domains* pour un nom plus court du type `sparrow-liberable.vercel.app` (gratuit).

Chaque commit sur la branche de production redéploie automatiquement.

## Installer sur le téléphone
- **iPhone** : ouvrir le lien dans Safari → bouton Partager → **Sur l'écran d'accueil** → Ajouter.
- **Android** : Chrome → menu ⋮ → **Installer l'application**.

Pas de widget d'écran verrouillé : une PWA ne le permet pas.

## Développement

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # tests du compte à rebours (fuseau, heure d'été, bissextile, final)
npm run lint       # vérification TypeScript
npm run build      # export statique dans out/
npm run assets     # régénère photos optimisées, icônes et image de partage
```

Structure :
```
src/config.ts            dates, fuseau, numéro de dossier
src/lib/time.ts          calcul de l'instant cible + temps restant (testé)
src/data/                photos, messages, caps
src/components/          interface
public/                  photos optimisées, icônes, manifest, service worker
scripts/build-assets.mjs génération des assets
```
