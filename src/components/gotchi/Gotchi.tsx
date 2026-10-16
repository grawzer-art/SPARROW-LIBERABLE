"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TROPHIES } from "@/lib/gotchi/achievements";
import {
  COOLDOWN,
  STATS,
  act,
  ageJours,
  buy,
  cacheSpot,
  canFarm,
  catchUp,
  claim,
  claimable,
  cooldownLeft,
  ensureMissions,
  equipAndCheck,
  farmReward,
  findCache,
  isEquipped,
  mood as moodOf,
  newState,
  randomEvent,
  restore,
  tick,
  type Action,
  type FarmResult,
  type Mood,
  type Note,
  type Result,
  type State,
} from "@/lib/gotchi/engine";
import { ITEMS, titleFor, xpToNext, type Slot } from "@/lib/gotchi/items";
import { playLine, roomLine, type PlayLine } from "@/lib/gotchi/dialogue";
import { missionDef } from "@/lib/gotchi/missions";
import { restorePos, type Interactable, type ObjectId } from "@/lib/gotchi/room";
import { load, save } from "@/lib/storage";
import { Chiptune } from "../game/audio";
import { Toast } from "../Overlays";
import { FarmGame, type FarmSummary } from "./FarmGame";
import { Joystick } from "./Joystick";
import { ROOMS, VIEW_H, VIEW_W, World, WORLD_W, type Activity } from "./world";

const KEY = "sp.gotchi.v1"; // même clé qu'en v1 : la progression existante est migrée, jamais effacée
const SOUND_KEY = "sp.gotchi.sound";
const POS_KEY = "sp.gotchi.pos";

/** Objets qui déclenchent une vraie action du jeu. */
const OBJ_ACTION: Partial<Record<ObjectId, Action>> = { friteuse: "frites", table: "salade", canape: "sieste", douche: "douche" };

const ACTIONS: { id: Action; icon: string; label: string }[] = [
  { id: "frites", icon: "🍟", label: "Frites" },
  { id: "salade", icon: "🥗", label: "Salade" },
  { id: "dofus", icon: "🎮", label: "Dofus" },
  { id: "sieste", icon: "🛋️", label: "Micro-sieste" },
  { id: "douche", icon: "🚿", label: "Rafraîchir" },
  { id: "parler", icon: "💬", label: "Parler" },
];

const MOOD_LABEL: Record<Mood, string> = {
  content: "AU TOP",
  neutre: "STABLE",
  affame: "RÉCLAME DES FRITES",
  creve: "ÉPUISÉ (NIE TOUT)",
  deprime: "DÉPRIMÉ",
  gras: "FRITOMAN",
  focus: "ULTRA FOCUS",
  rage: "EN RAGE",
  dofus: "SESSION DOFUS",
  boude: "BOUDE",
  degout: "DÉGOÛTÉ",
  crise: "CRISE DRAMATIQUE",
};

const SLOTS: { id: Slot; label: string }[] = [
  { id: "lunettes", label: "Lunettes" },
  { id: "tenue", label: "Tenues" },
  { id: "tete", label: "Têtes" },
  { id: "deco", label: "Déco" },
];

type Sheet = "missions" | "sac" | "trophees" | "journal" | "options" | null;

interface Queued {
  line: string;
  anim: Activity;
  scene?: Result["scene"];
  rarity?: Result["rarity"];
  notes: Note[];
}

const hhmm = (t: number) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(
    new Date(t),
  );

export function Gotchi() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<State | null>(null);
  const world = useRef<World | null>(null);
  const audio = useRef(new Chiptune());
  const queue = useRef<Queued[]>([]);
  const lastSay = useRef(0);
  const reduced = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lineTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState(0);
  const [line, setLine] = useState<string | null>(null);
  const [typed, setTyped] = useState(0);
  const [delta, setDelta] = useState<{ key: number; d: Result["delta"] } | null>(null);
  const [sound, setSound] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [slot, setSlot] = useState<Slot>("lunettes");
  const [farming, setFarming] = useState(false);
  const [room, setRoom] = useState(2);
  const [legend, setLegend] = useState(false);
  const [near, setNear] = useState<Interactable | "cache" | null>(null);
  const playStats = useRef({ bumps: 0, walked: 0, rooms: new Set<number>(), manual: false, lastLine: 0 });

  const toast = useCallback((m: string) => {
    setToastText(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 3200);
  }, []);

  const commit = useCallback((s: State) => {
    stateRef.current = s;
    setState(s);
    save(KEY, s);
  }, []);

  const say = useCallback((text: string) => {
    lastSay.current = Date.now();
    setLine(text);
    setTyped(0);
    clearTimeout(lineTimer.current);
    lineTimer.current = setTimeout(() => setLine(null), Math.max(4500, text.length * 70));
  }, []);

  const announce = useCallback(
    (notes: Note[]) => {
      if (!notes.length) return;
      toast(notes.map((n) => n.txt).join(" · "));
      const au = audio.current;
      if (notes.some((n) => n.kind === "level")) {
        au.milestone();
        navigator.vibrate?.([30, 40, 30, 40, 60]);
      } else if (notes.some((n) => n.kind === "drop" || n.kind === "trophy")) au.win();
      else au.coin();
    },
    [toast],
  );

  /** Joue une séquence dans l'appartement ; la réplique arrive quand il est au bon meuble. */
  const perform = useCallback(
    (q: Queued, of?: string) => {
      const w = world.current;
      const show = () => {
        say(q.line);
        announce(q.notes);
        if (q.rarity === "legendaire") {
          setLegend(true);
          setTimeout(() => setLegend(false), 2600);
          audio.current.win();
          navigator.vibrate?.([60, 40, 60, 40, 120]);
        }
      };
      if (!w) return show();
      w.play(q.anim, { of, scene: q.scene, onAct: show, reduced: reduced.current });
    },
    [announce, say],
  );

  // Chargement + rattrapage du temps passé (migration v1 → v2 transparente)
  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    world.current = new World(restorePos(load<unknown>(POS_KEY, null)));
    const t = Date.now();
    const raw = load<unknown>(KEY, null);
    const before = raw ? restore(raw, t) : newState(t);
    const back = raw ? catchUp(before, t) : null;
    let after = back ? back.state : ensureMissions(tick(before, t), t);
    if (!raw) say("Salut. Je suis Sparrow. Bienvenue dans mon appart. Tu me dois des frites.");
    else if (back) {
      say(back.welcome);
      for (const e of back.events) queue.current.push({ line: e.line, anim: e.anim, scene: e.scene, rarity: e.rarity, notes: e.notes });
    } else {
      const ev = randomEvent(after, t);
      if (ev && ev.anim !== "parler") {
        after = ev.state;
        queue.current.push({ line: ev.line, anim: ev.anim, scene: ev.scene, rarity: ev.rarity, notes: ev.notes });
      }
      say(ev?.anim === "parler" ? ev.line : "Ah, te revoilà. J'avais pas remarqué que t'étais parti.");
    }
    commit(after);
    setNow(t);
    const snd = load<boolean>(SOUND_KEY, false);
    setSound(snd);
    audio.current.enabled = snd;
  }, [commit, say]);

  // Le temps passe pendant que l'écran est ouvert ; événements aléatoires
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      if (!s || document.visibilityState !== "visible") return;
      const t = Date.now();
      setNow(t);
      const back = catchUp(s, t);
      if (back) {
        commit(back.state);
        say(back.welcome);
        for (const e of back.events) queue.current.push({ line: e.line, anim: e.anim, scene: e.scene, rarity: e.rarity, notes: e.notes });
      } else commit(ensureMissions(tick(s, t), t));
      const w = world.current;
      if (w) setRoom(w.room);
      if (queue.current.length && w && !w.busy && !w.manual && t - lastSay.current > 4500) perform(queue.current.shift()!);
      if (w) {
        save(POS_KEY, w.pos);
        // Répliques selon ce que fait vraiment le joueur (rythme limité).
        const ps = playStats.current;
        let kind: PlayLine | "room" | null = null;
        if (w.manual && !ps.manual) kind = "start";
        else if (w.bumps - ps.bumps >= 2) kind = "bump";
        else if (w.walked - ps.walked > 700) kind = "long";
        else if (w.manual && !ps.rooms.has(w.room)) kind = "room";
        ps.manual = w.manual;
        if (w.manual) ps.rooms.add(w.room);
        if (kind && t - ps.lastLine > 20_000 && t - lastSay.current > 6000 && !w.busy) {
          ps.lastLine = t;
          ps.bumps = w.bumps;
          ps.walked = w.walked;
          say(kind === "room" ? roomLine(w.room, s.said) : playLine(kind, s.said));
        } else if (kind === "bump") ps.bumps = w.bumps;
      }
    }, 1000);
    const ev = setInterval(() => {
      const s = stateRef.current;
      if (!s || document.visibilityState !== "visible" || world.current?.busy || world.current?.manual || queue.current.length) return;
      const r = randomEvent(s, Date.now());
      if (r) {
        commit(r.state);
        queue.current.push({ line: r.line, anim: r.anim, scene: r.scene, rarity: r.rarity, notes: r.notes });
        if (r.anim === "crise") navigator.vibrate?.([80, 60, 80]);
      }
    }, 38_000);
    const onVis = () => {
      const s = stateRef.current;
      if (s && document.visibilityState === "hidden") save(KEY, tick(s, Date.now()));
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      clearInterval(ev);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [commit, perform, say]);

  // Objet à portée (bouton d'action contextuel)
  useEffect(() => {
    const id = setInterval(() => {
      const w = world.current;
      const s = stateRef.current;
      if (!w || !s) return;
      const n: Interactable | "cache" | null = w.nearCache(cacheSpot(s, Date.now(), WORLD_W)) ? "cache" : w.near();
      setNear((prev) => (prev === n ? prev : n));
    }, 150);
    return () => clearInterval(id);
  }, []);

  // Clavier (ordinateur) : flèches / ZQSD / WASD, Entrée ou Espace pour l'action
  useEffect(() => {
    const keys = new Set<string>();
    const sync = () => {
      const w = world.current;
      if (!w) return;
      const has = (...k: string[]) => k.some((x) => keys.has(x));
      w.input = {
        x: (has("arrowright", "d") ? 1 : 0) - (has("arrowleft", "q", "a") ? 1 : 0),
        y: (has("arrowdown", "s") ? 1 : 0) - (has("arrowup", "z", "w") ? 1 : 0),
      };
    };
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLButtonElement) return;
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "z", "q", "s", "d", "w", "a"].includes(k)) {
        keys.add(k);
        sync();
        e.preventDefault();
      } else if (k === "enter" || k === " " || k === "e") {
        document.querySelector<HTMLButtonElement>(".gt-pad__a")?.click();
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      sync();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // Effet machine à écrire sur la bulle
  useEffect(() => {
    if (!line || typed >= line.length) return;
    const id = setTimeout(() => setTyped((n) => n + 2), 22);
    return () => clearTimeout(id);
  }, [line, typed]);

  // Rendu du monde
  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    let raf = 0;
    let last = performance.now();
    const frame = (n: number) => {
      const s = stateRef.current;
      const w = world.current;
      if (s && w) {
        const t = Date.now();
        w.draw(
          ctx,
          {
            mood: moodOf(s, t),
            look: { lunettes: s.equip.lunettes, tenue: s.equip.tenue, tete: s.equip.tete, barbe: s.level >= 6 },
            deco: s.equip.deco,
            pcBroken: s.pcBrokenUntil > t,
            cache: cacheSpot(s, t, WORLD_W),
            reduced: reduced.current,
          },
          (n - last) / 1000,
        );
      }
      last = n;
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
    setDelta({ key: t, d: r.delta });
    perform({ line: r.line, anim: r.anim, notes: r.notes }, a);
    const au = audio.current;
    if (r.anim === "refus" || r.anim === "rage" || r.anim === "boude") au.hit();
    else if (r.anim === "drop" || r.anim === "victoire" || r.anim === "miracle") au.win();
    else if (r.anim === "gras") au.power();
    else if (a === "frites" || a === "salade") au.coin();
    else au.jump(false);
    navigator.vibrate?.(r.anim === "refus" || r.anim === "rage" ? [40, 40, 40] : 15);
  };

  const openFarm = () => {
    const s = stateRef.current;
    if (!s) return;
    const t = Date.now();
    if (!canFarm(s, t)) {
      toast(`PC en panne. Réparation dans ${Math.ceil((s.pcBrokenUntil - t) / 60_000)} min.`);
      return;
    }
    setSheet(null);
    setFarming(true);
  };

  const onFarmFinish = useCallback(
    (r: FarmResult): FarmSummary => {
      const s = stateRef.current!;
      const res = farmReward(s, r, Date.now());
      commit(res.state);
      return {
        coins: res.coins,
        xp: res.xp,
        drop: res.drop?.name ?? null,
        record: res.record,
        notes: res.notes.filter((n) => n.kind !== "drop").map((n) => n.txt),
      };
    },
    [commit],
  );

  const closeFarm = () => {
    setFarming(false);
    world.current?.play("victoire", { of: "dofus", reduced: reduced.current });
    say("Session terminée. Je suis épuisé, mais riche. Enfin, riche en Frit'pièces.");
  };

  const collect = () => {
    const s = stateRef.current;
    if (!s) return;
    const r = findCache(s, Date.now());
    if (r) {
      commit(r.state);
      say(r.line);
      announce(r.notes);
    }
  };

  /** Utiliser un objet : il y marche, puis l'action se joue (ou le mini-jeu s'ouvre). */
  const interact = (o: Interactable) => {
    const w = world.current;
    const s = stateRef.current;
    if (!w || !s) return;
    const a = OBJ_ACTION[o.id];
    if (a) return doAction(a);
    if (o.id === "pc") {
      if (!canFarm(s, Date.now())) {
        w.goTo("pc", () => say("Le PC est en panne. Je le fixe du regard, ça va le réparer."), reduced.current);
        return;
      }
      w.goTo("pc", () => setTimeout(openFarm, reduced.current ? 0 : 450), reduced.current);
      return;
    }
    w.goTo(o.id, () => say(playLine(o.id as PlayLine, s.said)), reduced.current);
  };

  const onCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    const w = world.current;
    if (!s || !w) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const py = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    const t = Date.now();
    const spot = cacheSpot(s, t, WORLD_W);
    const what = w.hit(px, py, { cache: spot });
    if (what.kind === "cache" && spot) w.goTo(spot, collect, reduced.current);
    else if (what.kind === "object") interact(what.obj);
    else if (what.kind === "sparrow") doAction("parler");
    else if (what.kind === "floor") w.goTo(what.pos, undefined, reduced.current);
  };

  /** Bouton d'action contextuel (A). */
  const actionA = () => {
    if (near === "cache") collect();
    else if (near) interact(near);
    else doAction("parler");
  };

  const goRoom = (i: number) => {
    world.current?.goRoom(i, reduced.current);
    setRoom(i);
  };

  const doClaim = (id: string) => {
    const s = stateRef.current;
    if (!s) return;
    const r = claim(s, id, Date.now());
    if (!r) return;
    commit(r.state);
    announce(r.notes);
  };

  const doBuy = (id: string) => {
    const s = stateRef.current;
    if (!s) return;
    const r = buy(s, id, Date.now());
    if (r.ok) {
      commit(r.state);
      audio.current.coin();
    } else audio.current.hit();
    toast(r.msg);
  };

  const doEquip = (id: string) => {
    const s = stateRef.current;
    if (!s) return;
    const r = equipAndCheck(s, id, Date.now());
    commit(r.state);
    announce(r.notes);
  };

  const exportSave = async () => {
    const s = stateRef.current;
    if (!s) return;
    const json = JSON.stringify({ app: "sparrowgotchi", v: 2, exported: Date.now(), state: s }, null, 1);
    const name = `sparrowgotchi-${new Date().toISOString().slice(0, 10)}.json`;
    const file = typeof File !== "undefined" ? new File([json], name, { type: "application/json" }) : null;
    try {
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Sauvegarde Sparrowgotchi" });
        return;
      }
    } catch {
      /* partage annulé : on propose le téléchargement */
    }
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("Sauvegarde exportée.");
  };

  const importSave = async (f: File | undefined) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const raw = data && typeof data === "object" && "state" in data ? data.state : data;
      if (!raw || typeof raw !== "object" || !("stats" in raw)) throw new Error("format");
      if (!window.confirm("Remplacer le Sparrow actuel par cette sauvegarde ?")) return;
      const t = Date.now();
      commit(ensureMissions(tick(restore(raw, t), t), t));
      say("Je me sens… importé. C'est bizarre, mais j'ai toujours faim.");
      toast("Sauvegarde importée.");
    } catch {
      toast("Fichier illisible. Ce n'est pas une sauvegarde Sparrowgotchi.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const reset = () => {
    if (!window.confirm("Adopter un nouveau Sparrow ? Niveau, objets et trophées seront perdus. (Exporte d'abord ta sauvegarde !)")) return;
    commit(ensureMissions(newState(Date.now()), Date.now()));
    setSheet(null);
    say("Nouveau Sparrow, mêmes exigences. Frites, s'il te plaît.");
  };

  const toggleSound = () => {
    const v = !sound;
    setSound(v);
    audio.current.enabled = v;
    save(SOUND_KEY, v);
    if (v) audio.current.coin();
  };

  const t = now || Date.now();
  const m = state ? moodOf(state, t) : "neutre";
  const toClaim = state ? claimable(state) : 0;
  const need = state ? xpToNext(state.level) : 1;
  const trophyCount = state ? Object.keys(state.trophies).length : 0;

  return (
    <div className={`gt${legend ? " is-legend" : ""}`}>
      <header className="gt-bar mono">
        <a href="/jeu">← JEUX</a>
        <span className="gt-bar__title">SPARROWGOTCHI</span>
        <button type="button" onClick={toggleSound} aria-pressed={sound}>
          {sound ? "SON ●" : "SON ○"}
        </button>
      </header>

      <main className="gt-main">
        {state && (
          <div className="gt-prog mono">
            <span className="gt-prog__lvl">NIV {state.level}</span>
            <div className="gt-prog__xp" role="meter" aria-label="Expérience" aria-valuemin={0} aria-valuemax={need} aria-valuenow={state.xp}>
              <i style={{ transform: `scaleX(${state.xp / need})` }} />
              <span>{titleFor(state.level)}</span>
            </div>
            <span className="gt-prog__coins" aria-label={`${state.coins} Frit'pièces`}>
              🍟 {state.coins}
            </span>
          </div>
        )}

        <div className="gt-bubble-wrap" aria-live="polite">
          {line && (
            <p className="gt-bubble" key={line}>
              {line.slice(0, typed)}
              <span className="sr-only">{line}</span>
            </p>
          )}
        </div>

        <div className={`gt-screen gt-screen--${m}`}>
          <canvas
            ref={canvas}
            width={VIEW_W}
            height={VIEW_H}
            className="gt-screen__canvas"
            onPointerDown={onCanvas}
            aria-label="L'appartement de Sparrow. Touche un objet ou un endroit pour qu'il y aille, ou Sparrow pour lui parler."
            role="img"
          />
          <div className="gt-screen__status mono">
            <span>{MOOD_LABEL[m]}</span>
            {state && <span>J+{ageJours(state, t)}</span>}
          </div>
        </div>
        <div className="gt-pad">
          <Joystick
            onMove={(x, y) => {
              if (world.current) world.current.input = { x, y };
            }}
          />
          <div className="gt-pad__side">
            <p className="gt-pad__ctx mono" aria-live="polite">
              {near === "cache" ? "Objet caché !" : near ? near.label : "Approche-toi d'un objet"}
            </p>
            <button type="button" className={`gt-pad__a${near ? " is-ready" : ""}`} onClick={actionA}>
              <span aria-hidden="true">A</span>
              <em className="mono">{near === "cache" ? "Ramasser" : near ? "Utiliser" : "Parler"}</em>
            </button>
          </div>
        </div>
        <nav className="gt-rooms mono" aria-label="Aller dans une pièce">
          {ROOMS.map((r, i) => (
            <button key={r.id} type="button" className={room === i ? "is-on" : ""} onClick={() => goRoom(i)}>
              {r.label}
            </button>
          ))}
        </nav>

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
            const left = state ? cooldownLeft(state, a.id, t) : 0;
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

        <nav className="gt-menu mono" aria-label="Menus">
          <button type="button" onClick={openFarm}>
            🖥️<span>Farm</span>
          </button>
          <button type="button" onClick={() => setSheet("missions")}>
            📋<span>Missions</span>
            {toClaim > 0 && <b className="gt-badge">{toClaim}</b>}
          </button>
          <button type="button" onClick={() => setSheet("sac")}>
            🎒<span>Sac</span>
          </button>
          <button type="button" onClick={() => setSheet("trophees")}>
            🏆<span>Trophées</span>
          </button>
          <button type="button" onClick={() => setSheet("journal")}>
            📰<span>Journal</span>
          </button>
          <button type="button" onClick={() => setSheet("options")}>
            ⚙️<span>Options</span>
          </button>
        </nav>
      </main>

      {sheet && state && (
        <div className="gt-sheet-wrap" onClick={() => setSheet(null)}>
          <section className="gt-sheet" role="dialog" aria-modal="true" aria-label={sheet} onClick={(e) => e.stopPropagation()}>
            <header className="gt-sheet__head mono">
              <span>
                {sheet === "missions" && "MISSIONS DU JOUR"}
                {sheet === "sac" && `SAC & BOUTIQUE · 🍟 ${state.coins} FP`}
                {sheet === "trophees" && `TROPHÉES · ${trophyCount}/${TROPHIES.length}`}
                {sheet === "journal" && "JOURNAL DE SPARROW"}
                {sheet === "options" && "OPTIONS"}
              </span>
              <button type="button" onClick={() => setSheet(null)} aria-label="Fermer">
                ✕
              </button>
            </header>
            <div className="gt-sheet__body">
              {sheet === "missions" && (
                <>
                  <p className="gt-sheet__note mono">Trois missions par jour, renouvelées à minuit. Rien n&apos;est perdu si tu ne les fais pas.</p>
                  {state.missions.list.map((mi) => {
                    const d = missionDef(mi.id);
                    if (!d) return null;
                    const done = mi.progress >= d.n;
                    return (
                      <div key={mi.id} className={`gt-row${mi.claimed ? " is-done" : ""}`}>
                        <div className="gt-row__main">
                          <p className="gt-row__title">{d.txt}</p>
                          <div className="gt-row__bar">
                            <i style={{ transform: `scaleX(${Math.min(1, mi.progress / d.n)})` }} />
                          </div>
                          <p className="gt-row__meta mono">
                            {Math.min(mi.progress, d.n)}/{d.n} · +{d.coins} FP · +{d.xp} XP
                          </p>
                        </div>
                        {mi.claimed ? (
                          <span className="gt-row__tag mono">ENCAISSÉ</span>
                        ) : (
                          <button type="button" className="btn btn--sm" disabled={!done} onClick={() => doClaim(mi.id)}>
                            {done ? "Encaisser" : "En cours"}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {sheet === "sac" && (
                <>
                  <div className="gt-tabs mono" role="tablist">
                    {SLOTS.map((s) => (
                      <button key={s.id} type="button" role="tab" aria-selected={slot === s.id} className={slot === s.id ? "is-on" : ""} onClick={() => setSlot(s.id)}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                  {ITEMS.filter((it) => it.slot === slot).map((it) => {
                    const owned = state.owned.includes(it.id);
                    const on = isEquipped(state, it.id);
                    if (it.rare && !owned)
                      return (
                        <div key={it.id} className="gt-row is-locked">
                          <div className="gt-row__main">
                            <p className="gt-row__title">??? Objet rare</p>
                            <p className="gt-row__meta mono">Uniquement en drop : farm, événements…</p>
                          </div>
                        </div>
                      );
                    return (
                      <div key={it.id} className={`gt-row${on ? " is-on" : ""}${it.rare ? " is-rare" : ""}`}>
                        <div className="gt-row__main">
                          <p className="gt-row__title">
                            {it.name}
                            {it.rare && <em className="mono"> RARE</em>}
                          </p>
                          <p className="gt-row__meta">{it.desc}</p>
                        </div>
                        {owned ? (
                          it.price === 0 && !it.rare && it.slot !== "deco" && on ? (
                            <span className="gt-row__tag mono">PORTÉ</span>
                          ) : (
                            <button type="button" className={`btn btn--sm${on ? " btn--ghost" : ""}`} onClick={() => doEquip(it.id)} disabled={on && it.slot !== "deco"}>
                              {on ? (it.slot === "deco" ? "Retirer" : "Porté") : it.slot === "deco" ? "Installer" : "Équiper"}
                            </button>
                          )
                        ) : (
                          <button type="button" className="btn btn--sm" onClick={() => doBuy(it.id)} disabled={state.level < it.level}>
                            {state.level < it.level ? `Niv ${it.level}` : `${it.price} FP`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </>
              )}

              {sheet === "trophees" &&
                TROPHIES.map((tr) => {
                  const got = state.trophies[tr.id];
                  const hidden = tr.secret && !got;
                  return (
                    <div key={tr.id} className={`gt-row${got ? " is-on" : " is-locked"}`}>
                      <div className="gt-row__main">
                        <p className="gt-row__title">{hidden ? "??? Trophée secret" : tr.name}</p>
                        <p className="gt-row__meta">{hidden ? "Continue à vivre ta vie de Sparrow. Ça viendra." : tr.desc}</p>
                      </div>
                      <span className="gt-row__tag mono">{got ? "✓" : `+${tr.coins}`}</span>
                    </div>
                  );
                })}

              {sheet === "journal" &&
                (state.journal.length ? (
                  [...state.journal].reverse().map((j, i) => (
                    <div key={`${j.t}-${i}`} className={`gt-log gt-log--${j.kind}`}>
                      <span className="mono">{hhmm(j.t)}</span>
                      <p>{j.txt}</p>
                    </div>
                  ))
                ) : (
                  <p className="gt-sheet__note mono">Rien pour l&apos;instant. Sparrow vit sa vie, reviens plus tard.</p>
                ))}

              {sheet === "options" && (
                <>
                  <div className="gt-opts">
                    <button type="button" className="btn btn--sm" onClick={toggleSound}>
                      Son : {sound ? "activé" : "coupé"}
                    </button>
                    <button type="button" className="btn btn--sm" onClick={exportSave}>
                      Exporter la sauvegarde
                    </button>
                    <button type="button" className="btn btn--sm" onClick={() => fileInput.current?.click()}>
                      Importer une sauvegarde
                    </button>
                    <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => importSave(e.target.files?.[0])} />
                  </div>
                  <dl className="gt-dossier mono">
                    <div>
                      <dt>Adopté depuis</dt>
                      <dd>{ageJours(state, t)} j</dd>
                    </div>
                    <div>
                      <dt>Portions de frites</dt>
                      <dd>{state.counters.frites}</dd>
                    </div>
                    <div>
                      <dt>Fritoman</dt>
                      <dd>{state.counters.fritoman}</dd>
                    </div>
                    <div>
                      <dt>Salades acceptées / refusées</dt>
                      <dd>
                        {state.counters.salade} / {state.counters.saladeRefus}
                      </dd>
                    </div>
                    <div>
                      <dt>Sessions de farm · record</dt>
                      <dd>
                        {state.counters.farms} · {state.bestFarm}
                      </dd>
                    </div>
                    <div>
                      <dt>Siestes refusées</dt>
                      <dd>{state.counters.siestesRefusees}</dd>
                    </div>
                    <div>
                      <dt>Événements vécus</dt>
                      <dd>{state.counters.events}</dd>
                    </div>
                    <div>
                      <dt>Crises dramatiques</dt>
                      <dd>{state.counters.crises}</dd>
                    </div>
                  </dl>
                  <p className="gt-sheet__note mono">
                    Sauvegarde locale, sur ce téléphone uniquement. Sparrow vit sa vie même quand l&apos;appli est fermée. Il ne meurt jamais : il boude, au pire.
                  </p>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={reset}>
                    Adopter un nouveau Sparrow
                  </button>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {farming && state && (
        <FarmGame audio={audio.current} best={state.bestFarm} reduced={reduced.current} onFinish={onFarmFinish} onClose={closeFarm} />
      )}
      <Toast text={toastText} />
    </div>
  );
}
