# Architecture — LECA HQ

## Choix
- **Vite + React 19 + TypeScript strict** : build statique, démarrage instantané, aucun backend.
- **HashRouter** : fonctionne sur n'importe quel hébergement statique sans réécriture d'URL.
- **IndexedDB via `idb`** : campagnes (`campaigns`) et images (`assets`, stockées en Blob, réduites à 1600 px).
- **zod** : toute écriture et tout import sont validés ; un import invalide ne modifie rien.
- **Scène du QG** : SVG isométrique généré par des primitives (`src/hq/iso.tsx`), gestes pointer/pinch maison
  (pas de dépendance 3D). Repli accessible : dock de navigation + postes focalisables au clavier.
- **PWA** : `public/manifest.webmanifest` + `public/sw.js` (réseau d'abord pour la navigation, cache d'abord pour les
  fichiers versionnés). Le service worker n'est enregistré qu'en production.

## Structure
```
src/
  stations.ts          configuration unique des postes (nom, statut, fonctions prévues, garde-fous)
  hq/                  scène isométrique (iso.tsx primitives, scenery.tsx postes, HQScene.tsx gestes)
  modules/creative/    modèle zod, bibliothèque, éditeur de campagne, moodboard
  modules/stations/    postes non livrés, LECA CORE, sauvegardes
  db/db.ts             accès IndexedDB + export/import
  components/ lib/     coque de poste, toasts, confirmations, réduction d'images
```
Chaque futur module (social, finance, shop, booking) suivra le schéma de `modules/creative` : types zod →
fonctions `db` → pages. Les activités LECA LASH / NAILS / LECA SHOP seront des **espaces de données séparés** (clé
`activity` obligatoire sur chaque enregistrement financier ou client ; aucun champ partagé entre Léa et sa collègue).

## Évolution vers le multi-utilisateur (NON opérationnel aujourd'hui)
Le stockage local n'offre ni synchronisation ni isolation entre personnes. Avant tout usage professionnel avec de
vraies fiches clientes ou données financières, il faudra : authentification, base hébergée avec règles d'accès par
rôle (Léa / collègue / gérante), sauvegardes côté serveur. Un fournisseur à offre gratuite (ex. Supabase) est une
piste, **non activée** : elle demande ton accord explicite (création de compte, limites du palier gratuit).
La couche `src/db/db.ts` est la seule à toucher au stockage, pour permettre ce remplacement.

## Shopify (futur)
Aucune clé ni appel Shopify. Le module SHOP distinguera trois origines de donnée : `local`, `importée` (CSV),
`synchronisée` (uniquement si une connexion officielle autorisée existe réellement).
