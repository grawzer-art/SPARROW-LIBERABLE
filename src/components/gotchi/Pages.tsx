"use client";

import { useState } from "react";
import { TROPHIES } from "@/lib/gotchi/achievements";
import { STATS, ageJours, isEquipped, type State } from "@/lib/gotchi/engine";
import { ITEMS, MUSCLE_STAGES, TITLES, muscleStage, tierOf, titleFor, xpToNext, type Group, type Slot } from "@/lib/gotchi/items";
import { LAYOUT, ROOMS, type RoomId } from "@/lib/gotchi/map";
import { MINIGAMES, type GameId } from "@/lib/gotchi/minigames";
import { missionDef } from "@/lib/gotchi/missions";
import { CONSUMABLES, EQUIPMENT, MEMBERS, MOVES } from "@/lib/rpg/bestiary";
import { makeAlly, usableOutside } from "@/lib/rpg/combat";
import type { UiPrefs } from "./uiMode";
import { ACTIVE, EVOLUTIONS, RARITY_LABEL, SPECIES, evolvedForms, isSeen, ownLevels, xpNeed } from "@/lib/rpg/monsters";
import { TYPE_LABEL } from "@/lib/rpg/types";
import { battler } from "@/components/rpg/battlers";
import { QUESTS, RPG_ITEMS, isDone, nextStep, status } from "@/lib/rpg/quest";

export type PageId = "quetes" | "jeux" | "missions" | "inventaire" | "appart" | "profil" | "equipe" | "bestiaire" | "options" | "quitter";

export const MENU: { id: PageId; label: string; icon: string }[] = [
  { id: "quetes", label: "Quêtes", icon: "!" },
  { id: "inventaire", label: "Inventaire", icon: "◆" },
  { id: "missions", label: "Missions", icon: "✓" },
  { id: "equipe", label: "Équipe", icon: "♥" },
  { id: "bestiaire", label: "Bestiaire", icon: "✿" },
  { id: "appart", label: "Appartement", icon: "⌂" },
  { id: "profil", label: "Profil", icon: "☺" },
  { id: "jeux", label: "Mini-jeux", icon: "★" },
  { id: "options", label: "Options", icon: "⚙" },
  { id: "quitter", label: "Quitter l'aventure", icon: "⏏" },
];

const TITLE: Record<PageId, string> = {
  quetes: "QUÊTES",
  jeux: "MINI-JEUX",
  missions: "MISSIONS DU JOUR",
  inventaire: "INVENTAIRE",
  appart: "APPARTEMENT",
  profil: "PROFIL · ÉVOLUTION",
  equipe: "ÉQUIPE",
  bestiaire: "BESTIAIRE",
  options: "OPTIONS",
  quitter: "QUITTER",
};

const STATUS_LABEL = { disponible: "DISPONIBLE", active: "EN COURS", terminee: "TERMINÉE" } as const;

const WEAR: { id: Slot; label: string }[] = [
  { id: "lunettes", label: "Lunettes" },
  { id: "tenue", label: "Tenues" },
  { id: "tete", label: "Têtes" },
];

const GROUPS: { id: Group; label: string; room: RoomId; base: string }[] = [
  { id: "pc", label: "Coin gaming", room: "gaming", base: "PC de base" },
  { id: "lit", label: "Lit", room: "chambre", base: "Lit simple" },
  { id: "canape", label: "Canapé", room: "salon", base: "Canapé rouge" },
  { id: "sport", label: "Salle de sport", room: "muscu", base: "Banc rouillé" },
];

const hhmm = (t: number) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(t));

export interface PageHandlers {
  playGame: (g: GameId) => void;
  claim: (id: string) => void;
  buy: (id: string) => void;
  equip: (id: string) => void;
  /** Équiper / retirer un équipement de combat. */
  equipGear: (id: string) => void;
  /** Intégrer une créature capturée à l'équipe, ou la remettre au Bestiaire. */
  toggleMon: (species: string) => void;
  /** Utiliser un soin du SAC hors combat (sur l'équipier le plus blessé). */
  useItem: (id: string) => void;
  goRoom: (r: RoomId) => void;
  toggleSound: () => void;
  /** Opacité des commandes tactiles au repos (0,2 à 0,7). */
  setPadOpacity: (v: number) => void;
  toggleIntro: () => void;
  /** Autoriser / interdire le jeu en portrait sur téléphone. */
  setPortrait: (on: boolean) => void;
  exportSave: () => void;
  importSave: () => void;
  reset: () => void;
}

interface Props {
  page: PageId;
  state: State;
  now: number;
  sound: boolean;
  room: RoomId;
  /** Sparrow est dehors (Quartier 404). */
  outside: boolean;
  prefs: UiPrefs;
  h: PageHandlers;
  onClose: () => void;
}

/** Pages du MENU, affichées dans l'écran de la console. */
export function Page({ page, state, now, sound, room, outside, prefs, h, onClose }: Props) {
  const [slot, setSlot] = useState<Slot | "objets" | "combat">("objets");
  const [qtab, setQtab] = useState<"quetes" | "journal">("quetes");
  const [tab, setTab] = useState<"meubles" | "deco" | "plan">("plan");
  const [ptab, setPtab] = useState<"profil" | "trophees">("profil");
  const s = state;

  const itemRow = (id: string) => {
    const it = ITEMS.find((i) => i.id === id)!;
    const owned = s.owned.includes(it.id);
    const on = isEquipped(s, it.id);
    if (it.rare && !owned)
      return (
        <div key={it.id} className="gb-row is-locked">
          <div className="gb-row__main">
            <p className="gb-row__title">??? Objet rare</p>
            <p className="gb-row__meta">Uniquement en drop : farm, événements…</p>
          </div>
        </div>
      );
    let btn: React.ReactNode;
    if (!owned)
      btn = (
        <button type="button" className="gb-btn" onClick={() => h.buy(it.id)} disabled={s.level < it.level}>
          {s.level < it.level ? `NIV ${it.level}` : `${it.price} FP`}
        </button>
      );
    else if (it.slot === "meuble") btn = <span className="gb-row__tag">INSTALLÉ</span>;
    else if (it.slot === "deco")
      btn = (
        <button type="button" className="gb-btn" onClick={() => h.equip(it.id)}>
          {on ? "RETIRER" : "POSER"}
        </button>
      );
    else
      btn = on ? (
        <span className="gb-row__tag">PORTÉ</span>
      ) : (
        <button type="button" className="gb-btn" onClick={() => h.equip(it.id)}>
          ÉQUIPER
        </button>
      );
    return (
      <div key={it.id} className={`gb-row${on ? " is-on" : ""}${it.rare ? " is-rare" : ""}`}>
        <div className="gb-row__main">
          <p className="gb-row__title">
            {it.name}
            {it.rare && <em> RARE</em>}
          </p>
          <p className="gb-row__meta">{it.desc}</p>
        </div>
        {btn}
      </div>
    );
  };

  const stage = muscleStage(s.muscle);
  const next = MUSCLE_STAGES[stage + 1];
  const need = xpToNext(s.level);

  return (
    <section className="gb-page" role="dialog" aria-modal="true" aria-label={TITLE[page]}>
      <header className="gb-page__head">
        <button type="button" onClick={onClose} aria-label="Retour">
          ◀ B
        </button>
        <span>{TITLE[page]}</span>
        <span className="gb-page__coins">{s.coins} FP</span>
      </header>
      <div className="gb-page__body">
        {page === "quetes" && (
          <>
            <div className="gb-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={qtab === "quetes"} className={qtab === "quetes" ? "is-on" : ""} onClick={() => setQtab("quetes")}>
                Quêtes
              </button>
              <button type="button" role="tab" aria-selected={qtab === "journal"} className={qtab === "journal" ? "is-on" : ""} onClick={() => setQtab("journal")}>
                Journal
              </button>
            </div>
            {qtab === "quetes" ? (
              <>
                <p className="gb-game-title">
                  SPARROW : 23:59 <span>L&apos;Élu de la Minute</span>
                </p>
                {QUESTS.filter(
                  (q) =>
                    q.chapter === 1 ||
                    status(s.rpg, q.id) !== "disponible" ||
                    (q.id === "frites-perdues" && status(s.rpg, "ville-figee") === "terminee") ||
                    (q.id === "confrerie" && status(s.rpg, "frites-perdues") === "terminee") ||
                    (q.id === "samourai" && status(s.rpg, "confrerie") === "terminee") ||
                    (q.id === "minuit" && status(s.rpg, "samourai") === "terminee"),
                ).map((q) => {
                  const st = status(s.rpg, q.id);
                  const nx = nextStep(s.rpg, q.id);
                  return (
                    <div key={q.id} className="gb-card">
                      <p className="gb-group__title">
                        CHAPITRE {q.chapter} · <span className={`gb-chip gb-chip--${st}`}>{STATUS_LABEL[st]}</span>
                      </p>
                      <p className="gb-card__rank">{q.name}</p>
                      <p className="gb-row__meta">{q.desc}</p>
                      {st !== "terminee" && nx && <p className="gb-next">▶ {nx.txt}</p>}
                      <ul className="gb-steps">
                        {q.steps.map((x) => (
                          <li key={x.id} className={isDone(s.rpg, q.id, x.id) ? "is-done" : ""}>
                            {isDone(s.rpg, q.id, x.id) ? "✓" : "□"} {x.txt}
                          </li>
                        ))}
                      </ul>
                      <p className="gb-row__meta">
                        Récompense : +{q.reward.xp} XP · +{q.reward.coins} FP · objet mystère
                      </p>
                    </div>
                  );
                })}
                {(() => {
                  const next =
                    status(s.rpg, "ville-figee") !== "terminee"
                      ? { n: 2, name: "Le Centre-ville", hint: "Termine « La Ville Figée » pour débloquer la suite." }
                      : status(s.rpg, "frites-perdues") !== "terminee"
                        ? { n: 3, name: "La Confrérie du Muscle", hint: "Termine « La Cité des Frites Perdues » pour débloquer la suite." }
                        : status(s.rpg, "confrerie") !== "terminee"
                          ? { n: 4, name: "La Voie du Samouraï", hint: "Termine « La Confrérie du Muscle » pour débloquer la suite." }
                          : status(s.rpg, "samourai") !== "terminee"
                            ? { n: 5, name: "Protocole Minuit", hint: "Termine « La Voie du Samouraï » pour débloquer la suite." }
                            : status(s.rpg, "minuit") !== "terminee"
                              ? null
                              : { n: 0, name: "Mode libre", hint: "Les cinq chapitres sont terminés. Finis les quêtes secondaires, et défie l'Écho de Minuit au sommet de la Tour." };
                  if (!next) return null;
                  return (
                    <div className="gb-card is-locked">
                      <p className="gb-group__title">{next.n ? `CHAPITRE ${next.n} · VERROUILLÉ` : "AVENTURE TERMINÉE"}</p>
                      <p className="gb-card__rank">{next.name}</p>
                      <p className="gb-row__meta">{next.hint}</p>
                    </div>
                  );
                })()}
                <p className="gb-note">Les quêtes racontent l&apos;aventure. Les missions du jour, elles, restent dans « Missions ».</p>
              </>
            ) : s.journal.length ? (
              [...s.journal].reverse().map((j, i) => (
                <div key={`${j.t}-${i}`} className={`gb-log gb-log--${j.kind}`}>
                  <span>{hhmm(j.t)}</span>
                  <p>{j.txt}</p>
                </div>
              ))
            ) : (
              <p className="gb-note">Rien pour l&apos;instant. Sparrow vit sa vie, reviens plus tard.</p>
            )}
          </>
        )}

        {page === "equipe" && (
          <>
            {["sparrow", ...s.rpg.party].map((id, n) => {
              const m = MEMBERS[id];
              if (!m) return null;
              const f = makeAlly(id, { level: s.level, gear: s.rpg.gear, skills: s.rpg.skills, mons: ownLevels(s.rpg) });
              return (
                <div key={id} className="gb-card">
                  <p className="gb-group__title">
                    MEMBRE N°{n + 1}
                    {n > ACTIVE ? " · EN RÉSERVE" : ""}
                    {s.rpg.mons?.[id] ? " · CRÉATURE" : ""}
                  </p>
                  <p className="gb-card__rank">{m.name}</p>
                  <p className="gb-row__meta">
                    Niv {f.lv}
                    {id === "sparrow" ? ` · ${titleFor(s.level)} · ${MUSCLE_STAGES[muscleStage(s.muscle)][1]}` : ` · XP ${(s.rpg.mons?.[id] ?? s.rpg.levels?.[id])?.xp ?? 0}/${xpNeed(f.lv)}`}
                  </p>
                  {f.name !== m.name && <p className="gb-row__meta">Évolué : {f.name}</p>}
                  <p className="gb-row__meta">{m.desc}</p>
                  {(() => {
                    const fr = s.rpg.hp?.[id] ?? 1;
                    const cur = fr <= 0 ? 0 : Math.max(1, Math.round(f.maxHp * fr));
                    return (
                      <div className="gb-gauge">
                        <span>PV</span>
                        <div className="gb-bar gb-bar--red">
                          <i style={{ transform: `scaleX(${cur / f.maxHp})` }} />
                        </div>
                        <b>{cur ? `${cur}/${f.maxHp}` : "K.O."}</b>
                      </div>
                    );
                  })()}
                  {(
                    [
                      ["ATTAQUE", f.atk, 60],
                      ["DÉFENSE", f.def, 60],
                      ["VITESSE", f.spd, 60],
                    ] as [string, number, number][]
                  ).map(([k, v, max]) => (
                    <div key={k} className="gb-gauge">
                      <span>{k}</span>
                      <div className="gb-bar gb-bar--red">
                        <i style={{ transform: `scaleX(${Math.min(1, v / max)})` }} />
                      </div>
                      <b>{v}</b>
                    </div>
                  ))}
                  <p className="gb-group__title">TECHNIQUES</p>
                  {f.moves.map((mid) => {
                    const mv = MOVES[mid];
                    return (
                      <p key={mid} className="gb-rank">
                        ★ {mv.name}{" "}
                        <small>
                          · PUI {mv.power ? (mv.hits ? `${mv.power}×${mv.hits[0]}-${mv.hits[1]}` : mv.power) : "—"} · PRÉ {mv.acc} — {mv.desc}
                        </small>
                      </p>
                    );
                  })}
                  {id === "sparrow" && (
                    <p className="gb-row__meta">
                      Équipement : {(["arme", "armure", "accessoire"] as const).map((sl) => (s.rpg.gear[sl] ? EQUIPMENT[s.rpg.gear[sl]!]?.name : "—")).join(" · ")}
                    </p>
                  )}
                </div>
              );
            })}
            {!s.rpg.party.length && <p className="gb-note">D&apos;autres membres rejoindront peut-être l&apos;équipe… La barrière du Centre-ville cache quelqu&apos;un.</p>}
            <p className="gb-note">Chaque membre a son propre niveau : seuls ceux qui entrent au combat gagnent de l&apos;expérience. De nouvelles techniques s&apos;apprennent en montant de niveau. Les PV ne remontent pas tout seuls entre deux combats : infirmière Camomille (une par région), appartement de Sparrow, ou soins du SAC. Les boss se jouent toujours en pleine forme.</p>
          </>
        )}

        {page === "bestiaire" && (
          <>
            <p className="gb-note">
              Collection : {SPECIES.filter((x) => s.rpg.mons?.[x.id]).length} / {SPECIES.length} espèces · formes évoluées : {evolvedForms(s.rpg).length} / {EVOLUTIONS.length}. Équipe de combat : Sparrow + {ACTIVE} compagnons (les premiers de la liste).
            </p>
            {SPECIES.map((sp) => {
              const m = MEMBERS[sp.id];
              const mon = m ? s.rpg.mons?.[sp.id] : undefined;
              const num = `N°${String(sp.n).padStart(3, "0")}`;
              const seen = !!m && isSeen(s.rpg, sp.id);
              if (!mon && !seen)
                return (
                  <div key={sp.id} className="gb-card is-locked">
                    <p className="gb-group__title">
                      {num} · INCONNU · {RARITY_LABEL[sp.rarity].toUpperCase()}
                    </p>
                    <p className="gb-card__rank">???</p>
                    <p className="gb-row__meta">{sp.rarity === "legendaire" ? `Région : ${sp.region}. Une créature légendaire : on dit qu'une quête secrète mène jusqu'à elle.` : `Région : ${sp.region}. Une créature rôde quelque part…`}</p>
                  </div>
                );
              if (!mon)
                return (
                  <div key={sp.id} className="gb-card is-locked">
                    <p className="gb-group__title">
                      {num} · {isSeen(s.rpg, sp.id) ? "VU, PAS CAPTURÉ" : "INCONNU"}
                    </p>
                    <p className="gb-card__rank">{isSeen(s.rpg, sp.id) ? m.name : "???"}</p>
                    <p className="gb-row__meta">{isSeen(s.rpg, sp.id) ? `Habitat : ${sp.habitat}. Affaiblis-le, puis lance une Capsule d'Écho.` : "Une créature rôde quelque part, dans les herbes hautes…"}</p>
                  </div>
                );
              const f = makeAlly(sp.id, { level: s.level, gear: {}, skills: [], mons: ownLevels(s.rpg) });
              const active = s.rpg.party.slice(0, ACTIVE).includes(sp.id);
              return (
                <div key={sp.id} className="gb-card">
                  <p className="gb-group__title">
                    {num} · {TYPE_LABEL[sp.type].toUpperCase()} · {RARITY_LABEL[sp.rarity].toUpperCase()} · {active ? "DANS L'ÉQUIPE" : "AU BESTIAIRE"}
                  </p>
                  <div className="gb-mon">
                    <img className="gb-mon__img" src={battler(m.evo && mon.level >= m.evo.lv ? m.evo.front : (sp.sprite ?? sp.id)).toDataURL()} alt="" width={96} height={96} />
                    <div>
                      <p className="gb-card__rank">{f.name}</p>
                      {m.evo && mon.level < m.evo.lv && <p className="gb-row__meta">Évolue au niveau {m.evo.lv}.</p>}
                      <p className="gb-row__meta">
                        Niv {mon.level} · XP {mon.xp}/{xpNeed(mon.level)}
                      </p>
                      <div className="gb-bar">
                        <i style={{ transform: `scaleX(${Math.min(1, mon.xp / xpNeed(mon.level))})` }} />
                      </div>
                      <p className="gb-row__meta">Habitat : {sp.habitat}</p>
                    </div>
                  </div>
                  <p className="gb-row__meta">{m.desc}</p>
                  {(
                    [
                      ["PV", f.maxHp, 200],
                      ["ATTAQUE", f.atk, 60],
                      ["DÉFENSE", f.def, 60],
                      ["VITESSE", f.spd, 60],
                    ] as [string, number, number][]
                  ).map(([k, v, max]) => (
                    <div key={k} className="gb-gauge">
                      <span>{k}</span>
                      <div className="gb-bar gb-bar--red">
                        <i style={{ transform: `scaleX(${Math.min(1, v / max)})` }} />
                      </div>
                      <b>{v}</b>
                    </div>
                  ))}
                  <p className="gb-group__title">CAPACITÉS</p>
                  {f.moves.map((mid) => {
                    const mv = MOVES[mid];
                    return (
                      <p key={mid} className="gb-rank">
                        ★ {mv.name}{" "}
                        <small>
                          · PUI {mv.power ? (mv.hits ? `${mv.power}×${mv.hits[0]}-${mv.hits[1]}` : mv.power) : "—"} · PRÉ {mv.acc} — {mv.desc}
                        </small>
                      </p>
                    );
                  })}
                  <button type="button" className="gb-btn" onClick={() => h.toggleMon(sp.id)}>
                    {active ? "Remettre au Bestiaire" : "Intégrer à l'équipe"}
                  </button>
                  {!active && s.rpg.party.length >= ACTIVE && <p className="gb-row__meta">L&apos;équipe est pleine : {MEMBERS[s.rpg.party[ACTIVE - 1]]?.name} passera en réserve (il reste dans l&apos;équipe, sans combattre).</p>}
                </div>
              );
            })}
          </>
        )}

        {page === "jeux" &&
          MINIGAMES.map((g) => (
            <div key={g.id} className={`gb-row${g.ready ? "" : " is-locked"}`}>
              <div className="gb-row__main">
                <p className="gb-row__title">{g.name}</p>
                <p className="gb-row__meta">{g.desc}</p>
                {g.ready && <p className="gb-row__meta">Record : {g.best(s)} pts</p>}
              </div>
              {g.ready ? (
                <button type="button" className="gb-btn" onClick={() => h.playGame(g.id)}>
                  JOUER
                </button>
              ) : (
                <span className="gb-row__tag">BIENTÔT</span>
              )}
            </div>
          ))}

        {page === "missions" && (
          <>
            <p className="gb-note">Trois missions par jour, renouvelées à minuit. Rien n&apos;est perdu si tu ne les fais pas.</p>
            {s.missions.list.map((mi) => {
              const d = missionDef(mi.id);
              if (!d) return null;
              const done = mi.progress >= d.n;
              return (
                <div key={mi.id} className={`gb-row${mi.claimed ? " is-done" : ""}`}>
                  <div className="gb-row__main">
                    <p className="gb-row__title">{d.txt}</p>
                    <div className="gb-bar">
                      <i style={{ transform: `scaleX(${Math.min(1, mi.progress / d.n)})` }} />
                    </div>
                    <p className="gb-row__meta">
                      {Math.min(mi.progress, d.n)}/{d.n} · +{d.coins} FP · +{d.xp} XP
                    </p>
                  </div>
                  {mi.claimed ? (
                    <span className="gb-row__tag">OK</span>
                  ) : (
                    <button type="button" className="gb-btn" disabled={!done} onClick={() => h.claim(mi.id)}>
                      {done ? "ENCAISSER" : "EN COURS"}
                    </button>
                  )}
                </div>
              );
            })}
          </>
        )}

        {page === "inventaire" && (
          <>
            <div className="gb-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={slot === "objets"} className={slot === "objets" ? "is-on" : ""} onClick={() => setSlot("objets")}>
                Objets
              </button>
              <button type="button" role="tab" aria-selected={slot === "combat"} className={slot === "combat" ? "is-on" : ""} onClick={() => setSlot("combat")}>
                Combat
              </button>
              {WEAR.map((w) => (
                <button key={w.id} type="button" role="tab" aria-selected={slot === w.id} className={slot === w.id ? "is-on" : ""} onClick={() => setSlot(w.id)}>
                  {w.label}
                </button>
              ))}
            </div>
            {slot === "objets" ? (
              <>
                {Object.entries(s.rpg.bag).filter(([k, n]) => n > 0 && CONSUMABLES[k]).length > 0 && <p className="gb-group__title">SAC</p>}
                {Object.entries(s.rpg.bag)
                  .filter(([k, n]) => n > 0 && CONSUMABLES[k])
                  .map(([k, n]) => (
                    <div key={k} className="gb-row">
                      <span className="gb-item">✚</span>
                      <div className="gb-row__main">
                        <p className="gb-row__title">
                          {CONSUMABLES[k].name} ×{n}
                        </p>
                        <p className="gb-row__meta">{CONSUMABLES[k].desc}</p>
                      </div>
                      {usableOutside(k) && (
                        <button type="button" className="gb-btn" onClick={() => h.useItem(k)}>
                          UTILISER
                        </button>
                      )}
                    </div>
                  ))}
                {s.rpg.items.length > 0 && <p className="gb-group__title">OBJETS D&apos;AVENTURE</p>}
                {s.rpg.items.length
                  ? RPG_ITEMS.filter((it) => s.rpg.items.includes(it.id)).map((it) => (
                      <div key={it.id} className="gb-row">
                        <span className="gb-item">{it.icon}</span>
                        <div className="gb-row__main">
                          <p className="gb-row__title">{it.name}</p>
                          <p className="gb-row__meta">{it.desc}</p>
                        </div>
                      </div>
                    ))
                  : !Object.keys(s.rpg.bag).length && <p className="gb-note">Aucun objet d&apos;aventure pour l&apos;instant. Sors explorer le quartier !</p>}
              </>
            ) : slot === "combat" ? (
              <>
                {s.rpg.owned.length ? (
                  s.rpg.owned
                    .filter((id) => EQUIPMENT[id])
                    .map((id) => {
                      const e = EQUIPMENT[id];
                      const on = s.rpg.gear[e.slot] === id;
                      return (
                        <div key={id} className={`gb-row${on ? " is-on" : ""}`}>
                          <span className="gb-item">{e.slot === "arme" ? "⚔" : e.slot === "armure" ? "⛨" : "◎"}</span>
                          <div className="gb-row__main">
                            <p className="gb-row__title">{e.name}</p>
                            <p className="gb-row__meta">
                              {e.slot.toUpperCase()} · {e.desc}
                            </p>
                          </div>
                          <button type="button" className="gb-btn" onClick={() => h.equipGear(id)}>
                            {on ? "RETIRER" : "ÉQUIPER"}
                          </button>
                        </div>
                      );
                    })
                ) : (
                  <p className="gb-note">Aucun équipement de combat. Les boutiques de la Cité des Frites Perdues en vendent.</p>
                )}
                <p className="gb-note">Une arme, une armure et un accessoire à la fois. L&apos;équipement s&apos;ajoute aux statistiques de Sparrow en combat.</p>
              </>
            ) : (
              ITEMS.filter((it) => it.slot === slot).map((it) => itemRow(it.id))
            )}
          </>
        )}

        {page === "appart" && (
          <>
            <div className="gb-tabs" role="tablist">
              {(
                [
                  ["plan", "Plan"],
                  ["meubles", "Meubles"],
                  ["deco", "Déco"],
                ] as const
              ).map(([id, l]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}>
                  {l}
                </button>
              ))}
            </div>
            {tab === "plan" && outside && <p className="gb-note">Tu es dehors, dans le Quartier 404. Rentre par la porte de la Résidence Les Lilas pour retrouver ton appart.</p>}
            {tab === "plan" && !outside && (
              <>
                <div className="gb-map">
                  {LAYOUT.flat().map((r, i) =>
                    r ? (
                      <button key={r} type="button" className={`gb-map__room${room === r ? " is-here" : ""}`} onClick={() => h.goRoom(r)}>
                        {ROOMS[r].name}
                        {room === r && <em>ICI</em>}
                      </button>
                    ) : (
                      <span key={`x${i}`} className="gb-map__void" />
                    ),
                  )}
                </div>
                <p className="gb-note">Touche une pièce : Sparrow y va (en passant par les portes).</p>
              </>
            )}
            {tab === "meubles" &&
              GROUPS.map((g) => (
                <div key={g.id} className="gb-group">
                  <p className="gb-group__title">
                    {g.label} · niveau {tierOf(s.owned, g.id)}
                  </p>
                  <p className="gb-row__meta">Niveau 1 : {g.base}</p>
                  {ITEMS.filter((it) => it.group === g.id).map((it) => itemRow(it.id))}
                </div>
              ))}
            {tab === "deco" && ITEMS.filter((it) => it.slot === "deco").map((it) => itemRow(it.id))}
          </>
        )}

        {page === "profil" && (
          <>
            <div className="gb-tabs" role="tablist">
              <button type="button" role="tab" aria-selected={ptab === "profil"} className={ptab === "profil" ? "is-on" : ""} onClick={() => setPtab("profil")}>
                Profil
              </button>
              <button type="button" role="tab" aria-selected={ptab === "trophees"} className={ptab === "trophees" ? "is-on" : ""} onClick={() => setPtab("trophees")}>
                Trophées {Object.keys(s.trophies).length}/{TROPHIES.length}
              </button>
            </div>
            {ptab === "profil" ? (
              <>
                <div className="gb-card">
                  <p className="gb-card__rank">{titleFor(s.level)}</p>
                  <p className="gb-row__meta">
                    Niveau {s.level} · {s.xp}/{need} XP · J+{ageJours(s, now)}
                  </p>
                  <div className="gb-bar">
                    <i style={{ transform: `scaleX(${s.xp / need})` }} />
                  </div>
                </div>
                <div className="gb-card">
                  <p className="gb-group__title">ÉVOLUTION MUSCULAIRE</p>
                  <p className="gb-card__rank">{MUSCLE_STAGES[stage][1]}</p>
                  <p className="gb-row__meta">
                    {Math.round(s.muscle)} pts de muscle{next ? ` · prochain stade : ${next[1]} à ${next[0]}` : " · stade ultime atteint"}
                  </p>
                  <div className="gb-bar gb-bar--red">
                    <i style={{ transform: `scaleX(${next ? Math.min(1, (s.muscle - MUSCLE_STAGES[stage][0]) / (next[0] - MUSCLE_STAGES[stage][0])) : 1})` }} />
                  </div>
                </div>
                <div className="gb-card">
                  <p className="gb-group__title">JAUGES</p>
                  {STATS.map(({ id, label }) => (
                    <div key={id} className="gb-gauge">
                      <span>{label}</span>
                      <div className="gb-bar">
                        <i style={{ transform: `scaleX(${s.stats[id] / 100})` }} />
                      </div>
                      <b>{Math.round(s.stats[id])}</b>
                    </div>
                  ))}
                </div>
                <div className="gb-card">
                  <p className="gb-group__title">RANGS</p>
                  {TITLES.map(([lv, name]) => (
                    <p key={name} className={`gb-rank${s.level >= lv ? " is-on" : ""}`}>
                      {s.level >= lv ? "★" : "☆"} {name} <em>niv {lv}</em>
                    </p>
                  ))}
                </div>
                <dl className="gb-dossier">
                  <div>
                    <dt>Frites</dt>
                    <dd>{s.counters.frites}</dd>
                  </div>
                  <div>
                    <dt>Salades OK / refus</dt>
                    <dd>
                      {s.counters.salade}/{s.counters.saladeRefus}
                    </dd>
                  </div>
                  <div>
                    <dt>Farms · record</dt>
                    <dd>
                      {s.counters.farms} · {s.bestFarm}
                    </dd>
                  </div>
                  <div>
                    <dt>Séances · reps</dt>
                    <dd>
                      {s.counters.trainings} · {s.counters.reps}
                    </dd>
                  </div>
                  <div>
                    <dt>Siestes refusées</dt>
                    <dd>{s.counters.siestesRefusees}</dd>
                  </div>
                  <div>
                    <dt>Fritoman</dt>
                    <dd>{s.counters.fritoman}</dd>
                  </div>
                </dl>
              </>
            ) : (
              TROPHIES.map((tr) => {
                const got = s.trophies[tr.id];
                const hidden = tr.secret && !got;
                return (
                  <div key={tr.id} className={`gb-row${got ? " is-on" : " is-locked"}`}>
                    <div className="gb-row__main">
                      <p className="gb-row__title">{hidden ? "??? Trophée secret" : tr.name}</p>
                      <p className="gb-row__meta">{hidden ? "Continue à vivre ta vie de Sparrow. Ça viendra." : tr.desc}</p>
                    </div>
                    <span className="gb-row__tag">{got ? "✓" : `+${tr.coins}`}</span>
                  </div>
                );
              })
            )}
          </>
        )}

        {page === "options" && (
          <>
            <div className="gb-opts">
              <button type="button" className="gb-btn gb-btn--wide" onClick={h.toggleSound}>
                SON : {sound ? "ACTIVÉ" : "COUPÉ"}
              </button>
              <label className="gb-range">
                <span>OPACITÉ DES COMMANDES : {Math.round(prefs.padOpacity * 100)} %</span>
                <input type="range" min={20} max={70} step={5} value={Math.round(prefs.padOpacity * 100)} onChange={(e) => h.setPadOpacity(Number(e.target.value) / 100)} aria-label="Opacité des commandes tactiles" />
              </label>
              <button type="button" className="gb-btn gb-btn--wide" onClick={h.toggleIntro}>
                INTRO GRAW STUDIO : {prefs.intro ? "ACTIVÉE" : "DÉSACTIVÉE"}
              </button>
              <button type="button" className="gb-btn gb-btn--wide" onClick={() => h.setPortrait(false)}>
                REVENIR AU MODE PAYSAGE
              </button>
              <button type="button" className="gb-btn gb-btn--wide" onClick={h.exportSave}>
                EXPORTER LA SAUVEGARDE
              </button>
              <button type="button" className="gb-btn gb-btn--wide" onClick={h.importSave}>
                IMPORTER UNE SAUVEGARDE
              </button>
            </div>
            <p className="gb-note">
              <b>Commandes</b> · croix : marcher · B maintenu : courir · A : parler, examiner, utiliser · B : annuler · START : menu · SELECT : mini-jeux · les mini-jauges en haut de l&apos;écran ouvrent le Profil. Dans l&apos;appart, toucher l&apos;écran = y aller.
            </p>
            <p className="gb-note">Sauvegarde locale, sur ce téléphone uniquement. Sparrow vit sa vie même appli fermée. Il ne meurt jamais : il boude, au pire.</p>
            <button type="button" className="gb-btn gb-btn--wide gb-btn--ghost" onClick={h.reset}>
              ADOPTER UN NOUVEAU SPARROW
            </button>
          </>
        )}
      </div>
    </section>
  );
}
