"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { load, save } from "@/lib/storage";
import { Toast } from "../Overlays";
import { Chiptune } from "./audio";
import { Engine, KEBAB_DAYS, MAX_MASKS, START_DAYS } from "./engine";
import { Renderer } from "./render";
import { SpritePreview } from "./SpritePreview";
import type { Skin } from "./sprites";

type Screen = "title" | "play" | "over" | "won";

const BANNERS: Record<number, string> = {
  1500: "PALIER 1 500 · ÇA ACCÉLÈRE",
  1000: "1 000 JOURS · LES LUNDIS S'ÉNERVENT",
  500: "500 JOURS · LE MINISTÈRE PANIQUE",
  100: "100 JOURS · TIENS BON, SOLDAT",
  30: "30 JOURS · ON Y EST PRESQUE",
  7: "7 JOURS · RESPIRE",
};

const OVER_LINES = [
  "Le calendrier vous a rattrapé. Retour en cellule.",
  "Arrêté par un lundi. Grand classique.",
  "Le Ministère du Calendrier vous remercie de votre participation.",
  "Évasion avortée. Le compteur rigole encore.",
  "Trois masques perdus. Le latex, ça coûte cher.",
  "Le sujet a été rattrapé. Il prétend avoir glissé.",
];

const fr = (n: number) => n.toLocaleString("fr-FR");

export function Game() {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const renderer = useRef<Renderer | null>(null);
  const audio = useRef(new Chiptune());
  const screenRef = useRef<Screen>("title");
  const pausedRef = useRef(false);
  const overAt = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const bannerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [screen, setScreenState] = useState<Screen>("title");
  const [hud, setHud] = useState({ days: START_DAYS, kebabs: 0, masks: MAX_MASKS, slow: false });
  const [best, setBest] = useState(0);
  const [record, setRecord] = useState(false);
  const [skin, setSkin] = useState<Skin>("lunettes");
  const [sound, setSound] = useState(false);
  const [paused, setPaused] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [overLine, setOverLine] = useState(OVER_LINES[0]);
  const [last, setLast] = useState({ done: 0, kebabs: 0 });
  const [toastText, setToastText] = useState<string | null>(null);

  const setScreen = (s: Screen) => {
    screenRef.current = s;
    setScreenState(s);
  };

  const toast = useCallback((m: string) => {
    setToastText(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 3000);
  }, []);

  // Préférences sauvegardées
  useEffect(() => {
    setBest(load<number>("sp.game.best", 0));
    const sk = load<Skin>("sp.game.skin", "lunettes");
    setSkin(sk);
    const snd = load<boolean>("sp.game.sound", false);
    setSound(snd);
    audio.current.enabled = snd;
  }, []);

  // Boucle de jeu + dimensionnement pixel art (agrandissement entier).
  useEffect(() => {
    const st = stage.current;
    const cv = canvas.current;
    if (!st || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const fit = () => {
      const r = st.getBoundingClientRect();
      // Pixels bien visibles sur téléphone : ~140 pixels logiques de large.
      const scale = Math.max(2, Math.min(Math.round(r.width / 140), Math.round(r.height / 120)));
      const W = Math.ceil(r.width / scale);
      const H = Math.ceil(r.height / scale);
      cv.width = W;
      cv.height = H;
      cv.style.width = `${W * scale}px`;
      cv.style.height = `${H * scale}px`;
      if (!engine.current) engine.current = new Engine(W, H);
      else engine.current.resize(W, H);
    };
    fit();
    if (!renderer.current) renderer.current = new Renderer(load<Skin>("sp.game.skin", "lunettes"));
    const ro = new ResizeObserver(fit);
    ro.observe(st);

    let raf = 0;
    let prev = performance.now();
    let lastHud = "";
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const e = engine.current!;
      const rd = renderer.current!;
      if (!pausedRef.current) e.update(dt);

      for (const ev of e.drain()) {
        const a = audio.current;
        if (ev.type === "jump") {
          a.jump(ev.double);
          if (ev.double) rd.burst(e.heroX + 7, e.hero.y + 20, "#777777", 6);
        } else if (ev.type === "land") rd.burst(e.heroX + 7, e.groundY - 1, "#3d3d3d", 4);
        else if (ev.type === "hit") {
          a.hit();
          rd.hit();
          rd.burst(e.heroX + 7, e.hero.y + 8, "#e53935", 14);
          navigator.vibrate?.(60);
        } else if (ev.type === "collect") {
          if (ev.kind === "kebab") {
            a.coin();
            rd.float(ev.x, ev.y - 6, `-${KEBAB_DAYS}J`, "#f2c14e");
            rd.burst(ev.x + 5, ev.y + 4, "#f2c14e", 8);
          } else {
            a.power();
            rd.float(ev.x, ev.y - 6, ev.kind === "mask" ? "+1" : "X2", "#f1efe8");
            rd.burst(ev.x + 5, ev.y + 4, "#f1efe8", 12);
          }
        } else if (ev.type === "milestone") {
          a.milestone();
          setBanner(BANNERS[ev.days] ?? null);
          clearTimeout(bannerTimer.current);
          bannerTimer.current = setTimeout(() => setBanner(null), 2200);
        } else if (ev.type === "over" || ev.type === "won") {
          const done = e.daysDone;
          const prevBest = load<number>("sp.game.best", 0);
          const isRecord = done > prevBest;
          if (isRecord) {
            save("sp.game.best", done);
            setBest(done);
          }
          setRecord(isRecord);
          setLast({ done, kebabs: e.kebabs });
          setOverLine(OVER_LINES[Math.floor(Math.random() * OVER_LINES.length)]);
          overAt.current = performance.now();
          if (ev.type === "won") {
            a.win();
            setScreen("won");
          } else {
            a.over();
            navigator.vibrate?.([80, 60, 160]);
            setScreen("over");
          }
        }
      }

      const key = `${e.daysLeft}|${e.kebabs}|${e.masks}|${e.slowT > 0}`;
      if (key !== lastHud) {
        lastHud = key;
        setHud({ days: e.daysLeft, kebabs: e.kebabs, masks: e.masks, slow: e.slowT > 0 });
      }
      rd.draw(ctx, e, pausedRef.current ? 0 : dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onHide = () => {
      if (document.visibilityState === "hidden" && screenRef.current === "play") {
        pausedRef.current = true;
        setPaused(true);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  const begin = useCallback(() => {
    const e = engine.current;
    if (!e) return;
    e.reset();
    e.start();
    pausedRef.current = false;
    setPaused(false);
    setBanner(null);
    setScreen("play");
  }, []);

  const action = useCallback(() => {
    const s = screenRef.current;
    if (s === "title") begin();
    else if (s === "play") {
      if (pausedRef.current) {
        pausedRef.current = false;
        setPaused(false);
      } else engine.current?.jump();
    }
  }, [begin]);

  // Clavier (ordinateur)
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.code === "Space" || ev.code === "ArrowUp" || ev.code === "KeyW") {
        ev.preventDefault();
        if (screenRef.current === "over" || screenRef.current === "won") {
          if (performance.now() - overAt.current > 700) begin();
        } else action();
      } else if (ev.code === "KeyP" || ev.code === "Escape") togglePause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const togglePause = () => {
    if (screenRef.current !== "play") return;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
  };

  const pickSkin = (s: Skin) => {
    setSkin(s);
    save("sp.game.skin", s);
    renderer.current?.setSkin(s);
  };

  const toggleSound = () => {
    const v = !sound;
    setSound(v);
    audio.current.enabled = v;
    save("sp.game.sound", v);
    if (v) audio.current.coin();
  };

  const share = async () => {
    const url = `${window.location.origin}/jeu`;
    const text =
      screenRef.current === "won"
        ? `J'ai fait tomber les ${fr(START_DAYS)} jours dans L'Évasion de Sparrow. Sparrow est libérable (dans le jeu). Bats-moi :`
        : `J'ai fait tomber le compteur de ${fr(last.done)} jours dans L'Évasion de Sparrow (${last.kebabs} kebabs). Bats-moi :`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "L'Évasion de Sparrow", text, url });
        return;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast("Défi copié. Colle-le dans le groupe.");
    } catch {
      toast(url);
    }
  };

  const onStagePointer = (ev: React.PointerEvent) => {
    if ((ev.target as HTMLElement).closest("button, a")) return;
    ev.preventDefault();
    action();
  };

  return (
    <div className="arcade">
      <header className="arcade__bar mono">
        <a href="/">← DOSSIER</a>
        <span className="arcade__brand">L&apos;ÉVASION DE SPARROW</span>
        <button type="button" onClick={toggleSound} aria-pressed={sound} aria-label="Son">
          {sound ? "SON ●" : "SON ○"}
        </button>
      </header>

      <div className="arcade__stage" ref={stage} onPointerDown={onStagePointer}>
        <canvas ref={canvas} className="arcade__canvas" aria-label="Zone de jeu" />

        {screen === "play" && (
          <div className="hud mono" aria-live="off">
            <div className="hud__days">
              <small>JOURS RESTANTS</small>
              <b>{fr(hud.days)}</b>
            </div>
            <div className="hud__right">
              <div className="hud__masks" aria-label={`${hud.masks} masques`}>
                {Array.from({ length: MAX_MASKS }, (_, i) => (
                  <i key={i} className={i < hud.masks ? "on" : ""} />
                ))}
              </div>
              <div className="hud__kebabs">🥙 {hud.kebabs}</div>
              <button type="button" className="hud__pause" onClick={togglePause} aria-label="Pause">
                II
              </button>
            </div>
          </div>
        )}

        {screen === "play" && hud.slow && <div className="hud__slow mono">SABLIER ACTIF · TEMPS RALENTI</div>}
        {screen === "play" && banner && <div className="banner mono">{banner}</div>}

        {screen === "play" && paused && (
          <div className="arcade__overlay">
            <p className="arcade__big">PAUSE</p>
            <p className="mono arcade__blink">TOUCHER POUR REPRENDRE</p>
          </div>
        )}

        {screen === "title" && (
          <div className="arcade__overlay arcade__overlay--title">
            <p className="mono arcade__kicker">MINISTÈRE DU CALENDRIER PRÉSENTE</p>
            <h1 className="arcade__title">
              <span>L&apos;ÉVASION</span>
              <span className="red">DE SPARROW</span>
            </h1>
            <div className="skins" role="radiogroup" aria-label="Choisir le personnage">
              {(["lunettes", "masque"] as Skin[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={skin === s}
                  className={`skin${skin === s ? " skin--on" : ""}`}
                  onClick={() => pickSkin(s)}
                >
                  <SpritePreview skin={s} scale={4} />
                  <span className="mono">{s === "lunettes" ? "INCOGNITO" : "CHEVALIER NOIR"}</span>
                </button>
              ))}
            </div>
            <button type="button" className="btn btn--primary arcade__start" onClick={begin}>
              ▶ Jouer
            </button>
            <p className="mono arcade__blink">INSERT COIN · GRATUIT, COMME TOUT LE RESTE</p>
            <ul className="arcade__rules mono">
              <li>
                <b>TOUCHER</b> = sauter · deux fois = double saut
              </li>
              <li>Évite calendriers, horloges et lundis volants</li>
              <li>
                🥙 Kebab = −{KEBAB_DAYS} jours · Masque = +1 vie · Sablier = ralenti
              </li>
              <li>Fais tomber le compteur de {fr(START_DAYS)} à 0</li>
            </ul>
            {best > 0 && <p className="mono arcade__best">RECORD SUR CE TÉLÉPHONE : {fr(best)} JOURS</p>}
          </div>
        )}

        {(screen === "over" || screen === "won") && (
          <div className={`arcade__overlay arcade__overlay--end${screen === "won" ? " is-won" : ""}`}>
            <p className="mono arcade__kicker">{screen === "won" ? "VERDICT DU JEU" : "GAME OVER"}</p>
            <h2 className="arcade__big">{screen === "won" ? "SPARROW EST LIBÉRABLE !" : "ATTRAPÉ."}</h2>
            <p className="mono arcade__line">
              {screen === "won"
                ? `Tu as fait tomber les ${fr(START_DAYS)} jours. Le vrai compteur, lui, n'a pas bougé d'une seconde.`
                : overLine}
            </p>
            <dl className="arcade__stats mono">
              <div>
                <dt>JOURS TOMBÉS</dt>
                <dd>{fr(last.done)}</dd>
              </div>
              <div>
                <dt>KEBABS</dt>
                <dd>{last.kebabs}</dd>
              </div>
              <div>
                <dt>RECORD</dt>
                <dd>{fr(best)}</dd>
              </div>
            </dl>
            {record && <p className="mono arcade__record">★ NOUVEAU RECORD ★</p>}
            <div className="arcade__actions">
              <button type="button" className="btn btn--primary" onClick={begin}>
                Rejouer
              </button>
              <button type="button" className="btn" onClick={share}>
                Défier les potes
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setScreen("title")}>
                Changer de perso
              </button>
            </div>
          </div>
        )}
      </div>
      <Toast text={toastText} />
    </div>
  );
}
