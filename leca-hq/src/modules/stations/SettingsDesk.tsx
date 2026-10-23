import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Wordmark } from '../../components/Wordmark';
import { exportBackup, importBackup, requestPersistence } from '../../db/db';
import { useConfirm } from '../../lib/confirm';
import { useToast } from '../../lib/toast';

/** Sauvegardes locales : seul moyen de déplacer ou protéger les données de ce prototype. */
export function SettingsDesk() {
  const { notify } = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);

  async function doExport() {
    setBusy(true);
    try {
      const backup = await exportBackup();
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leca-hq-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      notify(`Sauvegarde exportée (${backup.creative.campaigns.length} campagne(s)).`, 'success');
      void requestPersistence();
    } catch {
      notify('Export impossible.', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function doImport(file: File | undefined) {
    if (!file) return;
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return notify('Ce fichier n’est pas une sauvegarde LECA HQ valide.', 'error');
    }
    if (
      mode === 'replace' &&
      !(await confirm({
        title: 'Remplacer toutes les données ?',
        message: 'Les campagnes actuelles de cet appareil seront supprimées avant l’import.',
        confirmLabel: 'Remplacer',
        danger: true,
      }))
    )
      return;
    setBusy(true);
    try {
      const r = await importBackup(raw, mode);
      notify(`Import terminé : ${r.campaigns} campagne(s), ${r.assets} image(s).`, 'success');
    } catch {
      notify('Sauvegarde invalide ou incompatible : rien n’a été modifié.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="desk">
      <nav className="desk__nav" aria-label="Navigation">
        <Link to="/" className="backlink">
          <span aria-hidden>←</span> Retour au QG
        </Link>
        <span className="desk__brand">
          <Wordmark small />
        </span>
      </nav>
      <header className="desk__head">
        <p className="eyebrow">Données</p>
        <h1 className="desk__title">Sauvegardes</h1>
        <p className="desk__tagline">Exporter et importer les données de cet appareil.</p>
      </header>
      <main className="desk__main">
        <section className="panel glass notice">
          <p className="badge">Stockage local uniquement</p>
          <h2>Tes données vivent sur cet appareil.</h2>
          <p>
            Elles ne sont ni synchronisées entre appareils, ni protégées par un compte. Vider les données du navigateur
            peut les effacer : exporte régulièrement une sauvegarde. Avant d’y mettre des fiches clientes ou des données
            financières réelles, ou de les partager entre plusieurs personnes, il faudra une solution d’authentification et
            de contrôle d’accès — pas encore en place.
          </p>
        </section>
        <section className="panel glass">
          <h2 className="eyebrow">Exporter</h2>
          <p>Un fichier JSON contenant les campagnes Creative et leurs images.</p>
          <button className="btn btn--primary" disabled={busy} onClick={() => void doExport()}>
            Télécharger la sauvegarde
          </button>
        </section>
        <section className="panel glass">
          <h2 className="eyebrow">Importer</h2>
          <div className="seg" role="radiogroup" aria-label="Mode d’import">
            <button type="button" role="radio" aria-checked={mode === 'merge'} className={mode === 'merge' ? 'seg__btn is-on' : 'seg__btn'} onClick={() => setMode('merge')}>
              Fusionner
            </button>
            <button type="button" role="radio" aria-checked={mode === 'replace'} className={mode === 'replace' ? 'seg__btn is-on' : 'seg__btn'} onClick={() => setMode('replace')}>
              Remplacer
            </button>
          </div>
          <p className="hint">
            {mode === 'merge' ? 'Ajoute les campagnes du fichier ; une campagne de même identifiant est mise à jour.' : 'Supprime d’abord les campagnes actuelles.'}
          </p>
          <button className="btn btn--ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
            Choisir un fichier…
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { void doImport(e.target.files?.[0]); e.target.value = ''; }} />
        </section>
      </main>
    </div>
  );
}
