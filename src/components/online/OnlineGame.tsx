"use client";

/**
 * SPARROW ONLINE — mode multijoueur (bêta privée).
 * Compte → création du héros → Quartier 404 partagé (déplacements en temps réel, chat, Sparrow).
 * Réutilise le moteur de carte du jeu solo (`Overworld`) et la console (croix, A, B).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { DPad } from "@/components/gotchi/DPad";
import { charSprite, registerChar } from "@/components/rpg/actors";
import { OW_W, Overworld, type OtherActor } from "@/components/rpg/overworld";
import { DEFAULT_LOOK, LOOK_KEYS, OPTIONS, PSEUDO_RE, heroDef, lookId, randomLook, type Look } from "@/lib/online/hero";
import { errText, onlineNet, type ChatMessage, type OnlineNet, type Peer, type Profile, type Room } from "@/lib/online/net";
import { ChatLimiter, MAX_MESSAGE, SendPolicy, STALE_MS, Track, cleanMessage, dirOf } from "@/lib/online/sync";
import { ONLINE_MAP, ONLINE_RPG, SPARROW_LINES, spawnTile } from "@/lib/online/world";
import { solidAt } from "@/lib/rpg/mapdef";

type Screen = "boot" | "config" | "auth" | "hero" | "world";

const heroChar = (l: Look) => {
  const id = lookId(l);
  registerChar(id, heroDef(l));
  return id;
};

const time = (t: number) => new Date(t).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/** Aperçu du héros en grand, qui tourne sur lui-même. */
function HeroPreview({ look }: { look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const id = heroChar(look);
    let k = 0;
    const draw = () => {
      const ctx = ref.current?.getContext("2d");
      if (!ctx) return;
      const views = [
        ["down", false],
        ["side", false],
        ["up", false],
        ["side", true],
      ] as const;
      const [d, flip] = views[k % 4];
      ctx.clearRect(0, 0, 16, 21);
      ctx.drawImage(charSprite(id, d, (Math.floor(k / 4) % 2) as 0 | 1, flip), 0, 0);
    };
    draw();
    const t = setInterval(() => {
      k++;
      draw();
    }, 700);
    return () => clearInterval(t);
  }, [look]);
  return <canvas ref={ref} width={16} height={21} className="ol-preview" aria-label="Aperçu du héros" />;
}

/** Éditeur de héros (création ou changement d'apparence). */
function HeroEditor({ initial, create, onDone, onCancel }: { initial: Look; create: boolean; onDone: (pseudo: string, invite: string, look: Look) => Promise<void>; onCancel?: () => void }) {
  const [look, setLook] = useState<Look>(initial);
  const [pseudo, setPseudo] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const LABEL: Record<keyof Look, string> = { hair: "Coiffure", hairColor: "Cheveux", skin: "Peau", face: "Visage", top: "Haut", topColor: "Couleur du haut", pants: "Pantalon", acc: "Accessoire" };
  const turn = (k: keyof Look, n: number) => setLook((l) => ({ ...l, [k]: (l[k] + n + OPTIONS[k].length) % OPTIONS[k].length }));
  const submit = async () => {
    setErr("");
    if (create && !PSEUDO_RE.test(pseudo.trim())) return setErr("Pseudo : 3 à 16 caractères (lettres, chiffres, - ou _).");
    if (create && !invite.trim()) return setErr("Il faut un code d'invitation (bêta privée).");
    setBusy(true);
    try {
      await onDone(pseudo.trim(), invite.trim(), look);
    } catch (e) {
      setErr(errText(e));
    }
    setBusy(false);
  };
  return (
    <form className="ol-panel mono" onSubmit={(e) => (e.preventDefault(), void submit())}>
      <p className="ol-title">{create ? "CRÉE TON HÉROS" : "APPARENCE"}</p>
      <div className="ol-hero">
        <HeroPreview look={look} />
        <div className="ol-opts">
          {LOOK_KEYS.map((k) => (
            <div key={k} className="ol-opt">
              <span>{LABEL[k]}</span>
              <button type="button" onClick={() => turn(k, -1)} aria-label={`${LABEL[k]} : précédent`}>
                ◀
              </button>
              <b>{OPTIONS[k][look[k]]}</b>
              <button type="button" onClick={() => turn(k, 1)} aria-label={`${LABEL[k]} : suivant`}>
                ▶
              </button>
            </div>
          ))}
        </div>
      </div>
      <button type="button" className="ol-link" onClick={() => setLook(randomLook())}>
        ⚄ Au hasard
      </button>
      {create && (
        <>
          <label className="ol-field">
            Pseudo
            <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={16} autoCapitalize="off" autoComplete="nickname" placeholder="3 à 16 caractères" />
          </label>
          <label className="ol-field">
            Code d&apos;invitation
            <input value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} maxLength={24} autoCapitalize="characters" placeholder="Bêta privée" />
          </label>
        </>
      )}
      {err && <p className="ol-err">{err}</p>}
      <div className="ol-row">
        {onCancel && (
          <button type="button" className="gb-btn" onClick={onCancel}>
            Annuler
          </button>
        )}
        <button type="submit" className="gb-btn ol-main" disabled={busy}>
          {busy ? "…" : create ? "Entrer dans le Quartier 404" : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}

function AuthPanel({ net, onIn }: { net: OnlineNet; onIn: () => void }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setMsg("");
    setBusy(true);
    try {
      if (mode === "up") {
        const r = await net.signUp(email.trim(), pw);
        if (r.confirm) setMsg("Compte créé : confirme ton e-mail (lien reçu), puis connecte-toi.");
        else onIn();
      } else {
        await net.signIn(email.trim(), pw);
        onIn();
      }
    } catch (e) {
      setMsg(errText(e));
    }
    setBusy(false);
  };
  return (
    <form className="ol-panel mono" onSubmit={(e) => (e.preventDefault(), void go())}>
      <p className="ol-title">SPARROW ONLINE</p>
      <p className="ol-note">Bêta privée. Ton héros et ta progression sont liés à ton compte.</p>
      <div className="ol-tabs">
        <button type="button" className={mode === "in" ? "is-on" : ""} onClick={() => setMode("in")}>
          Connexion
        </button>
        <button type="button" className={mode === "up" ? "is-on" : ""} onClick={() => setMode("up")}>
          Créer un compte
        </button>
      </div>
      <label className="ol-field">
        E-mail
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="off" required />
      </label>
      <label className="ol-field">
        Mot de passe
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "up" ? "new-password" : "current-password"} minLength={6} required />
      </label>
      {msg && <p className="ol-err">{msg}</p>}
      <button type="submit" className="gb-btn ol-main" disabled={busy}>
        {busy ? "…" : mode === "up" ? "Créer mon compte" : "Se connecter"}
      </button>
    </form>
  );
}

export function OnlineGame() {
  const netRef = useRef<OnlineNet | null>(null);
  const [screen, setScreen] = useState<Screen>("boot");
  const [me, setMe] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<"off" | "joining" | "on" | "error">("off");
  const [statusMsg, setStatusMsg] = useState("");
  const [count, setCount] = useState(0);
  const [instance, setInstance] = useState(1);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState("");
  const [chatErr, setChatErr] = useState("");
  const [blocked, setBlocked] = useState<string[]>([]);
  const [card, setCard] = useState<{ id: string; pseudo: string; level: number; msg?: number } | null>(null);
  const [talk, setTalk] = useState<string[] | null>(null);
  const [toast, setToast] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const ow = useRef<Overworld | null>(null);
  const room = useRef<Room | null>(null);
  const tracks = useRef(new Map<string, { t: Track; peer: Peer; char: string }>());
  const policy = useRef(new SendPolicy());
  const limiter = useRef(new ChatLimiter());
  const talkN = useRef(0);
  const ui = useRef({ chatOpen, card, talk, editing });
  ui.current = { chatOpen, card, talk, editing };
  const chatOpenRef = useRef(chatOpen);
  chatOpenRef.current = chatOpen;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast((t) => (t === m ? "" : t)), 2500);
  };

  // ─── Démarrage : configuration, session restaurée, héros ───
  const boot = useCallback(async () => {
    const net = onlineNet();
    netRef.current = net;
    if (!net) return setScreen("config");
    try {
      const s = await net.session();
      if (!s) return setScreen("auth");
      const p = await net.myProfile();
      if (!p) return setScreen("hero");
      setMe(p);
      setScreen("world");
    } catch (e) {
      setStatusMsg(errText(e));
      setScreen("auth");
    }
  }, []);
  useEffect(() => {
    void boot();
  }, [boot]);

  // ─── Monde : carte, salon temps réel, chat ───
  const join = useCallback(async () => {
    const net = netRef.current;
    const o = ow.current;
    if (!net || !o || !me || room.current) return;
    setStatus("joining");
    try {
      policy.current.reset();
      const first = policy.current.next({ x: o.x, y: o.y, dir: o.dir }, performance.now())!;
      const r = await net.join(me, first, {
        onPeers: (peers) => {
          const now = performance.now();
          const seen = new Set<string>();
          for (const p of peers) {
            seen.add(p.id);
            const cur = tracks.current.get(p.id);
            if (cur) {
              cur.peer = p;
              cur.char = heroChar(p.look);
            } else tracks.current.set(p.id, { t: new Track({ x: p.move.x, y: p.move.y, dir: dirOf(p.move.d) }, now), peer: p, char: heroChar(p.look) });
          }
          for (const id of [...tracks.current.keys()]) if (!seen.has(id)) tracks.current.delete(id);
          setCount(tracks.current.size + 1);
        },
        onMove: (id, m) => tracks.current.get(id)?.t.push(m, performance.now()),
        onLeave: (id) => {
          tracks.current.delete(id);
          setCount(tracks.current.size + 1);
        },
      });
      room.current = r;
      setInstance(r.instance);
      setStatus("on");
      setStatusMsg("");
    } catch (e) {
      setStatus("error");
      setStatusMsg(errText(e));
    }
  }, [me]);

  const leave = useCallback(async () => {
    const r = room.current;
    room.current = null;
    tracks.current.clear();
    setStatus("off");
    await r?.leave().catch(() => null);
  }, []);

  useEffect(() => {
    if (screen !== "world" || !me) return;
    const net = netRef.current!;
    const taken = [...tracks.current.values()].map((x) => x.t.tile);
    const o = new Overworld(ONLINE_MAP, spawnTile(taken), ONLINE_RPG);
    o.playerChar = heroChar(me.look);
    o.playerName = me.pseudo;
    ow.current = o;
    void join();
    // Chat : historique récent puis temps réel
    void net
      .chatHistory()
      .then(setMessages)
      .catch(() => null);
    void net
      .blocked()
      .then(setBlocked)
      .catch(() => null);
    const off = net.onChat((m) => {
      if (blockedRef.current.includes(m.author)) return;
      setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list.slice(-99), m]));
      if (!chatOpenRef.current && m.author !== me.id) setUnread((n) => n + 1);
    });
    // iPhone : appli en arrière-plan → on quitte le salon ; retour → on revient
    const vis = () => {
      if (document.visibilityState === "hidden") void leave();
      else void join();
    };
    document.addEventListener("visibilitychange", vis);
    const online = () => void join();
    window.addEventListener("online", online);
    const hide = () => void leave();
    window.addEventListener("pagehide", hide);
    // Boucle d'affichage
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const ctx = canvas.current?.getContext("2d");
      const others: OtherActor[] = [];
      for (const [id, x] of tracks.current) {
        if (now - x.t.seen > STALE_MS) {
          tracks.current.delete(id);
          continue;
        }
        x.t.step(dt);
        others.push({ id, char: x.char, name: x.peer.pseudo, px: x.t.px, py: x.t.py, tile: x.t.tile, dir: x.t.dir, walking: x.t.walking });
      }
      o.others = others;
      o.frozen = !!(ui.current.chatOpen || ui.current.card || ui.current.talk || ui.current.editing);
      if (ctx) o.draw(ctx, { rpg: ONLINE_RPG, reduced: false }, dt);
      // Position envoyée seulement au changement de case (la case d'arrivée, dès le début du pas) ou en battement
      const r = room.current;
      const m = r ? policy.current.next({ x: o.x, y: o.y, dir: o.dir }, now) : null;
      if (r && m) r.move(m);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    // Accès de test (?debug), en lecture seule
    if (new URLSearchParams(location.search).has("debug"))
      Object.assign(window, {
        __online: {
          me: () => ({ x: o.x, y: o.y, dir: o.dir, moving: o.moving, pseudo: me.pseudo, char: o.playerChar }),
          others: () => o.others.map((x) => ({ id: x.id, name: x.name, tile: x.tile, px: x.px, py: x.py, walking: x.walking })),
          status: () => (room.current ? "on" : "off"),
          solid: (x: number, y: number) => solidAt(ONLINE_MAP, { x, y }, ONLINE_RPG),
        },
      });
    const fit = () => {
      const box = canvas.current?.parentElement?.getBoundingClientRect();
      if (box && box.width > 10) {
        const h = Math.max(150, Math.min(420, Math.floor((OW_W * box.height) / box.width)));
        if (canvas.current) canvas.current.height = h;
        o.setView(OW_W, h);
      }
    };
    fit();
    window.addEventListener("resize", fit);
    return () => {
      cancelAnimationFrame(raf);
      off();
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("online", online);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("resize", fit);
      void leave();
    };
  }, [screen, me, join, leave]);

  // ─── Commandes (A, B, clavier) ───
  const pressA = useCallback(() => {
    const o = ow.current;
    if (ui.current.talk) {
      const next = ui.current.talk.slice(1);
      return setTalk(next.length ? next : null);
    }
    if (ui.current.card || ui.current.chatOpen || !o) return;
    const f = o.facing({ rpg: ONLINE_RPG, reduced: false });
    if (f?.kind === "player") {
      const x = tracks.current.get(f.id);
      if (x) setCard({ id: f.id, pseudo: x.peer.pseudo, level: x.peer.level });
    } else if (f?.kind === "npc" && f.id === "sparrow") {
      setTalk(SPARROW_LINES[talkN.current++ % SPARROW_LINES.length].map((l) => l));
    } else if (f?.kind === "door") flash(f.door.text ?? "");
  }, []);
  const pressB = useCallback(() => {
    if (ui.current.talk) return setTalk(null);
    if (ui.current.card) return setCard(null);
    if (ui.current.chatOpen) return setChatOpen(false);
  }, []);
  const keys = useRef({ pressA, pressB });
  keys.current = { pressA, pressB };
  useEffect(() => {
    if (screen !== "world") return;
    const held = new Set<string>();
    const sync = () => {
      const o = ow.current;
      if (!o) return;
      const x = (held.has("arrowright") ? 1 : 0) - (held.has("arrowleft") ? 1 : 0);
      const y = (held.has("arrowdown") ? 1 : 0) - (held.has("arrowup") ? 1 : 0);
      o.input = { x, y };
    };
    const typing = (e: KeyboardEvent) => e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const down = (e: KeyboardEvent) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      if (k.startsWith("arrow")) {
        held.add(k);
        sync();
        e.preventDefault();
      } else if (k === "enter" || k === " ") {
        if (!e.repeat) keys.current.pressA();
        e.preventDefault();
      } else if (k === "escape") keys.current.pressB();
    };
    const up = (e: KeyboardEvent) => {
      held.delete(e.key.toLowerCase());
      sync();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [screen]);

  // ─── Chat ───
  const send = async () => {
    const net = netRef.current;
    if (!net) return;
    const body = cleanMessage(draft);
    const why = limiter.current.check(body, Date.now());
    if (why) return setChatErr(why);
    setChatErr("");
    try {
      await net.sendChat(body);
      limiter.current.record(body, Date.now());
      setDraft("");
    } catch (e) {
      setChatErr(errText(e));
    }
  };
  const doBlock = async (id: string) => {
    const net = netRef.current!;
    try {
      if (blocked.includes(id)) {
        await net.unblock(id);
        setBlocked((b) => b.filter((x) => x !== id));
        setMessages(await net.chatHistory());
        flash("Joueur débloqué.");
      } else {
        await net.block(id);
        setBlocked((b) => [...b, id]);
        setMessages((list) => list.filter((m) => m.author !== id));
        flash("Joueur bloqué : tu ne verras plus ses messages.");
      }
    } catch (e) {
      flash(errText(e));
    }
    setCard(null);
  };
  const doReport = async (id: string, msg?: number) => {
    try {
      await netRef.current!.report(id, "Signalé depuis le jeu", msg);
      flash("Merci, le signalement est enregistré.");
    } catch (e) {
      flash(errText(e));
    }
    setCard(null);
  };

  const net = netRef.current;
  return (
    <div className="gb-wrap">
      <main className="gb">
        <header className="gb-top mono">
          <a href="/jeu" className="gb-top__back" aria-label="Retour aux jeux">
            ‹
          </a>
          <span className="gb-top__lvl">ONLINE</span>
          <span className="gb-top__place">{screen === "world" ? `Quartier 404 · ${count || 1} en ligne${instance > 1 ? ` · salle ${instance}` : ""}` : "Bêta privée"}</span>
          {screen === "world" && <span className={`ol-dot is-${status}`} aria-label={status === "on" ? "Connecté" : "Hors ligne"} />}
        </header>

        <div className="gb-screen gb-screen--rue">
          {screen === "world" && <canvas ref={canvas} width={OW_W} height={200} className="gb-screen__canvas" role="img" aria-label="Quartier 404 en ligne. Croix pour marcher, A pour parler." />}
          {screen === "boot" && <p className="ol-panel mono">Connexion…</p>}
          {screen === "config" && (
            <div className="ol-panel mono">
              <p className="ol-title">SPARROW ONLINE</p>
              <p className="ol-note">Le mode en ligne n&apos;est pas encore branché sur cette version : il manque la configuration du serveur (Supabase). Le jeu solo, lui, fonctionne normalement.</p>
              <a className="gb-btn" href="/jeu/sparrowgotchi">
                Jouer en solo
              </a>
            </div>
          )}
          {screen === "auth" && net && <AuthPanel net={net} onIn={() => void boot()} />}
          {screen === "hero" && net && (
            <HeroEditor
              initial={DEFAULT_LOOK}
              create
              onDone={async (pseudo, invite, look) => {
                const p = await net.createHero(invite, pseudo, look);
                setMe(p);
                setScreen("world");
              }}
            />
          )}
          {screen === "world" && editing && me && net && (
            <HeroEditor
              initial={me.look}
              create={false}
              onCancel={() => setEditing(false)}
              onDone={async (_p, _i, look) => {
                const p = await net.updateLook(look);
                setMe(p);
                if (ow.current) ow.current.playerChar = heroChar(p.look);
                setEditing(false);
                // Les autres le verront à la prochaine connexion au salon
                await leave();
                await join();
              }}
            />
          )}
          {screen === "world" && status === "error" && (
            <button type="button" className="ol-banner mono" onClick={() => void join()}>
              {statusMsg || "Connexion perdue."} Toucher pour réessayer.
            </button>
          )}
          {toast && <span className="gb-banner mono">{toast}</span>}
          {talk && (
            <button type="button" className="gb-dialog gb-dialog--rpg mono" onClick={pressA} aria-live="polite">
              <span className="gb-dialog__name">Sparrow</span>
              <span>{talk[0]}</span>
              <i className="gb-dialog__next" aria-hidden="true">
                ▼
              </i>
            </button>
          )}
          {card && (
            <div className="ol-panel ol-card mono" role="dialog" aria-label={`Joueur ${card.pseudo}`}>
              <p className="ol-title">{card.pseudo}</p>
              <p className="ol-note">Niveau {card.level} · Héros du Quartier 404</p>
              <div className="ol-row">
                <button type="button" className="gb-btn" onClick={() => void doBlock(card.id)}>
                  {blocked.includes(card.id) ? "Débloquer" : "Bloquer"}
                </button>
                <button type="button" className="gb-btn" onClick={() => void doReport(card.id, card.msg)}>
                  Signaler
                </button>
                <button type="button" className="gb-btn" onClick={() => setCard(null)}>
                  Fermer
                </button>
              </div>
            </div>
          )}
          {chatOpen && me && (
            <div className="ol-chat mono" role="dialog" aria-label="Chat du Quartier 404">
              <div className="ol-chat__list" ref={(el) => el?.scrollTo({ top: el.scrollHeight })}>
                {!messages.length && <p className="ol-note">Personne n&apos;a encore parlé. Lance la conversation !</p>}
                {messages
                  .filter((m) => !blocked.includes(m.author))
                  .map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className={`ol-msg${m.author === me.id ? " is-me" : ""}`}
                      onClick={() => m.author !== me.id && setCard({ id: m.author, pseudo: m.pseudo, level: tracks.current.get(m.author)?.peer.level ?? 1, msg: m.id })}
                    >
                      <b>{m.pseudo}</b> <small>{time(m.at)}</small> {m.body}
                    </button>
                  ))}
              </div>
              <form className="ol-chat__send" onSubmit={(e) => (e.preventDefault(), void send())}>
                <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={MAX_MESSAGE} placeholder="Écrire au quartier…" enterKeyHint="send" aria-label="Message" />
                <button type="submit" className="gb-btn">
                  Envoyer
                </button>
              </form>
              {chatErr && <p className="ol-err">{chatErr}</p>}
            </div>
          )}
        </div>

        <div className="gb-controls">
          <DPad onMove={(x, y) => ow.current && (ow.current.input = { x, y })} />
          <div className="gb-ab">
            <button type="button" className="gb-key gb-key--b" onClick={pressB} aria-label="B : fermer">
              B
            </button>
            <button type="button" className="gb-key gb-key--a" onClick={pressA} aria-label="A : parler">
              A
            </button>
          </div>
          <div className="gb-startsel mono">
            <button type="button" onClick={() => screen === "world" && setEditing((v) => !v)} aria-label="SELECT : apparence">
              SELECT
            </button>
            <button
              type="button"
              onClick={() => {
                if (screen !== "world") return;
                setChatOpen((v) => !v);
                setUnread(0);
              }}
              aria-label="START : chat"
            >
              CHAT
              {unread > 0 && <b className="gb-badge">{unread}</b>}
            </button>
          </div>
        </div>
        {screen === "world" && net && (
          <button
            type="button"
            className="ol-logout mono"
            onClick={async () => {
              await leave();
              await net.signOut();
              setMe(null);
              setScreen("auth");
            }}
          >
            Se déconnecter
          </button>
        )}
      </main>
    </div>
  );
}
