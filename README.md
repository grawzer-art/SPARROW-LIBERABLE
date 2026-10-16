# SPARROW EST LIBÉRABLE — Dossier SP-2031

Application web installable (PWA) : compte à rebours cinématographique, à la seconde près, jusqu'au
**12 octobre 2031, 00:00 (heure de Paris)**. Projet indépendant, fait pour les potes. Document fictif, sans valeur juridique.

- 100 % statique (Next.js en export statique) : pas de serveur, pas de base de données, pas de compte.
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
| Citation du jour | Une réplique de Batman par jour (change à minuit, heure de Paris) + note du Ministère |
| Rapport d'analyse | Secondes, réveils, lundis, week-ends, Noëls restants (calculs réels) + estimations signalées |
| Archives du suspect | Galerie tactile avec légendes, emplacements réservés |
| Don pour le Chevalier Noir | Boutons PayPal / Wero (liens externes, l'appli ne collecte rien) |
| Diffusion | Partage du lien, fiche image (PNG 1080×1350), QR code, instructions d'installation |
| Grand final | Écran spécial à zéro : confettis, photo finale, verdict, partage |

### Easter eggs
- Toucher **4 fois vite la photo** → alerte « TENTATIVE DE LIBÉRATION ANTICIPÉE DÉTECTÉE ».
- Toucher **le compteur** → « Non. Ça ne va pas plus vite en cliquant. » (de plus en plus agacé).
- Toucher 3 fois **STATUT** ou **N° SP-2031** → surprises.
- Caps symboliques annoncés une fois : 1 500, 1 000, 500, 100, 30, 7 jours, dernières 24 h (le compteur passe au rouge).
- Bouton **Effets : activés/désactivés** en bas de page ; la préférence système « réduire les animations » est respectée.

### Tester le final sans attendre 5 ans
Ajouter à l'adresse : `?simuler=2031-10-11T23:59:50` (heure de Paris). Un bandeau « MODE SIMULATION » s'affiche.
Autres exemples : `?simuler=2030-06-01` (cap des 500 jours), `?simuler=2031-10-11T08:00` (dernières 24 h).

## Réglages

- **Heure de fin** : `src/config.ts` → `END.time` (ex. `"14:30"`). Commit → Vercel redéploie.
- **Messages** : `src/data/messages.ts` (ajouter une ligne suffit).
- **Caps** : `src/data/milestones.ts`.
- **Citations du jour** : `src/data/quotes.ts` (une par jour, dans l'ordre, puis la liste recommence).
- **Liens de don** : `src/config.ts` → `DONATIONS` (`paypal`, `weroUrl`, `weroId`). Une valeur vide masque le bouton.
  Attention : ces informations sont visibles publiquement.

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
