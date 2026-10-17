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
import { MAP_H, MAP_W, NPCS, SPAWN, isSolid, restoreTile, type Door, type Zone } from "@/lib/rpg/quartier";
import { applyEffects, flag, status, type Effect } from "@/lib/rpg/quest";
import { evenement, examine, talkTo, type Conversation, type Line } from "@/lib/rpg/script";
import { load, save } from "@/lib/storage";
import { Chiptune } from "../game/audio";
import { Toast } from "../Overlays";
import { OW_H, OW_W, Overworld, type OwFrame } from "../rpg/overworld";
import { DPad, type Dir } from "./DPad";
import { FarmGame, type FarmSummary } from "./FarmGame";
import { MuscuGame, type MuscuSummary } from "./MuscuGame";
import { MENU, Page, type PageId } from "./Pages";
import { VIEW_H, VIEW_W, World, type Activity } from "./world";

const KEY = "sp.gotchi.v1"; // même clé depuis la v1 : la progression existante est migrée, jamais effacée
const SOUND_KEY = "sp.gotchi.sound";
const POS_KEY = "sp.gotchi.place";
const WHERE_KEY = "sp.gotchi.where";
/** L'appartement (160 × 144) est centré dans l'écran du RPG, comme les intérieurs des RPG portables. */
/** Échelle de l'appartement : ×1,5 dès que l'écran est assez haut (la pièce remplit alors la largeur). */
const aptScale = (h: number) => (h >= VIEW_H * 1.5 ? 1.5 : 1);
const aptBox = (h: number) => {
  const k = aptScale(h);
  return { k, x: Math.round((OW_W - VIEW_W * k) / 2), y: Math.round((h - VIEW_H * k) / 2) };
};
/** Hauteur de la vue (pixels de jeu) : elle s'adapte à l'espace libre sur le téléphone. */
const MIN_VH = 168;
const MAX_VH = 420;

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


interface Queued {
  line: string;
  anim: Activity;
  scene?: Result["scene"];
  rarity?: Result["rarity"];
  notes: Note[];
}

interface Conv {
  lines: Line[];
  i: number;
  effects: Effect[];
  cutscene?: Conversation["cutscene"];
  npc?: (typeof NPCS)[number]["id"];
  final?: boolean;
}

const lookOf = (s: State) => ({ lunettes: s.equip.lunettes, tenue: s.equip.tenue, tete: s.equip.tete, barbe: s.level >= 6, muscle: muscleStage(s.muscle) });
const owFrameOf = (s: State, reduced: boolean): OwFrame => ({
  gateOpen: flag(s.rpg, "portail"),
  questDone: status(s.rpg, "ville-figee") === "terminee",
  inconnuGone: flag(s.rpg, "inconnu-parti"),
  tenue: s.equip.tenue,
  reduced,
});

export function Gotchi() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const screenBox = useRef<HTMLDivElement>(null);
  const viewH = useRef(OW_H);
  const aptCanvas = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<State | null>(null);
  const world = useRef<World | null>(null);
  const ow = useRef<Overworld | null>(null);
  const whereRef = useRef<"appart" | "quartier">("appart");
  const audio = useRef(new Chiptune());
  const queue = useRef<Queued[]>([]);
  const lastSay = useRef(0);
  const reduced = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lineTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const bannerTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const banners = useRef<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const cacheMemo = useRef<{ seed: number | null; place: Place | null }>({ seed: -1, place: null });
  const playStats = useRef({ bumps: 0, walked: 0, rooms: new Set<string>(), manual: false, lastLine: 0, roomChanges: 0 });
  const convRef = useRef<Conv | null>(null);
  const doorCooldown = useRef(0);

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
  const [where, setWhere] = useState<"appart" | "quartier">("appart");
  const [banner, setBanner] = useState<string | null>(null);
  const [legend, setLegend] = useState(false);
  const [near, setNear] = useState<Spot | "cache" | null>(null);
  const [owHint, setOwHint] = useState<string | null>(null);
  const [run, setRun] = useState(false);
  const [conv, setConv] = useState<Conv | null>(null);
  const [fade, setFade] = useState(false);
  const [chapter, setChapter] = useState<string[] | null>(null);
  const [vh, setVh] = useState(OW_H);

  // L'écran de jeu prend toute la hauteur libre : on montre plus de carte au lieu d'agrandir les pixels.
  useEffect(() => {
    const box = screenBox.current;
    if (!box) return;
    const fit = () => {
      const r = box.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const h = Math.max(MIN_VH, Math.min(MAX_VH, Math.floor((OW_W * r.height) / r.width)));
      viewH.current = h;
      setVh(h);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, []);
  const uiRef = useRef({ menu, page, game, conv: false });
  useEffect(() => {
    uiRef.current = { menu, page, game, conv: !!conv };
  }, [menu, page, game, conv]);

  const toast = useCallback((m: string) => {
    setToastText(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 3200);
  }, []);

  /** Petites notifications dans l'écran (découvertes, objets, quêtes), l'une après l'autre. */
  const notify = useCallback((texts: string[]) => {
    if (!texts.length) return;
    const showNext = () => {
      const n = banners.current.shift();
      if (!n) return setBanner(null);
      setBanner(n);
      clearTimeout(bannerTimer.current);
      bannerTimer.current = setTimeout(showNext, 1900);
    };
    const idle = banners.current.length === 0;
    banners.current.push(...texts);
    if (idle) showNext();
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

  /** Joue une séquence dans l'appart ; la réplique arrive quand il est au bon meuble. */
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

  /** Applique des effets de quête et annonce ce qui a changé. */
  const rpgApply = useCallback(
    (effects: Effect[]) => {
      const s = stateRef.current;
      if (!s || !effects.length) return null;
      const r = applyEffects(s, effects, Date.now());
      commit(r.state);
      notify(r.notes);
      if (r.notes.length) audio.current.coin();
      return r;
    },
    [commit, notify],
  );

  // ─── Dialogues RPG (nom du personnage, texte progressif, A pour continuer) ───

  const openConv = useCallback((c: Conversation, extra?: Partial<Conv>) => {
    setLine(null);
    const cv: Conv = { lines: c.lines, i: 0, effects: c.effects ?? [], cutscene: c.cutscene, ...extra };
    convRef.current = cv;
    setConv(cv);
    setTyped(0);
    if (ow.current) ow.current.frozen = true;
    audio.current.jump(false);
  }, []);

  const endConv = useCallback(() => {
    const cv = convRef.current;
    convRef.current = null;
    setConv(null);
    doorCooldown.current = Date.now();
    if (!cv) return;
    if (cv.npc) ow.current?.talkTo(cv.npc, false);
    const r = rpgApply(cv.effects);
    if (cv.cutscene === "evenement") {
      // Scène finale : la station s'emballe, l'inconnu apparaît, puis le dialogue.
      const o = ow.current;
      if (o) {
        o.frozen = true;
        o.quake(reduced.current);
      }
      audio.current.hit();
      navigator.vibrate?.([80, 60, 80, 60, 160]);
      setTimeout(() => openConv(evenement(), { final: true }), reduced.current ? 200 : 1400);
      return;
    }
    if (cv.final && r?.completed) {
      ow.current?.flashWhite();
      flashLegend();
      setChapter([`CHAPITRE ${r.completed.chapter} TERMINÉ`, r.completed.name.toUpperCase(), `+${r.completed.reward.xp} XP · +${r.completed.reward.coins} FP`, "Objet : Fragment d'horloge n°1", "La barrière du Centre-ville s'est levée…"]);
    }
    if (ow.current) ow.current.frozen = false;
  }, [flashLegend, openConv, rpgApply]);

  const advanceConv = useCallback(() => {
    const cv = convRef.current;
    if (!cv) return;
    const cur = cv.lines[cv.i];
    if (typedRef.current < cur.text.length) {
      setTyped(cur.text.length);
      return;
    }
    if (cv.i + 1 < cv.lines.length) {
      const next = { ...cv, i: cv.i + 1 };
      convRef.current = next;
      setConv(next);
      setTyped(0);
      audio.current.jump(false);
    } else endConv();
  }, [endConv]);
  const typedRef = useRef(0);
  useEffect(() => {
    typedRef.current = typed;
  }, [typed]);

  // ─── Passer de l'appart à la rue et inversement ───

  const transition = useCallback((fn: () => void) => {
    if (reduced.current) return fn();
    setFade(true);
    setTimeout(() => {
      fn();
      setTimeout(() => setFade(false), 60);
    }, 260);
  }, []);

  const goOutside = useCallback(() => {
    transition(() => {
      whereRef.current = "quartier";
      setWhere("quartier");
      ow.current ??= new Overworld();
      ow.current.place(SPAWN);
      ow.current.frozen = false;
      save(WHERE_KEY, { map: "quartier", ...SPAWN });
      const s = stateRef.current;
      notify(["Quartier 404"]);
      if (s && !s.rpg.done.includes("ville-figee:sortir")) {
        setTimeout(() => {
          openConv({
            lines: [
              { who: "Sparrow", text: "Il fait nuit noire. Les lampadaires grésillent. Et cette horloge, là-bas… 23:59, encore." },
              { who: "Sparrow", text: "Bon. Si tout le quartier est en panne, quelqu'un doit bien savoir quelque chose. Allons poser des questions." },
            ],
            effects: [{ kind: "step", quest: "ville-figee", step: "sortir" }],
          });
        }, 500);
      }
    });
  }, [notify, openConv, transition]);

  const goHome = useCallback(() => {
    transition(() => {
      whereRef.current = "appart";
      setWhere("appart");
      world.current?.comeHome();
      save(WHERE_KEY, { map: "appart" });
      notify(["Appartement de Sparrow"]);
    });
  }, [notify, transition]);

  const onDoor = useCallback(
    (d: Door) => {
      if (convRef.current || Date.now() - doorCooldown.current < 1200) return;
      if (d.to === "appart") goHome();
      else if (d.text) openConv({ lines: [{ who: "", text: d.text }] });
    },
    [goHome, openConv],
  );

  const onZone = useCallback(
    (z: Zone) => {
      const s = stateRef.current;
      if (!s) return;
      const eff: Effect[] = [];
      if (!s.rpg.seen.includes(z.id)) {
        eff.push({ kind: "seen", id: z.id });
        notify([`Lieu découvert : ${z.name}`]);
      }
      if (z.id === "place") eff.push({ kind: "step", quest: "ville-figee", step: "explorer" });
      if (z.id === "station") eff.push({ kind: "step", quest: "ville-figee", step: "station" });
      if (eff.length) rpgApply(eff);
    },
    [notify, rpgApply],
  );

  // Chargement + rattrapage du temps passé
  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const place = restorePlace(load<unknown>(POS_KEY, null));
    world.current = new World(place);
    setRoom(place.room);
    playStats.current.rooms.add(place.room);
    aptCanvas.current = Object.assign(document.createElement("canvas"), { width: VIEW_W, height: VIEW_H });
    const t = Date.now();
    const raw = load<unknown>(KEY, null);
    const before = raw ? restore(raw, t) : newState(t);
    const back = raw ? catchUp(before, t) : null;
    let after = back ? back.state : ensureMissions(tick(before, t), t);
    // Reprise : dehors ou dans l'appart
    const wh = load<{ map?: string } | null>(WHERE_KEY, null);
    const outside = wh?.map === "quartier" ? restoreTile(wh) : null;
    if (outside) {
      ow.current = new Overworld(outside);
      whereRef.current = "quartier";
      setWhere("quartier");
    }
    const questFresh = status(after.rpg, "ville-figee") === "disponible";
    if (!raw)
      say("Salut. Je suis Sparrow. Bienvenue dans mon appart. Croix pour marcher, A pour agir, START pour le menu. Et… attends, pourquoi toutes les horloges affichent 23:59 ?");
    else if (back) {
      say(back.welcome);
      for (const e of back.events) queue.current.push({ line: e.line, anim: e.anim, scene: e.scene, rarity: e.rarity, notes: e.notes });
    } else if (questFresh && !outside) {
      say("Panne de courant… Toutes les horloges de l'appart affichent 23:59. Bizarre. Je devrais aller voir dehors : la porte d'entrée est en haut du salon.");
    } else {
      const ev = randomEvent(after, t);
      if (ev && ev.anim !== "parler" && !outside) {
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
    // Petit accès de test (?debug) pour les essais automatisés : lecture seule.
    if (new URLSearchParams(location.search).has("debug"))
      Object.assign(window, {
        __rpg: {
          where: () => whereRef.current,
          tile: () => (ow.current ? { x: ow.current.x, y: ow.current.y, dir: ow.current.dir, moving: ow.current.moving, frozen: ow.current.frozen } : null),
          solid: (x: number, y: number) => isSolid({ x, y }, { gateOpen: flag(stateRef.current!.rpg, "portail") }),
          npcs: () => ow.current?.npcTiles() ?? [],
          conv: () => (convRef.current ? convRef.current.lines[convRef.current.i] : null),
          size: [MAP_W, MAP_H],
          overview: () => (ow.current ??= new Overworld()).overview(),
        },
      });
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
      const o = ow.current;
      if (whereRef.current === "quartier" && o) {
        if (!o.moving) save(WHERE_KEY, { map: "quartier", x: o.x, y: o.y, dir: o.dir });
        return; // dehors : pas de vie autonome dans l'appart
      }
      save(POS_KEY, w.place);
      const ui = uiRef.current;
      const free = ui.menu === null && !ui.page && !ui.game && !ui.conv;
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
      if (!s || !w || whereRef.current !== "appart" || document.visibilityState !== "visible" || w.busy || w.manual || queue.current.length || uiRef.current.game) return;
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
        const o = ow.current;
        if (whereRef.current === "quartier" && o) save(WHERE_KEY, { map: "quartier", x: o.x, y: o.y, dir: o.dir });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(id);
      clearInterval(ev);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [commit, perform, say]);

  // Objet à portée, sortie de l'appart, bandeau de pièce
  useEffect(() => {
    const id = setInterval(() => {
      const w = world.current;
      const s = stateRef.current;
      if (!w || !s) return;
      const o = ow.current;
      if (whereRef.current === "quartier" && o) {
        o.onDoor = onDoor;
        o.onZone = onZone;
        const f = o.facing(owFrameOf(s, reduced.current));
        const hint =
          f?.kind === "npc"
            ? `Parler à ${NPCS.find((n) => n.id === f.id)!.id === "inconnu" ? "l'inconnu" : NPCS.find((n) => n.id === f.id)!.name}`
            : f?.kind === "door"
              ? f.door.to
                ? "Rentrer chez soi"
                : "Frapper à la porte"
              : f?.kind === "thing"
                ? "Examiner"
                : null;
        setOwHint((p) => (p === hint ? p : hint));
        return;
      }
      if (w.exited) {
        w.exited = false;
        goOutside();
        return;
      }
      const n: Spot | "cache" | null = w.nearCache(cacheOf(s, Date.now())) ? "cache" : w.near();
      setNear((p) => (p === n ? p : n));
      const ps = playStats.current;
      if (w.roomChanges !== ps.roomChanges) {
        ps.roomChanges = w.roomChanges;
        setRoom(w.room);
        notify([ROOMS[w.room].name]);
      }
    }, 120);
    return () => clearInterval(id);
  }, [cacheOf, goOutside, notify, onDoor, onZone]);

  // Effet machine à écrire (répliques et dialogues)
  const shownText = conv ? conv.lines[conv.i].text : line;
  useEffect(() => {
    if (!shownText || typed >= shownText.length) return;
    const id = setTimeout(() => setTyped((n) => n + 2), 22);
    return () => clearTimeout(id);
  }, [shownText, typed]);

  // Rendu du monde
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const frame = (n: number) => {
      const s = stateRef.current;
      const w = world.current;
      const dt = (n - last) / 1000;
      last = n;
      if (s && w) {
        const t = Date.now();
        if (whereRef.current === "quartier") {
          ow.current ??= new Overworld();
          ow.current.setView(OW_W, viewH.current);
          ow.current.draw(ctx, owFrameOf(s, reduced.current), dt);
        } else {
          const actx = aptCanvas.current?.getContext("2d");
          if (actx) {
            w.draw(
              actx,
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
              dt,
            );
            ctx.imageSmoothingEnabled = false;
            const ab = aptBox(viewH.current);
            ctx.fillStyle = "#06060a";
            ctx.fillRect(0, 0, OW_W, viewH.current);
            ctx.fillStyle = "#14121c";
            ctx.fillRect(ab.x - 3, ab.y - 3, VIEW_W * ab.k + 6, VIEW_H * ab.k + 6);
            ctx.drawImage(aptCanvas.current!, ab.x, ab.y, VIEW_W * ab.k, VIEW_H * ab.k);
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [cacheOf]);

  // ─── Actions de l'appartement ───

  const openGame = useCallback(
    (g: GameId) => {
      const s = stateRef.current;
      const w = world.current;
      const def = MINIGAMES.find((m) => m.id === g);
      if (!s || !w || !def?.ready) return;
      setMenu(null);
      setPage(null);
      if (whereRef.current === "quartier") {
        toast(g === "farm" ? "Le PC est à l'appart. Rentre par la porte de la Résidence Les Lilas !" : "Le banc de muscu est à l'appart. Rentre chez toi pour t'entraîner.");
        return;
      }
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

  /** A dehors : parler, examiner, entrer. */
  const interactOutside = () => {
    const o = ow.current;
    const s = stateRef.current;
    if (!o || !s || o.moving) return;
    const f = o.facing(owFrameOf(s, reduced.current));
    if (!f) return;
    if (f.kind === "npc") {
      o.talkTo(f.id, true);
      openConv(talkTo(f.id, s.rpg), { npc: f.id });
    } else if (f.kind === "door") onDoor(f.door);
    else openConv(examine(f.thing.id, s.rpg, f.thing.text));
  };

  const openPage = (p: PageId) => {
    setMenu(null);
    setPage(p);
    audio.current.coin();
  };

  const pressA = () => {
    if (page || chapter) return chapter ? setChapter(null) : undefined;
    if (convRef.current) return advanceConv();
    if (menu !== null) return openPage(MENU[menu].id);
    if (line && typed < line.length) return setTyped(line.length);
    if (line) setLine(null);
    if (whereRef.current === "quartier") return interactOutside();
    if (near === "cache") {
      world.current?.goTo(cacheOf(stateRef.current!, Date.now())!, collect, true);
    } else if (near) interact(near);
    else if (!line) doAction("parler");
  };

  const pressB = () => {
    if (chapter) return setChapter(null);
    if (convRef.current) return advanceConv();
    if (page) return setPage(null);
    if (menu !== null) return setMenu(null);
    if (line) setLine(null);
    world.current?.cancel();
  };

  const toggleMenu = () => {
    if (convRef.current || chapter) return;
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

  const setInput = (x: number, y: number) => {
    const blocked = menu !== null || !!page || !!convRef.current;
    const v = blocked ? { x: 0, y: 0 } : { x, y };
    if (whereRef.current === "quartier") {
      if (ow.current) ow.current.input = v;
    } else if (world.current) world.current.input = v;
  };

  const onCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stateRef.current;
    const w = world.current;
    if (!s || !w) return;
    if (convRef.current) return advanceConv();
    if (menu !== null) return setMenu(null);
    if (line) setLine(null);
    if (whereRef.current === "quartier") return; // dehors : on explore à la croix
    const rect = e.currentTarget.getBoundingClientRect();
    const ab = aptBox(viewH.current);
    const px = (((e.clientX - rect.left) / rect.width) * OW_W - ab.x) / ab.k;
    const py = (((e.clientY - rect.top) / rect.height) * viewH.current - ab.y) / ab.k;
    if (px < 0 || py < 0 || px > VIEW_W || py > VIEW_H) return;
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
  const keyRef = useRef({ pressA, pressB, toggleMenu, step, setInput });
  useEffect(() => {
    keyRef.current = { pressA, pressB, toggleMenu, step, setInput };
  });
  useEffect(() => {
    const keys = new Set<string>();
    const sync = () => {
      const has = (...k: string[]) => k.some((x) => keys.has(x));
      keyRef.current.setInput(
        (has("arrowright", "d") ? 1 : 0) - (has("arrowleft", "q", "a") ? 1 : 0),
        (has("arrowdown", "s") ? 1 : 0) - (has("arrowup", "z", "w") ? 1 : 0),
      );
      const r = keys.has("shift");
      if (world.current) world.current.run = r;
      if (ow.current) ow.current.run = r;
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
        if (!e.repeat) keyRef.current.pressA();
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
    if (!window.confirm("Adopter un nouveau Sparrow ? Niveau, objets, muscles, quêtes et trophées seront perdus. (Exporte d'abord ta sauvegarde !)")) return;
    commit(ensureMissions(newState(Date.now()), Date.now()));
    setPage(null);
    if (whereRef.current === "quartier") goHome();
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
    if (ow.current) ow.current.run = v;
  };

  const t = now || Date.now();
  const m = state ? moodOf(state, t) : "neutre";
  const toClaim = state ? claimable(state) : 0;
  const need = state ? xpToNext(state.level) : 1;
  const outside = where === "quartier";
  const hint = conv
    ? "Suite"
    : menu !== null
      ? "Ouvrir"
      : outside
        ? (owHint ?? "—")
        : near === "cache"
          ? "Ramasser l'objet caché"
          : near
            ? near.label
            : line
              ? "Suite"
              : "Parler";
  const ready = conv ? true : outside ? !!owHint : !!near;
  const cur = conv ? conv.lines[conv.i] : null;

  return (
    <div className={`gb-wrap${legend ? " is-legend" : ""}`}>
      <main className="gb">
        <header className="gb-top mono">
          <a href="/jeu" className="gb-top__back" aria-label="Retour aux jeux">
            ‹
          </a>
          {state && (
            <>
              <span className="gb-top__lvl" aria-label={`Niveau ${state.level}, ${titleFor(state.level)}`}>
                NIV {state.level}
                <i style={{ transform: `scaleX(${state.xp / need})` }} />
              </span>
              <button type="button" className="gb-top__stats" onClick={() => !conv && openPage("profil")} aria-label="Jauges de Sparrow : ouvrir le profil">
                {STATS.map(({ id, label }) => {
                  const v = state.stats[id];
                  return (
                    <span key={id} className={`gb-mini${v < 25 ? " is-low" : ""}`} title={`${label} ${Math.round(v)}`}>
                      <i style={{ transform: `scaleY(${Math.max(0.06, v / 100)})` }} />
                    </span>
                  );
                })}
              </button>
              <span className="gb-top__place">{outside ? "QUARTIER 404" : MOOD_LABEL[m]}</span>
              <span className="gb-top__coins">{state.coins} FP</span>
            </>
          )}
        </header>

        <div ref={screenBox} className={`gb-screen gb-screen--${outside ? "rue" : m}`}>
          <canvas
            ref={canvas}
            width={OW_W}
            height={vh}
            className="gb-screen__canvas"
            onPointerDown={onCanvas}
            role="img"
            aria-label={outside ? "Le Quartier 404, de nuit. Croix pour marcher, A pour parler ou examiner." : "L'appartement de Sparrow. Touche un objet ou un endroit pour qu'il y aille."}
          />
          <div className={`gb-fade${fade ? " is-on" : ""}`} aria-hidden="true" />
          {banner && (
            <span key={banner} className="gb-banner mono">
              {banner}
            </span>
          )}
          {ready && !conv && !line && menu === null && !chapter && (
            <span className="gb-pill mono" aria-live="polite">
              <b>A</b> {hint}
            </span>
          )}
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
          {cur && (
            <button type="button" className="gb-dialog gb-dialog--rpg mono" onClick={advanceConv} aria-live="polite">
              {cur.who && <span className="gb-dialog__name">{cur.who}</span>}
              <span className={cur.who ? "" : "gb-dialog__narr"}>{cur.text.slice(0, typed)}</span>
              <span className="sr-only">{cur.text}</span>
              {typed >= cur.text.length && (
                <i className="gb-dialog__next" aria-hidden="true">
                  ▼
                </i>
              )}
            </button>
          )}
          {!cur && line && menu === null && (
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
          {chapter && (
            <button type="button" className="gb-chapter mono" onClick={() => setChapter(null)}>
              {chapter.map((l, i) => (
                <span key={l} className={i === 0 ? "gb-chapter__kicker" : i === 1 ? "gb-chapter__title" : ""}>
                  {l}
                </span>
              ))}
              <em>A : continuer</em>
            </button>
          )}
        </div>

        <div className="gb-controls">
          <DPad onMove={setInput} onStep={step} />
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
            <button type="button" className={`gb-key gb-key--a${ready ? " is-ready" : ""}`} onClick={pressA} aria-label={`A : ${hint}`}>
              A
            </button>
          </div>
          <div className="gb-startsel mono">
            <button type="button" onClick={() => !conv && openPage("jeux")} aria-label="SELECT : mini-jeux">
              SELECT
            </button>
            <button type="button" onClick={toggleMenu} aria-label="START : menu">
              START
              {toClaim > 0 && <b className="gb-badge">{toClaim}</b>}
            </button>
          </div>
        </div>
      </main>

      {page && state && (
        <div className="gb-page-wrap">
          <Page
            page={page}
            state={state}
            now={t}
            sound={sound}
            room={room}
            outside={outside}
            onClose={() => setPage(null)}
            h={{
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
