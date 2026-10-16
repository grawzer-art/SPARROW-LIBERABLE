"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CASE_NUMBER } from "@/config";
import {
  ARCHIVE_YEARS,
  MAX_AUTHOR,
  MAX_BODY,
  MAX_LETTERS,
  TONES,
  archiveOpensAt,
  capsuleYearOf,
  emptyCapsule,
  emptyDraft,
  isOpen,
  makeBackup,
  mergeLetters,
  needsBackup,
  parseBackup,
  sealLetter,
  type CapsuleData,
  type Letter,
  type Tone,
} from "@/lib/capsule/model";
import { LocalCapsuleStore, requestPersistence, type CapsuleStore } from "@/lib/capsule/store";
import { load, save, sessionFlag } from "@/lib/storage";
import { formatDot, initClock, now, pad } from "@/lib/time";
import { useNow } from "@/lib/useNow";
import { Toast } from "../Overlays";
import { Scanner } from "./Scanner";
import { CapsuleSfx } from "./sfx";
import { Vault, type VaultState } from "./Vault";

const INTRO = [
  `DOSSIER ${CASE_NUMBER} · ANNEXE C`,
  "OBJET : CAPSULE TEMPORELLE SCELLÉE",
  "CONTENU : MESSAGES POUR LE SPARROW DE 2031",
  "OUVERTURE AUTORISÉE : 12.10.2031 · 00:00",
  "TOUTE TENTATIVE ANTICIPÉE SERA CONSIGNÉE.",
];

const DENIALS = [
  "ACCÈS REFUSÉ. REVENEZ LE 12.10.2031.",
  "LE COFFRE NE RÉPOND PAS AUX SUPPLICATIONS.",
  "COMBINAISON CORRECTE. ANNÉE INCORRECTE.",
  "LE VOLANT A TOURNÉ. LE CALENDRIER, LUI, N'A PAS BOUGÉ.",
  "SERRURE TEMPORELLE ACTIVE. ELLE NE CONNAÎT QU'UNE DATE.",
  "TENTATIVE REJETÉE. MÊME LE CHEVALIER NOIR N'Y ARRIVE PAS.",
  "LE COFFRE A RI. DISCRÈTEMENT, MAIS IL A RI.",
];

function escalation(n: number): string | null {
  if (n === 5) return "CINQ TENTATIVES. LE COFFRE A DÉPOSÉ UNE MAIN COURANTE.";
  if (n === 10) return "DIX TENTATIVES. VOUS ÊTES PLACÉ SOUS SURVEILLANCE RENFORCÉE.";
  if (n === 25) return "VINGT-CINQ TENTATIVES. LE MINISTÈRE ENVISAGE DE VOUS ENFERMER DEDANS.";
  if (n === 50) return "CINQUANTE. LE COFFRE DEMANDE UN ARRÊT MALADIE.";
  return null;
}

const ANNUAL: Record<number, { title: string; text: string }> = {
  2027: { title: "ANNÉE I", text: "Le sujet a découvert que 365 jours, c'est long. Le Ministère confirme, chiffres à l'appui." },
  2028: { title: "ANNÉE II", text: "Année bissextile : un jour offert par le calendrier. Le sujet n'a pas dit merci." },
  2029: { title: "ANNÉE III", text: "Mi-parcours franchi. Le moral remonte, la consommation de frites aussi." },
  2030: { title: "ANNÉE IV", text: "Dernière ligne droite. Le coffre commence à transpirer, le sujet aussi." },
  2031: { title: "ANNÉE V", text: "Ouverture officielle de la capsule. Toutes les lettres sont déverrouillées." },
};

const PROMPTS = [
  "Cher Sparrow de 2031, si tu lis ceci, c'est que…",
  "Je parie qu'en 2031 tu…",
  "Le jour où tu as été libérable, moi j'étais…",
  "Petit rappel de 2026 : tu nous avais promis que…",
];

const fr = (n: number) => n.toLocaleString("fr-FR");

const simulated = typeof window !== "undefined" && initClock(window.location.search);

function daysUntil(ms: number, t: number) {
  return Math.max(0, Math.ceil((ms - t) / 86_400_000));
}

export function CapsulePage() {
  const store = useRef<CapsuleStore>(new LocalCapsuleStore());
  const sfx = useRef(new CapsuleSfx());
  const fileInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const t = useNow();

  const [data, setData] = useState<CapsuleData>(emptyCapsule());
  const [loaded, setLoaded] = useState(false);
  const [intro, setIntro] = useState(true);
  const [introN, setIntroN] = useState(0);
  const [vault, setVault] = useState<VaultState>("idle");
  const [denial, setDenial] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [sealing, setSealing] = useState(false);
  const [sound, setSound] = useState(true);
  const [toastText, setToastText] = useState<string | null>(null);
  const [sim, setSim] = useState(false);
  const [prompt, setPrompt] = useState(PROMPTS[0]);

  const opened = t != null && isOpen(t);

  const toast = useCallback((m: string) => {
    setToastText(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 3600);
  }, []);

  // Chargement local + préférences
  useEffect(() => {
    setSim(simulated);
    const snd = load<boolean>("sp.capsule.sound", true);
    setSound(snd);
    sfx.current.enabled = snd;
    setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || sessionFlag("sp.capsule.intro")) setIntro(false);
    void store.current.load().then((d) => {
      setData(d);
      setLoaded(true);
    });
  }, []);

  // Séquence d'introduction
  useEffect(() => {
    if (!intro) return;
    if (introN < INTRO.length) {
      const id = setTimeout(() => setIntroN((n) => n + 1), introN === 0 ? 300 : 420);
      return () => clearTimeout(id);
    }
  }, [intro, introN]);

  // À l'heure dite, le coffre s'ouvre tout seul.
  useEffect(() => {
    if (opened && vault !== "open") {
      setVault("open");
      sfx.current.clunk();
    }
  }, [opened, vault]);

  const persist = useCallback(
    async (next: CapsuleData) => {
      setData(next);
      try {
        await store.current.save(next);
      } catch (e) {
        toast((e as Error).message);
      }
    },
    [toast],
  );

  // Brouillon enregistré automatiquement (léger délai).
  const draftTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const editDraft = (patch: Partial<CapsuleData["draft"]>) => {
    const next = { ...data, draft: { ...data.draft, ...patch } };
    setData(next);
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => void store.current.save(next).catch(() => undefined), 400);
  };

  const tryOpen = () => {
    if (vault === "trying") return;
    if (opened) {
      setVault("open");
      sfx.current.clunk();
      return;
    }
    setDenial(null);
    setVault("trying");
    sfx.current.dial(14, 0.08);
    const attempts = data.attempts + 1;
    void persist({ ...data, attempts });
    setTimeout(() => {
      setVault("denied");
      sfx.current.deny();
      navigator.vibrate?.([90, 60, 90]);
      const special = escalation(attempts);
      const base = DENIALS[Math.floor(Math.random() * DENIALS.length)];
      setDenial(special ?? (scanned ? `EMPREINTE VALIDE. DATE INVALIDE. ${base}` : base));
      setTimeout(() => setVault((v) => (v === "denied" ? "idle" : v)), 900);
    }, 1500);
  };

  const sealDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = data.draft.body.trim();
    if (body.length < 3) {
      toast("Lettre trop courte. Le Sparrow de 2031 mérite mieux.");
      return;
    }
    if (data.letters.length >= MAX_LETTERS) {
      toast(`La capsule est pleine (${MAX_LETTERS} lettres).`);
      return;
    }
    const letter = sealLetter(data.draft, now());
    setSealing(true);
    sfx.current.seal();
    navigator.vibrate?.(40);
    await persist({
      ...data,
      letters: [...data.letters, letter],
      draft: { ...emptyDraft(), author: data.draft.author, tone: data.draft.tone },
      updatedAt: new Date().toISOString(),
    });
    void requestPersistence();
    setTimeout(() => setSealing(false), 1400);
    setPrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
    toast("Lettre scellée. Rendez-vous le 12.10.2031. Pensez à exporter une sauvegarde.");
  };

  const removeLetter = async (l: Letter) => {
    if (!window.confirm(`Détruire définitivement la lettre de ${l.author} ? Elle ne pourra pas être récupérée sans sauvegarde.`))
      return;
    await persist({ ...data, letters: data.letters.filter((x) => x.id !== l.id), updatedAt: new Date().toISOString() });
    toast("Lettre détruite. Le Ministère n'a rien vu.");
  };

  const exportBackup = async () => {
    if (data.letters.length === 0) {
      toast("Aucune lettre à sauvegarder pour l'instant.");
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `capsule-sparrow-2031-${stamp}.json`;
    const blob = new Blob([JSON.stringify(makeBackup(data.letters, now()), null, 2)], { type: "application/json" });
    const file = new File([blob], name, { type: "application/json" });
    let done = false;
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Sauvegarde capsule 2031" });
        done = true;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
      }
    }
    if (!done) {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }
    await persist({ ...data, lastExportAt: new Date().toISOString() });
    toast("Sauvegarde exportée. Rangez-la dans Fichiers → iCloud Drive.");
  };

  const importBackup = async (files: FileList | null) => {
    const f = files?.[0];
    if (fileInput.current) fileInput.current.value = "";
    if (!f) return;
    if (f.size > 5_000_000) {
      toast("Fichier trop lourd pour une sauvegarde de capsule.");
      return;
    }
    const res = parseBackup(await f.text());
    if ("error" in res) {
      toast(res.error);
      return;
    }
    const { letters, added } = mergeLetters(data.letters, res.letters);
    await persist({ ...data, letters, updatedAt: added ? new Date().toISOString() : data.updatedAt });
    sfx.current.grant();
    toast(added ? `${added} lettre${added > 1 ? "s" : ""} restaurée${added > 1 ? "s" : ""}.` : "Rien de nouveau : toutes ces lettres sont déjà là.");
  };

  const toggleSound = () => {
    const v = !sound;
    setSound(v);
    sfx.current.enabled = v;
    save("sp.capsule.sound", v);
    if (v) sfx.current.beep();
  };

  const left = t == null ? null : daysUntil(archiveOpensAt(2031), t);
  const warn = loaded && needsBackup(data);
  const lettersByYear = useMemo(() => {
    const m: Record<number, number> = {};
    for (const l of data.letters) {
      const y = capsuleYearOf(Date.parse(l.sealedAt));
      m[y] = (m[y] ?? 0) + 1;
    }
    return m;
  }, [data.letters]);

  return (
    <div className="app is-ready capsule">
      <div className="grain" aria-hidden="true" />
      <div className="cap-scan" aria-hidden="true" />

      {sim && (
        <div className="simbar mono" role="note">
          MODE SIMULATION · HORLOGE DÉCALÉE ·{" "}
          <a href="/capsule" className="red">
            QUITTER
          </a>
        </div>
      )}

      <main className="page cap">
        {/* 1. En-tête classifié */}
        <header className="cap-head mono reveal">
          <div className="meta__row">
            <span className="meta__strong">ANNEXE C · ACCÈS RESTREINT</span>
            <button type="button" className="cap-sound" onClick={toggleSound} aria-pressed={sound}>
              {sound ? "SON ●" : "SON ○"}
            </button>
          </div>
          <div className="meta__row">
            <span>N° {CASE_NUMBER}/CT</span>
            <span className="red">{opened ? "● CAPSULE OUVERTE" : "● SCELLÉE"}</span>
          </div>
        </header>

        <h1 className="cap-title reveal" style={{ ["--d" as string]: "0.1s" }}>
          <span>CAPSULE</span>
          <span className="red">2031</span>
        </h1>
        <p className="cap-sub mono reveal" style={{ ["--d" as string]: "0.2s" }}>
          Des messages pour le Sparrow de 2031. Scellés aujourd&apos;hui. Ouverts le jour du verdict.
        </p>

        {/* 2. Coffre-fort */}
        <section className="cap-vault reveal" style={{ ["--d" as string]: "0.3s" }} aria-label="Coffre-fort">
          <Vault state={vault} letters={data.letters.length} />
          <div className="cap-open mono">
            <span>OUVERTURE PROGRAMMÉE</span>
            <b>12.10.2031 · 00:00</b>
            <span className="steel" suppressHydrationWarning>
              {opened ? "LA CAPSULE EST OUVERTE" : left == null ? "—" : `DANS ${fr(left)} JOUR${left > 1 ? "S" : ""}`}
            </span>
          </div>
        </section>

        {/* 3. Scanner biométrique + 4. Tentative d'ouverture */}
        <section className="cap-sec" aria-labelledby="cap-scan-t">
          <header className="section-head">
            <span className="section-head__num mono">C1</span>
            <h2 id="cap-scan-t" className="section-head__title">
              Contrôle d&apos;accès
            </h2>
            <span className="section-head__meta mono">BIOMÉTRIE</span>
          </header>
          <Scanner open={opened} sfx={sfx.current} onResult={() => setScanned(true)} />
          <button
            type="button"
            className={`btn btn--primary cap-try${vault === "trying" ? " is-busy" : ""}`}
            onClick={tryOpen}
            disabled={vault === "trying"}
          >
            {vault === "trying" ? "Déverrouillage en cours…" : opened ? "Ouvrir la capsule" : "Tenter l'ouverture"}
          </button>
          {denial && (
            <p className="cap-denial mono" role="alert" key={denial + data.attempts}>
              <b>⛔ {denial}</b>
              <span>
                Tentative n° {data.attempts} consignée au dossier. (Compteur réel, stocké sur ce téléphone.)
              </span>
            </p>
          )}
        </section>

        {/* 5. Écrire au Sparrow de 2031 */}
        <section className="cap-sec" aria-labelledby="cap-write-t">
          <header className="section-head">
            <span className="section-head__num mono">C2</span>
            <h2 id="cap-write-t" className="section-head__title">
              Écrire au Sparrow de 2031
            </h2>
          </header>

          {opened ? (
            <p className="cap-note mono">La capsule est ouverte : plus aucune lettre ne peut y être scellée.</p>
          ) : (
            <form className={`letter${sealing ? " letter--sealing" : ""}`} onSubmit={sealDraft}>
              <div className="letter__head mono">
                <span>DESTINATAIRE : SPARROW · 2031</span>
                <span>RÉF. L-{pad(data.letters.length + 1, 3)}</span>
              </div>
              <label className="letter__lbl mono" htmlFor="cap-body">
                MESSAGE
              </label>
              <textarea
                id="cap-body"
                className="letter__body"
                value={data.draft.body}
                onChange={(e) => editDraft({ body: e.target.value })}
                maxLength={MAX_BODY}
                rows={7}
                placeholder={prompt}
              />
              <div className="letter__row">
                <div>
                  <label className="letter__lbl mono" htmlFor="cap-author">
                    SIGNATURE
                  </label>
                  <input
                    id="cap-author"
                    className="letter__input mono"
                    value={data.draft.author}
                    onChange={(e) => editDraft({ author: e.target.value })}
                    maxLength={MAX_AUTHOR}
                    placeholder="Ton prénom"
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <span className="letter__lbl mono">TON</span>
                  <div className="letter__tones" role="radiogroup" aria-label="Ton de la lettre">
                    {(Object.keys(TONES) as Tone[]).map((k) => (
                      <button
                        key={k}
                        type="button"
                        role="radio"
                        aria-checked={data.draft.tone === k}
                        className={data.draft.tone === k ? "on" : ""}
                        onClick={() => editDraft({ tone: k })}
                      >
                        {TONES[k]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="letter__count mono">
                {fr(data.draft.body.length)} / {fr(MAX_BODY)} · brouillon enregistré sur ce téléphone
              </p>
              <button type="submit" className="btn btn--primary letter__seal">
                Sceller la lettre
              </button>
              <span className="letter__wax" aria-hidden="true">
                SP
              </span>
            </form>
          )}
        </section>

        {/* Lettres scellées */}
        <section className="cap-sec" aria-labelledby="cap-list-t">
          <header className="section-head">
            <span className="section-head__num mono">C3</span>
            <h2 id="cap-list-t" className="section-head__title">
              Lettres scellées
            </h2>
            <span className="section-head__meta mono">{data.letters.length} / {MAX_LETTERS}</span>
          </header>
          {data.letters.length === 0 ? (
            <p className="cap-note mono">Aucune lettre dans la capsule de ce téléphone. Le Sparrow de 2031 attend.</p>
          ) : (
            <ul className="env-list">
              {data.letters.map((l, i) => {
                const readable = t != null && isOpen(t, l);
                return (
                  <li key={l.id} className={`env${readable ? " env--open" : ""}`}>
                    <div className="env__flap" aria-hidden="true" />
                    <div className="env__meta mono">
                      <span>L-{pad(i + 1, 3)} · {TONES[l.tone].toUpperCase()}</span>
                      <span>SCELLÉE LE {formatDot(Date.parse(l.sealedAt))}</span>
                    </div>
                    <p className="env__from">De : {l.author}</p>
                    {readable ? (
                      <p className="env__body">{l.body}</p>
                    ) : (
                      <p className="env__locked mono" suppressHydrationWarning>
                        🔒 CONTENU SCELLÉ · OUVERTURE DANS {t == null ? "—" : fr(daysUntil(Date.parse(l.openAt), t))} J
                      </p>
                    )}
                    <span className="env__seal" aria-hidden="true">
                      SP
                    </span>
                    <button type="button" className="env__del mono" onClick={() => void removeLetter(l)}>
                      Détruire
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 6. Sauvegardes */}
        <section className="cap-sec" aria-labelledby="cap-bak-t">
          <header className="section-head">
            <span className="section-head__num mono">C4</span>
            <h2 id="cap-bak-t" className="section-head__title">
              Sauvegardes
            </h2>
            <span className={`section-head__meta mono${warn ? " red" : ""}`}>{warn ? "À FAIRE" : "À JOUR"}</span>
          </header>
          <div className={`bak${warn ? " bak--warn" : ""}`}>
            <p className="bak__lead">
              Les lettres vivent <b>uniquement sur ce téléphone</b>.
            </p>
            <ul className="bak__list mono">
              <li>Elles ne sont envoyées nulle part : ni sur le site, ni sur GitHub, ni chez le Ministère.</li>
              <li>
                Effacer les données de Safari, changer de téléphone ou supprimer l&apos;appli de l&apos;écran
                d&apos;accueil peut les <b>effacer définitivement</b>.
              </li>
              <li>
                Exporte une sauvegarde après chaque lettre et range-la dans <b>Fichiers → iCloud Drive</b>. 5 ans,
                c&apos;est long.
              </li>
            </ul>
            <p className="bak__status mono" suppressHydrationWarning>
              {data.letters.length} lettre{data.letters.length > 1 ? "s" : ""} · dernière sauvegarde :{" "}
              {data.lastExportAt ? formatDot(Date.parse(data.lastExportAt)) : "jamais"}
            </p>
            <div className="bak__actions">
              <button type="button" className="btn btn--primary" onClick={() => void exportBackup()}>
                Exporter la sauvegarde
              </button>
              <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
                Importer une sauvegarde
              </button>
              <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(e) => void importBackup(e.target.files)}
              />
            </div>
            <p className="bak__fine mono">
              Le fichier de sauvegarde contient le texte des lettres en clair : ne le partage qu&apos;avec des gens de
              confiance. L&apos;import fusionne sans créer de doublons.
            </p>
          </div>
        </section>

        {/* 7. Archives annuelles */}
        <section className="cap-sec" aria-labelledby="cap-arch-t">
          <header className="section-head">
            <span className="section-head__num mono">C5</span>
            <h2 id="cap-arch-t" className="section-head__title">
              Archives annuelles
            </h2>
            <span className="section-head__meta mono">2027 → 2031</span>
          </header>
          <ol className="drawers">
            {ARCHIVE_YEARS.map((y, i) => {
              const at = archiveOpensAt(y);
              const unlocked = t != null && t >= at;
              const a = ANNUAL[y];
              return (
                <li key={y} className={`drawer${unlocked ? " drawer--open" : ""}`}>
                  <div className="drawer__face">
                    <span className="drawer__year">{y}</span>
                    <span className="drawer__lbl mono">{a.title}</span>
                    <span className="drawer__lock mono" suppressHydrationWarning>
                      {unlocked ? "DÉVERROUILLÉE" : t == null ? "—" : `🔒 ${fr(daysUntil(at, t))} J`}
                    </span>
                  </div>
                  {unlocked ? (
                    <div className="drawer__body">
                      <p>{a.text}</p>
                      <p className="mono drawer__stat">
                        Lettres scellées sur ce téléphone pendant l&apos;année {i + 1} : <b>{lettersByYear[i + 1] ?? 0}</b>
                      </p>
                    </div>
                  ) : (
                    <p className="drawer__hint mono">Déverrouillage le {formatDot(at)} à minuit, heure de Paris.</p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>

        {/* Capsule collective : préparée, pas encore active */}
        <section className="cap-sec" aria-labelledby="cap-col-t">
          <div className="collective">
            <span className="mono collective__tag">EN PRÉPARATION · NIVEAU OMEGA</span>
            <h2 id="cap-col-t" className="collective__title">
              Capsule collective des potes
            </h2>
            <p className="mono">
              Bientôt : une capsule commune et privée, réservée au groupe. En attendant, chaque téléphone garde sa
              propre capsule, et les sauvegardes permettent de tout transférer plus tard.
            </p>
          </div>
        </section>

        <footer className="foot mono">
          <p>
            Capsule fictive réalisée entre amis. Ouverture symbolique le 12.10.2031, sans aucune valeur juridique.
          </p>
          <p>
            <a href="/" className="red">
              ← Retour au dossier SP-2031
            </a>
          </p>
        </footer>
      </main>

      {intro && (
        <div
          className={`cap-intro${introN > INTRO.length ? " cap-intro--out" : ""}`}
          role="dialog"
          aria-label="Introduction"
          onClick={() => {
            if (introN >= INTRO.length) {
              setIntroN(INTRO.length + 1);
              sfx.current.clunk();
              setTimeout(() => setIntro(false), 600);
            } else setIntroN(INTRO.length);
          }}
        >
          <div className="cap-intro__box mono">
            <p className="cap-intro__stamp">TOP SECRET</p>
            {INTRO.slice(0, introN).map((l, i) => (
              <p key={i} className={i === INTRO.length - 1 ? "red" : ""}>
                &gt; {l}
              </p>
            ))}
            {introN < INTRO.length && <span className="feed__cursor" />}
          </div>
          {introN >= INTRO.length && <span className="btn btn--primary cap-intro__go">Entrer dans la salle des coffres</span>}
          <span className="intro__skip mono">TOUCHER POUR CONTINUER</span>
        </div>
      )}

      <Toast text={toastText} />
    </div>
  );
}
