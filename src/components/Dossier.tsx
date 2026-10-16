"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CASE_NUMBER } from "@/config";
import { COUNTER_TAPS, PHOTO_ALERTS } from "@/data/messages";
import { dueMilestone, type Milestone } from "@/data/milestones";
import { formatClock, initClock, remaining } from "@/lib/time";
import { load, save, sessionFlag } from "@/lib/storage";
import { useNow } from "@/lib/useNow";
import { Archives } from "./Archives";
import { Countdown } from "./Countdown";
import { DailyQuote } from "./DailyQuote";
import { Donation } from "./Donation";
import { Feed } from "./Feed";
import { Finale } from "./Finale";
import { Alert, Intro, MilestoneModal, Toast } from "./Overlays";
import { Portrait } from "./Portrait";
import { Progress } from "./Progress";
import { Report } from "./Report";
import { ShareSection } from "./ShareSection";
import { Temoins } from "./Temoins";

const simulated = typeof window !== "undefined" && initClock(window.location.search);

export function Dossier() {
  const t = useNow();
  const r = t == null ? null : remaining(t);

  const [fx, setFx] = useState(true);
  const [intro, setIntro] = useState(true);
  const [ready, setReady] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const [alertText, setAlertText] = useState<string | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [showFile, setShowFile] = useState(false);
  const [visits, setVisits] = useState<number | null>(null);
  const [sim, setSim] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const counterTaps = useRef(0);
  const statusTaps = useRef(0);
  const caseTaps = useRef(0);

  // Préférences, intro, compteur de visites (local à l'appareil).
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pref = load<boolean | null>("sp.fx", null);
    const on = pref ?? !reduce;
    setFx(on);
    if (!on || sessionFlag("sp.intro")) {
      setIntro(false);
      setReady(true);
    }
    const seenSession = sessionFlag("sp.visit");
    const v = load<number>("sp.visits", 0) + (seenSession ? 0 : 1);
    save("sp.visits", v);
    setVisits(v);
    setSim(simulated);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("fx-off", !fx);
  }, [fx]);

  const endIntro = useCallback(() => {
    setIntro(false);
    setReady(true);
  }, []);

  const toast = useCallback((m: string) => {
    setToastText(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 3200);
  }, []);

  // Caps symboliques.
  const ms = r?.ms ?? null;
  useEffect(() => {
    if (ms == null || !ready || milestone) return;
    const seen = load<string[]>("sp.ms", []);
    const due = dueMilestone(ms, seen);
    if (due) {
      save("sp.ms", [...seen, due.id]);
      setMilestone(due);
    }
  }, [ms, ready, milestone]);

  const onCounterTap = useCallback(() => {
    toast(COUNTER_TAPS[Math.min(counterTaps.current, COUNTER_TAPS.length - 1)]);
    counterTaps.current += 1;
    navigator.vibrate?.(30);
  }, [toast]);

  const onHarass = useCallback((n: number) => {
    setAlertText(PHOTO_ALERTS[(n - 1) % PHOTO_ALERTS.length]);
    navigator.vibrate?.([80, 60, 80, 60, 160]);
  }, []);

  const closeAlert = useCallback(() => setAlertText(null), []);
  const closeMilestone = useCallback(() => setMilestone(null), []);

  const onStatusTap = () => {
    statusTaps.current += 1;
    if (statusTaps.current % 3 === 0) toast("Modification du statut : refusée. Bien essayé.");
  };
  const onCaseTap = () => {
    caseTaps.current += 1;
    if (caseTaps.current % 3 === 0) toast("Le numéro de dossier n'est pas un code promo.");
  };

  const toggleFx = () => {
    const v = !fx;
    setFx(v);
    save("sp.fx", v);
    toast(v ? "Effets spéciaux réactivés. Le drame est de retour." : "Effets désactivés. Mode sobre, comme un procès-verbal.");
  };

  const done = r?.done ?? false;
  const urgent = r != null && !done && r.ms <= 86_400_000;
  const classes = ["app", ready ? "is-ready" : "", urgent ? "is-urgent" : "", done ? "is-done" : ""].join(" ");

  return (
    <div className={classes}>
      <div className="grain" aria-hidden="true" />
      <div className="leak" aria-hidden="true" />

      {sim && (
        <div className="simbar mono" role="note">
          MODE SIMULATION · HORLOGE DÉCALÉE ·{" "}
          <a href="/" className="red">
            QUITTER
          </a>
        </div>
      )}

      {done && !showFile ? (
        <Finale fx={fx} toast={toast} onOpenFile={() => setShowFile(true)} />
      ) : (
        <main className="page">
          <header className="meta mono reveal" style={{ ["--d" as string]: "0s" }}>
            <div className="meta__row">
              <span className="meta__strong">DOSSIER CLASSIFIÉ</span>
              <span className="meta__clock" suppressHydrationWarning>
                PARIS {t == null ? "--:--:--" : formatClock(t)}
              </span>
            </div>
            <div className="meta__row">
              <button type="button" className="meta__btn" onClick={onCaseTap}>
                N° {CASE_NUMBER}
              </button>
              <button type="button" className="meta__btn meta__status" onClick={onStatusTap}>
                <i aria-hidden="true" /> STATUT : {done ? "CLOS" : "EN COURS"}
              </button>
            </div>
          </header>

          <h1 className="title reveal" style={{ ["--d" as string]: "0.1s" }}>
            <span className="title__a">SPARROW</span>
            <span className="title__b">EST LIBÉRABLE</span>
          </h1>

          <div className="ref mono reveal" style={{ ["--d" as string]: "0.2s" }} aria-hidden="true">
            <span>RÉF. MIN-CAL/{CASE_NUMBER}/A</span>
            <span>ACCRÉDITATION : POTE</span>
          </div>

          <section className="sec" aria-labelledby="sec-sujet">
            <header className="section-head reveal" style={{ ["--d" as string]: "0.3s" }}>
              <span className="section-head__num mono">01</span>
              <h2 id="sec-sujet" className="section-head__title">Le sujet</h2>
              <span className="section-head__meta mono">NE PAS TOUCHER</span>
            </header>
            <Portrait onHarass={onHarass} />
          </section>

          <section className="sec sec--cd" aria-labelledby="sec-cd">
            <header className="section-head reveal" style={{ ["--d" as string]: "0.45s" }}>
              <span className="section-head__num mono">02</span>
              <h2 id="sec-cd" className="section-head__title">Temps restant</h2>
              <span className="section-head__meta mono">SYNCHRO SECONDE</span>
            </header>
            <div className="reveal" style={{ ["--d" as string]: "0.5s" }}>
              <Countdown r={r} onTap={onCounterTap} />
            </div>
            <Progress progress={r?.progress ?? null} notStarted={r?.notStarted ?? false} />
            <Feed r={r} fx={fx} />
          </section>

          <DailyQuote t={t} />
          <Report r={r} t={t} />
          <Archives />
          <Temoins toast={toast} />
          <Donation />
          <ShareSection toast={toast} />

          <footer className="foot mono">
            <div className="foot__end">— FIN DU DOCUMENT —</div>
            <p>
              Document fictif réalisé entre amis. Le Ministère du Calendrier n&apos;existe pas. La date du 12.10.2031 est
              symbolique et n&apos;a aucune valeur juridique.
            </p>
            {visits != null && (
              <p>
                Consultations de ce dossier sur cet appareil : <b>{visits}</b>{" "}
                <span className="steel">(donnée réelle, stockée uniquement sur ce téléphone)</span>
              </p>
            )}
            <div className="foot__row">
              <button type="button" className="btn btn--ghost btn--sm" onClick={toggleFx} aria-pressed={fx}>
                Effets : {fx ? "activés" : "désactivés"}
              </button>
              {done && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowFile(false)}>
                  Retour au verdict
                </button>
              )}
            </div>
          </footer>
        </main>
      )}

      <Toast text={toastText} />
      {alertText && <Alert text={alertText} onClose={closeAlert} />}
      {milestone && <MilestoneModal m={milestone} onClose={closeMilestone} />}
      {intro && <Intro onDone={endIntro} />}
    </div>
  );
}
