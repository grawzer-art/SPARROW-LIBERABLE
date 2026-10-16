"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { ARCHIVES } from "@/data/photos";
import { CASE_NUMBER } from "@/config";
import { PhotoImg } from "./PhotoImg";
import { pad } from "@/lib/time";

/** Galerie « ARCHIVES DU SUSPECT » : défilement tactile avec aimantation. */
function ArchivesImpl() {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { root: el, threshold: 0.6 },
    );
    el.querySelectorAll<HTMLElement>("[data-i]").forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  const go = useCallback((i: number) => {
    const el = track.current;
    const card = el?.querySelector<HTMLElement>(`[data-i="${(i + ARCHIVES.length) % ARCHIVES.length}"]`);
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: "smooth" });
  }, []);

  return (
    <section className="archives reveal" aria-labelledby="archives-title">
      <header className="section-head">
        <span className="section-head__num mono">05</span>
        <h2 id="archives-title" className="section-head__title">Archives du suspect</h2>
        <span className="section-head__meta mono">
          {pad(active + 1)} / {pad(ARCHIVES.length)}
        </span>
      </header>

      <div className="archives__track" ref={track} tabIndex={0} aria-roledescription="carrousel" aria-label="Clichés du dossier">
        {ARCHIVES.map((p, i) => (
          <article
            key={p.id}
            data-i={i}
            className={`archive${i === active ? " archive--active" : ""}${p.placeholder ? " archive--empty" : ""}`}
            aria-roledescription="cliché"
            aria-label={`${i + 1} sur ${ARCHIVES.length}`}
          >
            <div className="archive__frame">
              <PhotoImg photo={p} className="archive__img" />
              <span className="archive__tag mono">
                {CASE_NUMBER} / {p.id}
              </span>
              {p.date && <span className="archive__date mono">{p.date}</span>}
              <span className="archive__holes" aria-hidden="true" />
            </div>
            <p className="archive__caption mono">« {p.caption} »</p>
          </article>
        ))}
      </div>

      <div className="archives__nav">
        <button type="button" className="btn btn--icon" onClick={() => go(active - 1)} aria-label="Cliché précédent">
          ←
        </button>
        <div className="archives__dots" role="tablist" aria-label="Choisir un cliché">
          {ARCHIVES.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={`Cliché ${i + 1}`}
              className={i === active ? "on" : ""}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button type="button" className="btn btn--icon" onClick={() => go(active + 1)} aria-label="Cliché suivant">
          →
        </button>
      </div>
    </section>
  );
}

export const Archives = memo(ArchivesImpl);
