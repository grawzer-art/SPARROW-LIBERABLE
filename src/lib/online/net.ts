/**
 * SPARROW ONLINE — couche réseau.
 *
 * `OnlineNet` décrit tout ce dont le jeu a besoin (compte, héros, salon temps réel, chat).
 * - `SupabaseNet` : la vraie implémentation (Auth, PostgreSQL + RLS, Realtime).
 *   Configurée par NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (clé publique :
 *   elle ne donne que les droits définis par les règles RLS ; aucune clé secrète côté client).
 * - `RelayNet` : relais WebSocket local pour les tests automatisés à plusieurs navigateurs
 *   (scripts/online-dev-relay.mjs), activé seulement par NEXT_PUBLIC_ONLINE_DEV_RELAY.
 */

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { validLook, type Look } from "./hero";
import { isMove, ROOM, type Move } from "./sync";

export interface Profile {
  id: string;
  pseudo: string;
  look: Look;
  level: number;
}

export interface ChatMessage {
  id: number;
  author: string;
  pseudo: string;
  body: string;
  at: number;
}

export interface Peer {
  id: string;
  pseudo: string;
  look: Look;
  level: number;
  move: Move;
}

export interface RoomHandlers {
  /** Liste complète des joueurs présents (hors soi). */
  onPeers: (peers: Peer[]) => void;
  onMove: (id: string, m: Move) => void;
  onLeave: (id: string) => void;
  /** Canal perdu puis retrouvé (reconnexion automatique). */
  onStatus?: (s: "on" | "lost") => void;
}

/** Diagnostic de connexion (affiché en touchant le compteur « en ligne »). */
export interface Diag {
  channel: string;
  state: string;
  instance: number;
  presence: number;
  peers: number;
  sent: number;
  recv: number;
  lastSync: number;
  log: string[];
}
export const newDiag = (): Diag => ({ channel: "", state: "", instance: 0, presence: 0, peers: 0, sent: 0, recv: 0, lastSync: 0, log: [] });

export interface Room {
  instance: number;
  move: (m: Move) => void;
  leave: () => Promise<void>;
}

export interface OnlineNet {
  readonly kind: "supabase" | "relay";
  readonly diag?: Diag;
  session(): Promise<{ id: string; email: string } | null>;
  signUp(email: string, password: string): Promise<{ confirm: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  myProfile(): Promise<Profile | null>;
  createHero(invite: string, pseudo: string, look: Look): Promise<Profile>;
  updateLook(look: Look): Promise<Profile>;
  join(me: Profile, first: Move, h: RoomHandlers): Promise<Room>;
  chatHistory(): Promise<ChatMessage[]>;
  onChat(cb: (m: ChatMessage) => void): () => void;
  sendChat(body: string): Promise<void>;
  block(id: string): Promise<void>;
  unblock(id: string): Promise<void>;
  blocked(): Promise<string[]>;
  report(target: string, reason: string, messageId?: number): Promise<void>;
}

/** Message d'erreur lisible (les fonctions serveur répondent déjà en français). */
export const errText = (e: unknown) => {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/Invalid login credentials/i.test(m)) return "E-mail ou mot de passe incorrect.";
  if (/User already registered/i.test(m)) return "Un compte existe déjà avec cet e-mail.";
  if (/Password should be/i.test(m)) return "Mot de passe trop court (6 caractères minimum).";
  if (/Email not confirmed/i.test(m)) return "Confirme d'abord ton e-mail (lien reçu par e-mail).";
  return m.replace(/^.*?ERROR:\s*/, "");
};

const toProfile = (r: { id: string; pseudo: string; look: unknown; level: number }): Profile => ({
  id: r.id,
  pseudo: String(r.pseudo),
  look: validLook(r.look) ? r.look : { hair: 0, hairColor: 0, skin: 0, face: 0, top: 0, topColor: 1, pants: 0, acc: 0 },
  level: r.level,
});
const toMessage = (r: { id: number; author: string; pseudo: string; body: string; created_at: string }): ChatMessage => ({
  id: r.id,
  author: r.author,
  pseudo: String(r.pseudo),
  body: r.body,
  at: Date.parse(r.created_at),
});

// ════════════════════════════ Supabase ════════════════════════════

export class SupabaseNet implements OnlineNet {
  readonly kind = "supabase";
  private sb: SupabaseClient;
  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: "sp.online.auth" } });
  }
  async session() {
    const { data } = await this.sb.auth.getSession();
    const u = data.session?.user;
    return u ? { id: u.id, email: u.email ?? "" } : null;
  }
  async signUp(email: string, password: string) {
    // Le lien de confirmation (si activée) ramène directement au jeu en ligne
    const emailRedirectTo = typeof location !== "undefined" ? `${location.origin}/jeu/online` : undefined;
    const { data, error } = await this.sb.auth.signUp({ email, password, options: { emailRedirectTo } });
    if (error) throw error;
    return { confirm: !data.session };
  }
  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }
  async signOut() {
    await this.sb.auth.signOut();
  }
  async myProfile() {
    const s = await this.session();
    if (!s) return null;
    const { data, error } = await this.sb.from("profiles").select("id,pseudo,look,level").eq("id", s.id).maybeSingle();
    if (error) throw error;
    return data ? toProfile(data) : null;
  }
  async createHero(invite: string, pseudo: string, look: Look) {
    const { data, error } = await this.sb.rpc("create_hero", { p_invite: invite, p_pseudo: pseudo, p_look: look });
    if (error) throw error;
    return toProfile(data);
  }
  async updateLook(look: Look) {
    const { data, error } = await this.sb.rpc("update_look", { p_look: look });
    if (error) throw error;
    return toProfile(data);
  }
  readonly diag: Diag = newDiag();
  private log(e: string) {
    this.diag.log = [...this.diag.log.slice(-11), `${new Date().toISOString().slice(11, 19)} ${e}`];
  }
  /**
   * Ferme VRAIMENT les anciens salons. supabase-js réutilise un canal existant du même nom
   * (et ne le retire de sa liste que si la fermeture réussit) : sans ce nettoyage, une reconnexion
   * récupérait un canal mort ou en cours de fermeture → joueur invisible, compteur faux.
   */
  private async purge() {
    for (const c of this.sb.getChannels()) {
      if (!c.topic.startsWith(`realtime:online:${ROOM}:`)) continue;
      const st = await c.unsubscribe().catch(() => "error");
      c.teardown();
      (this.sb.realtime as unknown as { _remove(c: RealtimeChannel): void })._remove(c);
      this.log(`purge ${c.topic.slice(9)} (${st})`);
    }
  }
  async join(me: Profile, first: Move, h: RoomHandlers): Promise<Room> {
    await this.purge();
    // Salons privés : le jeton de session est transmis au serveur temps réel (règles RLS)
    await this.sb.realtime.setAuth();
    const d = this.diag;
    const profiles = new Map<string, Profile>();
    const profileOf = async (ids: string[]) => {
      const missing = ids.filter((i) => !profiles.has(i));
      if (missing.length) {
        const { data, error } = await this.sb.from("profiles").select("id,pseudo,look,level").in("id", missing);
        if (error) this.log(`profils : ${error.message}`);
        for (const r of data ?? []) profiles.set(r.id, toProfile(r));
      }
    };
    // Le serveur temps réel peut refuser la première connexion (réveil) : on réessaie un peu
    let retries = 0;
    for (let instance = 1; instance <= 20; instance++) {
      const topic = `online:${ROOM}:${instance}`;
      const ch: RealtimeChannel = this.sb.channel(topic, { config: { private: true, presence: { key: me.id }, broadcast: { self: false } } });
      d.channel = topic;
      // Dernière position connue de chacun (déplacements reçus, sinon présence)
      const last = new Map<string, Move>();
      let mine = first;
      let joined = false;
      let gen = 0;
      // La présence est LA source des joueurs affichés et du compteur
      const emit = async () => {
        const g = ++gen;
        const state = ch.presenceState<{ m: Move }>();
        const ids = Object.keys(state).filter((id) => id !== me.id);
        d.presence = Object.keys(state).length;
        d.lastSync = Date.now();
        // Le pseudo et l'apparence viennent de la base (jamais de ce que le client annonce)
        await profileOf(ids);
        if (g !== gen) return; // une synchro plus récente est arrivée entre-temps
        const peers = ids.flatMap((id) => {
          const p = profiles.get(id);
          const metas = state[id] ?? [];
          // Plusieurs connexions pour un même compte : on garde la plus récente
          const m = last.get(id) ?? metas.map((x) => x.m).filter(isMove).sort((x, y) => y.s - x.s)[0];
          return p && m ? [{ ...p, move: m }] : [];
        });
        d.peers = peers.length;
        h.onPeers(peers);
      };
      ch.on("presence", { event: "sync" }, () => void emit());
      ch.on("broadcast", { event: "mv" }, ({ payload }) => {
        const p = payload as { id?: string; m?: unknown };
        if (!p?.id || p.id === me.id || !isMove(p.m)) return;
        d.recv++;
        last.set(p.id, p.m);
        h.onMove(p.id, p.m);
      });
      const ok = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 12000);
        ch.subscribe((status, err) => {
          d.state = status;
          this.log(`${topic} ${status}${err ? ` ${err.message}` : ""}`);
          if (status === "SUBSCRIBED") {
            clearTimeout(timer);
            if (joined) {
              // Reconnexion automatique du canal : la présence est perdue côté serveur, on la renvoie
              void ch.track({ m: mine });
              h.onStatus?.("on");
            }
            resolve(true);
          } else {
            if (joined) h.onStatus?.("lost");
            clearTimeout(timer);
            resolve(false);
          }
        });
      });
      if (!ok) {
        await this.purge();
        if (retries < 3) {
          retries++;
          await new Promise((r) => setTimeout(r, 1500 * retries));
          await this.sb.realtime.setAuth();
          instance--;
          continue;
        }
        throw new Error("Connexion au quartier impossible. Réessaie dans un instant.");
      }
      // Laisser arriver la présence, puis vérifier qu'il reste de la place
      await new Promise((r) => setTimeout(r, 600));
      if (Object.keys(ch.presenceState()).filter((id) => id !== me.id).length >= 20) {
        await this.purge();
        continue;
      }
      const tr = await ch.track({ m: first });
      this.log(`track ${tr}`);
      joined = true;
      d.instance = instance;
      let lastTrack = Date.now();
      let pending: ReturnType<typeof setTimeout> | undefined;
      return {
        instance,
        move: (m) => {
          mine = m;
          d.sent++;
          void ch.send({ type: "broadcast", event: "mv", payload: { id: me.id, m } });
          // La présence garde la dernière position pour ceux qui arrivent : au plus toutes les 3 s,
          // et une fois à l'arrêt (sans saturer le quota temps réel)
          clearTimeout(pending);
          if (Date.now() - lastTrack > 3000) {
            lastTrack = Date.now();
            void ch.track({ m });
          } else
            pending = setTimeout(() => {
              lastTrack = Date.now();
              void ch.track({ m: mine });
            }, 1200);
        },
        leave: async () => {
          clearTimeout(pending);
          joined = false;
          d.state = "LEFT";
          await ch.untrack().catch(() => null);
          await this.purge();
        },
      };
    }
    throw new Error("Le quartier est complet. Réessaie plus tard.");
  }
  async chatHistory() {
    const { data, error } = await this.sb.from("chat_messages").select("id,author,pseudo,body,created_at").eq("room", ROOM).order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return (data ?? []).map(toMessage).reverse();
  }
  onChat(cb: (m: ChatMessage) => void) {
    const ch = this.sb
      .channel(`chat:${ROOM}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room=eq.${ROOM}` }, (p) => cb(toMessage(p.new as Parameters<typeof toMessage>[0])))
      .subscribe();
    return () => void this.sb.removeChannel(ch);
  }
  async sendChat(body: string) {
    const { error } = await this.sb.rpc("send_message", { p_room: ROOM, p_body: body });
    if (error) throw error;
  }
  async block(id: string) {
    const s = await this.session();
    const { error } = await this.sb.from("blocks").insert({ blocker: s?.id, blocked: id });
    if (error && !/duplicate/i.test(error.message)) throw error;
  }
  async unblock(id: string) {
    const s = await this.session();
    const { error } = await this.sb.from("blocks").delete().eq("blocker", s?.id).eq("blocked", id);
    if (error) throw error;
  }
  async blocked() {
    const { data } = await this.sb.from("blocks").select("blocked");
    return (data ?? []).map((r) => r.blocked as string);
  }
  async report(target: string, reason: string, messageId?: number) {
    const s = await this.session();
    const { error } = await this.sb.from("reports").insert({ reporter: s?.id, target, reason: reason.slice(0, 300), message_id: messageId ?? null });
    if (error) throw error;
  }
}

// ════════════════════════════ Relais de test ════════════════════════════

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

class RelayNet implements OnlineNet {
  readonly kind = "relay";
  private ws: WebSocket | null = null;
  private n = 0;
  private wait = new Map<number, Pending>();
  private listeners = new Set<(ev: { t: string; [k: string]: unknown }) => void>();
  private token: string | null = null;
  constructor(private url: string) {
    this.token = typeof localStorage !== "undefined" ? localStorage.getItem("sp.online.relay") : null;
  }
  private async socket(): Promise<WebSocket> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return this.ws;
    const ws = new WebSocket(this.url);
    await new Promise<void>((res, rej) => {
      ws.onopen = () => res();
      ws.onerror = () => rej(new Error("Relais injoignable"));
    });
    ws.onmessage = (e) => {
      const msg = JSON.parse(String(e.data));
      if (msg.re !== undefined) {
        const p = this.wait.get(msg.re);
        this.wait.delete(msg.re);
        if (msg.error) p?.reject(new Error(msg.error));
        else p?.resolve(msg.data);
      } else for (const l of this.listeners) l(msg);
    };
    this.ws = ws;
    if (this.token) await this.call("resume", { token: this.token }).catch(() => (this.token = null));
    return ws;
  }
  private async call<T>(op: string, args: Record<string, unknown> = {}): Promise<T> {
    const ws = await this.socket();
    const id = ++this.n;
    return new Promise<T>((resolve, reject) => {
      this.wait.set(id, { resolve: resolve as (v: unknown) => void, reject });
      ws.send(JSON.stringify({ id, op, ...args }));
    });
  }
  private keep(token: string | null) {
    this.token = token;
    if (token) localStorage.setItem("sp.online.relay", token);
    else localStorage.removeItem("sp.online.relay");
  }
  async session() {
    await this.socket().catch(() => null);
    return this.token ? this.call<{ id: string; email: string } | null>("session") : null;
  }
  async signUp(email: string, password: string) {
    const r = await this.call<{ token: string }>("signUp", { email, password });
    this.keep(r.token);
    return { confirm: false };
  }
  async signIn(email: string, password: string) {
    const r = await this.call<{ token: string }>("signIn", { email, password });
    this.keep(r.token);
  }
  async signOut() {
    await this.call("signOut").catch(() => null);
    this.keep(null);
  }
  myProfile = () => this.call<Profile | null>("myProfile");
  createHero = (invite: string, pseudo: string, look: Look) => this.call<Profile>("createHero", { invite, pseudo, look });
  updateLook = (look: Look) => this.call<Profile>("updateLook", { look });
  async join(_me: Profile, first: Move, h: RoomHandlers): Promise<Room> {
    const l = (ev: { t: string; [k: string]: unknown }) => {
      if (ev.t === "peers") h.onPeers(ev.peers as Peer[]);
      if (ev.t === "mv" && isMove(ev.m)) h.onMove(ev.id as string, ev.m);
      if (ev.t === "leave") h.onLeave(ev.id as string);
    };
    this.listeners.add(l);
    const r = await this.call<{ instance: number }>("join", { m: first });
    return {
      instance: r.instance,
      move: (m) => void this.call("move", { m }).catch(() => null),
      leave: async () => {
        this.listeners.delete(l);
        await this.call("leave").catch(() => null);
      },
    };
  }
  chatHistory = () => this.call<ChatMessage[]>("chatHistory");
  onChat(cb: (m: ChatMessage) => void) {
    const l = (ev: { t: string; [k: string]: unknown }) => ev.t === "chat" && cb(ev.m as ChatMessage);
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  }
  sendChat = async (body: string) => void (await this.call("sendChat", { body }));
  block = async (id: string) => void (await this.call("block", { target: id }));
  unblock = async (id: string) => void (await this.call("unblock", { target: id }));
  blocked = () => this.call<string[]>("blocked");
  report = async (target: string, reason: string) => void (await this.call("report", { target, reason }));
}

/**
 * Projet Supabase « sparrow-online ». L'URL et la clé publiable sont PUBLIQUES par conception :
 * elles ne donnent que les droits des règles RLS. (Aucune clé secrète ne doit figurer ici.)
 * Les variables d'environnement, si elles existent, ont la priorité.
 */
const PROJECT_URL = "https://mtbsuhllfsvhdafuaqtr.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_-z4SjSf40IKuMLliG44Osw_Y7UFaieI";

/** Le service en ligne configuré pour cette version de l'application (ou null). */
export function onlineNet(): OnlineNet | null {
  const relay = process.env.NEXT_PUBLIC_ONLINE_DEV_RELAY;
  if (relay) return new RelayNet(relay);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || PROJECT_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PUBLISHABLE_KEY;
  return url && key ? new SupabaseNet(url, key) : null;
}
