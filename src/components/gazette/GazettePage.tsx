"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RUBRIQUES,
  addDays,
  archives,
  editionDu,
  isTitre,
  parRubrique,
  parisDate,
  titreParId,
  LANCEMENT,
  type Breve,
  type Edition,
  type RubriqueId,
  type Titre,
} from "@/lib/gazette/edition";
import { load, save } from "@/lib/storage";
import { initClock, now } from "@/lib/time";
import { Toast } from "../Overlays";
import { shareTitreImage } from "./shareImage";

type Vue = "une" | "rubriques" | "archives" | "favoris";
type Item = Titre | Breve;

const VUES: { id: Vue; label: string }[] = [
  { id: "une", label: "À la une" },
  { id: "rubriques", label: "Rubriques" },
  { id: "archives", label: "Archives" },
  { id: "favoris", label: "Favoris" },
];

const PRIX = ["un rein (le gauche)", "deux euros et votre dignité", "une clope", "votre âme, payable en 3 fois", "un ticket resto périmé"];
const METEO = ["dépression sur tout le pays", "averses de lundis", "risque de pétage de câble", "gueule de bois persistante", "orageux en fin de mois"];

const simulated = typeof window !== "undefined" && initClock(window.location.search);

function fmtLong(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .toUpperCase();
}

const fmtShort = (date: string) => date.split("-").reverse().join(".");

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return arr[h % arr.length];
}

export function GazettePage() {
  const [today, setToday] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [vue, setVue] = useState<Vue>("une");
  const [rubrique, setRubrique] = useState<RubriqueId>("france");
  const [favs, setFavs] = useState<string[]>([]);
  const [focus, setFocus] = useState<{ item: Item; flash: boolean } | null>(null);
  const [flipKey, setFlipKey] = useState(0);
  const [toastText, setToastText] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [sim, setSim] = useState(false);
  const [archLimit, setArchLimit] = useState(30);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((m: string) => {
    setToastText(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 3200);
  }, []);

  // Lecture de l'URL (?ed=AAAA-MM-JJ, ?vue=…, ?t=id) et des favoris.
  useEffect(() => {
    setSim(simulated);
    const t = parisDate(now());
    setToday(t);
    const q = new URLSearchParams(window.location.search);
    const ed = q.get("ed");
    setDate(ed && /^\d{4}-\d{2}-\d{2}$/.test(ed) && ed >= LANCEMENT && ed <= t ? ed : t);
    const v = q.get("vue") as Vue | null;
    if (v && VUES.some((x) => x.id === v)) setVue(v);
    const r = q.get("rubrique") as RubriqueId | null;
    if (r && r in RUBRIQUES) setRubrique(r);
    const id = q.get("t");
    if (id) {
      const item = titreParId(id);
      if (item) setFocus({ item, flash: isTitre(item) && !!item.flash });
    }
    setFavs(load<string[]>("sp.gazette.favs", []));
  }, []);

  // Garde l'URL à jour (liens partageables, retour arrière).
  useEffect(() => {
    if (!date || !today) return;
    const q = new URLSearchParams(window.location.search);
    if (date === today) q.delete("ed");
    else q.set("ed", date);
    if (vue === "une") q.delete("vue");
    else q.set("vue", vue);
    if (vue === "rubriques") q.set("rubrique", rubrique);
    else q.delete("rubrique");
    if (focus) q.set("t", focus.item.id);
    else q.delete("t");
    const s = q.toString();
    window.history.replaceState(null, "", `/gazette${s ? `?${s}` : ""}`);
  }, [date, today, vue, rubrique, focus]);

  const edition: Edition | null = useMemo(() => (date ? editionDu(date) : null), [date]);
  const arch = useMemo(() => (today ? archives(today, archLimit) : []), [today, archLimit]);

  const goEdition = (d: string) => {
    if (!today || d < LANCEMENT || d > today) return;
    setDate(d);
    setVue("une");
    setFlipKey((k) => k + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((x) => x !== id) : [id, ...favs];
    setFavs(next);
    save("sp.gazette.favs", next);
    toast(favs.includes(id) ? "Retiré des favoris. Lâche." : "Ajouté aux favoris. Vous avez des goûts de chiotte, on adore.");
  };

  const shareTitre = async (item: Item) => {
    const url = `${window.location.origin}/gazette?t=${encodeURIComponent(item.id)}`;
    const text = `« ${item.titre} »\n— La Gazette du Chaos (parodie)`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "La Gazette du Chaos", text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      toast("Titre copié. Collez-le dans le groupe.");
    } catch {
      toast("Partage impossible sur cet appareil.");
    }
  };

  const imageTitre = async (item: Item) => {
    setBusy(item.id);
    const res = await shareTitreImage(item, date ?? today ?? LANCEMENT, `${window.location.origin}/gazette`);
    setBusy(null);
    if (res === "failed") toast("Impression impossible sur cet appareil.");
  };

  const actions = (item: Item, dark = false) => (
    <div className={`gz-actions${dark ? " gz-actions--dark" : ""}`}>
      <button type="button" onClick={() => void shareTitre(item)} aria-label="Partager ce titre">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v8h14v-8" />
        </svg>
        <span>Partager</span>
      </button>
      <button type="button" onClick={() => void imageTitre(item)} aria-label="Créer l'image de ce titre" disabled={busy === item.id}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h3l2-2h6l2 2h3v12H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
        </svg>
        <span>{busy === item.id ? "…" : "Image"}</span>
      </button>
      <button
        type="button"
        onClick={() => toggleFav(item.id)}
        aria-pressed={favs.includes(item.id)}
        aria-label={favs.includes(item.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
        className={favs.includes(item.id) ? "on" : ""}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />
        </svg>
        <span>Favori</span>
      </button>
    </div>
  );

  const rub = (t: Titre) => <span className="gz-rub">{RUBRIQUES[t.rubrique].nom}</span>;
  const tampon = (t: Titre) => (t.tampon ? <span className="gz-stamp">{t.tampon}</span> : null);
  const open = (item: Item) => setFocus({ item, flash: isTitre(item) && !!item.flash });

  const loaded = edition && today && date;

  return (
    <div className="gz">
      <div className="gz-grain" aria-hidden="true" />

      {sim && (
        <div className="simbar mono" role="note">
          MODE SIMULATION · HORLOGE DÉCALÉE ·{" "}
          <a href="/gazette" className="red">
            QUITTER
          </a>
        </div>
      )}

      {/* Bandeau URGENT (information totalement insignifiante) */}
      <div className="gz-ticker" aria-label="Urgent">
        <span className="gz-ticker__tag">URGENT</span>
        <div className="gz-ticker__track">
          <span className="gz-ticker__text">
            {edition ? `${edition.urgent}  ✶  ${edition.urgent}  ✶  ` : "Chargement des informations inutiles…"}
          </span>
        </div>
      </div>

      <header className="gz-mast">
        <div className="gz-mast__top">
          <span>N° {edition ? String(edition.numero).padStart(4, "0") : "····"}</span>
          <span>{date ? fmtLong(date) : " "}</span>
        </div>
        <h1 className="gz-mast__title">
          <span className="gz-mast__la">La Gazette</span>
          <span className="gz-mast__chaos">du Chaos</span>
        </h1>
        <p className="gz-mast__sig">« L&apos;actualité est déjà assez ridicule. On en rajoute. »</p>
        <div className="gz-mast__bottom">
          <span>Journal satirique · 100 % parodie</span>
          <span>Prix : {date ? pick(PRIX, date) : "—"}</span>
          <span>Météo du moral : {date ? pick(METEO, date + "m") : "—"}</span>
        </div>
      </header>

      <nav className="gz-tabs" aria-label="Sections de la Gazette">
        {VUES.map((v) => (
          <button
            key={v.id}
            type="button"
            className={vue === v.id ? "on" : ""}
            aria-current={vue === v.id ? "page" : undefined}
            onClick={() => {
              setVue(v.id);
              if (v.id === "une" && today && date !== today) goEdition(today);
            }}
          >
            {v.label}
            {v.id === "favoris" && favs.length > 0 && <i>{favs.length}</i>}
          </button>
        ))}
      </nav>

      {!loaded ? (
        <p className="gz-loading">Mise sous presse…</p>
      ) : vue === "une" ? (
        <main className="gz-edition" key={flipKey} data-flip={flipKey > 0 ? "1" : undefined}>
          {edition.speciale && (
            <div className="gz-special">
              <b>{edition.speciale}</b>
              {edition.bandeau && <span>{edition.bandeau}</span>}
            </div>
          )}
          {date !== today && (
            <p className="gz-archived">
              Édition d&apos;archive du {fmtShort(date)}.{" "}
              <button type="button" onClick={() => goEdition(today)}>
                Revenir à l&apos;édition du jour →
              </button>
            </p>
          )}

          {/* LA UNE */}
          <article className="gz-une">
            <div className="gz-une__kicker">
              {rub(edition.une)}
              {tampon(edition.une)}
            </div>
            <h2 className="gz-une__title">
              <button type="button" onClick={() => open(edition.une)}>
                {edition.une.titre}
              </button>
            </h2>
            {edition.une.chapo && <p className="gz-une__chapo">{edition.une.chapo}</p>}
            <figure className="gz-photo" aria-hidden="true">
              <div className="gz-photo__img" />
              <figcaption>Photo d&apos;illustration. Aucun rapport. On n&apos;avait pas le budget.</figcaption>
            </figure>
            {actions(edition.une)}
          </article>

          {edition.flash && (
            <button type="button" className="gz-flashbtn" onClick={() => setFocus({ item: edition.flash!, flash: true })}>
              <span className="gz-flashbtn__dot" /> FLASH SPÉCIAL · Toucher pour lire
            </button>
          )}

          {/* Gros titre */}
          {edition.titres[0] && (
            <article className="gz-big">
              <div className="gz-kick">
                {rub(edition.titres[0])}
                {tampon(edition.titres[0])}
              </div>
              <h3>
                <button type="button" onClick={() => open(edition.titres[0])}>
                  {edition.titres[0].titre}
                </button>
              </h3>
              {actions(edition.titres[0])}
            </article>
          )}

          {/* Deux colonnes */}
          <div className="gz-cols">
            {edition.titres.slice(1, 3).map((t) => (
              <article key={t.id} className="gz-col">
                <div className="gz-kick">{rub(t)}</div>
                <h3>
                  <button type="button" onClick={() => open(t)}>
                    {t.titre}
                  </button>
                </h3>
                {actions(t)}
              </article>
            ))}
          </div>

          {/* Bloc inversé */}
          {edition.titres[3] && (
            <article className="gz-inverse">
              <div className="gz-kick">
                {rub(edition.titres[3])}
                <span className="gz-stamp gz-stamp--light">{edition.titres[3].tampon ?? "EXCLUSIF"}</span>
              </div>
              <h3>
                <button type="button" onClick={() => open(edition.titres[3])}>
                  {edition.titres[3].titre}
                </button>
              </h3>
              {actions(edition.titres[3], true)}
            </article>
          )}

          {/* Chiffre du jour */}
          <aside className="gz-chiffre">
            <span className="gz-chiffre__lbl">Le chiffre du jour</span>
            <b>{edition.chiffre.valeur}</b>
            <p>{edition.chiffre.texte}</p>
            <small>Chiffre inventé, comme tous les autres.</small>
          </aside>

          {/* Liste numérotée */}
          <ol className="gz-list">
            {edition.titres.slice(4, 6).map((t, i) => (
              <li key={t.id}>
                <span className="gz-list__n">{i + 1}</span>
                <div>
                  <div className="gz-kick">{rub(t)}</div>
                  <h3>
                    <button type="button" onClick={() => open(t)}>
                      {t.titre}
                    </button>
                  </h3>
                  {actions(t)}
                </div>
              </li>
            ))}
          </ol>

          {/* Information inutile */}
          {edition.titres[6] && (
            <article className="gz-loupe">
              <span className="gz-loupe__stamp">Information inutile mais vérifiée par personne</span>
              <div className="gz-kick">{rub(edition.titres[6])}</div>
              <h3>
                <button type="button" onClick={() => open(edition.titres[6])}>
                  {edition.titres[6].titre}
                </button>
              </h3>
              {actions(edition.titres[6])}
            </article>
          )}

          {/* En bref */}
          <section className="gz-breves" aria-labelledby="gz-bref">
            <h3 id="gz-bref" className="gz-section">
              En bref
            </h3>
            <ul>
              {edition.breves.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => open(b)}>
                    {b.titre}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <nav className="gz-pager" aria-label="Changer d'édition">
            <button type="button" onClick={() => goEdition(addDays(date, -1))} disabled={date <= LANCEMENT}>
              ← Édition précédente
            </button>
            <button type="button" onClick={() => goEdition(addDays(date, 1))} disabled={date >= today}>
              Édition suivante →
            </button>
          </nav>
        </main>
      ) : vue === "rubriques" ? (
        <main className="gz-view">
          <div className="gz-chips" role="tablist" aria-label="Rubriques">
            {(Object.keys(RUBRIQUES) as RubriqueId[]).map((r) => (
              <button key={r} type="button" role="tab" aria-selected={rubrique === r} className={rubrique === r ? "on" : ""} onClick={() => setRubrique(r)}>
                {RUBRIQUES[r].nom}
              </button>
            ))}
          </div>
          <h2 className="gz-viewtitle">{RUBRIQUES[rubrique].nom}</h2>
          <ul className="gz-feed">
            {parRubrique(rubrique, today).map((t) => (
              <li key={t.id}>
                {t.tampon && <span className="gz-stamp">{t.tampon}</span>}
                <h3>
                  <button type="button" onClick={() => open(t)}>
                    {t.titre}
                  </button>
                </h3>
                {actions(t)}
              </li>
            ))}
          </ul>
        </main>
      ) : vue === "archives" ? (
        <main className="gz-view">
          <h2 className="gz-viewtitle">Archives</h2>
          <p className="gz-viewsub">Toutes les éditions depuis le n° 1. On n&apos;efface rien, surtout pas la honte.</p>
          <ol className="gz-arch">
            {arch.map((a) => (
              <li key={a.date}>
                <button type="button" onClick={() => goEdition(a.date)}>
                  <span className="gz-arch__meta">
                    N° {String(a.numero).padStart(4, "0")} · {fmtShort(a.date)}
                    {a.speciale && <em> · {a.speciale}</em>}
                  </span>
                  <span className="gz-arch__une">{a.une}</span>
                </button>
              </li>
            ))}
          </ol>
          {arch.length >= archLimit && (
            <button type="button" className="gz-more" onClick={() => setArchLimit((n) => n + 60)}>
              Éditions plus anciennes
            </button>
          )}
        </main>
      ) : (
        <main className="gz-view">
          <h2 className="gz-viewtitle">Vos favoris</h2>
          <p className="gz-viewsub">Gardés sur ce téléphone uniquement. Aucun compte, aucun espion (à part nous).</p>
          {favs.length === 0 ? (
            <p className="gz-empty">Aucun favori. Même pas un ? Touchez l&apos;étoile d&apos;un titre, on ne jugera pas (si).</p>
          ) : (
            <ul className="gz-feed">
              {favs
                .map((id) => titreParId(id))
                .filter((x): x is Item => !!x)
                .map((t) => (
                  <li key={t.id}>
                    {isTitre(t) && <span className="gz-rub">{RUBRIQUES[t.rubrique].nom}</span>}
                    <h3>
                      <button type="button" onClick={() => open(t)}>
                        {t.titre}
                      </button>
                    </h3>
                    {actions(t)}
                  </li>
                ))}
            </ul>
          )}
        </main>
      )}

      <footer className="gz-foot">
        <p>
          <b>La Gazette du Chaos</b> est un journal parodique réalisé entre amis. Tous les titres sont inventés, aucun ne
          décrit un fait réel. Si ça vous rappelle quelque chose, c&apos;est votre vie qui a un problème.
        </p>
        <p className="gz-foot__small">Rédaction : le Ministère du Calendrier · Dépôt légal : jamais.</p>
      </footer>

      {/* Lecture plein écran / FLASH SPÉCIAL */}
      {focus && (
        <div
          className={`gz-focus${focus.flash ? " gz-focus--flash" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label={focus.flash ? "Flash spécial" : "Titre"}
          onClick={() => setFocus(null)}
        >
          <div className="gz-focus__sheet" onClick={(e) => e.stopPropagation()}>
            {focus.flash && <div className="gz-focus__siren">FLASH SPÉCIAL</div>}
            <p className="gz-focus__mast">La Gazette du Chaos</p>
            <div className="gz-kick">
              {isTitre(focus.item) ? rub(focus.item) : <span className="gz-rub">En bref</span>}
              {isTitre(focus.item) && tampon(focus.item)}
            </div>
            <h2 className="gz-focus__title">{focus.item.titre}</h2>
            {isTitre(focus.item) && focus.item.chapo && <p className="gz-une__chapo">{focus.item.chapo}</p>}
            <p className="gz-focus__parodie">PARODIE · Ce titre est inventé.</p>
            {actions(focus.item)}
            <button type="button" className="gz-focus__close" onClick={() => setFocus(null)} autoFocus>
              Fermer
            </button>
          </div>
        </div>
      )}

      <Toast text={toastText} />
    </div>
  );
}
