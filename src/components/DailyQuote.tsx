"use client";

import { QUOTES } from "@/data/quotes";
import { parisDayIndex, parisTomorrow } from "@/lib/calendar";
import { pad, zonedToUtc } from "@/lib/time";

/** Une citation du Chevalier Noir par jour, renouvelée à minuit (Paris). */
export function DailyQuote({ t }: { t: number | null }) {
  const day = t == null ? 0 : parisDayIndex(t);
  const idx = ((day % QUOTES.length) + QUOTES.length) % QUOTES.length;
  const q = QUOTES[idx];

  let next = "--:--:--";
  if (t != null) {
    const s = Math.max(0, Math.ceil((zonedToUtc(parisTomorrow(t), "00:00") - t) / 1000));
    next = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }

  return (
    <section className="quote reveal" aria-labelledby="quote-title">
      <header className="section-head">
        <span className="section-head__num mono">03</span>
        <h2 id="quote-title" className="section-head__title">Citation du jour</h2>
        <span className="section-head__meta mono">PIÈCE Q-{pad(idx + 1, 3)}</span>
      </header>

      <figure className="quote__card" key={idx}>
        <BatSignal />
        <blockquote className="quote__text">
          <p>« {q.fr} »</p>
        </blockquote>
        <figcaption className="quote__src mono">
          <span className="red">— {q.who}</span>
          <span>{q.source}</span>
        </figcaption>
        <p className="quote__en mono" lang="en">
          VO : “{q.en}” <span className="steel">· traduction libre</span>
        </p>
        <p className="quote__note mono">
          <b>NOTE DU MINISTÈRE :</b> {q.note}
        </p>
      </figure>

      <p className="quote__next mono" suppressHydrationWarning>
        PROCHAINE CITATION DANS <b>{next}</b>
      </p>
    </section>
  );
}

/** Projecteur et silhouette de chauve-souris générique. */
function BatSignal() {
  return (
    <svg className="quote__signal" viewBox="0 0 120 80" aria-hidden="true">
      <ellipse cx="60" cy="40" rx="56" ry="36" className="quote__beam" />
      <path
        className="quote__bat"
        d="M60 27c-1.5 0-2.6-2.4-3.4-4.6-.6 1.7-1 3.4-1.1 5.1-7.4-.4-13.6-3.6-17.4-8.4 1 3.6.6 7.2-1.9 9.4-3.2-2.6-8-2.9-12.1-.6 4.4 1.8 7.7 6.4 8.3 11.6 2.7-2.3 6.9-2.6 10.1-.6.8-4 4.7-6.4 9-5.4 2 1 3.6 3.4 4.5 6.1 1.1 1.8 2.4 3.6 4 5 1.6-1.4 2.9-3.2 4-5 .9-2.7 2.5-5.1 4.5-6.1 4.3-1 8.2 1.4 9 5.4 3.2-2 7.4-1.7 10.1.6.6-5.2 3.9-9.8 8.3-11.6-4.1-2.3-8.9-2-12.1.6-2.5-2.2-2.9-5.8-1.9-9.4-3.8 4.8-10 8-17.4 8.4-.1-1.7-.5-3.4-1.1-5.1-.8 2.2-1.9 4.6-3.4 4.6z"
      />
    </svg>
  );
}
