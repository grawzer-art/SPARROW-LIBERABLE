import { TICKS_PER_YEAR } from "./config";
import { TECH_EFFECT, TECH_NAMES, genPlaceName, genReligion, DOGMA_LABEL } from "./data";
import type { SimulationEngine } from "./SimulationEngine";
import type { ChronicleEntry, City, Civ, EventType, Leader, War } from "./types";

const TPY = TICKS_PER_YEAR;

export interface LogInput {
  civ: number; civ2?: number; type: EventType; text: string; consequences?: string; importance?: 1 | 2 | 3;
}

export const LAW_INFO: Record<string, { name: string; effect: string }> = {
  noWheels: { name: "Interdiction des roues", effect: "Production de bois −20 %." },
  cloudBan: { name: "Interdiction des nuages", effect: "Récoltes −5 %, stabilité +3 (le peuple se sent protégé)." },
  mandatoryDance: { name: "Danse de la pluie obligatoire", effect: "Récoltes −3 %, stabilité +4." },
  noTuesday: { name: "Suppression du mardi", effect: "Revenus −10 % (un jour sans taxes)." },
  shadowTax: { name: "Taxe sur l'ombre", effect: "Revenus +12 %, stabilité −3." },
};

const ACCIDENTS: { text: string; law?: string }[] = [
  { text: "glisse sur une peau de banane importée à grands frais" },
  { text: "est piétiné par son propre éléphant de cérémonie" },
  { text: "est écrasé par sa propre statue lors de l'inauguration", law: "shadowTax" },
  { text: "se noie dans son bain, devant son équipe de baigneurs" },
  { text: "est renversé par une charrette lors d'un défilé en son honneur", law: "noWheels" },
  { text: "s'étouffe avec une olive, en pleine harangue sur la tempérance" },
  { text: "tombe de son trône en éternuant. Le trône était réputé inconfortable", law: "noTuesday" },
];

const WANT_LABEL: Record<string, string> = {
  rain: "de la pluie", fire: "du feu", food: "du pain", victory: "la victoire", cure: "la guérison", gift: "un cadeau",
};

/** Chroniques + moteur narratif : tout texte est déclenché par un fait réel de la simulation. */
export class EventSystem {
  private last = new Map<string, number>();

  pick<T>(sim: SimulationEngine, key: string, arr: readonly T[]): T {
    let i = sim.rng.int(arr.length);
    if (arr.length > 1 && this.last.get(key) === i) i = (i + 1 + sim.rng.int(arr.length - 1)) % arr.length;
    this.last.set(key, i);
    return arr[i];
  }

  log(sim: SimulationEngine, e: LogInput): ChronicleEntry {
    const entry: ChronicleEntry = {
      id: sim.newId(), tick: sim.tick, year: sim.year, civ: e.civ, civ2: e.civ2 ?? -1,
      type: e.type, text: e.text, consequences: e.consequences ?? "", importance: e.importance ?? 1,
    };
    sim.chronicle.push(entry);
    if (sim.chronicle.length > 2500) sim.chronicle.splice(0, sim.chronicle.length - 2500);
    if (entry.importance >= 2) sim.boredom = Math.max(0, sim.boredom - 9);
    for (const l of sim.listeners) l(entry);
    return entry;
  }

  private coolOk(sim: SimulationEngine, civ: Civ, key: string, years: number): boolean {
    const t = civ.lastEvt[key] ?? -1e9;
    if (sim.tick - t < years * TPY) return false;
    civ.lastEvt[key] = sim.tick;
    return true;
  }

  // ------------------------------------------------------------ royaumes

  civBorn(sim: SimulationEngine, civ: Civ, city: City): void {
    const t = this.pick(sim, "born", [
      `Naissance de ${civ.formal}. ${civ.leader.title} ${civ.leader.name} annonce que l'histoire commence aujourd'hui, ce qui est faux mais pratique.`,
      `${civ.formal} sort de la brume, fonde ${city.name} et se déclare immédiatement supérieure à tout ce qui existe.`,
      `Quelques familles se rassemblent à ${city.name}. On les appellera bientôt ${civ.formal}, faute de mieux.`,
    ]);
    this.log(sim, { civ: civ.id, type: "birth", importance: 3, text: t,
      consequences: `Religion : ${civ.religion.name}. ${DOGMA_LABEL[civ.religion.dogma]}.` });
  }

  newTribe(sim: SimulationEngine, civ: Civ): void {
    this.log(sim, { civ: civ.id, type: "birth", importance: 3,
      text: `Une tribu sort d'une caverne et se proclame ${civ.formal}, convaincue d'avoir tout inventé, y compris le feu.`,
      consequences: "Le monde avait cessé de s'agiter ; il reprend." });
  }

  cityFounded(sim: SimulationEngine, civ: Civ, city: City): void {
    const t = this.pick(sim, "city", [
      `${civ.name} fonde ${city.name}, à l'endroit exact où personne n'avait osé.`,
      `${city.name} naît : une poignée de colons, un hall en chantier et un panneau « Bienvenue » déjà obsolète.`,
      `Les colons de ${civ.name} s'installent à ${city.name}. Ils appellent ça de l'expansion ; les arbres, de la déforestation.`,
    ]);
    this.log(sim, { civ: civ.id, type: "city", importance: 2, text: t, consequences: `${sim.citiesOf(civ.id).length} ville(s). Territoire en expansion.` });
  }

  castleBuilt(sim: SimulationEngine, civ: Civ, city?: City): void {
    if (!this.coolOk(sim, civ, "castle", 6)) return;
    this.log(sim, { civ: civ.id, type: "city", text: `${civ.name} achève un château à ${city?.name ?? "quelque part"}. Il sert surtout à rassurer le dirigeant.`,
      consequences: "Défense accrue. Rayon de la ville +2." });
  }

  discovery(sim: SimulationEngine, civ: Civ, level: number): void {
    const n = TECH_NAMES[level];
    const L = civ.leader;
    const texts: Record<number, string[]> = {
      1: [`${civ.formal} découvre l'agriculture. Les premiers agriculteurs réclament déjà des congés.`, `${civ.name} comprend qu'une graine plantée donne une plante. ${L.name} s'attribue le mérite.`],
      2: [`${civ.formal} invente la roue. ${L.name} la déclare « un peu ronde, mais ça ira ».`, `La roue est découverte à ${civ.name}. Son premier usage : se plaindre du bruit.`],
      3: [`${civ.name} maîtrise la métallurgie. Les voisins sont informés par courrier sous forme d'épée.`, `${civ.formal} fond ses premiers métaux. Les casseroles attendront.`],
      4: [`${civ.name} invente l'écriture. Le premier texte est une liste de rancunes, soigneusement classée.`, `L'écriture arrive à ${civ.formal} : on peut désormais perdre des documents officiels.`],
      5: [`${civ.formal} découvre le fer et la chevalerie. Désormais, les massacres ont de l'allure.`, `${civ.name} adopte la chevalerie : se faire tuer en armure est un progrès.`],
      6: [`${civ.name} développe la médecine. Elle repose surtout sur des saignées et sur l'optimisme.`, `${civ.formal} invente le médecin, puis, dans la foulée, le médecin incompétent.`],
      7: [`${civ.formal} découvre la poudre noire. ${L.name} la teste immédiatement sur une chose précieuse.`, `${civ.name} invente la poudre. Les voisins constatent un regain de bruit.`],
    };
    this.log(sim, { civ: civ.id, type: "discovery", importance: 2, text: this.pick(sim, "disc" + level, texts[level]), consequences: `${n} : ${TECH_EFFECT[level]}` });
  }

  // ------------------------------------------------------------ dirigeants

  pickAccident(sim: SimulationEngine, civ: Civ): { text: string; law?: string } {
    const list = ACCIDENTS.filter((a) => a.law !== "noWheels" || civ.tech >= 2);
    return this.pick(sim, "acc", list);
  }

  leaderDeath(sim: SimulationEngine, civ: Civ, old: Leader, nl: Leader, cause: string, accident: { text: string; law?: string } | null, detail?: string): void {
    const base = `${old.title} ${old.name}`;
    let t: string;
    switch (cause) {
      case "age": t = this.pick(sim, "lage", [
        `${base} meurt de vieillesse, entouré de courtisans qui comptent déjà l'héritage.`,
        `${base} s'éteint dans son lit, après ${sim.year - old.since} ans de règne que personne n'a demandés.`]); break;
      case "accident": t = `${base} ${accident?.text ?? "meurt dans des circonstances ridicules"}.`; break;
      case "war": t = `${base} tombe pendant la bataille, ou plus exactement dans un fossé pendant la bataille.`; break;
      case "lightning": t = `${base} est foudroyé en plein discours. Les théologiens y voient un message, les autres un paratonnerre manquant.`; break;
      case "meteor": t = `${base} est écrasé par un caillou céleste. L'opposition accuse le gouvernement de ne pas l'avoir vu venir.`; break;
      case "plague": t = `${base} succombe à la peste, après avoir déclaré publiquement qu'il n'y avait pas de peste.`; break;
      case "wrath": t = `${base} est emporté par la colère divine, ce qui rend sa dernière déclaration tout à fait ironique.`; break;
      default: t = `${base} est renversé.`;
    }
    t += ` ${nl.goat ? "" : `${nl.title} ${nl.name} lui succède.`}`;
    this.log(sim, { civ: civ.id, type: "leader", importance: 2, text: t.trim(),
      consequences: `Stabilité −${cause === "age" ? 3 : 10}.${detail ? " " + detail : ""}` });
  }

  goat(sim: SimulationEngine, civ: Civ, l: Leader): void {
    const t = this.pick(sim, "goat", [
      `Une chèvre est élue dirigeante de ${civ.formal} après une crise politique. ${l.name} promet de brouter les problèmes à la racine.`,
      `${civ.formal} confie le pouvoir à ${l.name}, une chèvre. Les observateurs notent une légère amélioration du climat politique.`,
    ]);
    this.log(sim, { civ: civ.id, type: "absurd", importance: 3, text: t, consequences: "Stabilité +8, aucune ambition guerrière, recherche ralentie." });
  }

  adoptLaw(sim: SimulationEngine, civ: Civ, id: string, reason: string): void {
    if (civ.laws.some((l) => l.id === id)) return;
    const info = LAW_INFO[id];
    civ.laws.push({ id, name: info.name, since: sim.year });
    if (civ.laws.length > 3) civ.laws.shift();
    const texts: Record<string, string> = {
      noWheels: `${civ.leader.title} ${civ.leader.name} interdit les roues ${reason}. Le bois sera désormais transporté à dos de rancœur.`,
      cloudBan: `${civ.formal} interdit les nuages ${reason}. La météo n'a pas été consultée.`,
      mandatoryDance: `${civ.formal} impose la danse de la pluie ${reason}. Chaque habitant doit danser, y compris les boiteux.`,
      noTuesday: `${civ.formal} supprime le mardi ${reason}. L'économie a du mal à comprendre.`,
      shadowTax: `${civ.formal} instaure une taxe sur l'ombre ${reason}. Le fisc surveille le soleil.`,
    };
    this.log(sim, { civ: civ.id, type: "law", importance: 2, text: texts[id], consequences: info.effect });
  }

  // ------------------------------------------------------------ effondrements

  collapse(sim: SimulationEngine, civ: Civ, old: Leader, lost: number): void {
    const t = this.pick(sim, "collapse", [
      `${civ.formal} s'effondre : ${old.name} est chassé par une foule qui n'était d'accord sur rien, sauf sur lui.`,
      `Le gouvernement de ${civ.formal} s'écroule. ${lost} habitants meurent dans des émeutes sur le thème « qui dirige ? ».`,
    ]);
    this.log(sim, { civ: civ.id, type: "collapse", importance: 3, text: t, consequences: `${lost} morts, technologie en recul, trésor pillé.` });
  }

  breakaway(sim: SimulationEngine, civ: Civ, nc: Civ, city: City): void {
    this.log(sim, { civ: civ.id, civ2: nc.id, type: "collapse", importance: 3,
      text: `${city.name} fait sécession et fonde ${nc.formal}. ${civ.leader.name} dit que c'était prévu.`,
      consequences: `Naissance de ${nc.name}. Rancune durable envers ${civ.name}.` });
  }

  extinct(sim: SimulationEngine, civ: Civ): void {
    const t = this.pick(sim, "ext", [
      `${civ.formal} disparaît. On retrouvera plus tard ses ruines, et un mur couvert de plaintes.`,
      `La dernière habitante de ${civ.formal} éteint la lumière. Il n'y avait pas de lumière, mais c'est l'intention qui compte.`,
    ]);
    this.log(sim, { civ: civ.id, type: "collapse", importance: 3, text: t,
      consequences: `${civ.stats.births} naissances et ${civ.stats.deaths} morts au total. Fondée en l'an ${civ.foundedYear}.` });
  }

  drought(sim: SimulationEngine, civ: Civ, city: City): void {
    this.log(sim, { civ: civ.id, type: "catastrophe", importance: 2,
      text: `Sécheresse sur ${city.name}. ${civ.leader.name} organise des prières, des danses et une enquête sur les nuages.`,
      consequences: "Récoltes divisées par deux dans la zone." });
  }

  // ------------------------------------------------------------ prières

  prayerResult(sim: SimulationEngine, civ: Civ, got: "rain" | "lightning" | "meteor" | "plague" | "bless" | "wrath"): void {
    const pr = civ.prayer;
    if (!pr) return;
    const gotLabel: Record<string, string> = {
      rain: "la pluie", lightning: "la foudre", meteor: "un caillou de la taille d'une colline", plague: "la peste", bless: "une bénédiction", wrath: "la colère divine",
    };
    const ok: Record<string, string[]> = {
      rain: ["rain", "food"], bless: ["gift", "food", "victory", "cure"], lightning: ["fire"], meteor: ["fire"], plague: [], wrath: [],
    };
    const match = ok[got].includes(pr.want);
    if (!this.coolOk(sim, civ, "prayer", 3)) return;
    for (const c of sim.citizens) if (c.civ === civ.id) c.faith = Math.min(1, c.faith + (match ? 0.08 : 0.03));
    if (match) {
      civ.stability = Math.min(100, civ.stability + 6);
      this.log(sim, { civ: civ.id, type: "miracle", importance: 2,
        text: `Les habitants de ${civ.name} remercient Dieu pour ${gotLabel[got]}. C'était exactement ce qu'ils avaient demandé. Ils ne le méritaient pas.`,
        consequences: "Foi +8 %, stabilité +6." });
    } else {
      civ.stability = Math.max(0, civ.stability - (got === "plague" || got === "wrath" ? 2 : 0));
      const wanted = WANT_LABEL[pr.want];
      const t = got === "plague" || got === "wrath" || got === "meteor"
        ? `Les habitants de ${civ.name} avaient demandé ${wanted}. Ils ont reçu ${gotLabel[got]}. Les prêtres parlent d'un malentendu ; les survivants, d'un procès.`
        : `Les habitants de ${civ.name} remercient Dieu pour ${gotLabel[got]}. Ils avaient pourtant demandé ${wanted}.`;
      this.log(sim, { civ: civ.id, type: "miracle", importance: 2, text: t, consequences: "Foi +3 %. Les prêtres inventent une théologie pour l'occasion." });
    }
    civ.prayer = null;
  }

  // ------------------------------------------------------------ guerre / diplomatie

  warDeclared(sim: SimulationEngine, war: War, a: Civ, d: Civ): void {
    const L = a.leader;
    const why = war.reason;
    const t: Record<string, string[]> = {
      conquest: [`${a.formal} déclare la guerre à ${d.formal}. ${L.name} juge ses terres « mal exploitées », ce qui est un avis d'expert en rien.`,
        `${L.name} regarde la carte, regarde ${d.name}, et déclare la guerre. Tout est dit.`],
      resources: [`${a.formal} déclare la guerre à ${d.formal}, dont les récoltes et les forêts éveillent chez elle un amour soudain.`],
      revenge: [`${a.formal} déclare la guerre à ${d.formal} pour venger ${why}. Personne ne se rappelle déjà ce que c'était, mais la rancune est intacte.`],
      alliance: [`${a.formal} déclare la guerre à ${d.formal} pour honorer son alliance. Les alliés rappellent qu'ils n'avaient rien demandé.`],
      provocation: [`${a.formal} déclare la guerre à ${d.formal} après ${why}. L'insulte était, selon les historiens, minuscule.`],
      ego: [`${a.formal} déclare la guerre à ${d.formal} : ${L.name} s'est senti insulté par ${why}.`],
    };
    this.log(sim, { civ: a.id, civ2: d.id, type: "war", importance: 3, text: this.pick(sim, "wd" + war.cb, t[war.cb]),
      consequences: `Mobilisation de ${a.soldiers} soldats. Relations rompues.` });
  }

  battle(sim: SimulationEngine, war: War, a: Civ, b: Civ, placeName: string, lostA: number, lostB: number): void {
    this.log(sim, { civ: a.id, civ2: b.id, type: "war", importance: 2,
      text: `Bataille de ${placeName} : ${a.name} et ${b.name} se disputent un morceau de campagne qui n'a rien demandé.`,
      consequences: `Pertes : ${lostA} (${a.name}), ${lostB} (${b.name}).` });
  }

  cityCaptured(sim: SimulationEngine, war: War, city: City, from: Civ, to: Civ, razed: boolean): void {
    const t = razed
      ? `${to.name} rase ${city.name}. ${to.leader.name} appelle cela « un nettoyage de printemps ».`
      : `${to.name} s'empare de ${city.name}. Les habitants changent de drapeau avec une résignation remarquable.`;
    this.log(sim, { civ: to.id, civ2: from.id, type: "war", importance: 3, text: t,
      consequences: razed ? `${city.name} détruite.` : `${city.name} passe sous contrôle de ${to.name}. Territoire redistribué.` });
  }

  peace(sim: SimulationEngine, war: War, outcome: "victory" | "white" | "collapse", winner: Civ | null, loser: Civ | null, a: Civ, d: Civ): void {
    const total = war.casA + war.casD + war.civCas;
    let t: string, type: EventType = "treaty";
    if (outcome === "victory" && winner && loser) {
      t = `${loser.formal} signe la paix avec ${winner.formal}. ${winner.leader.name} fait graver une victoire qu'un scribe nuance en bas de page.`;
    } else if (outcome === "white") {
      t = `${a.name} et ${d.name} signent une paix blanche. Chacun jure avoir gagné ; les cimetières ne sont pas d'accord.`;
    } else {
      t = `La guerre entre ${a.name} et ${d.name} s'arrête faute de combattants à envoyer au front.`;
      type = "peace";
    }
    this.log(sim, { civ: a.id, civ2: d.id, type, importance: 3, text: t,
      consequences: `Bilan : ${total} morts (${war.casA + war.casD} soldats, ${war.civCas} civils). ${war.takenA + war.takenD} ville(s) changent de main.` });
  }

  senselessWar(sim: SimulationEngine, war: War, a: Civ, d: Civ): void {
    const total = war.casA + war.casD + war.civCas;
    this.log(sim, { civ: a.id, civ2: d.id, type: "absurd", importance: 2,
      text: `${total} habitants meurent dans une guerre entre ${a.name} et ${d.name} dont personne ne connaît plus l'origine.`,
      consequences: "Les deux camps affirment défendre une cause. La même." });
  }

  alliance(sim: SimulationEngine, a: Civ, b: Civ): void {
    this.log(sim, { civ: a.id, civ2: b.id, type: "treaty", importance: 2,
      text: this.pick(sim, "all", [
        `${a.name} et ${b.name} signent une alliance. Le banquet dure plus longtemps que l'amitié.`,
        `Alliance entre ${a.formal} et ${b.formal} : désormais, leurs guerres seront communes et leurs rancunes aussi.`]),
      consequences: "Soutien militaire mutuel en cas de guerre." });
  }

  allianceBroken(sim: SimulationEngine, a: Civ, b: Civ): void {
    this.log(sim, { civ: a.id, civ2: b.id, type: "treaty", text: `L'alliance entre ${a.name} et ${b.name} est rompue : une histoire de repas, officiellement.`, consequences: "Relations en baisse." });
  }

  // ------------------------------------------------------------ narrateur (annuel)

  update(sim: SimulationEngine, yearly: boolean): void {
    if (!yearly) return;
    const rng = sim.rng;
    for (const civ of sim.civs) {
      if (!civ.alive || civ.pop < 5) continue;
      const cap = sim.cityById.get(civ.capital);
      // accusations
      const inDrought = cap ? sim.inWeather("drought", cap.x, cap.y) : false;
      const paranoid = civ.personality === "paranoid" && rng.chance(0.05);
      const dumb = civ.personality === "stupid" && rng.chance(0.04);
      if ((civ.famine >= 1 || inDrought || paranoid || dumb) && this.coolOk(sim, civ, "accuse", 14)) this.accuse(sim, civ, inDrought);
      // charrette non fatale
      if (civ.tech >= 2 && rng.chance(0.006) && !civ.laws.some((l) => l.id === "noWheels") && this.coolOk(sim, civ, "cart", 30)) {
        this.adoptLaw(sim, civ, "noWheels", `après avoir été renversé par une charrette`);
      }
      // lois ridicules
      if ((civ.personality === "stupid" || civ.personality === "arrogant" || civ.personality === "paranoid") && rng.chance(0.025) && this.coolOk(sim, civ, "law", 20)) {
        const free = Object.keys(LAW_INFO).filter((id) => id !== "noWheels" && !civ.laws.some((l) => l.id === id));
        if (free.length) this.adoptLaw(sim, civ, rng.pick(free), "au terme d'un débat de neuf minutes");
      }
      // famine
      if (civ.famine === 2 && this.coolOk(sim, civ, "famine", 10)) {
        this.log(sim, { civ: civ.id, type: "catastrophe", importance: 2,
          text: `Famine à ${civ.name} : les greniers sont vides. Le conseil se réunit autour d'un banquet pour en discuter.`,
          consequences: `Stabilité en chute. Stock de nourriture : ${Math.floor(civ.food)}.` });
      }
      // vantardise
      for (const city of sim.cities) {
        if (city.civ !== civ.id) continue;
        if (city.pop >= 60 && civ.lastBoast < 60 || city.pop >= 120 && civ.lastBoast < 120) {
          civ.lastBoast = city.pop >= 120 ? 120 : 60;
          this.log(sim, { civ: civ.id, type: "city", importance: 2,
            text: `${city.name} atteint ${city.pop} habitants. Le maire affirme que c'est grâce à lui ; les statistiques évoquent surtout la natalité et l'ennui.`,
            consequences: "La ville s'étend, et les rues aussi." });
        }
      }
      // schisme
      if (civ.stability < 40 && civ.avgFaith > 0.35 && rng.chance(0.012) && this.coolOk(sim, civ, "schism", 40)) {
        const old = civ.religion;
        civ.religion = genReligion(rng);
        civ.stability = Math.max(0, civ.stability - 5);
        this.log(sim, { civ: civ.id, type: "miracle", importance: 2,
          text: `Schisme à ${civ.name} : le « ${old.name} » se divise sur la question de la couleur du pain. Le vainqueur fonde le « ${civ.religion.name} ».`,
          consequences: "Religion remplacée. Stabilité −5." });
      }
      // dirigeant vaniteux
      if (cap && civ.leader.vanity > 0.75 && !civ.leader.goat && rng.chance(0.015) && this.coolOk(sim, civ, "rename", 40)) {
        const old = cap.name;
        cap.name = `${civ.leader.name.split(" ")[0]}opolis`;
        this.log(sim, { civ: civ.id, type: "absurd", text: `${civ.leader.title} ${civ.leader.name} rebaptise ${old} en ${cap.name}. Les cartographes protestent ; on les remplace.`, consequences: "Rien ne change, sauf les panneaux." });
      }
    }
    // guerres sans origine
    for (const w of sim.wars) {
      if (!w.active) continue;
      const a = sim.civById.get(w.a), d = sim.civById.get(w.d);
      if (!a || !d) continue;
      const dur = (sim.tick - w.start) / TPY;
      const origin = a.leader.name !== w.leaderName;
      if (dur >= 8 && origin && w.casA + w.casD + w.civCas >= 30 && (!w.forgotten || dur % 20 === 0)) {
        w.forgotten = true;
        this.senselessWar(sim, w, a, d);
      }
    }
    // ennui divin
    if (sim.boredom > 75 && sim.tick - (this.last.get("bored") ?? -1e9) > 25 * TPY) {
      this.last.set("bored", sim.tick);
      this.log(sim, { civ: -1, type: "absurd", text: "Dieu bâille. Un chroniqueur note que rien ne se passe, ce qui est probablement l'œuvre de quelqu'un.", consequences: "Ennui divin : critique." });
      sim.boredom = 60;
    }
    void genPlaceName;
  }

  accuse(sim: SimulationEngine, civ: Civ, drought: boolean): void {
    const others = sim.aliveCivs().filter((c) => c.id !== civ.id && sim.statusOf(c.id, civ.id) !== "alliance");
    if (!others.length) return;
    const cap = sim.cityById.get(civ.capital);
    let target = others[0], bd = Infinity;
    for (const o of others) for (const c of sim.cities) if (c.civ === o.id && cap) { const d = Math.hypot(c.x - cap.x, c.y - cap.y); if (d < bd) { bd = d; target = o; } }
    const what = drought ? "volé la pluie"
      : civ.famine >= 1 ? "volé les récoltes en les regardant avec insistance"
      : this.pick(sim, "acc", ["volé le soleil", "détourné le vent", "empoisonné les poules à distance", "dérobé la lune la nuit dernière", "volé le mois de mars"]);
    this.log(sim, { civ: civ.id, civ2: target.id, type: "absurd", importance: 2,
      text: `${civ.formal} accuse ${target.name} d'avoir ${what}. Aucune preuve n'a été demandée, aucune ne sera fournie.`,
      consequences: `Relations avec ${target.name} en forte baisse.` });
    sim.addOpinion(civ.id, target.id, -14);
    sim.addOpinion(target.id, civ.id, -4);
    const k = `${civ.id}>${target.id}`;
    sim.grudge[k] = Math.min(1, (sim.grudge[k] ?? 0) + 0.2);
    sim.grudgeWhy[k] = `les accusations d'avoir ${what}`;
  }
}
