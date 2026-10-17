import { MOVES } from "@/lib/rpg/bestiary";
import { ally, baseDamage, canTransform, foe, forced, mustSwap, type Action, type Battle } from "@/lib/rpg/combat";

/** Un joueur raisonnable : se soigne quand ça va mal, se protège des attaques annoncées, sinon frappe fort. */
export function policy(b: Battle): Action {
  if (mustSwap(b)) return { kind: "swap", to: b.allies.findIndex((x) => x.hp > 0) };
  const f = forced(b);
  if (f) return f;
  const me = ally(b);
  const them = foe(b);
  if (canTransform(b) && them.hp / them.maxHp > 0.4) return { kind: "transform" };
  const low = me.hp / me.maxHp < 0.35;
  if (low && me.moves.includes("micro-sieste")) return { kind: "move", move: "micro-sieste" };
  if (low && me.moves.includes("sieste-titan")) return { kind: "move", move: "sieste-titan" };
  if (low && me.moves.includes("cornet-soin")) return { kind: "move", move: "cornet-soin" };
  if (low && (b.bag.frites ?? 0) > 0) return { kind: "item", item: "frites" };
  if (low) {
    const other = b.allies.findIndex((x, i) => i !== b.a && x.hp / x.maxHp > 0.6);
    if (other >= 0) return { kind: "swap", to: other };
  }
  if (them.charging && me.moves.includes("garde-silencieuse")) return { kind: "move", move: "garde-silencieuse" };
  let best = me.moves[0];
  let bs = -1;
  for (const id of me.moves) {
    const m = MOVES[id];
    const hits = m.hits ? (m.hits[0] + m.hits[1]) / 2 : 1;
    let s = baseDamage(me, them, m) * hits * (m.acc / 100);
    if (m.charge) s *= them.charging ? 0.2 : 0.55;
    if (s > bs) {
      bs = s;
      best = id;
    }
  }
  return { kind: "move", move: best };
}

