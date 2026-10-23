export type StationId = 'creative' | 'social' | 'finance' | 'shop' | 'booking';

export interface Station {
  id: StationId;
  number: string;
  name: string;
  tagline: string;
  path: string;
  /** Opérationnel = au moins un outil réel utilisable dans cette version. */
  status: 'operational' | 'planned';
  /** Phase de la feuille de route où le poste est livré. */
  phase: number;
  planned: string[];
  guardrails: string[];
}

export const STATIONS: Station[] = [
  {
    id: 'creative',
    number: '01',
    name: 'LECA CREATIVE',
    tagline: 'Direction artistique, campagnes, moodboards.',
    path: '/creative',
    status: 'operational',
    phase: 1,
    planned: [
      'Campagnes : nom, objectif, produit ou prestation, brief',
      'Moodboard à partir de fichiers importés',
      'Idées de shootings et liste de plans',
      'Statuts et avancement',
    ],
    guardrails: ['Aucune génération d’images ou de vidéos par IA.'],
  },
  {
    id: 'social',
    number: '02',
    name: 'LECA SOCIAL',
    tagline: 'Calendrier éditorial et contenus.',
    path: '/social',
    status: 'planned',
    phase: 2,
    planned: [
      'Calendrier éditorial',
      'Publications Instagram / TikTok : Reels, stories, carrousels, posts',
      'Scripts, hooks, légendes, hashtags',
      'Checklists de tournage',
      'Lien avec un produit LECA et une campagne Creative',
      'Statuts : Idée → Script prêt → À tourner → À monter → À valider → Prêt à publier → Publié',
    ],
    guardrails: ['Aucune publication automatique : elle exigerait une intégration autorisée.'],
  },
  {
    id: 'finance',
    number: '03',
    name: 'LECA FINANCE',
    tagline: 'Recettes, dépenses, suivi mensuel.',
    path: '/finance',
    status: 'planned',
    phase: 3,
    planned: [
      'Recettes et dépenses : catégorie, date, note',
      'Activités distinctes : LECA LASH, NAILS, LECA SHOP',
      'Chiffre d’affaires, dépenses, résultat de suivi',
      'Évolution mensuelle et export CSV',
    ],
    guardrails: [
      'Recettes séparées par activité.',
      'Le solde recettes − dépenses est un résultat de suivi, jamais un bénéfice comptable net.',
      'Aucune donnée financière n’est inventée.',
    ],
  },
  {
    id: 'shop',
    number: '04',
    name: 'LECA SHOP',
    tagline: 'Catalogue, stocks, réapprovisionnement.',
    path: '/shop',
    status: 'planned',
    phase: 3,
    planned: [
      'Catalogue, fiches produits, SKU, prix, stocks, seuils d’alerte',
      'Fournisseurs et liste de réapprovisionnement',
      'Suivi des commandes importées',
      'Import et export CSV',
      'Architecture prête pour une future connexion Shopify officielle',
    ],
    guardrails: [
      'Aucune clé Shopify utilisée sans autorisation.',
      'Aucune synchronisation simulée : données locales, importées ou synchronisées clairement distinguées.',
    ],
  },
  {
    id: 'booking',
    number: '05',
    name: 'LECA BOOKING',
    tagline: 'Rendez-vous et fiches clientes.',
    path: '/booking',
    status: 'planned',
    phase: 4,
    planned: [
      'Agenda jour / semaine / mois',
      'Création, modification, annulation de rendez-vous',
      'Durées des prestations et détection des conflits',
      'Fiches clientes, historique, notes professionnelles',
      'Deux agendas distincts : Léa (extensions de cils) et sa collègue (ongles)',
    ],
    guardrails: [
      'Les prestations d’ongles ne sont jamais attribuées à Léa.',
      'Clientes et finances des deux activités ne sont pas mélangées.',
      'Aucun SMS ni e-mail envoyé automatiquement.',
    ],
  },
];

export const getStation = (id: string): Station | undefined => STATIONS.find((s) => s.id === id);
