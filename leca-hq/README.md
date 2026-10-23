# LECA HQ — Phase 1 (fondations et QG)

Application web privée, responsive et installable (PWA), quartier général digital de la marque LECA.
Projet **indépendant** du reste du dépôt (SPARROW) : tout vit dans ce dossier `leca-hq/`.

## Lancer

```bash
cd leca-hq
npm install
npm run dev          # http://localhost:5173 (accessible sur le réseau local, ex. depuis un iPhone)
npm test             # tests (modèle, IndexedDB, sauvegarde, interface)
npm run build        # vérifie les types + build statique dans dist/
npm run preview      # sert dist/ sur http://localhost:4173 (service worker actif)
node scripts/screenshots.mjs   # captures desktop + iPhone (après build + preview) → docs/screenshots/
```

Installation iPhone : ouvrir l'URL dans Safari → Partager → « Sur l'écran d'accueil ».
Le service worker et l'installation exigent HTTPS (ou `localhost`) : sur un hébergement statique gratuit (GitHub Pages,
Cloudflare Pages, Netlify…) c'est automatique. Aucun hébergement n'a été configuré ni déployé.

## État honnête des fonctionnalités

| Élément | État |
|---|---|
| QG isométrique (diorama SVG interactif, 5 postes + noyau, zoom/déplacement tactile, pincer, molette, boutons) | ✅ opérationnel |
| Navigation alternative sans la scène (dock en bas, accessible au clavier) | ✅ opérationnel |
| Design system « Liquid Chrome », Roboto (embarquée, fonctionne hors ligne), animations réduites si demandé | ✅ opérationnel |
| PWA : manifeste, icônes iOS, service worker (coquille hors ligne) | ✅ opérationnel |
| **LECA CREATIVE** : créer / modifier / supprimer une campagne (nom, objectif, produit ou prestation en texte libre, brief, statut), idées de shootings, plan de tournage avec avancement, moodboard (import d'images, légendes, ordre), bibliothèque avec recherche et filtre par statut | ✅ opérationnel, sauvegarde automatique dans IndexedDB |
| Sauvegardes : export / import JSON (campagnes + images), fusion ou remplacement, validation avant écriture | ✅ opérationnel |
| LECA SOCIAL, FINANCE, SHOP, BOOKING | 🚧 espace accessible, **aucun outil** : page « en développement » listant ce qui est prévu (phases 2 à 4) |
| LECA CORE | 🚧 raccourcis réels vers les postes uniquement. **Aucune IA, aucune commande** (phase 5) |
| Liaison campagne ↔ catalogue SHOP / publications SOCIAL | ⏳ prévue avec les phases concernées |
| Comptes, synchronisation entre appareils, permissions | ❌ non implémentés (voir `docs/ARCHITECTURE.md`) |

## Limites à connaître

- **Stockage local** : les données restent sur cet appareil et ce navigateur. Pas de synchronisation, pas de
  séparation sécurisée entre utilisateurs. Vider les données de Safari peut les effacer → exporter des sauvegardes.
- **Aucune donnée réelle sensible** (fiches clientes, finances) ne doit y être saisie avant la mise en place d'une
  authentification et d'un contrôle d'accès.
- Le **logo officiel LECA n'est pas fourni** : la marque est écrite en texte (Roboto). L'icône « HQ » de l'écran
  d'accueil est un placeholder (`public/icons/icon.svg`, régénérer les PNG avec `node scripts/make-icons.mjs`).
- Le QG est un diorama SVG vectoriel (pas de WebGL) : léger et net sur tous les écrans, mais non « 3D temps réel ».
- Testé : Chromium (desktop et émulation iPhone), tests automatisés. **Pas encore testé sur un vrai iPhone / Safari.**

Coût : 0 €. Dépendances 100 % open source (React, Vite, react-router, zod, idb, @fontsource/roboto).
