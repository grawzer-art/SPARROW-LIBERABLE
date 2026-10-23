import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteCampaign, exportBackup, getAsset, getCampaign, getDB, importBackup,
  listAssets, listCampaigns, putAsset, resetDBConnection, saveCampaign,
} from '../src/db/db';
import { campaignSchema, createCampaign, shotProgress } from '../src/modules/creative/types';

async function wipe() {
  const db = await getDB();
  await db.clear('campaigns');
  await db.clear('assets');
}
beforeEach(wipe);

describe('modèle Campagne', () => {
  it('crée une campagne valide avec statut « idea » par défaut', () => {
    const c = createCampaign({ name: '  ProBond ' });
    expect(c.name).toBe('ProBond');
    expect(c.status).toBe('idea');
    expect(c.shots).toEqual([]);
  });
  it('refuse un nom vide ou un statut inconnu', () => {
    expect(() => createCampaign({ name: '   ' })).toThrow();
    const c = createCampaign({ name: 'A' });
    expect(campaignSchema.safeParse({ ...c, status: 'publie' }).success).toBe(false);
  });
  it('calcule l’avancement du plan de tournage', () => {
    const c = createCampaign({ name: 'A' });
    expect(shotProgress(c)).toBeNull();
    const withShots = { ...c, shots: [{ id: '1', text: 'a', done: true }, { id: '2', text: 'b', done: false }] };
    expect(shotProgress(withShots)).toBe(0.5);
  });
});

describe('persistance IndexedDB', () => {
  it('enregistre, relit (après fermeture de la connexion) et supprime une campagne', async () => {
    const c = createCampaign({ name: 'Lancement ProBond', objective: 'Faire connaître', status: 'preparing' });
    await saveCampaign(c);
    await resetDBConnection(); // simule un rechargement de page
    const back = await getCampaign(c.id);
    expect(back?.name).toBe('Lancement ProBond');
    expect(back?.status).toBe('preparing');
    expect((await listCampaigns()).map((x) => x.id)).toEqual([c.id]);
    await deleteCampaign(c.id);
    expect(await getCampaign(c.id)).toBeUndefined();
  });
  it('refuse d’enregistrer des données invalides', async () => {
    const c = createCampaign({ name: 'A' });
    await expect(saveCampaign({ ...c, name: '' })).rejects.toThrow();
    expect(await listCampaigns()).toHaveLength(0);
  });
  it('supprime les images avec la campagne', async () => {
    const c = createCampaign({ name: 'A' });
    await saveCampaign(c);
    await putAsset({ id: 'a1', campaignId: c.id, name: 'x.png', type: 'image/png', blob: new Blob(['x'], { type: 'image/png' }), createdAt: new Date().toISOString() });
    expect(await listAssets(c.id)).toHaveLength(1);
    await deleteCampaign(c.id);
    expect(await getAsset('a1')).toBeUndefined();
  });
});

describe('sauvegarde', () => {
  it('exporte puis réimporte (remplacement) sans perte, images comprises', async () => {
    const c = createCampaign({ name: 'Export', moodboard: [{ assetId: 'img1', caption: 'ref' }] });
    await saveCampaign(c);
    await putAsset({ id: 'img1', campaignId: c.id, name: 'r.png', type: 'image/png', blob: new Blob(['hello'], { type: 'image/png' }), createdAt: new Date().toISOString() });
    const backup = JSON.parse(JSON.stringify(await exportBackup()));
    await wipe();
    const r = await importBackup(backup, 'replace');
    expect(r).toEqual({ campaigns: 1, assets: 1 });
    const asset = await getAsset('img1');
    expect(asset?.type).toBe('image/png');
    expect(asset?.blob.size).toBe(5);
    expect((await getCampaign(c.id))?.moodboard[0]?.caption).toBe('ref');
  });
  it('rejette un fichier invalide sans rien modifier', async () => {
    const keep = createCampaign({ name: 'Garde-moi' });
    await saveCampaign(keep);
    await expect(importBackup({ format: 'autre' }, 'replace')).rejects.toThrow();
    expect(await listCampaigns()).toHaveLength(1);
  });
});
