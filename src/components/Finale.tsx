"use client";

import { useState } from "react";
import { FINAL_PHOTO } from "@/data/photos";
import { CASE_NUMBER } from "@/config";
import { END_MS, TOTAL_DAYS, TOTAL_MS, formatDot, remaining } from "@/lib/time";
import { shareCard, shareLink } from "@/lib/share";
import { Confetti } from "./Confetti";
import { PhotoImg } from "./PhotoImg";
import { Stamp } from "./Stamp";

const fr = (n: number) => n.toLocaleString("fr-FR");

const TOTALS = [
  { v: fr(TOTAL_DAYS), k: "jours" },
  { v: fr(TOTAL_MS / 3_600_000), k: "heures" },
  { v: fr(TOTAL_MS / 60_000), k: "minutes" },
  { v: fr(TOTAL_MS / 1000), k: "secondes" },
];

/** LE GRAND FINAL — 12 octobre 2031. */
export function Finale({ fx, toast, onOpenFile }: { fx: boolean; toast: (m: string) => void; onOpenFile: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <main className="finale">
      {fx && <Confetti run />}
      <div className="finale__flash" aria-hidden="true" />
      <div className="finale__beams" aria-hidden="true" />

      <header className="finale__meta mono reveal">
        <span>DOSSIER {CASE_NUMBER}</span>
        <span className="red">STATUT : CLOS</span>
      </header>

      <p className="finale__pre mono reveal" style={{ ["--d" as string]: "0.2s" }}>
        VERDICT DU {formatDot(END_MS)} · 00:00:00
      </p>

      <h1 className="finale__title reveal" style={{ ["--d" as string]: "0.35s" }}>
        <span>SPARROW</span>
        <span className="red">EST LIBÉRABLE.</span>
      </h1>

      <p className="finale__sub mono reveal" style={{ ["--d" as string]: "0.6s" }}>
        APRÈS {fr(TOTAL_DAYS)} JOURS, LE COMPTEUR A RENDU SON VERDICT.
      </p>

      <figure className="finale__photo reveal" style={{ ["--d" as string]: "0.85s" }}>
        <div className="finale__frame">
          <PhotoImg photo={FINAL_PHOTO} priority className="finale__img" />
          <Stamp className="finale__stamp">LIBÉRABLE</Stamp>
        </div>
        <figcaption className="mono">« {FINAL_PHOTO.caption} »</figcaption>
      </figure>

      <section className="finale__msg reveal" style={{ ["--d" as string]: "1s" }}>
        <p>
          Le Ministère du Calendrier remercie l&apos;ensemble des potes pour leur soutien moral, leurs vannes et leur
          consultation obsessionnelle du compteur.
        </p>
        <p className="mono">
          Le sujet est désormais autorisé à reprendre une activité normale. Les potes, en revanche, gardent le droit
          de le chambrer à vie.
        </p>
      </section>

      <dl className="finale__totals reveal">
        {TOTALS.map((t) => (
          <div key={t.k}>
            <dd>{t.v}</dd>
            <dt className="mono">{t.k} de patience</dt>
          </div>
        ))}
      </dl>

      <div className="finale__actions reveal">
        <button
          type="button"
          className="btn btn--primary"
          onClick={async () => {
            const res = await shareLink("VERDICT RENDU : Sparrow est libérable. Après 1 826 jours, le compteur a parlé.");
            if (res === "copied") toast("Lien copié. Annoncez la nouvelle.");
          }}
        >
          Annoncer la nouvelle
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await shareCard(remaining(END_MS), FINAL_PHOTO.src ?? "", "final");
            setBusy(false);
          }}
        >
          {busy ? "Impression…" : "Partager la capture"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onOpenFile}>
          Revoir le dossier
        </button>
      </div>

      <p className="finale__legal mono">
        Le 12 octobre 2031 est la date symbolique choisie pour cette application entre amis. Ce verdict est fictif et
        n&apos;a aucune valeur juridique.
      </p>
    </main>
  );
}
