import { Link } from 'react-router-dom';
import { Wordmark } from '../../components/Wordmark';
import { STATIONS } from '../../stations';

/** LECA CORE — Phase 1 : raccourcis réels uniquement. Aucune IA, aucune commande simulée. */
export function CoreDesk() {
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
        <p className="eyebrow">Assistant central</p>
        <h1 className="desk__title">LECA CORE</h1>
        <p className="desk__tagline">Raccourcis vers les cinq postes.</p>
      </header>
      <main className="desk__main">
        <section className="panel glass notice">
          <p className="badge">Aucune IA externe connectée</p>
          <h2>L’assistant conversationnel arrive en phase 5.</h2>
          <p>
            Pour l’instant, LECA CORE ne répond à aucune question et n’exécute aucune commande : seuls les raccourcis
            ci-dessous fonctionnent. Les commandes guidées (« Créer une campagne… », « Ajouter une dépense… ») seront
            branchées sur les fonctions réellement disponibles, avec confirmation avant toute modification.
          </p>
        </section>
        <section className="panel glass">
          <h2 className="eyebrow">Raccourcis</h2>
          <ul className="shortcuts">
            {STATIONS.map((s) => (
              <li key={s.id}>
                <Link to={s.path} className="shortcut">
                  <span className="shortcut__n">{s.number}</span>
                  <span className="shortcut__name">{s.name}</span>
                  <span className="shortcut__state">{s.status === 'operational' ? 'Disponible' : `Phase ${s.phase}`}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
