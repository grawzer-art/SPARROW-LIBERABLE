import { END_MS, START_MS, TOTAL_DAYS, formatDot } from "@/lib/time";

export function Progress({ progress, notStarted }: { progress: number | null; notStarted: boolean }) {
  const pct = (progress ?? 0) * 100;
  const label = progress == null ? "—" : `${pct.toFixed(4).replace(".", ",")} %`;
  return (
    <section className="progress reveal" style={{ ["--d" as string]: "0.6s" }} aria-label="Progression du dossier">
      <div className="progress__top mono">
        <span>TEMPS ÉCOULÉ</span>
        <span className="progress__pct">{label}</span>
      </div>
      <div
        className="progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 100) / 100}
        aria-valuetext={label}
      >
        <div className="progress__fill" style={{ transform: `scaleX(${progress ?? 0})` }} />
        <div className="progress__head" style={{ left: `${pct}%` }} />
        <div className="progress__ticks" aria-hidden="true">
          {Array.from({ length: 21 }, (_, i) => (
            <i key={i} className={i % 5 === 0 ? "major" : ""} />
          ))}
        </div>
      </div>
      <div className="progress__years mono" aria-hidden="true">
        {[2026, 2027, 2028, 2029, 2030, 2031].map((y) => (
          <span key={y}>{y}</span>
        ))}
      </div>
      <dl className="progress__dates mono">
        <div>
          <dt>DATE D&apos;OUVERTURE</dt>
          <dd>{formatDot(START_MS)}</dd>
        </div>
        <div>
          <dt>DURÉE</dt>
          <dd>{TOTAL_DAYS.toLocaleString("fr-FR")} J</dd>
        </div>
        <div>
          <dt>DATE CIBLE</dt>
          <dd className="red">{formatDot(END_MS)}</dd>
        </div>
      </dl>
      {notStarted && <p className="progress__note mono">Le compteur n&apos;a pas encore officiellement démarré.</p>}
    </section>
  );
}
