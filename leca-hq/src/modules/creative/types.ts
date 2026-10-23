import { z } from 'zod';

export const CAMPAIGN_STATUSES = ['idea', 'preparing', 'production', 'review', 'done'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const STATUS_LABELS: Record<CampaignStatus, string> = {
  idea: 'Idée',
  preparing: 'En préparation',
  production: 'En production',
  review: 'À valider',
  done: 'Terminé',
};

export const SUBJECT_KINDS = ['product', 'service', 'none'] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

export const SUBJECT_LABELS: Record<SubjectKind, string> = {
  product: 'Produit',
  service: 'Prestation',
  none: 'Aucun',
};

const id = z.string().min(1);
const isoDate = z.string().min(1);

export const ideaSchema = z.object({ id, text: z.string().trim().min(1).max(600) });
export const shotSchema = z.object({ id, text: z.string().trim().min(1).max(300), done: z.boolean() });
export const moodItemSchema = z.object({ assetId: id, caption: z.string().max(200) });

export const campaignSchema = z.object({
  id,
  name: z.string().trim().min(1, 'Donne un nom à la campagne.').max(120),
  objective: z.string().max(600),
  subjectKind: z.enum(SUBJECT_KINDS),
  subjectLabel: z.string().max(160),
  brief: z.string().max(8000),
  status: z.enum(CAMPAIGN_STATUSES),
  ideas: z.array(ideaSchema),
  shots: z.array(shotSchema),
  moodboard: z.array(moodItemSchema),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export type Campaign = z.infer<typeof campaignSchema>;
export type Idea = z.infer<typeof ideaSchema>;
export type Shot = z.infer<typeof shotSchema>;
export type MoodItem = z.infer<typeof moodItemSchema>;

/** Fichier image stocké localement (le Blob reste dans IndexedDB). */
export interface AssetRecord {
  id: string;
  campaignId: string;
  name: string;
  type: string;
  blob: Blob;
  createdAt: string;
}

export const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function createCampaign(input: Partial<Campaign> & { name: string }): Campaign {
  const now = new Date().toISOString();
  return campaignSchema.parse({
    id: newId(),
    objective: '',
    subjectKind: 'none',
    subjectLabel: '',
    brief: '',
    status: 'idea',
    ideas: [],
    shots: [],
    moodboard: [],
    createdAt: now,
    updatedAt: now,
    ...input,
  });
}

/** Avancement du plan de tournage (0–1), ou null s'il n'y a aucun plan. */
export function shotProgress(c: Pick<Campaign, 'shots'>): number | null {
  if (c.shots.length === 0) return null;
  return c.shots.filter((s) => s.done).length / c.shots.length;
}
