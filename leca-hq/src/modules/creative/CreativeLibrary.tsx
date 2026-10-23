import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { saveCampaign } from '../../db/db';
import { useToast } from '../../lib/toast';
import { StationShell } from '../../components/StationShell';
import { StatusTrack } from './StatusTrack';
import { useCampaigns } from './useCampaigns';
import {
  CAMPAIGN_STATUSES,
  STATUS_LABELS,
  SUBJECT_LABELS,
  createCampaign,
  shotProgress,
  type Campaign,
  type CampaignStatus,
} from './types';

export function CreativeLibrary() {
  const { campaigns, error, reload } = useCampaigns();
  const [filter, setFilter] = useState<CampaignStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { notify } = useToast();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (campaigns ?? []).filter(
      (c) =>
        (filter === 'all' || c.status === filter) &&
        (!q || `${c.name} ${c.objective} ${c.subjectLabel}`.toLowerCase().includes(q)),
    );
  }, [campaigns, filter, query]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) return notify('Donne un nom à la campagne.', 'error');
    setBusy(true);
    try {
      const saved = await saveCampaign(createCampaign({ name: trimmed }));
      notify('Campagne créée et enregistrée.', 'success');
      navigate(`/creative/${saved.id}`);
    } catch {
      notify('Enregistrement impossible : le stockage local est indisponible.', 'error');
      setBusy(false);
    }
  }

  return (
    <StationShell stationId="creative">
      <section className="panel glass">
        <h2 className="eyebrow">Nouvelle campagne</h2>
        <form className="inline-form" onSubmit={create}>
          <label className="sr-only" htmlFor="new-name">
            Nom de la campagne
          </label>
          <input
            id="new-name"
            className="input"
            placeholder="Ex. Lancement ProBond"
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
          <button className="btn btn--primary" disabled={busy}>
            Créer
          </button>
        </form>
        <p className="hint">Tu pourras ensuite définir l’objectif, le brief, le moodboard et le plan de tournage.</p>
      </section>

      <section className="library">
        <div className="library__bar">
          <h2 className="eyebrow">Bibliothèque de campagnes</h2>
          <div className="library__tools">
            <label className="sr-only" htmlFor="q">
              Rechercher
            </label>
            <input
              id="q"
              className="input input--sm"
              type="search"
              placeholder="Rechercher"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="sr-only" htmlFor="f">
              Filtrer par statut
            </label>
            <select id="f" className="input input--sm" value={filter} onChange={(e) => setFilter(e.target.value as CampaignStatus | 'all')}>
              <option value="all">Tous les statuts</option>
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="state state--error" role="alert">
            <p>Impossible de lire le stockage local ({error}).</p>
            <button className="btn btn--ghost" onClick={() => void reload()}>
              Réessayer
            </button>
          </div>
        ) : campaigns === null ? (
          <div className="state" aria-busy>
            <p>Chargement de la bibliothèque…</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="state state--empty">
            <div className="state__mark" aria-hidden />
            <h3>Aucune campagne pour l’instant</h3>
            <p>Crée la première ci-dessus. Elle sera enregistrée sur cet appareil et retrouvée à chaque ouverture.</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="state state--empty">
            <h3>Aucun résultat</h3>
            <p>Aucune campagne ne correspond à cette recherche.</p>
          </div>
        ) : (
          <ul className="cards">
            {visible.map((c) => (
              <CampaignCard key={c.id} c={c} />
            ))}
          </ul>
        )}
      </section>
    </StationShell>
  );
}

function CampaignCard({ c }: { c: Campaign }) {
  const progress = shotProgress(c);
  return (
    <li>
      <Link to={`/creative/${c.id}`} className="card glass">
        <span className="card__status">{STATUS_LABELS[c.status]}</span>
        <h3 className="card__title">{c.name}</h3>
        <p className="card__meta">
          {c.subjectKind !== 'none' && c.subjectLabel
            ? `${SUBJECT_LABELS[c.subjectKind]} · ${c.subjectLabel}`
            : 'Aucun produit ou prestation associé'}
        </p>
        {c.objective && <p className="card__text">{c.objective}</p>}
        <StatusTrack value={c.status} />
        <div className="card__foot">
          <span>
            {c.shots.length} plan{c.shots.length > 1 ? 's' : ''} · {c.moodboard.length} référence
            {c.moodboard.length > 1 ? 's' : ''}
          </span>
          {progress !== null && <span>{Math.round(progress * 100)} % tourné</span>}
        </div>
      </Link>
    </li>
  );
}
