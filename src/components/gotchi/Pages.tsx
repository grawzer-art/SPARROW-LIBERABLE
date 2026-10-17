"use client";

import { useState } from "react";
import { TROPHIES } from "@/lib/gotchi/achievements";
import { STATS, ageJours, isEquipped, type Action, type State } from "@/lib/gotchi/engine";
import { ITEMS, MUSCLE_STAGES, TITLES, muscleStage, tierOf, titleFor, xpToNext, type Group, type Slot } from "@/lib/gotchi/items";
import { LAYOUT, ROOMS, type RoomId } from "@/lib/gotchi/map";
import { MINIGAMES, type GameId } from "@/lib/gotchi/minigames";
import { missionDef } from "@/lib/gotchi/missions";

export type PageId = "actions" | "jeux" | "missions" | "inventaire" | "appart" | "profil" | "journal" | "options";

export const MENU: { id: PageId; label: string; icon: string }[] = [
  { id: "actions", label: "Actions", icon: "▶" },
  { id: "jeux", label: "Mini-jeux", icon: "★" },
  { id: "missions", label: "Missions", icon: "!" },
  { id: "inventaire", label: "Inventaire", icon: "◆" },
  { id: "appart", label: "Appartement", icon: "⌂" },
  { id: "profil", label: "Profil", icon: "☺" },
  { id: "journal", label: "Journal", icon: "≡" },
  { id: "options", label: "Options", icon: "⚙" },
];

const TITLE: Record<PageId, string> = {
  actions: "ACTIONS",
  jeux: "MINI-JEUX",
  missions: "MISSIONS DU JOUR",
  inventaire: "INVENTAIRE",
  appart: "APPARTEMENT",
  profil: "PROFIL · ÉVOLUTION",
  journal: "JOURNAL DE SPARROW",
  options: "OPTIONS",
};

export const ACTIONS: { id: Action | "muscu"; label: string; where: string }[] = [
  { id: "frites", label: "Frites", where: "Cuisine · friteuse" },
  { id: "salade", label: "Salade", where: "Cuisine · frigo" },
  { id: "dofus", label: "Dofus (il joue seul)", where: "Coin gaming · PC" },
  { id: "sieste", label: "Micro-sieste", where: "Chambre · lit" },
  { id: "douche", label: "Rafraîchir", where: "Chambre · douche" },
  { id: "muscu", label: "S'entraîner", where: "Salle de sport · banc" },
  { id: "parler", label: "Parler", where: "Là où il est" },
];

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
  doAction: (a: Action | "muscu") => void;
  playGame: (g: GameId) => void;
  claim: (id: string) => void;
  buy: (id: string) => void;
  equip: (id: string) => void;
  goRoom: (r: RoomId) => void;
  toggleSound: () => void;
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
  h: PageHandlers;
  onClose: () => void;
}

/** Pages du MENU, affichées dans l'écran de la console. */
export function Page({ page, state, now, sound, room, h, onClose }: Props) {
  const [slot, setSlot] = useState<Slot>("lunettes");
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
        {page === "actions" && (
          <>
            <p className="gb-note">Sparrow va lui-même jusqu&apos;au bon meuble. Tu peux aussi l&apos;y conduire et appuyer sur A.</p>
            {ACTIONS.map((a) => (
              <button key={a.id} type="button" className="gb-row gb-row--btn" onClick={() => h.doAction(a.id)}>
                <span className="gb-cursor">▶</span>
                <span className="gb-row__main">
                  <span className="gb-row__title">{a.label}</span>
                  <span className="gb-row__meta">{a.where}</span>
                </span>
              </button>
            ))}
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
              {WEAR.map((w) => (
                <button key={w.id} type="button" role="tab" aria-selected={slot === w.id} className={slot === w.id ? "is-on" : ""} onClick={() => setSlot(w.id)}>
                  {w.label}
                </button>
              ))}
            </div>
            {ITEMS.filter((it) => it.slot === slot).map((it) => itemRow(it.id))}
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
            {tab === "plan" && (
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

        {page === "journal" &&
          (s.journal.length ? (
            [...s.journal].reverse().map((j, i) => (
              <div key={`${j.t}-${i}`} className={`gb-log gb-log--${j.kind}`}>
                <span>{hhmm(j.t)}</span>
                <p>{j.txt}</p>
              </div>
            ))
          ) : (
            <p className="gb-note">Rien pour l&apos;instant. Sparrow vit sa vie, reviens plus tard.</p>
          ))}

        {page === "options" && (
          <>
            <div className="gb-opts">
              <button type="button" className="gb-btn gb-btn--wide" onClick={h.toggleSound}>
                SON : {sound ? "ACTIVÉ" : "COUPÉ"}
              </button>
              <button type="button" className="gb-btn gb-btn--wide" onClick={h.exportSave}>
                EXPORTER LA SAUVEGARDE
              </button>
              <button type="button" className="gb-btn gb-btn--wide" onClick={h.importSave}>
                IMPORTER UNE SAUVEGARDE
              </button>
            </div>
            <p className="gb-note">
              Commandes : croix = marcher (B maintenu = courir) · A = utiliser / parler · B = annuler · START = menu · toucher l&apos;écran = y aller.
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
