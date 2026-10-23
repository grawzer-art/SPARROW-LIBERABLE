import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteAsset, getCampaign, putAsset, saveCampaign, deleteCampaign } from '../../db/db';
import { useConfirm } from '../../lib/confirm';
import { shrinkImage } from '../../lib/image';
import { useToast } from '../../lib/toast';
import { StationShell } from '../../components/StationShell';
import { AssetImage } from './AssetImage';
import { StatusTrack } from './StatusTrack';
import {
  SUBJECT_KINDS,
  SUBJECT_LABELS,
  newId,
  shotProgress,
  type Campaign,
  type SubjectKind,
} from './types';

type Load = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error'; message: string } | { kind: 'ready' };
type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'invalid';

const SAVE_LABEL: Record<SaveState, string> = {
  saved: 'Enregistré sur cet appareil',
  dirty: 'Modifications en cours…',
  saving: 'Enregistrement…',
  error: 'Échec de l’enregistrement',
  invalid: 'Nom requis pour enregistrer',
};

export function CampaignEditor() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const confirm = useConfirm();

  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [c, setC] = useState<Campaign | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [newIdea, setNewIdea] = useState('');
  const [newShot, setNewShot] = useState('');
  const [importing, setImporting] = useState(false);

  const latest = useRef<Campaign | null>(null);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const deleted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoad({ kind: 'loading' });
    getCampaign(id)
      .then((found) => {
        if (cancelled) return;
        if (!found) return setLoad({ kind: 'missing' });
        latest.current = found;
        setC(found);
        setLoad({ kind: 'ready' });
      })
      .catch((e) => !cancelled && setLoad({ kind: 'error', message: e instanceof Error ? e.message : 'Erreur inconnue' }));
    return () => {
      cancelled = true;
    };
  }, [id]);

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current);
    const current = latest.current;
    if (!current || !dirty.current || deleted.current) return;
    if (!current.name.trim()) return setSaveState('invalid');
    setSaveState('saving');
    try {
      const saved = await saveCampaign(current);
      // ne pas écraser des frappes survenues pendant l'écriture
      if (latest.current === current) {
        dirty.current = false;
        setSaveState('saved');
      } else {
        latest.current = { ...latest.current!, updatedAt: saved.updatedAt };
      }
    } catch {
      setSaveState('error');
    }
  }, []);

  const update = useCallback(
    (patch: Partial<Campaign> | ((prev: Campaign) => Partial<Campaign>)) => {
      const prev = latest.current;
      if (!prev) return;
      const next = { ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) };
      latest.current = next;
      dirty.current = true;
      setC(next);
      setSaveState('dirty');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 500);
    },
    [flush],
  );

  // Enregistre quand l'onglet est masqué (iOS peut suspendre la page) et au démontage.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      void flush();
    };
  }, [flush]);

  /* ── Idées ── */
  const addIdea = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newIdea.trim();
    if (!text) return;
    update((p) => ({ ideas: [...p.ideas, { id: newId(), text }] }));
    setNewIdea('');
  };
  /* ── Plans ── */
  const addShot = (e: React.FormEvent) => {
    e.preventDefault();
    const text = newShot.trim();
    if (!text) return;
    update((p) => ({ shots: [...p.shots, { id: newId(), text, done: false }] }));
    setNewShot('');
  };

  /* ── Moodboard ── */
  async function importFiles(files: FileList | null) {
    const current = latest.current;
    if (!files?.length || !current) return;
    setImporting(true);
    let added = 0;
    const skipped: string[] = [];
    try {
      const items: Campaign['moodboard'] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          skipped.push(file.name);
          continue;
        }
        const blob = await shrinkImage(file);
        const assetId = newId();
        await putAsset({
          id: assetId,
          campaignId: current.id,
          name: file.name,
          type: blob.type || file.type,
          blob,
          createdAt: new Date().toISOString(),
        });
        items.push({ assetId, caption: '' });
        added++;
      }
      if (items.length) {
        update((p) => ({ moodboard: [...p.moodboard, ...items] }));
        await flush();
      }
      if (added) notify(`${added} référence${added > 1 ? 's' : ''} ajoutée${added > 1 ? 's' : ''}.`, 'success');
      if (skipped.length) notify(`Ignoré (pas une image) : ${skipped.join(', ')}`, 'error');
    } catch {
      notify('Import impossible : stockage local plein ou indisponible.', 'error');
    } finally {
      setImporting(false);
    }
  }

  const moveMood = (index: number, dir: -1 | 1) =>
    update((p) => {
      const to = index + dir;
      if (to < 0 || to >= p.moodboard.length) return {};
      const list = [...p.moodboard];
      [list[index], list[to]] = [list[to]!, list[index]!];
      return { moodboard: list };
    });

  async function removeMood(index: number) {
    const item = latest.current?.moodboard[index];
    if (!item) return;
    if (!(await confirm({ title: 'Retirer cette référence ?', message: 'L’image sera supprimée de cet appareil.', confirmLabel: 'Retirer', danger: true })))
      return;
    update((p) => ({ moodboard: p.moodboard.filter((m) => m.assetId !== item.assetId) }));
    await deleteAsset(item.assetId).catch(() => {});
    await flush();
  }

  async function removeCampaign() {
    if (!c) return;
    const ok = await confirm({
      title: `Supprimer « ${c.name || 'cette campagne'} » ?`,
      message: 'La campagne, son brief, ses plans et ses images seront définitivement supprimés de cet appareil.',
      confirmLabel: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      deleted.current = true;
      window.clearTimeout(timer.current);
      await deleteCampaign(c.id);
      notify('Campagne supprimée.', 'success');
      navigate('/creative');
    } catch {
      deleted.current = false;
      notify('Suppression impossible.', 'error');
    }
  }

  if (load.kind !== 'ready' || !c) {
    return (
      <StationShell stationId="creative" backTo="/creative" backLabel="Bibliothèque">
        {load.kind === 'loading' && (
          <div className="state" aria-busy>
            <p>Chargement de la campagne…</p>
          </div>
        )}
        {load.kind === 'missing' && (
          <div className="state state--empty">
            <h3>Campagne introuvable</h3>
            <p>Elle a peut-être été supprimée, ou elle vit sur un autre appareil.</p>
            <Link to="/creative" className="btn btn--primary">
              Retour à la bibliothèque
            </Link>
          </div>
        )}
        {load.kind === 'error' && (
          <div className="state state--error" role="alert">
            <p>Lecture impossible ({load.message}).</p>
          </div>
        )}
      </StationShell>
    );
  }

  const progress = shotProgress(c);
  const doneCount = c.shots.filter((s) => s.done).length;

  return (
    <StationShell stationId="creative" backTo="/creative" backLabel="Bibliothèque">
      <div className="editor">
        <header className="editor__head">
          <label className="sr-only" htmlFor="c-name">
            Nom de la campagne
          </label>
          <input
            id="c-name"
            className="editor__title"
            value={c.name}
            maxLength={120}
            placeholder="Nom de la campagne"
            onChange={(e) => update({ name: e.target.value })}
            aria-invalid={!c.name.trim()}
          />
          <p className={`savestate savestate--${saveState}`} role="status">
            <span aria-hidden className="savestate__dot" />
            {SAVE_LABEL[saveState]}
            {saveState === 'error' && (
              <button className="linklike" onClick={() => void flush()}>
                Réessayer
              </button>
            )}
          </p>
        </header>

        <section className="panel glass">
          <h2 className="eyebrow">Statut</h2>
          <StatusTrack value={c.status} onChange={(status) => update({ status })} />
        </section>

        <section className="panel glass grid-2">
          <div className="field">
            <label htmlFor="c-obj">Objectif</label>
            <textarea
              id="c-obj"
              className="input"
              rows={3}
              maxLength={600}
              placeholder="Ex. Faire connaître la nouvelle colle auprès des professionnelles."
              value={c.objective}
              onChange={(e) => update({ objective: e.target.value })}
            />
          </div>
          <div className="field">
            <span id="subj-label">Produit ou prestation</span>
            <div className="seg" role="radiogroup" aria-labelledby="subj-label">
              {SUBJECT_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={c.subjectKind === k}
                  className={c.subjectKind === k ? 'seg__btn is-on' : 'seg__btn'}
                  onClick={() => update({ subjectKind: k as SubjectKind, ...(k === 'none' ? { subjectLabel: '' } : {}) })}
                >
                  {SUBJECT_LABELS[k]}
                </button>
              ))}
            </div>
            {c.subjectKind !== 'none' && (
              <>
                <label className="sr-only" htmlFor="c-subj">
                  Nom du {c.subjectKind === 'product' ? 'produit' : 'prestation'}
                </label>
                <input
                  id="c-subj"
                  className="input"
                  maxLength={160}
                  placeholder={c.subjectKind === 'product' ? 'Ex. Bonder ProBond' : 'Ex. Extensions volume russe'}
                  value={c.subjectLabel}
                  onChange={(e) => update({ subjectLabel: e.target.value })}
                />
              </>
            )}
            <p className="hint">Texte libre : le catalogue LECA SHOP sera relié en Phase 3.</p>
          </div>
        </section>

        <section className="panel glass">
          <div className="field">
            <label htmlFor="c-brief" className="eyebrow">
              Brief créatif
            </label>
            <textarea
              id="c-brief"
              className="input input--brief"
              rows={9}
              maxLength={8000}
              placeholder="Intention, ambiance, public, messages clés, contraintes…"
              value={c.brief}
              onChange={(e) => update({ brief: e.target.value })}
            />
          </div>
        </section>

        <section className="panel glass">
          <div className="panel__head">
            <h2 className="eyebrow">Moodboard</h2>
            <label className={`btn btn--ghost${importing ? ' is-disabled' : ''}`}>
              {importing ? 'Import…' : 'Importer des images'}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                disabled={importing}
                onChange={(e) => {
                  void importFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          {c.moodboard.length === 0 ? (
            <div className="state state--empty state--inline">
              <p>Aucune référence. Importe des photos depuis ton appareil ; elles restent stockées localement.</p>
            </div>
          ) : (
            <ul className="mood">
              {c.moodboard.map((m, i) => (
                <li key={m.assetId} className="mood__item">
                  <AssetImage assetId={m.assetId} alt={m.caption || `Référence ${i + 1}`} />
                  <input
                    className="input input--sm"
                    aria-label={`Légende de la référence ${i + 1}`}
                    placeholder="Légende"
                    maxLength={200}
                    value={m.caption}
                    onChange={(e) =>
                      update((p) => ({
                        moodboard: p.moodboard.map((x) => (x.assetId === m.assetId ? { ...x, caption: e.target.value } : x)),
                      }))
                    }
                  />
                  <div className="mood__actions">
                    <button className="iconbtn" aria-label="Déplacer avant" disabled={i === 0} onClick={() => moveMood(i, -1)}>
                      ←
                    </button>
                    <button
                      className="iconbtn"
                      aria-label="Déplacer après"
                      disabled={i === c.moodboard.length - 1}
                      onClick={() => moveMood(i, 1)}
                    >
                      →
                    </button>
                    <button className="iconbtn" aria-label="Retirer" onClick={() => void removeMood(i)}>
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel glass grid-2">
          <div>
            <h2 className="eyebrow">Idées de shootings</h2>
            <form className="inline-form" onSubmit={addIdea}>
              <label className="sr-only" htmlFor="idea">
                Nouvelle idée
              </label>
              <input id="idea" className="input" placeholder="Une idée de shooting" value={newIdea} maxLength={600} onChange={(e) => setNewIdea(e.target.value)} />
              <button className="btn btn--ghost">Ajouter</button>
            </form>
            {c.ideas.length === 0 ? (
              <p className="hint">Aucune idée pour l’instant.</p>
            ) : (
              <ul className="list">
                {c.ideas.map((idea) => (
                  <li key={idea.id}>
                    <span>{idea.text}</span>
                    <button className="iconbtn" aria-label={`Supprimer l’idée : ${idea.text}`} onClick={() => update((p) => ({ ideas: p.ideas.filter((x) => x.id !== idea.id) }))}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="eyebrow">Plan de tournage</h2>
            <form className="inline-form" onSubmit={addShot}>
              <label className="sr-only" htmlFor="shot">
                Nouveau plan
              </label>
              <input id="shot" className="input" placeholder="Un plan à réaliser" value={newShot} maxLength={300} onChange={(e) => setNewShot(e.target.value)} />
              <button className="btn btn--ghost">Ajouter</button>
            </form>
            {progress !== null && (
              <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Avancement du tournage">
                <div className="progress__bar" style={{ width: `${progress * 100}%` }} />
                <span className="progress__txt">
                  {doneCount}/{c.shots.length} plans réalisés
                </span>
              </div>
            )}
            {c.shots.length === 0 ? (
              <p className="hint">Aucun plan défini.</p>
            ) : (
              <ul className="list">
                {c.shots.map((s) => (
                  <li key={s.id}>
                    <label className="check">
                      <input type="checkbox" checked={s.done} onChange={() => update((p) => ({ shots: p.shots.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) }))} />
                      <span className={s.done ? 'is-done' : ''}>{s.text}</span>
                    </label>
                    <button className="iconbtn" aria-label={`Supprimer le plan : ${s.text}`} onClick={() => update((p) => ({ shots: p.shots.filter((x) => x.id !== s.id) }))}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <footer className="editor__foot">
          <button className="btn btn--danger-ghost" onClick={() => void removeCampaign()}>
            Supprimer la campagne
          </button>
          <p className="hint">
            Créée le {new Date(c.createdAt).toLocaleDateString('fr-FR')} · modifiée le {new Date(c.updatedAt).toLocaleDateString('fr-FR')}
          </p>
        </footer>
      </div>
    </StationShell>
  );
}
