"use client";

import { useMemo } from "react";
import { countDays } from "@/lib/calendar";
import { END_MS, type Remaining } from "@/lib/time";

const fr = (n: number) => Math.floor(n).toLocaleString("fr-FR");

/** Rapport d'analyse : chiffres réels (calendrier) + estimations clairement signalées. */
export function Report({ r, t }: { r: Remaining | null; t: number | null }) {
  const dayKey = r ? r.days : -1;
  const cal = useMemo(() => {
    if (t == null) return null;
    return {
      weekends: countDays(t, END_MS, (wd) => wd === 6),
      mondays: countDays(t, END_MS, (wd) => wd === 1),
      christmases: countDays(t, END_MS, (_, m, d) => m === 12 && d === 25),
      fridays13: countDays(t, END_MS, (wd, _, d) => wd === 5 && d === 13),
    };
    // Recalcul une fois par jour suffit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey]);

  const totalSec = r ? Math.ceil(r.ms / 1000) : null;

  const rows: { k: string; v: string; note?: string }[] = [
    { k: "Secondes restantes", v: totalSec == null ? "—" : fr(totalSec) },
    { k: "Réveils restants", v: r ? fr(r.days) : "—" },
    { k: "Lundis à endurer", v: cal ? fr(cal.mondays) : "—" },
    { k: "Week-ends à patienter", v: cal ? fr(cal.weekends) : "—" },
    { k: "Noëls d'ici là", v: cal ? fr(cal.christmases) : "—" },
    { k: "Vendredis 13", v: cal ? fr(cal.fridays13) : "—", note: "superstition non couverte" },
    { k: "Pleines lunes", v: r ? `≈ ${fr(r.ms / 86_400_000 / 29.53)}` : "—", note: "estimation" },
    { k: "Cafés nécessaires", v: r ? `≈ ${fr((r.ms / 86_400_000) * 2)}` : "—", note: "estimation, base 2 / jour" },
    { k: "Heures de sommeil", v: r ? `≈ ${fr((r.ms / 86_400_000) * 7.5)}` : "—", note: "estimation, base 7 h 30" },
  ];

  return (
    <section className="report reveal" aria-labelledby="report-title">
      <header className="section-head">
        <span className="section-head__num mono">03</span>
        <h2 id="report-title" className="section-head__title">Rapport d&apos;analyse</h2>
        <span className="section-head__meta mono">CALCULÉ EN TEMPS RÉEL</span>
      </header>
      <dl className="report__grid">
        {rows.map((row) => (
          <div key={row.k} className="report__cell">
            <dt className="mono">{row.k}</dt>
            <dd>{row.v}</dd>
            {row.note && <small className="mono">{row.note}</small>}
          </div>
        ))}
      </dl>
    </section>
  );
}
