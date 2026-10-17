import { describe, expect, it, vi } from "vitest";

// Faux client Supabase qui reproduit le piège réel de supabase-js : channel(topic) renvoie le canal
// existant du même nom, et removeChannel ne le retire de la liste que si la fermeture répond « ok ».
type Cb = (status: string, err?: Error) => void;
class FakeChannel {
  topic: string;
  binds: Record<string, ((p: unknown) => void)[]> = {};
  subscribed = 0;
  tracked: unknown[] = [];
  state: Record<string, { m: unknown }[]> = {};
  cb: Cb | null = null;
  constructor(t: string, private fail: { n: number }) {
    this.topic = `realtime:${t}`;
  }
  on(type: string, f: { event: string }, fn: (p: unknown) => void) {
    (this.binds[`${type}:${f.event}`] ??= []).push(fn);
    return this;
  }
  subscribe(cb: Cb) {
    // Un canal déjà rejoint ignore subscribe (comme supabase-js) → la connexion attendrait pour rien
    if (this.subscribed++) return this;
    this.cb = cb;
    setTimeout(() => (this.fail.n-- > 0 ? cb("CHANNEL_ERROR", new Error("MissingPartition")) : cb("SUBSCRIBED")), 1);
    return this;
  }
  presenceState() {
    return this.state;
  }
  sync(state: Record<string, { m: unknown }[]>) {
    this.state = state;
    for (const fn of this.binds["presence:sync"] ?? []) fn({});
  }
  async track(p: unknown) {
    this.tracked.push(p);
    return "ok";
  }
  async untrack() {
    return "ok";
  }
  send = vi.fn();
  async unsubscribe() {
    return "timed out"; // fermeture qui n'aboutit pas (réseau iPhone, arrière-plan…)
  }
  teardown() {}
}
const fail = { n: 0 };
const channels: FakeChannel[] = [];
const created: FakeChannel[] = [];
const client = {
  auth: { getSession: async () => ({ data: { session: null } }) },
  getChannels: () => channels,
  channel(t: string) {
    const ex = channels.find((c) => c.topic === `realtime:${t}`);
    if (ex) return ex;
    const c = new FakeChannel(t, fail);
    channels.push(c);
    created.push(c);
    return c;
  },
  async removeChannel(c: FakeChannel) {
    if ((await c.unsubscribe()) === "ok") channels.splice(channels.indexOf(c), 1);
  },
  realtime: {
    setAuth: async () => undefined,
    _remove(c: FakeChannel) {
      const i = channels.indexOf(c);
      if (i >= 0) channels.splice(i, 1);
    },
  },
  from: () => ({ select: () => ({ in: async (_k: string, ids: string[]) => ({ data: ids.map((id) => ({ id, pseudo: `P-${id}`, look: {}, level: 1 })), error: null }) }) }),
};
vi.mock("@supabase/supabase-js", () => ({ createClient: () => client }));

const { SupabaseNet } = await import("@/lib/online/net");
const me = { id: "a", pseudo: "Alice", look: {} as never, level: 1 };
const mv = (x: number, s: number) => ({ x, y: 5, d: 0, s });
const handlers = () => ({ onPeers: vi.fn(), onMove: vi.fn(), onLeave: vi.fn(), onStatus: vi.fn() });

describe("SPARROW ONLINE — présence Supabase", () => {
  it("revenir au salon après un départ mal fermé crée un VRAI nouveau canal (plus de canal fantôme)", async () => {
    const net = new SupabaseNet("u", "k");
    const r1 = await net.join(me, mv(1, 1), handlers());
    await r1.leave();
    const h = handlers();
    const r2 = await net.join(me, mv(2, 1), h);
    expect(created).toHaveLength(2);
    expect(created[1]).not.toBe(created[0]);
    expect(channels).toEqual([created[1]]);
    expect(created[1].tracked).toEqual([{ m: mv(2, 1) }]);
    // L'autre joueur apparaît dès la synchro de présence
    created[1].sync({ a: [{ m: mv(2, 1) }], b: [{ m: mv(7, 3) }] });
    await vi.waitFor(() => expect(h.onPeers).toHaveBeenCalled());
    expect(h.onPeers.mock.lastCall![0]).toEqual([expect.objectContaining({ id: "b", pseudo: "P-b", move: mv(7, 3) })]);
    await r2.leave();
  });

  it("deux connexions d'un même compte : un seul avatar, à la position la plus récente", async () => {
    const net = new SupabaseNet("u", "k");
    const h = handlers();
    const r = await net.join(me, mv(1, 1), h);
    channels[0].sync({ a: [{ m: mv(1, 1) }], b: [{ m: mv(3, 2) }, { m: mv(9, 8) }] });
    await vi.waitFor(() => expect(h.onPeers).toHaveBeenCalled());
    expect(h.onPeers.mock.lastCall![0]).toHaveLength(1);
    expect(h.onPeers.mock.lastCall![0][0].move).toEqual(mv(9, 8));
    expect(net.diag.presence).toBe(2);
    await r.leave();
  });

  it("premier refus du serveur temps réel : nouvel essai automatique sur un canal neuf", async () => {
    fail.n = 1;
    const before = created.length;
    const net = new SupabaseNet("u", "k");
    const r = await net.join(me, mv(1, 1), handlers());
    expect(created.length - before).toBe(2);
    expect(channels).toHaveLength(1);
    expect(net.diag.log.join(" ")).toMatch(/CHANNEL_ERROR MissingPartition/);
    await r.leave();
  }, 10000);

  it("reconnexion automatique du canal : la présence est renvoyée", async () => {
    const net = new SupabaseNet("u", "k");
    const h = handlers();
    const r = await net.join(me, mv(1, 1), h);
    const ch = channels[0];
    r.move(mv(4, 2));
    ch.cb!("CHANNEL_ERROR");
    expect(h.onStatus).toHaveBeenLastCalledWith("lost");
    ch.cb!("SUBSCRIBED");
    expect(h.onStatus).toHaveBeenLastCalledWith("on");
    expect(ch.tracked.at(-1)).toEqual({ m: mv(4, 2) });
    await r.leave();
  });
});
