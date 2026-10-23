import { StationShell } from '../../components/StationShell';
import { getStation, type StationId } from '../../stations';

/**
 * Espace de travail d'un poste dont les outils ne sont pas encore développés.
 * Affiche honnêtement ce qui est prévu — aucune fausse donnée, aucun faux bouton.
 */
export function PlannedDesk({ stationId }: { stationId: StationId }) {
  const st = getStation(stationId)!;
  return (
    <StationShell stationId={stationId}>
      <section className="panel glass notice">
        <p className="badge">En développement · Phase {st.phase}</p>
        <h2>Les outils de ce poste ne sont pas encore disponibles.</h2>
        <p>
          Cet espace est en place et accessible depuis le QG, mais aucune fonctionnalité n’est active pour l’instant. Rien
          n’est simulé : les tableaux restent vides tant que la fonctionnalité n’existe pas vraiment.
        </p>
      </section>

      <section className="panel glass">
        <h2 className="eyebrow">Prévu pour la phase {st.phase}</h2>
        <ul className="plain">
          {st.planned.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <section className="panel glass">
        <h2 className="eyebrow">Règles de conception</h2>
        <ul className="plain">
          {st.guardrails.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </section>
    </StationShell>
  );
}
