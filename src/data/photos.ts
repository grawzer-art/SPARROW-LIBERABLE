/**
 * ─────────────────────────────────────────────────────────────
 *  PIÈCES À CONVICTION — PHOTOS DE SPARROW
 * ─────────────────────────────────────────────────────────────
 *  1. Déposer le fichier .jpg dans  public/photos/
 *     (idéalement ~1080 px de large, < 300 Ko)
 *  2. Ajouter / modifier une entrée ci-dessous.
 *  3. Commit → Vercel redéploie automatiquement.
 *
 *  - src         : chemin depuis public/ (ex. "/photos/plage.jpg")
 *  - webp        : (optionnel) version .webp plus légère
 *  - caption     : légende humoristique affichée sous le cliché
 *  - focus       : cadrage CSS (object-position), ex. "50% 30%"
 *  - date        : (optionnel) mention libre affichée dans le cartouche
 *  - placeholder : true = emplacement vide en attente d'un cliché
 */

export interface Photo {
  id: string;
  src?: string;
  webp?: string;
  alt: string;
  caption: string;
  focus?: string;
  date?: string;
  placeholder?: boolean;
}

/** Portrait principal (page d'accueil). */
export const MAIN_PHOTO: Photo = {
  id: "P-01",
  src: "/photos/sparrow-lunettes.jpg",
  webp: "/photos/sparrow-lunettes.webp",
  alt: "Sparrow, lunettes de soleil, en plein soleil",
  caption: "Individu actuellement sous surveillance du calendrier.",
  focus: "50% 38%",
};

/** Photo révélée lors du grand final. */
export const FINAL_PHOTO: Photo = {
  id: "P-FIN",
  src: "/photos/sparrow-cri.jpg",
  webp: "/photos/sparrow-cri.webp",
  alt: "Sparrow en masque de chauve-souris, criant de joie",
  caption: "Réaction du sujet à l'annonce du verdict. Document non retouché.",
  focus: "50% 35%",
};

/** Galerie « ARCHIVES DU SUSPECT ». */
export const ARCHIVES: Photo[] = [
  MAIN_PHOTO,
  {
    id: "P-02",
    src: "/photos/sparrow-masque-nb.jpg",
    webp: "/photos/sparrow-masque-nb.webp",
    alt: "Sparrow portant un masque de chauve-souris, en noir et blanc",
    caption: "Le sujet tente de se fondre dans la population de Gotham. Sans succès.",
    focus: "50% 40%",
    date: "13.12.2025",
  },
  {
    id: "P-03",
    src: "/photos/sparrow-cri.jpg",
    webp: "/photos/sparrow-cri.webp",
    alt: "Sparrow en masque, bouche grande ouverte",
    caption: "Le sujet semble relativement détendu compte tenu de la situation.",
    focus: "50% 30%",
  },
  {
    id: "P-04",
    alt: "Emplacement réservé",
    caption: "Dernière apparition avant la fin du compte à rebours.",
    placeholder: true,
  },
  {
    id: "P-05",
    alt: "Emplacement réservé",
    caption: "Cliché saisi par les services. En cours de développement au labo.",
    placeholder: true,
  },
];
