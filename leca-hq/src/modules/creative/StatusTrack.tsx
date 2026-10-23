import { CAMPAIGN_STATUSES, STATUS_LABELS, type CampaignStatus } from './types';

/** Frise éditoriale des 5 statuts (monochrome). Cliquable si onChange est fourni. */
export function StatusTrack({ value, onChange }: { value: CampaignStatus; onChange?: (s: CampaignStatus) => void }) {
  const current = CAMPAIGN_STATUSES.indexOf(value);
  return (
    <ol className="track" aria-label="Statut de la campagne">
      {CAMPAIGN_STATUSES.map((s, i) => {
        const state = i < current ? 'past' : i === current ? 'current' : 'future';
        const inner = (
          <>
            <span className="track__dot" aria-hidden />
            <span className="track__label">{STATUS_LABELS[s]}</span>
          </>
        );
        return (
          <li key={s} className={`track__step track__step--${state}`}>
            {onChange ? (
              <button type="button" onClick={() => onChange(s)} aria-pressed={i === current}>
                {inner}
              </button>
            ) : (
              <span aria-current={i === current ? 'step' : undefined}>{inner}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
