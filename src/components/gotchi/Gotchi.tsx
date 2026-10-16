"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  COOLDOWN,
  STATS,
  absenceReport,
  act,
  ageJours,
  cooldownLeft,
  mood as moodOf,
  newState,
  randomEvent,
  restore,
  tick,
  type Action,
  type Mood,
  type Result,
  type State,
} from "@/lib/gotchi/engine";
import { load, save } from "@/lib/storage";
import { Chiptune } from "../game/audio";
import { Toast } from "../Overlays";
import { GotchiRenderer, LCD_H, LCD_W, type Anim } from "./render";

const KEY = "sp.gotchi.v1";

const ACTIONS: { id: Action; icon: string; label: string }[] = [
  { id: "frites", icon: "🍟", label: "Frites" },
  { id: "salade", icon: "🥗", label: "Salade" },
  { id: "dofus", icon: "🎮", label: "Dofus" },
  { id: "sieste", icon: "🛋️", label: "Repos express" },
  { id: "douche", icon: "🚿", label: "Rafraîchir" },
  { id: "parler", icon: "💬", label: "Parler" },
];

const MOOD_LABEL: Record<Mood, string> = {
  content: "AU TOP",
  neutre: "STABLE",
  affame: "RÉCLAME DES FRITES",
  creve: "ÉPUISÉ (NIE TOUT)",
  deprime: "DÉPRIMÉ",
  gras: "MODE FRITE",
  focus: "ULTRA FOCUS",
  rage: "EN RAGE",
  dofus: "SESSION DOFUS",
  degout: "DÉGOÛTÉ",
  crise: "CRISE DRAMATIQUE",
};

const ANIM_LEN = 2.4;

export function Gotchi() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State | null>(null);
  const animRef = useRef<{ anim: Anim; start: number; refusOf?: string } | null>(null);
  const renderer = useRef(new GotchiRenderer());
  const audio = useRef(new Chiptune());
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lineTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState(0);
  const [line, setLine] = useState<string | null>(null);
  const [typed, setTyped] = useState(0);
  const [delta, setDelta] = useState<{ key: number; d: Result["delta"] } | null>(null);
  const [sound, setSound] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const toast = useCallback((m: string) => {
    setToastText(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 2800);
  }, []);

  const commit = useCallback((s: State) => {
    stateRef.current = s;
    setState(s);
    save(KEY, s);
  }, []);

  const say = useCallback((text: string) => {
    setLine(text);
    setTyped(0);
    clearTimeout(lineTimer.current);
    lineTimer.current = setTimeout(() => setLine(null), Math.max(4500, text.length * 70));
  }, []);

  const play = useCallback((anim: Anim, refusOf?: string) => {
    animRef.current = { anim, start: performance.now(), refusOf };
  }, []);

  // Chargement + rattrapage du temps passé
  useEffect(() => {
    const t = Date.now();
    const raw = load<unknown>(KEY, null);
    const before = raw ? restore(raw, t) : newState(t);
    let after = tick(before, t);
    const report = raw ? absenceReport(before, after, t) : null;
    if (!raw) say("Salut. Je suis Sparrow. Tu me dois des frites.");
    else if (report) say(report);
    else {
      const ev = randomEvent(after, t);
      if (ev) {
        after = ev.state;
        say(ev.line);
        play(ev.anim as Anim);
      } else say("Ah, te revoilà. J'avais pas remarqué que t'étais parti.");
    }
    commit(after);
    setNow(t);
    const snd = load<boolean>("sp.gotchi.sound", false);
    setSound(snd);
    audio.current.enabled = snd;
  }, [commit, play, say]);

  // Le temps passe pendant que l'écran est ouvert ; événements aléatoires
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      if (!s || document.visibilityState !== "visible") return;
      const t = Date.now();
      setNow(t);
      const after = tick(s, t);
      // Retour après une absence (l'appli était en arrière-plan) : on raconte ce qui s'est passé.
      const rep = absenceReport(s, after, t);
      commit(after);
      if (rep) say(rep);
    }, 1000);
    const ev = setInterval(() => {
      const s = stateRef.current;
      if (!s || document.visibilityState !== "visible" || animRef.current) return;
      const r = randomEvent(s, Date.now());
      if (r) {
        commit(r.state);
        say(r.line);
        play(r.anim as Anim);
        if (r.anim === "crise") navigator.vibrate?.([80, 60, 80]);
      }
    }, 38_000);
    const onVis = () => {
      const s = stateRef.current;
      if (!s) return;
      if (document.visibilityState === "hidden") save(KEY, tick(s, Date.now()));
      else {
        const t = Date.now();
        const after = tick(s, t);
        const rep = absenceReport(s, after, t);
        commit(after);
        if (rep) say(rep);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      clearInterval(ev);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [commit, play, say]);

  // Effet machine à écrire sur la bulle
  useEffect(() => {
    if (!line || typed >= line.length) return;
    const id = setTimeout(() => setTyped((n) => n + 2), 22);
    return () => clearTimeout(id);
  }, [line, typed]);

  // Rendu de l'écran LCD
  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    let raf = 0;
    const t0 = performance.now();
    const frame = (n: number) => {
      const s = stateRef.current;
      if (s) {
        const a = animRef.current;
        let animT = 0;
        if (a) {
          animT = (n - a.start) / 1000;
          if (animT > ANIM_LEN) animRef.current = null;
        }
        renderer.current.draw(ctx, {
          mood: moodOf(s, Date.now()),
          anim: animRef.current?.anim ?? null,
          refusOf: animRef.current?.refusOf,
          animT,
          t: (n - t0) / 1000,
        });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const doAction = (a: Action) => {
    const s = stateRef.current;
    if (!s) return;
    const t = Date.now();
    const left = cooldownLeft(s, a, t);
    if (left > 0) {
      toast(`Doucement. Encore ${Math.ceil(left / 1000)} s.`);
      return;
    }
    const r = act(s, a, t);
    commit(r.state);
    setNow(t);
    say(r.line);
    play(r.anim as Anim, r.anim === "refus" ? a : undefined);
    setDelta({ key: t, d: r.delta });
    const au = audio.current;
    if (r.anim === "refus" || r.anim === "rage") au.hit();
    else if (r.anim === "drop") au.win();
    else if (a === "frites" || a === "salade") au.coin();
    else au.jump(false);
    navigator.vibrate?.(r.anim === "refus" || r.anim === "rage" ? [40, 40, 40] : 15);
  };

  const reset = () => {
    if (!window.confirm("Adopter un nouveau Sparrow ? L'actuel sera rendu au Ministère du Calendrier.")) return;
    const s = newState(Date.now());
    commit(s);
    say("Nouveau Sparrow, mêmes exigences. Frites, s'il te plaît.");
  };

  const toggleSound = () => {
    const v = !sound;
    setSound(v);
    audio.current.enabled = v;
    save("sp.gotchi.sound", v);
    if (v) audio.current.coin();
  };

  const m = state ? moodOf(state, now || Date.now()) : "neutre";

  return (
    <div className="gt">
      <header className="gt-bar mono">
        <a href="/jeu">← JEUX</a>
        <span className="gt-bar__title">SPARROWGOTCHI</span>
        <button type="button" onClick={toggleSound} aria-pressed={sound}>
          {sound ? "SON ●" : "SON ○"}
        </button>
      </header>

      <main className="gt-main">
        <div className="gt-bubble-wrap" aria-live="polite">
          {line && (
            <p className="gt-bubble" key={line}>
              {line.slice(0, typed)}
              <span className="sr-only">{line}</span>
            </p>
          )}
        </div>

        <div className={`gt-egg gt-egg--${m}`}>
          <div className="gt-egg__top mono">
            <span>SP-2031</span>
            <span className="gt-egg__led" />
          </div>
          <div className="gt-lcd">
            <canvas
              ref={canvas}
              width={LCD_W}
              height={LCD_H}
              className="gt-lcd__canvas"
              onClick={() => doAction("parler")}
              aria-label="Sparrow, toucher pour lui parler"
              role="img"
            />
            <div className="gt-lcd__status mono">
              <span>{MOOD_LABEL[m]}</span>
              {state && <span>J+{ageJours(state, now || Date.now())}</span>}
            </div>
          </div>
          <p className="gt-egg__brand">SPARROWGOTCHI</p>
          <div className="gt-egg__keys" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>

        <section className="gt-stats" aria-label="Jauges">
          {STATS.map(({ id, label }) => {
            const v = state?.stats[id] ?? 0;
            const d = delta?.d[id];
            return (
              <div key={id} className={`gt-stat${v < 25 ? " is-low" : ""}`}>
                <span className="gt-stat__lbl mono">{label}</span>
                <div className="gt-stat__bar" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-label={label}>
                  {Array.from({ length: 10 }, (_, i) => (
                    <i key={i} className={v > i * 10 + 2 ? "on" : ""} />
                  ))}
                </div>
                <span className="gt-stat__val mono">
                  {Math.round(v)}
                  {d ? (
                    <em key={delta!.key} className={d > 0 ? "up" : "down"}>
                      {d > 0 ? `+${d}` : d}
                    </em>
                  ) : null}
                </span>
              </div>
            );
          })}
        </section>

        <section className="gt-actions" aria-label="Actions">
          {ACTIONS.map((a) => {
            const left = state ? cooldownLeft(state, a.id, now || Date.now()) : 0;
            return (
              <button key={a.id} type="button" className="gt-act" onClick={() => doAction(a.id)} disabled={!state}>
                <span className="gt-act__icon" aria-hidden="true">
                  {a.icon}
                </span>
                <span className="gt-act__lbl mono">{a.label}</span>
                {left > 0 && <span className="gt-act__cd" style={{ transform: `scaleX(${left / COOLDOWN[a.id]})` }} />}
              </button>
            );
          })}
        </section>

        {state && (
          <section className="gt-file mono" aria-label="Dossier">
            <p className="gt-file__title">DOSSIER DU SUJET</p>
            <dl>
              <div>
                <dt>Adopté depuis</dt>
                <dd>{ageJours(state, now || Date.now())} j</dd>
              </div>
              <div>
                <dt>Portions de frites</dt>
                <dd>{state.counters.frites}</dd>
              </div>
              <div>
                <dt>Salades acceptées</dt>
                <dd>{state.counters.salade}</dd>
              </div>
              <div>
                <dt>Sessions Dofus</dt>
                <dd>{state.counters.dofus}</dd>
              </div>
              <div>
                <dt>Siestes refusées</dt>
                <dd>{state.counters.siestesRefusees}</dd>
              </div>
              <div>
                <dt>Crises dramatiques</dt>
                <dd>{state.counters.crises}</dd>
              </div>
            </dl>
            <p className="gt-file__note">
              Sauvegardé sur ce téléphone. Sparrow vit sa vie même quand l&apos;appli est fermée. Il ne meurt jamais : il
              fait juste des crises.
            </p>
            <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
              Adopter un nouveau Sparrow
            </button>
          </section>
        )}
      </main>
      <Toast text={toastText} />
    </div>
  );
}
