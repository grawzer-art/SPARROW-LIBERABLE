import { Link } from 'react-router-dom';
import { Wordmark } from '../components/Wordmark';
import { STATIONS } from '../stations';
import { HQScene } from './HQScene';

export function HQPage() {
  return (
    <div className="hq-page">
      <header className="hq-top">
        <Wordmark />
        <nav className="hq-top__links" aria-label="Outils">
          <Link to="/settings" className="pill">
            Sauvegardes
          </Link>
        </nav>
      </header>

      <HQScene />

      <p className="hq-hint" aria-hidden>
        Touchez un poste pour y entrer · pincez ou faites glisser pour explorer
      </p>

      <nav className="dock glass" aria-label="Accès rapide aux postes">
        {STATIONS.map((s) => (
          <Link key={s.id} to={s.path} className="dock__item">
            <span className="dock__n">{s.number}</span>
            <span className="dock__name">{s.name.replace('LECA ', '')}</span>
          </Link>
        ))}
        <Link to="/core" className="dock__item dock__item--core">
          <span className="dock__n">◎</span>
          <span className="dock__name">CORE</span>
        </Link>
      </nav>
    </div>
  );
}
