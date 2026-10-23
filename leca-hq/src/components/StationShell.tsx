import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getStation, type StationId } from '../stations';
import { Wordmark } from './Wordmark';

interface Props {
  stationId: StationId;
  children: ReactNode;
  backTo?: string;
  backLabel?: string;
}

export function StationShell({ stationId, children, backTo, backLabel }: Props) {
  const st = getStation(stationId)!;
  return (
    <div className="desk">
      <nav className="desk__nav" aria-label="Navigation du poste">
        <Link to="/" className="backlink">
          <span aria-hidden>←</span> Retour au QG
        </Link>
        {backTo && (
          <Link to={backTo} className="backlink backlink--sub">
            {backLabel ?? 'Retour'}
          </Link>
        )}
        <span className="desk__brand">
          <Wordmark small />
        </span>
      </nav>
      <header className="desk__head">
        <p className="eyebrow">Poste {st.number}</p>
        <h1 className="desk__title">{st.name}</h1>
        <p className="desk__tagline">{st.tagline}</p>
      </header>
      <main className="desk__main">{children}</main>
    </div>
  );
}
