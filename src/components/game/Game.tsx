"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { load, save } from "@/lib/storage";
import { NAME_MAX, cleanName, sortScores, type ScoreEntry } from "@/lib/scores";
import { Toast } from "../Overlays";
import { Chiptune } from "./audio";
import { Engine, FRITES_DAYS, MAX_MASKS, START_DAYS } from "./engine";
import { Renderer } from "./render";
import { SpritePreview } from "./SpritePreview";
import { SKIN_NAMES, type Skin } from "./sprites";

type Screen = "title" | "play" | "over" | "won" | "board";

const BANNERS: Record<number, string> = {
  1500: "PALIER 1 500 · ÇA ACCÉLÈRE",
  1000: "1 000 JOURS · LES LUNDIS S'ÉNERVENT",
  500: "500 JOURS · LE MINISTÈRE PANIQUE",
  100: "100 JOURS · TIENS BON, SOLDAT",
  30: "30 JOURS · ON Y EST PRESQUE",
  7: "7 JOURS · RESPIRE",
};

const OVER_SPARROW = [
  "Lili t'a rattrapé. Tu savais que ça finirait comme ça.",
  "Rattrapé par Lili. Le calendrier, lui, n'y est pour rien.",
  "Lili 1 – Sparrow 0.",
  "Arrêté par un lundi. Lili n'a eu qu'à finir le travail.",
  "Trois masques perdus. Le latex, ça coûte cher.",
  "Tombé entre deux toits. Lili n'a même pas eu à courir.",
];

const OVER_LILI = [
  "Sparrow t'a rattrapée. Il court plus vite quand c'est pour toi.",
  "Rattrapée. Sparrow voulait juste te parler du compte à rebours.",
  "Sparrow 1 – Lili 0. Il va en parler pendant 1 826 jours.",
  "Un lundi t'a ralentie. Sparrow n'en demandait pas tant.",
];

const fr = (n: number) => n.toLocaleString("fr-FR");
const SKINS: Skin[] = ["lunettes", "masque", "lili"];

interface Board {
  global: boolean;
  scores: ScoreEntry[];
}

function localBoard(): ScoreEntry[] {
  return load<ScoreEntry[]>("sp.game.board", []);
}

function addLocal(entry: ScoreEntry): ScoreEntry[] {
  const all = [...localBoard().filter((s) => s.name !== entry.name || s.days >= entry.days), entry].sort(sortScores);
  const seen = new Set<string>();
  const best = all.filter((s) => (seen.has(s.name) ? false : (seen.add(s.name), true))).slice(0, 30);
  save("sp.game.board", best);
  return best;
}

export function Game() {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const engine = useRef<Engine | null>(null);
  const renderer = useRef<Renderer | null>(null);
  const audio = useRef(new Chiptune());
  const screenRef = useRef<Screen>("title");
  const skinRef = useRef<Skin>("lunettes");
  const pausedRef = useRef(false);
  const overAt = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const bannerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [screen, setScreenState] = useState<Screen>("title");
  const [hud, setHud] = useState({ days: START_DAYS, frites: 0, masks: MAX_MASKS, slow: false });
  const [best, setBest] = useState(0);
  const [record, setRecord] = useState(false);
  const [skin, setSkin] = useState<Skin>("lunettes");
  const [sound, setSound] = useState(false);
  const [paused, setPaused] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [overLine, setOverLine] = useState(OVER_SPARROW[0]);
  const [last, setLast] = useState({ done: 0, frites: 0, seconds: 0, skin: "lunettes" as Skin });
  const [toastText, setToastText] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [board, setBoard] = useState<Board | null>(null);
  const [myRank, setMyRank] = useState<number | null>(null);

  const setScreen = (s: Screen) => {
    screenRef.current = s;
    setScreenState(s);
  };

  const toast = useCallback((m: string) => {
    setToastText(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 3000);
  }, []);

  const refreshBoard = useCallback(async () => {
    try {
      const res = await fetch("/api/scores", { cache: "no-store" });
      const data = (await res.json()) as { enabled: boolean; scores: ScoreEntry[] };
      if (data.enabled) {
        setBoard({ global: true, scores: data.scores });
        return;
      }
    } catch {
      /* hors ligne : classement local */
    }
    setBoard({ global: false, scores: localBoard() });
  }, []);

  // Préférences sauvegardées
  useEffect(() => {
    setBest(load<number>("sp.game.best", 0));
    const sk = load<Skin>("sp.game.skin", "lunettes");
    const safe = SKINS.includes(sk) ? sk : "lunettes";
    setSkin(safe);
    skinRef.current = safe;
    const snd = load<boolean>("sp.game.sound", false);
    setSound(snd);
    audio.current.enabled = snd;
    setName(load<string>("sp.game.name", ""));
    void refreshBoard();
  }, [refreshBoard]);

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
    if (!renderer.current) {
      const sk = load<Skin>("sp.game.skin", "lunettes");
      renderer.current = new Renderer(SKINS.includes(sk) ? sk : "lunettes");
    }
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
          if (ev.kind === "frites") {
            a.coin();
            rd.float(ev.x, ev.y - 6, `-${FRITES_DAYS}J`, "#f2c14e");
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
          setLast({ done, frites: e.frites, seconds: e.time, skin: skinRef.current });
          setSubmitted(false);
          setMyRank(null);
          const lines = skinRef.current === "lili" ? OVER_LILI : OVER_SPARROW;
          setOverLine(lines[Math.floor(Math.random() * lines.length)]);
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

      const key = `${e.daysLeft}|${e.frites}|${e.masks}|${e.slowT > 0}`;
      if (key !== lastHud) {
        lastHud = key;
        setHud({ days: e.daysLeft, frites: e.frites, masks: e.masks, slow: e.slowT > 0 });
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

  const togglePause = useCallback(() => {
    if (screenRef.current !== "play") return;
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
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
      if ((ev.target as HTMLElement)?.tagName === "INPUT") return;
      if (ev.code === "Space" || ev.code === "ArrowUp" || ev.code === "KeyW") {
        ev.preventDefault();
        if (screenRef.current === "over" || screenRef.current === "won") {
          if (performance.now() - overAt.current > 700) begin();
        } else action();
      } else if (ev.code === "KeyP" || ev.code === "Escape") togglePause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [action, begin, togglePause]);

  const pickSkin = (s: Skin) => {
    setSkin(s);
    skinRef.current = s;
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

  const submitScore = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const n = cleanName(name);
    if (n.length < 2) {
      toast("Pseudo trop court : 2 caractères minimum.");
      return;
    }
    if (last.done < 1) {
      toast("Zéro jour ? Le Ministère refuse d'afficher ça.");
      return;
    }
    save("sp.game.name", n);
    setName(n);
    setSending(true);
    const entry: ScoreEntry = { name: n, days: last.done, frites: last.frites, skin: last.skin, at: new Date().toISOString() };
    try {
      const res = await fetch("/api/scores", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...entry, seconds: Math.ceil(last.seconds) }),
      });
      const data = (await res.json().catch(() => ({}))) as { rank?: number; scores?: ScoreEntry[]; error?: string };
      if (res.ok && data.scores) {
        setBoard({ global: true, scores: data.scores });
        setMyRank(data.rank ?? null);
        setSubmitted(true);
        toast(data.rank === 1 ? "Nouveau n°1 des potes. Respect." : `Score enregistré. Tu es ${data.rank}ᵉ.`);
        setSending(false);
        return;
      }
      if (res.status !== 503) {
        toast(data.error ?? "Score refusé.");
        setSending(false);
        return;
      }
    } catch {
      /* hors ligne → classement local */
    }
    const local = addLocal(entry);
    setBoard({ global: false, scores: local });
    setMyRank(local.findIndex((s) => s.name === n) + 1);
    setSubmitted(true);
    setSending(false);
    toast("Score enregistré sur ce téléphone.");
  };

  const share = async () => {
    const url = `${window.location.origin}/jeu`;
    const who = last.skin === "lili" ? "Lili" : "Sparrow";
    const text =
      screenRef.current === "won"
        ? `J'ai fait tomber les ${fr(START_DAYS)} jours avec ${who} dans L'Évasion de Sparrow. Bats-moi :`
        : `J'ai fait tomber le compteur de ${fr(last.done)} jours avec ${who} (${last.frites} frites). Bats-moi :`;
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
    if ((ev.target as HTMLElement).closest("button, a, input, form, .lb")) return;
    ev.preventDefault();
    action();
  };

  const isLili = skin === "lili";

  const boardList = (limit: number, highlight?: string) =>
    board && board.scores.length > 0 ? (
      <ol className="lb mono">
        {board.scores.slice(0, limit).map((s, i) => (
          <li key={`${s.name}-${s.at}`} className={highlight && s.name === highlight ? "me" : ""}>
            <span className="lb__rank">{i + 1 === 1 ? "👑" : String(i + 1).padStart(2, "0")}</span>
            <span className="lb__name">{s.name}</span>
            <span className="lb__skin">{s.skin === "lili" ? "LILI" : s.skin === "masque" ? "C.N." : "SPA"}</span>
            <span className="lb__days">{fr(s.days)} J</span>
          </li>
        ))}
      </ol>
    ) : (
      <p className="mono lb__empty">Aucun score pour l&apos;instant. La première place est libre.</p>
    );

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
              <div className="hud__masks" aria-label={`${hud.masks} vies`}>
                {Array.from({ length: MAX_MASKS }, (_, i) => (
                  <i key={i} className={i < hud.masks ? "on" : ""} />
                ))}
              </div>
              <div className="hud__kebabs">🍟 {hud.frites}</div>
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
              {SKINS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={skin === s}
                  className={`skin${skin === s ? " skin--on" : ""}`}
                  onClick={() => pickSkin(s)}
                >
                  <SpritePreview skin={s} scale={3} />
                  <span className="mono">{SKIN_NAMES[s]}</span>
                </button>
              ))}
            </div>
            <p className="mono arcade__hint">
              {isLili ? "Tu joues Lili : c'est Sparrow qui te court après." : "Lili te court après. Ne te retourne pas."}
            </p>
            <button type="button" className="btn btn--primary arcade__start" onClick={begin}>
              ▶ Jouer
            </button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => { void refreshBoard(); setScreen("board"); }}>
              🏆 Classement des potes
            </button>
            <ul className="arcade__rules mono">
              <li>
                <b>TOUCHER</b> = sauter · deux fois = double saut
              </li>
              <li>Calendriers, horloges, lundis volants et trous entre les toits</li>
              <li>
                🍟 Frites = −{FRITES_DAYS} jours · Masque = +1 vie · Sablier = ralenti
              </li>
              <li>Fais tomber le compteur de {fr(START_DAYS)} à 0</li>
            </ul>
            {best > 0 && <p className="mono arcade__best">RECORD SUR CE TÉLÉPHONE : {fr(best)} JOURS</p>}
          </div>
        )}

        {screen === "board" && (
          <div className="arcade__overlay arcade__overlay--title">
            <p className="mono arcade__kicker">{board?.global ? "CLASSEMENT GÉNÉRAL" : "CLASSEMENT DE CE TÉLÉPHONE"}</p>
            <h2 className="arcade__big">LES PLUS FORTS</h2>
            {boardList(20, name)}
            {board && !board.global && (
              <p className="mono lb__note">Le classement partagé entre potes s&apos;active avec le stockage en ligne.</p>
            )}
            <button type="button" className="btn btn--primary arcade__start" onClick={() => setScreen("title")}>
              ← Retour
            </button>
          </div>
        )}

        {(screen === "over" || screen === "won") && (
          <div className={`arcade__overlay arcade__overlay--end${screen === "won" ? " is-won" : ""}`}>
            <p className="mono arcade__kicker">{screen === "won" ? "VERDICT DU JEU" : "GAME OVER"}</p>
            <h2 className="arcade__big">
              {screen === "won"
                ? last.skin === "lili"
                  ? "LILI S'EST ÉCHAPPÉE !"
                  : "SPARROW EST LIBÉRABLE !"
                : last.skin === "lili"
                  ? "ATTRAPÉE."
                  : "ATTRAPÉ."}
            </h2>
            <p className="mono arcade__line">
              {screen === "won"
                ? last.skin === "lili"
                  ? `Tu as semé Sparrow pendant ${fr(START_DAYS)} jours. Il cherche encore.`
                  : `Tu as fait tomber les ${fr(START_DAYS)} jours. Le vrai compteur, lui, n'a pas bougé d'une seconde.`
                : overLine}
            </p>
            <dl className="arcade__stats mono">
              <div>
                <dt>JOURS TOMBÉS</dt>
                <dd>{fr(last.done)}</dd>
              </div>
              <div>
                <dt>FRITES</dt>
                <dd>{last.frites}</dd>
              </div>
              <div>
                <dt>RECORD</dt>
                <dd>{fr(best)}</dd>
              </div>
            </dl>
            {record && <p className="mono arcade__record">★ NOUVEAU RECORD ★</p>}

            {!submitted ? (
              <form className="lb__form" onSubmit={submitScore}>
                <label className="mono" htmlFor="lb-name">
                  INSCRIS TON NOM AU TABLEAU
                </label>
                <div className="lb__row">
                  <input
                    id="lb-name"
                    className="mono"
                    value={name}
                    onChange={(e) => setName(e.target.value.toUpperCase())}
                    maxLength={NAME_MAX}
                    placeholder="TON PSEUDO"
                    autoComplete="nickname"
                    autoCapitalize="characters"
                    enterKeyHint="send"
                  />
                  <button type="submit" className="btn btn--primary" disabled={sending}>
                    {sending ? "…" : "OK"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="lb__wrap">
                <p className="mono lb__me">
                  {myRank ? `TU ES ${myRank === 1 ? "1ER" : `${myRank}ᵉ`} ${board?.global ? "CHEZ LES POTES" : "SUR CE TÉLÉPHONE"}` : ""}
                </p>
                {boardList(5, cleanName(name))}
              </div>
            )}

            <div className="arcade__actions">
              <button type="button" className="btn btn--primary" onClick={begin}>
                Rejouer
              </button>
              <button type="button" className="btn" onClick={share}>
                Défier les potes
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setScreen("title")}>
                Menu
              </button>
            </div>
          </div>
        )}
      </div>
      <Toast text={toastText} />
    </div>
  );
}
