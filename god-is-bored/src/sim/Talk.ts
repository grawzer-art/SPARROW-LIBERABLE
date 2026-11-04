import { hash2 } from "./rng";
import { EMO, GOAL, IDEA, MEM, REL } from "./MindSystem";
import type { SimulationEngine } from "./SimulationEngine";
import type { Citizen } from "./types";

/** Sujets de conversation : ils découlent de ce que l'habitant porte en lui (souvenirs, confiance, projets, foi, famille). */
export const TOPIC = { SMALL: 0, HUNGER: 1, LEADER: 2, LEAVE: 3, FAITH: 4, FAMILY: 5, GRUDGE: 6 } as const;
export const TOPIC_LABEL = ["Propos du quotidien", "La faim", "Le chef", "Partir", "La foi", "La famille", "Une rancune"];
/** Ton de l'échange : 0 tranquille, 1 tendu, 2 chaleureux. */
export const MOOD = { CALM: 0, HEATED: 1, WARM: 2 } as const;

export interface TalkLine { tick: number; who: number; text: string }
export interface Talk { a: number; b: number; topic: number; mood: number; start: number; last: number; speaker: number; n: number; lines: TalkLine[]; effect: string; over: boolean; agree: number }

/** Rythme : une réplique toutes les 2,2 s à ×1 (22 ticks). Les échanges durent 6 répliques. */
const PACE = 22;
const MAX_LINES = 6;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const pick = <T>(arr: T[], h: number): T => arr[Math.floor(h * arr.length) % arr.length];

/**
 * Conversations simulées : de vrais échanges entre deux habitants, avec sujet, répliques alternées, ton et EFFETS réels sur
 * leur esprit (confiance, idées, souvenirs, affinité, projet de départ). Données de simulation pures : le rendu les lit pour mettre
 * en scène (face à face, gestes alternés), l'interface les lit pour les afficher à la demande.
 */
export class TalkSystem {
  talks = new Map<string, Talk>();
  stats = { started: 0, lines: 0, convinced: 0, quarrels: 0 };

  private key(a: number, b: number): string { return a < b ? `${a}:${b}` : `${b}:${a}`; }

  /** Conversation en cours d'un habitant (ou undefined) et son rôle (celui qui parle ou celui qui écoute). */
  of(c: Citizen): { talk: Talk; speaking: boolean } | undefined {
    const o = c.soul?.target ?? -1;
    if (o < 0) return undefined;
    const t = this.talks.get(this.key(c.id, o));
    return t && !t.over ? { talk: t, speaking: t.speaker === c.id } : undefined;
  }
  get(a: number, b: number): Talk | undefined { return this.talks.get(this.key(a, b)); }
  /** Conversation en cours la plus proche d'un point (pour la toucher et l'observer). */
  near(sim: SimulationEngine, x: number, y: number, r = 2): Talk | undefined {
    let best: Talk | undefined, bd = r;
    for (const t of this.talks.values()) {
      if (t.over) continue;
      const a = sim.citizenById.get(t.a), b = sim.citizenById.get(t.b);
      if (!a || !b) continue;
      const d = Math.hypot((a.x + b.x) / 2 - x, (a.y + b.y) / 2 - y);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  private topicFor(sim: SimulationEngine, c: Citizen, p: Citizen): { topic: number; score: number } {
    const m = sim.mind.ensure(sim, c);
    const famine = sim.mind.memLoad(sim, m, MEM.FAMINE);
    const rel = sim.mind.relOf(c, p.id);
    const kin = !!rel && (rel.k === REL.KIN || rel.k === REL.PARTNER);
    const S: number[] = [0.22, famine * 0.9 + (c.hunger > 65 ? 0.3 : 0), Math.max(0, -m.trust - 15) / 100 * 1.3, (m.goal === GOAL.LEAVE ? 0.9 : 0) + (m.ideas & IDEA.WANDER ? 0.3 : 0),
      (m.ideas & IDEA.FAITH ? 0.35 : 0) + c.faith * 0.25, kin ? 0.45 : 0, rel && rel.k === REL.RIVAL ? 0.8 : 0];
    let best = 0, bs = -1;
    S.forEach((v, i) => { const s = v + hash2(c.id, p.id + Math.floor(sim.tick / 90), 330 + i) * 0.12; if (s > bs) { bs = s; best = i; } });
    return { topic: best, score: bs };
  }

  /** Appelé à chaque tick par les deux interlocuteurs tant qu'ils se parlent (la réplique suivante n'est dite qu'une fois par rythme). */
  step(sim: SimulationEngine, c: Citizen, p: Citizen): void {
    const k = this.key(c.id, p.id);
    let t = this.talks.get(k);
    if (t && t.over && sim.tick - t.last > 60) { this.talks.delete(k); t = undefined; }
    if (!t) {
      // c'est celui qui a le plus à dire qui engage la conversation (et en choisit le sujet)
      const tc = this.topicFor(sim, c, p), tp = this.topicFor(sim, p, c);
      const first = tp.score > tc.score + 0.05 ? p : c, second = first === c ? p : c, pickT = first === c ? tc : tp;
      t = { a: first.id, b: second.id, topic: pickT.topic, mood: MOOD.CALM, start: sim.tick, last: sim.tick - PACE + 6, speaker: first.id, n: 0, lines: [], effect: "", over: false, agree: -1 };
      this.talks.set(k, t); this.stats.started++;
    }
    if (t.over || sim.tick - t.last < PACE) return;
    t.last = sim.tick;
    this.speak(sim, t);
    // l'échange se termine après quelques répliques : tous deux ont dit ce qu'ils avaient à dire
    if (t.n >= MAX_LINES) {
      t.over = true;
      for (const id of [t.a, t.b]) { const s = sim.citizenById.get(id)?.soul; if (s) { s.soc = Math.min(s.soc, 12); s.until = 0; } }
    }
  }

  prune(sim: SimulationEngine): void {
    for (const [k, t] of this.talks) {
      const a = sim.citizenById.get(t.a), b = sim.citizenById.get(t.b);
      if (!a || !b || a.dead || b.dead) { this.talks.delete(k); continue; }
      if (!t.over && sim.tick - t.last > 90) t.over = true; // ils se sont séparés avant la fin
      if (t.over && sim.tick - t.last > 400) this.talks.delete(k);
    }
  }

  private say(sim: SimulationEngine, t: Talk, who: Citizen, text: string): void {
    t.lines.push({ tick: sim.tick, who: who.id, text });
    if (t.lines.length > 8) t.lines.shift();
    t.speaker = who.id === t.a ? t.b : t.a; // la parole passe à l'autre
    t.n++; this.stats.lines++;
  }

  /**
   * Une réplique. Rôles fixes : I = celui qui a engagé la conversation (répliques paires), R = celui qui répond (répliques impaires).
   * La position de R (il approuve ou conteste) est tirée de SON esprit (confiance, affinité, caractère, idées) et reste la même
   * pendant tout l'échange ; ses effets (idées, confiance, souvenir, projet) s'appliquent à celui qui est réellement convaincu.
   */
  private speak(sim: SimulationEngine, t: Talk): void {
    const I = sim.citizenById.get(t.a), R = sim.citizenById.get(t.b);
    if (!I || !R) { t.over = true; return; }
    const n = t.n; // rang de la réplique (say() l'incrémente)
    const who = n % 2 === 0 ? I : R;
    const mi = sim.mind.ensure(sim, I), mr = sim.mind.ensure(sim, R);
    const h = hash2(I.id * 7 + R.id, n + Math.floor(t.start / 10), 400);
    const tick = sim.tick;
    const chief = sim.civById.get(I.civ)?.leader.name ?? "le chef";
    const dest = sim.cityById.get(mi.gTarget >= 0 ? mi.gTarget : mr.gTarget) ?? sim.mind.destination(sim, I, sim.civById.get(I.civ)!, mi)?.city;
    const aff = (sim.mind.relOf(R, I.id)?.a ?? 0) / 100;
    const say = (text: string) => this.say(sim, t, who, text);
    const T = (a: string[]) => pick(a, h);
    const heat = () => { t.mood = MOOD.HEATED; this.stats.quarrels++; sim.mind.remember(sim, I, MEM.QUARREL, -25, R.id); sim.mind.remember(sim, R, MEM.QUARREL, -25, I.id); };
    // position de R, déterminée une fois à sa première réplique
    const stance = (p: number): boolean => { if (t.agree < 0) t.agree = rndStance(I, R, tick) < p ? 1 : 0; return t.agree === 1; };
    const rndStance = (a: Citizen, b: Citizen, k: number) => hash2(a.id + b.id, k, 411);
    const closer = () => say(n % 2 === 0 ? T(["Bon. Il faut que j'y aille.", "Merci de m'avoir écouté.", "On en reparlera."]) : T(["À plus tard.", "Prends soin de toi.", "Oui. À bientôt."]));

    switch (t.topic) {
      case TOPIC.LEADER: {
        if (n === 0) { say(T([`Je ne fais plus confiance à ${chief}.`, `${chief} nous raconte des histoires.`, `Tu as vu comment ${chief} nous traite ?`])); mi.ideas |= IDEA.DISTRUST; }
        else if (n === 1) {
          if (stance(clamp(0.5 - mr.trust / 220 + aff * 0.25, 0.08, 0.92))) {
            say(T(["Tu as raison. Je n'y avais pas pensé comme ça.", "C'est vrai… depuis la famine, plus rien n'est pareil.", "Je me posais la même question."]));
            mr.ideas |= IDEA.DISTRUST; mr.trust = clamp(mr.trust - 12, -100, 100); sim.mind.remember(sim, R, MEM.TALK, -38, I.id);
            sim.mind.touch(R, I.id, 6); sim.mind.touch(I, R.id, 5); t.effect = `${R.name} doute désormais de ${chief}.`; this.stats.convinced++; mr.next = Math.min(mr.next, tick + 4);
          } else {
            say(T([`Ne dis pas ça. ${chief} fait ce qu'il peut.`, "Tu exagères. On a connu pire.", "Parle moins fort, on pourrait t'entendre."]));
            sim.mind.touch(I, R.id, -6); sim.mind.touch(R, I.id, -6); sim.mind.feel(R, EMO.ANGER, 14); if (I.aggr > 0.55 || R.aggr > 0.55) heat();
          }
        } else if (n === 2) say(t.agree === 1 ? T(["Moi, je dis qu'il faut que ça change.", "Les autres pensent comme nous, tu verras."]) : T(["Tu es aveugle, c'est tout.", "Un jour tu comprendras."]));
        else if (n === 3) say(t.agree === 1 ? T(["Alors parlons-en aux autres, doucement.", "Ne faisons rien d'imprudent, mais gardons les yeux ouverts."]) : T(["Cessons là. On ne s'entendra pas.", "Je ne veux plus en parler."]));
        else closer();
        break;
      }
      case TOPIC.HUNGER: {
        if (n === 0) say(T(["Je n'oublie pas la grande faim.", "Il y a des nuits où j'y pense encore.", "Plus jamais ça, tu m'entends ?"]));
        else if (n === 1) { say(T(["Moi non plus. On a perdu trop de monde.", "C'est dur d'en parler… mais merci.", "Tant qu'on a du grain, on tient."])); sim.mind.feel(I, EMO.SAD, 10); sim.mind.feel(R, EMO.SAD, 10); sim.mind.touch(I, R.id, 7); sim.mind.touch(R, I.id, 7); t.mood = MOOD.WARM; sim.mind.remember(sim, R, MEM.TALK, 18, I.id); }
        else if (n === 2) say(T(["On devrait garder des réserves, cette fois.", "Si ça recommence, je ne resterai pas."]));
        else if (n === 3) say(T(["Alors on fera attention ensemble.", "Je garde un sac de grain sous mon lit. Ne le dis à personne."]));
        else closer();
        break;
      }
      case TOPIC.LEAVE: {
        if (n === 0) { say(T([`On vivrait mieux à ${dest?.name ?? "l'est"}, tu ne crois pas ?`, `Il paraît qu'à ${dest?.name ?? "l'est"}, on mange à sa faim.`, "Je pense à partir. Pour de bon."])); mi.ideas |= IDEA.WANDER; }
        else if (n === 1) {
          if (stance(mr.trust < 0 || (mr.ideas & IDEA.WANDER) !== 0 || aff > 0.35 + (R.soul?.t[4] ?? 0.5) * 0.3 ? 0.97 : 0.12)) {
            say(T(["…Peut-être. Oui. Il faut y réfléchir sérieusement.", "Tu me donnes envie de tout quitter.", "Je n'osais pas le dire, mais j'y pense aussi."]));
            mr.ideas |= IDEA.WANDER; mr.lastLeave = -1e9; sim.mind.remember(sim, R, MEM.TALK, -42, I.id); sim.mind.touch(R, I.id, 8); mr.next = Math.min(mr.next, tick + 3);
            t.effect = `${R.name} envisage de partir${dest ? ` pour ${dest.name}` : ""}.`; this.stats.convinced++;
          } else { say(T(["Quitter les tombes de nos parents ? Jamais.", "Je suis bien ici. Ne compte pas sur moi.", "Les autres villages ont leurs propres soucis."])); sim.mind.touch(I, R.id, -3); mr.ideas &= ~IDEA.WANDER; }
        } else if (n === 2) say(t.agree === 1 ? T(["Si tu viens, je pars avec toi.", "Ne reste pas ici à attendre que ça empire."]) : T(["Réfléchis-y, au moins.", "Tu changeras d'avis quand la faim reviendra."]));
        else if (n === 3) {
          if (t.agree === 1 && dest) {
            say(T(["D'accord. Laisse-moi quelques jours.", "C'est décidé : on part ensemble.", "Prévenons les petits. Nous partons."]));
            // la décision est prise : les deux partent ensemble ; la famille est rassemblée avant le départ
            for (const c of [I, R]) { const mc = sim.mind.ensure(sim, c); mc.goal = GOAL.LEAVE; mc.gT = tick; mc.gTarget = dest.id; mc.gWhy = [13, 5]; mc.lastLeave = tick; }
            sim.mind.rally(sim, I, dest, 90); sim.mind.rally(sim, R, dest, 90);
            mr.go = mi.go = Math.max(mr.go ?? 0, mi.go ?? 0, tick + 90);
            t.effect = `${I.name} et ${R.name} ont décidé de partir pour ${dest.name}, avec leur famille.`;
          } else say(T(["Non. Ma place est ici.", "Peut-être un jour. Pas aujourd'hui."]));
        } else closer();
        break;
      }
      case TOPIC.FAITH: {
        if (n === 0) { say(T(["J'ai fait un drôle de rêve cette nuit.", "Quelqu'un nous regarde, là-haut. J'en suis sûr.", "Tu as senti ce vent ? Ce n'était pas naturel."])); mi.ideas |= IDEA.FAITH; }
        else if (n === 1) {
          if (stance(R.faith + aff * 0.2 > 0.45 ? 0.95 : 0.1)) { say(T(["Raconte-moi… je veux savoir.", "Moi aussi, parfois, je sens une présence."])); mr.ideas |= IDEA.FAITH; R.faith = Math.min(1, R.faith + 0.06); sim.mind.remember(sim, R, MEM.TALK, 22, I.id); t.mood = MOOD.WARM; t.effect = `${R.name} est troublé(e) par ce récit.`; }
          else say(T(["Ce sont des histoires pour consoler les enfants.", "Le vent est le vent."]));
        } else if (n === 2) say(t.agree === 1 ? T(["Ça m'a donné du courage, tu sais.", "J'ai l'impression que tout a un sens."]) : T(["Rira bien qui rira le dernier.", "Tu verras, un jour, un signe."]));
        else if (n === 3) say(t.agree === 1 ? T(["Parlons-en à Lenn, il saura.", "Alors on n'est pas seuls."]) : T(["Garde ça pour toi.", "Si ça te rassure."]));
        else closer();
        break;
      }
      case TOPIC.FAMILY: {
        const lines = [["Les petits grandissent si lentement…", "Il faut qu'on pense à leur avenir.", "Rentrons ensemble ce soir."], ["Je sais. Je ne veux pas qu'ils connaissent la faim.", "Tout ira bien, tant qu'on est ensemble.", "Oui. Je prépare la soupe."]];
        if (n < 4) say(T(lines[n % 2])); else closer();
        sim.mind.touch(I, R.id, 4); sim.mind.touch(R, I.id, 4); sim.mind.feel(I, EMO.JOY, 5); sim.mind.feel(R, EMO.JOY, 5); t.mood = MOOD.WARM;
        break;
      }
      case TOPIC.GRUDGE: {
        const calm = (sim.soul.ensure(R).t[3] + sim.soul.ensure(I).t[3]) / 2 > 0.55;
        if (n === 0) say(T(["Je n'ai pas oublié ce que tu m'as fait.", "On avait un compte à régler, toi et moi.", "Tu oses encore me regarder ?"]));
        else if (n === 1) {
          if (stance(calm ? 0.95 : 0.05)) { say(T(["…Tu as raison d'être en colère. Je suis désolé(e).", "Enterrons ça. La vie est trop courte."])); sim.mind.touch(I, R.id, 25); sim.mind.touch(R, I.id, 25); sim.mind.remember(sim, I, MEM.RECONCILE, 38, R.id); sim.mind.remember(sim, R, MEM.RECONCILE, 38, I.id); sim.mind.stats.reconciled++; t.mood = MOOD.WARM; t.effect = `${I.name} et ${R.name} se réconcilient.`; }
          else { say(T(["Tu ne changeras jamais.", "Va-t'en avant que je m'énerve."])); heat(); sim.mind.touch(I, R.id, -10); sim.mind.touch(R, I.id, -10); sim.mind.feel(I, EMO.ANGER, 18); sim.mind.feel(R, EMO.ANGER, 18); }
        } else if (n < 4) say(t.agree === 1 ? T(["Repartons de zéro.", "Je t'offre un bol, si tu veux."]) : T(["Je n'ai rien à ajouter.", "Ne me parle plus."]));
        else closer();
        break;
      }
      default: {
        const lines = [["La récolte s'annonce correcte, cette année.", "J'ai croisé un renard près des champs.", "Il fera beau demain, je le sens."], ["Espérons-le. J'ai les mains qui me démangent de travailler.", "Un renard ? Garde bien les poules.", "Tu dis ça tous les jours."]];
        if (n < 4) say(T(lines[n % 2])); else closer();
        sim.mind.touch(I, R.id, 4); sim.mind.touch(R, I.id, 4); sim.mind.feel(I, EMO.JOY, 4); sim.mind.feel(R, EMO.JOY, 4);
      }
    }
  }
}
