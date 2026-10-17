"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mirrorLine, playLine, roomLine, type PlayLine } from "@/lib/gotchi/dialogue";
import {
  STATS,
  act,
  buy,
  cacheSeed,
  canFarm,
  catchUp,
  claim,
  claimable,
  cooldownLeft,
  ensureMissions,
  equipAndCheck,
  farmReward,
  findCache,
  mood as moodOf,
  muscuReward,
  newState,
  parisHour,
  randomEvent,
  restore,
  tick,
  type Action,
  type FarmResult,
  type Mood,
  type MuscuResult,
  type Note,
  type Result,
  type State,
} from "@/lib/gotchi/engine";
import { muscleStage, tierOf, titleFor, xpToNext } from "@/lib/gotchi/items";
import { ROOMS, cachePlace, restorePlace, type Place, type RoomId, type Spot } from "@/lib/gotchi/map";
import { MINIGAMES, type GameId } from "@/lib/gotchi/minigames";
import { load, save } from "@/lib/storage";
import { Chiptune } from "../game/audio";
import { Toast } from "../Overlays";
import { DPad, type Dir } from "./DPad";
import { FarmGame, type FarmSummary } from "./FarmGame";
import { MuscuGame, type MuscuSummary } from "./MuscuGame";
import { MENU, Page, type PageId } from "./Pages";
import { VIEW_H, VIEW_W, World, type Activity } from "./world";

const KEY = "sp.gotchi.v1"; // même clé depuis la v1 : la progression existante est migrée, jamais effacée
const SOUND_KEY = "sp.gotchi.sound";
const POS_KEY = "sp.gotchi.place";

const MOOD_LABEL: Record<Mood, string> = {
  content: "AU TOP",
  neutre: "STABLE",
  affame: "A FAIM",
  creve: "ÉPUISÉ",
  deprime: "DÉPRIMÉ",
  gras: "FRITOMAN",
  focus: "FOCUS",
  rage: "EN RAGE",
  dofus: "EN SESSION",
  boude: "BOUDE",
  degout: "DÉGOÛTÉ",
  crise: "CRISE",
};

const GAUGE: Record<string, string> = { satiete: "FAI", humeur: "HUM", energie: "ÉNE", forme: "FOR", fun: "GAM" };

interface Queued {
  line: string;
  anim: Activity;
  scene?: Result["scene"];
  rarity?: Result["rarity"];
  notes: Note[];
}

const lookOf = (s: State) => ({ lunettes: s.equip.lunettes, tenue: s.equip.tenue, tete: s.equip.tete, barbe: s.level >= 6, muscle: muscleStage(s.muscle) });

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
  const bannerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const cacheMemo = useRef<{ seed: number | null; place: Place | null }>({ seed: -1, place: null });
  const playStats = useRef({ bumps: 0, walked: 0, rooms: new Set<string>(), manual: false, lastLine: 0, roomChanges: 0 });

  const [state, setState] = useState<State | null>(null);
  const [now, setNow] = useState(0);
  const [line, setLine] = useState<string | null>(null);
  const [typed, setTyped] = useState(0);
  const [sound, setSound] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [page, setPage] = useState<PageId | null>(null);
  const [game, setGame] = useState<GameId | null>(null);
  const [room, setRoom] = useState<RoomId>("salon");
  const [banner, setBanner] = useState<string | null>(null);
  const [legend, setLegend] = useState(false);
  const [near, setNear] = useState<Spot | "cache" | null>(null);
  const [run, setRun] = useState(false);
  const uiRef = useRef({ menu, page, game });
  useEffect(() => {
    uiRef.current = { menu, page, game };
  }, [menu, page, game]);

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
    lineTimer.current = setTimeout(() => setLine(null), Math.max(5000, text.length * 75));
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

  const flashLegend = useCallback(() => {
    setLegend(true);
    setTimeout(() => setLegend(false), 2600);
    audio.current.win();
    navigator.vibrate?.([60, 40, 60, 40, 120]);
  }, []);

  /** Joue une séquence ; la réplique arrive quand il est au bon meuble. */
  const perform = useCallback(
    (q: Queued, of?: string) => {
      const show = () => {
        say(q.line);
        announce(q.notes);
        if (q.rarity === "legendaire") flashLegend();
      };
      const w = world.current;
      if (!w) return show();
      w.play(q.anim, { of, scene: q.scene, onAct: show, reduced: reduced.current });
    },
    [announce, flashLegend, say],
  );

  const cacheOf = useCallback((s: State, t: number) => {
    const seed = cacheSeed(s, t);
    if (cacheMemo.current.seed !== seed) cacheMemo.current = { seed, place: cachePlace(seed) };
    return cacheMemo.current.place;
  }, []);

  // Chargement + rattrapage du temps passé
  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const place = restorePlace(load<unknown>(POS_KEY, null));
    world.current = new World(place);
    setRoom(place.room);
    playStats.current.rooms.add(place.room);
    const t = Date.now();
    const raw = load<unknown>(KEY, null);
    const before = raw ? restore(raw, t) : newState(t);
    const back = raw ? catchUp(before, t) : null;
    let after = back ? back.state : ensureMissions(tick(before, t), t);
    if (!raw) say("Salut. Je suis Sparrow. Bienvenue dans mon appart. Croix pour marcher, A pour agir, START pour le menu. Et tu me dois des frites.");
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

  // Le temps passe ; événements aléatoires ; répliques selon ce que fait le joueur
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      const w = world.current;
      if (!s || !w || document.visibilityState !== "visible") return;
      const t = Date.now();
      setNow(t);
      const back = catchUp(s, t);
      if (back) {
        commit(back.state);
        say(back.welcome);
        for (const e of back.events) queue.current.push({ line: e.line, anim: e.anim, scene: e.scene, rarity: e.rarity, notes: e.notes });
      } else commit(ensureMissions(tick(s, t), t));
      save(POS_KEY, w.place);
      const ui = uiRef.current;
      const free = ui.menu === null && !ui.page && !ui.game;
      if (free && queue.current.length && !w.busy && !w.manual && t - lastSay.current > 4500) perform(queue.current.shift()!);
      const ps = playStats.current;
      let kind: PlayLine | "room" | null = null;
      if (w.manual && !ps.manual) kind = "start";
      else if (w.bumps - ps.bumps >= 2) kind = "bump";
      else if (w.walked - ps.walked > 900) kind = "long";
      else if (!ps.rooms.has(w.room)) kind = "room";
      ps.manual = w.manual;
      ps.rooms.add(w.room);
      if (free && kind && t - ps.lastLine > 20_000 && t - lastSay.current > 6000 && !w.busy) {
        ps.lastLine = t;
        ps.bumps = w.bumps;
        ps.walked = w.walked;
        say(kind === "room" ? roomLine(w.room, s.said) : playLine(kind, s.said));
      } else if (kind === "bump") ps.bumps = w.bumps;
    }, 1000);
    const ev = setInterval(() => {
      const s = stateRef.current;
      const w = world.current;
      if (!s || !w || document.visibilityState !== "visible" || w.busy || w.manual || queue.current.length || uiRef.current.game) return;
      const r = randomEvent(s, Date.now());
      if (r) {
        commit(r.state);
        queue.current.push({ line: r.line, anim: r.anim, scene: r.scene, rarity: r.rarity, notes: r.notes });
        if (r.anim === "crise") navigator.vibrate?.([80, 60, 80]);
      }
    }, 38_000);
    const onVis = () => {
      const s = stateRef.current;
      if (s && document.visibilityState === "hidden") {
        save(KEY, tick(s, Date.now()));
        if (world.current) save(POS_KEY, world.current.place);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      clearInterval(ev);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [commit, perform, say]);

  // Objet à portée + changement de pièce (bandeau)
  useEffect(() => {
    const id = setInterval(() => {
      const w = world.current;
      const s = stateRef.current;
      if (!w || !s) return;
      const n: Spot | "cache" | null = w.nearCache(cacheOf(s, Date.now())) ? "cache" : w.near();
      setNear((p) => (p === n ? p : n));
      const ps = playStats.current;
      if (w.roomChanges !== ps.roomChanges) {
        ps.roomChanges = w.roomChanges;
        setRoom(w.room);
        setBanner(ROOMS[w.room].name);
        clearTimeout(bannerTimer.current);
        bannerTimer.current = setTimeout(() => setBanner(null), 1500);
      }
    }, 120);
    return () => clearInterval(id);
  }, [cacheOf]);

  // Effet machine à écrire
  useEffect(() => {
    if (!line || typed >= line.length) return;
    const id = setTimeout(() => setTyped((n) => n + 2), 22);
    return () => clearTimeout(id);
  }, [line, typed]);

  // Rendu du monde
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
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
            look: lookOf(s),
            deco: s.equip.deco,
            tiers: { pc: tierOf(s.owned, "pc"), lit: tierOf(s.owned, "lit"), sport: tierOf(s.owned, "sport"), canape: tierOf(s.owned, "canape") },
            pcBroken: s.pcBrokenUntil > t,
            hour: parisHour(t),
            cache: cacheOf(s, t),
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
  }, [cacheOf]);

  // ─── Actions ───

  const openGame = useCallback(
    (g: GameId) => {
      const s = stateRef.current;
      const w = world.current;
      const def = MINIGAMES.find((m) => m.id === g);
      if (!s || !w || !def?.ready) return;
      setMenu(null);
      setPage(null);
      if (g === "farm" && !canFarm(s, Date.now())) {
        w.goTo("pc", () => say("Le PC est en panne. Je le fixe du regard, ça va le réparer."), reduced.current);
        toast(`PC en panne. Réparation dans ${Math.ceil((s.pcBrokenUntil - Date.now()) / 60_000)} min.`);
        return;
      }
      w.goTo(def.spot, () => setTimeout(() => setGame(g), reduced.current ? 0 : 450), reduced.current);
    },
    [say, toast],
  );

  const doAction = useCallback(
    (a: Action | "muscu", of?: string) => {
      if (a === "muscu") return openGame("muscu");
      const s = stateRef.current;
      if (!s) return;
      setMenu(null);
      setPage(null);
      const t = Date.now();
      const left = cooldownLeft(s, a, t);
      if (left > 0) {
        toast(`Doucement. Encore ${Math.ceil(left / 1000)} s.`);
        return;
      }
      const r = act(s, a, t);
      commit(r.state);
      setNow(t);
      perform({ line: r.line, anim: r.anim, notes: r.notes }, of ?? a);
      const au = audio.current;
      if (r.anim === "refus" || r.anim === "rage" || r.anim === "boude") au.hit();
      else if (r.anim === "drop" || r.anim === "victoire" || r.anim === "miracle") au.win();
      else if (r.anim === "gras") au.power();
      else if (a === "frites" || a === "salade") au.coin();
      else au.jump(false);
      navigator.vibrate?.(r.anim === "refus" || r.anim === "rage" ? [40, 40, 40] : 15);
    },
    [commit, openGame, perform, toast],
  );

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

  /** Utiliser un objet de l'appartement. */
  const interact = (sp: Spot) => {
    const w = world.current;
    const s = stateRef.current;
    if (!w || !s) return;
    switch (sp.id) {
      case "lit":
        return doAction("sieste");
      case "lavabo":
        return doAction("douche", "lavabo");
      case "douche":
        return doAction("douche");
      case "frigo":
        return doAction("salade");
      case "friteuse":
        return doAction("frites");
      case "pc":
        return openGame("farm");
      case "banc":
        return openGame("muscu");
      case "miroir":
        return w.goTo("miroir", () => say(mirrorLine(muscleStage(s.muscle), s.said)), reduced.current);
      default:
        return w.goTo(sp.id, () => say(playLine(sp.id as PlayLine, s.said)), reduced.current);
    }
  };

  const openPage = (p: PageId) => {
    setMenu(null);
    setPage(p);
    audio.current.coin();
  };

  const pressA = () => {
    if (page) return;
    if (menu !== null) return openPage(MENU[menu].id);
    if (line && typed < line.length) return setTyped(line.length);
    if (line) setLine(null);
    if (near === "cache") {
      world.current?.goTo(cacheOf(stateRef.current!, Date.now())!, collect, true);
    } else if (near) interact(near);
    else if (!line) doAction("parler");
  };

  const pressB = () => {
    if (page) return setPage(null);
    if (menu !== null) return setMenu(null);
    if (line) setLine(null);
    world.current?.cancel();
  };

  const toggleMenu = () => {
    if (page) return setPage(null);
    setMenu((m) => (m === null ? 0 : null));
    audio.current.jump(false);
  };

  const step = (d: Dir) => {
    setMenu((m) => {
      if (m === null) return m;
      const n = MENU.length;
      if (d === "up") return (m - 2 + n) % n;
      if (d === "down") return (m + 2) % n;
      if (d === "left") return m % 2 ? m - 1 : m;
      return m % 2 ? m : Math.min(n - 1, m + 1);
    });
  };

  const onCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    const w = world.current;
    if (!s || !w) return;
    if (menu !== null) return setMenu(null);
    if (line) setLine(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const py = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    const cache = cacheOf(s, Date.now());
    const h = w.hit(px, py, cache);
    if (h.kind === "cache" && cache) w.goTo(cache, collect, reduced.current);
    else if (h.kind === "spot") interact(h.spot);
    else if (h.kind === "sparrow") doAction("parler");
    else if (h.kind === "door") w.goDoor(h.door, reduced.current);
    else if (h.kind === "floor") w.goTo({ room: w.room, ...h.pos }, undefined, reduced.current);
  };

  const onFarmFinish = useCallback(
    (r: FarmResult): FarmSummary => {
      const res = farmReward(stateRef.current!, r, Date.now());
      commit(res.state);
      return { coins: res.coins, xp: res.xp, drop: res.drop?.name ?? null, record: res.record, notes: res.notes.filter((n) => n.kind !== "drop").map((n) => n.txt) };
    },
    [commit],
  );

  const onMuscuFinish = useCallback(
    (r: MuscuResult): MuscuSummary => {
      const res = muscuReward(stateRef.current!, r, Date.now());
      commit(res.state);
      return {
        coins: res.coins,
        xp: res.xp,
        gained: res.gained,
        stageUp: res.stageUp,
        record: res.record,
        notes: res.notes.filter((n) => !n.txt.startsWith("ÉVOLUTION")).map((n) => n.txt),
      };
    },
    [commit],
  );

  const closeGame = () => {
    const g = game;
    setGame(null);
    const s = stateRef.current;
    if (g === "muscu") {
      world.current?.play("victoire", { of: "muscu", reduced: reduced.current });
      const st = s ? muscleStage(s.muscle) : 0;
      if (st >= 4) {
        flashLegend();
        say("SPARROW TITAN ! Les murs tremblent. Le frigo aussi, mais ça, c'est la faim.");
      } else say(mirrorLine(st, s?.said ?? []));
    } else {
      world.current?.play("victoire", { of: "dofus", reduced: reduced.current });
      say("Session terminée. Je suis épuisé, mais riche. Enfin, riche en Frit'pièces.");
    }
  };

  // Clavier (ordinateur) : flèches / ZQSD, Entrée = A, Échap = B, M = START, Maj = courir
  const keyRef = useRef({ pressA, pressB, toggleMenu, step });
  useEffect(() => {
    keyRef.current = { pressA, pressB, toggleMenu, step };
  });
  useEffect(() => {
    const keys = new Set<string>();
    const sync = () => {
      const w = world.current;
      if (!w) return;
      const has = (...k: string[]) => k.some((x) => keys.has(x));
      const blocked = uiRef.current.menu !== null || !!uiRef.current.page;
      w.input = blocked
        ? { x: 0, y: 0 }
        : {
            x: (has("arrowright", "d") ? 1 : 0) - (has("arrowleft", "q", "a") ? 1 : 0),
            y: (has("arrowdown", "s") ? 1 : 0) - (has("arrowup", "z", "w") ? 1 : 0),
          };
      w.run = keys.has("shift");
    };
    const dirOf: Record<string, Dir> = { arrowup: "up", z: "up", w: "up", arrowdown: "down", s: "down", arrowleft: "left", q: "left", a: "left", arrowright: "right", d: "right" };
    const down = (e: KeyboardEvent) => {
      if (uiRef.current.game || e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (dirOf[k]) {
        if (!keys.has(k)) keyRef.current.step(dirOf[k]);
        keys.add(k);
        sync();
        e.preventDefault();
      } else if (k === "shift") {
        keys.add(k);
        sync();
      } else if (k === "enter" || k === " ") {
        keyRef.current.pressA();
        e.preventDefault();
      } else if (k === "escape" || k === "backspace") {
        keyRef.current.pressB();
        e.preventDefault();
      } else if (k === "m" || k === "tab") {
        keyRef.current.toggleMenu();
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

  // ─── Boutique, missions, sauvegarde ───

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
    if (!window.confirm("Adopter un nouveau Sparrow ? Niveau, objets, muscles et trophées seront perdus. (Exporte d'abord ta sauvegarde !)")) return;
    commit(ensureMissions(newState(Date.now()), Date.now()));
    setPage(null);
    say("Nouveau Sparrow, mêmes exigences. Frites, s'il te plaît.");
  };

  const toggleSound = () => {
    const v = !sound;
    setSound(v);
    audio.current.enabled = v;
    save(SOUND_KEY, v);
    if (v) audio.current.coin();
  };

  const setRunning = (v: boolean) => {
    setRun(v);
    if (world.current) world.current.run = v;
  };

  const t = now || Date.now();
  const m = state ? moodOf(state, t) : "neutre";
  const toClaim = state ? claimable(state) : 0;
  const need = state ? xpToNext(state.level) : 1;
  const hint = menu !== null ? "Ouvrir" : near === "cache" ? "Ramasser l'objet caché" : near ? near.label : line ? "Suite" : "Parler";

  return (
    <div className={`gb-wrap${legend ? " is-legend" : ""}`}>
      <header className="gt-bar mono">
        <a href="/jeu">← JEUX</a>
        <span className="gt-bar__title">SPARROWGOTCHI</span>
        <button type="button" onClick={toggleSound} aria-pressed={sound}>
          {sound ? "SON ●" : "SON ○"}
        </button>
      </header>

      <main className="gb">
        <div className="gb-bezel">
          <div className="gb-bezel__top mono">
            <span className="gb-led" aria-hidden="true" />
            <span>SPARROW·BOY</span>
            <span className="gb-bezel__mood">{MOOD_LABEL[m]}</span>
          </div>

          {state && (
            <div className="gb-hud mono">
              <span className="gb-hud__lvl">NIV {state.level}</span>
              <span className="gb-hud__rank">{titleFor(state.level)}</span>
              <span className="gb-hud__coins">{state.coins} FP</span>
              <div className="gb-hud__xp" aria-label={`Expérience ${state.xp} sur ${need}`}>
                <i style={{ transform: `scaleX(${state.xp / need})` }} />
              </div>
              <div className="gb-hud__gauges" aria-label="Jauges">
                {STATS.map(({ id, label }) => {
                  const v = state.stats[id];
                  return (
                    <span key={id} className={`gb-g${v < 25 ? " is-low" : ""}`} title={label} aria-label={`${label} ${Math.round(v)}`}>
                      <b>{GAUGE[id]}</b>
                      <i style={{ transform: `scaleX(${v / 100})` }} />
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`gb-screen gb-screen--${m}`}>
            <canvas
              ref={canvas}
              width={VIEW_W}
              height={VIEW_H}
              className="gb-screen__canvas"
              onPointerDown={onCanvas}
              role="img"
              aria-label="L'appartement de Sparrow. Touche un objet ou un endroit pour qu'il y aille."
            />
            {banner && <span className="gb-banner mono">{banner}</span>}
            {menu !== null && (
              <nav className="gb-menu mono" aria-label="Menu">
                <p className="gb-menu__title">MENU</p>
                <div className="gb-menu__grid">
                  {MENU.map((it, i) => (
                    <button key={it.id} type="button" className={menu === i ? "is-on" : ""} onClick={() => openPage(it.id)}>
                      <span className="gb-cursor">{menu === i ? "▶" : ""}</span>
                      {it.label}
                      {it.id === "missions" && toClaim > 0 && <b className="gb-badge">{toClaim}</b>}
                    </button>
                  ))}
                </div>
              </nav>
            )}
            {line && menu === null && (
              <button type="button" className="gb-dialog mono" onClick={() => (typed < line.length ? setTyped(line.length) : setLine(null))} aria-live="polite">
                <span>{line.slice(0, typed)}</span>
                <span className="sr-only">{line}</span>
                {typed >= line.length && (
                  <i className="gb-dialog__next" aria-hidden="true">
                    ▼
                  </i>
                )}
              </button>
            )}
          </div>

          <p className={`gb-hint mono${near ? " is-ready" : ""}`} aria-live="polite">
            <b>A</b> {hint}
          </p>
        </div>

        <div className="gb-controls">
          <DPad
            onMove={(x, y) => {
              if (world.current) world.current.input = menu === null && !page ? { x, y } : { x: 0, y: 0 };
            }}
            onStep={step}
          />
          <div className="gb-ab">
            <button
              type="button"
              className={`gb-key gb-key--b${run ? " is-down" : ""}`}
              onPointerDown={() => setRunning(true)}
              onPointerUp={() => setRunning(false)}
              onPointerLeave={() => setRunning(false)}
              onPointerCancel={() => setRunning(false)}
              onClick={pressB}
              aria-label="B : annuler, maintenir pour courir"
            >
              B
            </button>
            <button type="button" className={`gb-key gb-key--a${near ? " is-ready" : ""}`} onClick={pressA} aria-label={`A : ${hint}`}>
              A
            </button>
          </div>
          <div className="gb-startsel mono">
            <button type="button" onClick={() => openPage("jeux")} aria-label="SELECT : mini-jeux">
              <i />
              SELECT
            </button>
            <button type="button" onClick={toggleMenu} aria-label="START : menu">
              <i />
              START
              {toClaim > 0 && <b className="gb-badge">{toClaim}</b>}
            </button>
          </div>
        </div>
        <p className="gb-legend mono">START = MENU · SELECT = MINI-JEUX · B maintenu = courir</p>
      </main>

      {page && state && (
        <div className="gb-page-wrap">
          <Page
            page={page}
            state={state}
            now={t}
            sound={sound}
            room={room}
            onClose={() => setPage(null)}
            h={{
              doAction: (a) => doAction(a),
              playGame: openGame,
              claim: doClaim,
              buy: doBuy,
              equip: doEquip,
              goRoom: (r) => {
                setPage(null);
                world.current?.goTo({ room: r, x: 80, y: 90 }, undefined, reduced.current);
              },
              toggleSound,
              exportSave,
              importSave: () => fileInput.current?.click(),
              reset,
            }}
          />
        </div>
      )}
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => importSave(e.target.files?.[0])} />

      {game === "farm" && state && <FarmGame audio={audio.current} best={state.bestFarm} reduced={reduced.current} onFinish={onFarmFinish} onClose={closeGame} />}
      {game === "muscu" && state && (
        <MuscuGame
          audio={audio.current}
          best={state.bestMuscu}
          look={lookOf(state)}
          tier={tierOf(state.owned, "sport")}
          reduced={reduced.current}
          onFinish={onMuscuFinish}
          onClose={closeGame}
        />
      )}
      <Toast text={toastText} />
    </div>
  );
}
