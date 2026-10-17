#!/usr/bin/env node
/**
 * Relais WebSocket LOCAL pour tester SPARROW ONLINE à plusieurs navigateurs, sans Supabase.
 * Il reproduit les règles du serveur (invitation, pseudo, apparence, anti-spam, blocage) en mémoire.
 * Outil de développement uniquement : rien n'est persistant, rien n'est déployé.
 *
 *   node scripts/online-dev-relay.mjs            (port 8787, code d'invitation BETA-404)
 *   NEXT_PUBLIC_ONLINE_DEV_RELAY=ws://localhost:8787 npx next build && npx next start
 */
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8787);
const MAX = 20;
const LOOK = { hair: 4, hairColor: 6, skin: 4, face: 3, top: 3, topColor: 8, pants: 4, acc: 4 };
const users = new Map(); // email → { id, password }
const tokens = new Map(); // token → userId
const profiles = new Map(); // id → { id, pseudo, look, level }
const invites = new Map([["BETA-404", { max: 50, uses: 0 }]]);
const chat = [];
const blocks = new Set(); // "a>b"
const rooms = new Map(); // instance → Map(userId → { ws, m })
let msgId = 0;

const validLook = (l) => l && typeof l === "object" && Object.keys(l).sort().join() === Object.keys(LOOK).sort().join() && Object.entries(LOOK).every(([k, n]) => Number.isInteger(l[k]) && l[k] >= 0 && l[k] < n);
const clean = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
const send = (ws, o) => ws.readyState === 1 && ws.send(JSON.stringify(o));

function peersFor(instance, me) {
  const room = rooms.get(instance);
  return [...room.entries()].filter(([id]) => id !== me).map(([id, v]) => ({ ...profiles.get(id), move: v.m }));
}
function broadcastPeers(instance) {
  for (const [id, v] of rooms.get(instance) ?? []) send(v.ws, { t: "peers", peers: peersFor(instance, id) });
}
function leave(ws) {
  if (!ws.room) return;
  const room = rooms.get(ws.room);
  room?.delete(ws.uid);
  for (const [, v] of room ?? []) send(v.ws, { t: "leave", id: ws.uid });
  ws.room = null;
}

const ops = {
  resume(ws, { token }) {
    if (!tokens.has(token)) throw new Error("session expirée");
    ws.uid = tokens.get(token);
  },
  session(ws) {
    if (!ws.uid) return null;
    const email = [...users.entries()].find(([, u]) => u.id === ws.uid)?.[0];
    return { id: ws.uid, email };
  },
  signUp(ws, { email, password }) {
    if (!/^\S+@\S+\.\S+$/.test(email ?? "")) throw new Error("E-mail invalide.");
    if (String(password ?? "").length < 6) throw new Error("Mot de passe trop court (6 caractères minimum).");
    if (users.has(email)) throw new Error("Un compte existe déjà avec cet e-mail.");
    const id = randomUUID();
    users.set(email, { id, password });
    const token = randomUUID();
    tokens.set(token, id);
    ws.uid = id;
    return { token };
  },
  signIn(ws, { email, password }) {
    const u = users.get(email);
    if (!u || u.password !== password) throw new Error("E-mail ou mot de passe incorrect.");
    const token = randomUUID();
    tokens.set(token, u.id);
    ws.uid = u.id;
    return { token };
  },
  signOut(ws) {
    leave(ws);
    ws.uid = null;
  },
  myProfile(ws) {
    if (!ws.uid) throw new Error("non connecté");
    return profiles.get(ws.uid) ?? null;
  },
  createHero(ws, { invite, pseudo, look }) {
    if (!ws.uid) throw new Error("non connecté");
    if (profiles.has(ws.uid)) throw new Error("ce compte a déjà un héros");
    const name = String(pseudo ?? "").trim();
    if (!/^[A-Za-z0-9_-]{3,16}$/.test(name)) throw new Error("pseudo invalide : 3 à 16 caractères, lettres, chiffres, - ou _");
    if (!validLook(look)) throw new Error("apparence invalide");
    const inv = invites.get(String(invite ?? "").trim().toUpperCase());
    if (!inv || inv.uses >= inv.max) throw new Error("code d'invitation invalide ou épuisé");
    if ([...profiles.values()].some((p) => p.pseudo.toLowerCase() === name.toLowerCase())) throw new Error("pseudo déjà pris");
    inv.uses++;
    const p = { id: ws.uid, pseudo: name, look, level: 1 };
    profiles.set(ws.uid, p);
    return p;
  },
  updateLook(ws, { look }) {
    const p = profiles.get(ws.uid);
    if (!p) throw new Error("aucun héros");
    if (!validLook(look)) throw new Error("apparence invalide");
    p.look = look;
    return p;
  },
  join(ws, { m }) {
    if (!profiles.has(ws.uid)) throw new Error("crée d'abord ton héros");
    leave(ws);
    // Une seule connexion par compte : l'ancienne est remplacée
    for (const [, room] of rooms) {
      const old = room.get(ws.uid);
      if (old) leave(old.ws);
    }
    let instance = 1;
    while ((rooms.get(instance)?.size ?? 0) >= MAX) instance++;
    if (!rooms.has(instance)) rooms.set(instance, new Map());
    rooms.get(instance).set(ws.uid, { ws, m });
    ws.room = instance;
    broadcastPeers(instance);
    return { instance };
  },
  move(ws, { m }) {
    const room = rooms.get(ws.room);
    if (!room?.has(ws.uid)) return;
    room.get(ws.uid).m = m;
    for (const [id, v] of room) if (id !== ws.uid) send(v.ws, { t: "mv", id: ws.uid, m });
  },
  leave(ws) {
    leave(ws);
  },
  chatHistory(ws) {
    if (!profiles.has(ws.uid)) throw new Error("crée d'abord ton héros");
    return chat.filter((c) => !blocks.has(`${ws.uid}>${c.author}`)).slice(-50);
  },
  sendChat(ws, { body }) {
    const p = profiles.get(ws.uid);
    if (!p) throw new Error("crée d'abord ton héros");
    const b = clean(body);
    if (b.length < 1 || b.length > 200) throw new Error("message vide ou trop long (200 caractères max)");
    const now = Date.now();
    const mine = chat.filter((c) => c.author === ws.uid && now - c.at < 30000);
    if (mine.length && now - mine[mine.length - 1].at < 1500) throw new Error("doucement : un message toutes les 1,5 s");
    if (mine.length >= 8) throw new Error("trop de messages : attends quelques secondes");
    if (mine.some((c) => c.body === b && now - c.at < 15000)) throw new Error("message déjà envoyé");
    const m = { id: ++msgId, author: ws.uid, pseudo: p.pseudo, body: b, at: now };
    chat.push(m);
    for (const client of wss.clients) if (client.uid && profiles.has(client.uid) && !blocks.has(`${client.uid}>${ws.uid}`)) send(client, { t: "chat", m });
  },
  block(ws, { target }) {
    if (target !== ws.uid) blocks.add(`${ws.uid}>${target}`);
  },
  unblock(ws, { target }) {
    blocks.delete(`${ws.uid}>${target}`);
  },
  blocked(ws) {
    return [...blocks].filter((b) => b.startsWith(`${ws.uid}>`)).map((b) => b.split(">")[1]);
  },
  report() {},
};

const wss = new WebSocketServer({ port: PORT });
wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    try {
      const data = ops[msg.op]?.(ws, msg);
      send(ws, { re: msg.id, data: data ?? null });
    } catch (e) {
      send(ws, { re: msg.id, error: e.message });
    }
  });
  // Déconnexion (fermeture, réseau coupé) : le joueur disparaît chez les autres
  ws.on("close", () => leave(ws));
});
console.log(`Relais SPARROW ONLINE prêt sur ws://localhost:${PORT} (invitation : BETA-404)`);
