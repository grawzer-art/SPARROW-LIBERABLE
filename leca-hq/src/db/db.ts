import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { campaignSchema, type AssetRecord, type Campaign } from '../modules/creative/types';
import { z } from 'zod';

/**
 * Persistance locale (IndexedDB) — prototype personnel.
 * ⚠ Les données restent sur CET appareil et CE navigateur : pas de synchronisation,
 * pas de séparation sécurisée entre utilisateurs. Voir docs/ARCHITECTURE.md.
 */
interface LecaDB extends DBSchema {
  campaigns: { key: string; value: Campaign; indexes: { 'by-updated': string } };
  assets: { key: string; value: AssetRecord; indexes: { 'by-campaign': string } };
}

export const DB_NAME = 'leca-hq';
export const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LecaDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<LecaDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LecaDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const campaigns = db.createObjectStore('campaigns', { keyPath: 'id' });
        campaigns.createIndex('by-updated', 'updatedAt');
        const assets = db.createObjectStore('assets', { keyPath: 'id' });
        assets.createIndex('by-campaign', 'campaignId');
      },
    }).catch((e) => {
      dbPromise = null; // permet une nouvelle tentative
      throw e;
    });
  }
  return dbPromise;
}

/** Pour les tests : ferme la connexion et oublie la promesse. */
export async function resetDBConnection(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

/** Demande au navigateur de ne pas purger le stockage (utile sur Safari). Sans effet garanti. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignoré : amélioration optionnelle */
  }
  return false;
}

/* ───────── Campagnes ───────── */

export async function listCampaigns(): Promise<Campaign[]> {
  const db = await getDB();
  const all = await db.getAll('campaigns');
  return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getCampaign(id: string): Promise<Campaign | undefined> {
  return (await getDB()).get('campaigns', id);
}

/** Valide puis enregistre. Lève une ZodError si les données sont invalides. */
export async function saveCampaign(campaign: Campaign): Promise<Campaign> {
  const valid = campaignSchema.parse({ ...campaign, updatedAt: new Date().toISOString() });
  await (await getDB()).put('campaigns', valid);
  return valid;
}

export async function deleteCampaign(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['campaigns', 'assets'], 'readwrite');
  const keys = await tx.objectStore('assets').index('by-campaign').getAllKeys(id);
  await Promise.all(keys.map((k) => tx.objectStore('assets').delete(k)));
  await tx.objectStore('campaigns').delete(id);
  await tx.done;
}

/* ───────── Fichiers du moodboard ───────── */

export async function putAsset(asset: AssetRecord): Promise<void> {
  await (await getDB()).put('assets', asset);
}

export async function getAsset(id: string): Promise<AssetRecord | undefined> {
  return (await getDB()).get('assets', id);
}

export async function deleteAsset(id: string): Promise<void> {
  await (await getDB()).delete('assets', id);
}

export async function listAssets(campaignId: string): Promise<AssetRecord[]> {
  return (await getDB()).getAllFromIndex('assets', 'by-campaign', campaignId);
}

/* ───────── Sauvegarde (export / import) ───────── */

export const BACKUP_FORMAT = 'leca-hq-backup';
export const BACKUP_VERSION = 1;

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  exportedAt: z.string(),
  creative: z.object({
    campaigns: z.array(campaignSchema),
    assets: z.array(
      z.object({
        id: z.string().min(1),
        campaignId: z.string().min(1),
        name: z.string(),
        type: z.string(),
        createdAt: z.string(),
        dataUrl: z.string().startsWith('data:'),
      }),
    ),
  }),
});
export type Backup = z.infer<typeof backupSchema>;

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body = ''] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head ?? '')?.[1] ?? 'application/octet-stream';
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportBackup(): Promise<Backup> {
  const db = await getDB();
  const [campaigns, assets] = await Promise.all([db.getAll('campaigns'), db.getAll('assets')]);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    creative: {
      campaigns,
      assets: await Promise.all(
        assets.map(async (a) => ({
          id: a.id,
          campaignId: a.campaignId,
          name: a.name,
          type: a.type,
          createdAt: a.createdAt,
          dataUrl: await blobToDataUrl(a.blob),
        })),
      ),
    },
  };
}

export interface ImportResult {
  campaigns: number;
  assets: number;
}

/**
 * Importe une sauvegarde. `replace` vide d'abord les données Creative ;
 * sinon fusion (une campagne de même identifiant est écrasée).
 * Le fichier est entièrement validé AVANT toute écriture.
 */
export async function importBackup(raw: unknown, mode: 'merge' | 'replace'): Promise<ImportResult> {
  const backup = backupSchema.parse(raw);
  const db = await getDB();
  const tx = db.transaction(['campaigns', 'assets'], 'readwrite');
  if (mode === 'replace') {
    await Promise.all([tx.objectStore('campaigns').clear(), tx.objectStore('assets').clear()]);
  }
  for (const c of backup.creative.campaigns) await tx.objectStore('campaigns').put(c);
  for (const a of backup.creative.assets) {
    await tx.objectStore('assets').put({
      id: a.id,
      campaignId: a.campaignId,
      name: a.name,
      type: a.type,
      createdAt: a.createdAt,
      blob: dataUrlToBlob(a.dataUrl),
    });
  }
  await tx.done;
  return { campaigns: backup.creative.campaigns.length, assets: backup.creative.assets.length };
}
