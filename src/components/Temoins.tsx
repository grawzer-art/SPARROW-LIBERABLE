"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { load, save } from "@/lib/storage";
import { formatDot, pad } from "@/lib/time";

interface Pic {
  url: string;
  at: string;
}

type Role = "admin" | "pote" | null;

const API = "/api/temoins";
const MAX_SIDE = 1400;
const MAX_FILES = 5;

const CAPTIONS = [
  "Cliché transmis par un témoin anonyme. Crédibilité : élevée.",
  "Le sujet ignorait être photographié. Ou faisait semblant.",
  "Pièce versée au dossier. Le juge a ri. Officieusement.",
  "Témoignage visuel recevable. Le sujet conteste l'angle.",
  "Photo prise sans autorisation du sujet. Conservée quand même.",
  "Analyse en cours : le sujet semble attendre quelque chose.",
  "Document authentifié par le laboratoire. Hélas.",
  "Le sujet nie formellement. La photo, elle, ne ment pas.",
];

/** Redimensionne et réencode en JPEG : plus léger, et supprime les métadonnées (GPS…). */
async function prepare(file: File): Promise<Blob> {
  const src = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = src;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error("encode"))), "image/jpeg", 0.82));
  } finally {
    URL.revokeObjectURL(src);
  }
}

function TemoinsImpl({ toast }: { toast: (m: string) => void }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [pics, setPics] = useState<Pic[]>([]);
  const [role, setRole] = useState<Role>(null);
  const [code, setCode] = useState("");
  const [askCode, setAskCode] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async (c: string) => {
    try {
      const res = await fetch(API, { headers: c ? { "x-code": c } : {}, cache: "no-store" });
      const data = (await res.json()) as { enabled: boolean; role?: Role; photos: Pic[] };
      setEnabled(data.enabled);
      setPics(data.photos ?? []);
      setRole(data.role ?? null);
      return data.role ?? null;
    } catch {
      setEnabled((e) => e ?? false);
      return null;
    }
  }, []);

  useEffect(() => {
    const c = load<string>("sp.code", "");
    setCode(c);
    void refresh(c);
  }, [refresh]);

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await refresh(code.trim());
    if (!r) {
      toast("Code incorrect. Le Ministère vous a à l'œil.");
      return;
    }
    save("sp.code", code.trim());
    setAskCode(false);
    toast(r === "admin" ? "Accréditation Ministère confirmée." : "Accréditation confirmée. Vous pouvez déposer.");
    input.current?.click();
  };

  const start = () => {
    if (role) input.current?.click();
    else setAskCode(true);
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, MAX_FILES);
    if (!list.length) {
      toast("Seules les photos sont acceptées.");
      return;
    }
    let ok = 0;
    for (const [i, f] of list.entries()) {
      setBusy(`Transmission ${i + 1}/${list.length}…`);
      try {
        const blob = await prepare(f);
        const res = await fetch(API, {
          method: "POST",
          headers: { "content-type": "image/jpeg", "x-code": code.trim() },
          body: blob,
        });
        if (!res.ok) {
          const { error } = (await res.json().catch(() => ({}))) as { error?: string };
          toast(error ?? "Transmission refusée.");
          if (res.status === 401) setRole(null);
          break;
        }
        ok++;
      } catch {
        toast("Photo illisible. Essayez une autre pièce.");
      }
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    if (ok) {
      toast(ok > 1 ? `${ok} pièces versées au dossier. Merci, témoin.` : "Pièce versée au dossier. Merci, témoin.");
      await refresh(code.trim());
    }
  };

  const remove = async (p: Pic) => {
    if (!window.confirm("Détruire cette pièce ? Action définitive.")) return;
    const res = await fetch(API, {
      method: "DELETE",
      headers: { "content-type": "application/json", "x-code": code.trim() },
      body: JSON.stringify({ url: p.url }),
    });
    if (res.ok) {
      setOpen(null);
      toast("Pièce détruite. Aucune trace. Officiellement.");
      await refresh(code.trim());
    } else toast("Destruction refusée.");
  };

  const visible = showAll ? pics : pics.slice(0, 6);
  const num = (i: number) => `T-${pad(pics.length - i, 3)}`;
  const current = open == null ? null : pics[open];

  return (
    <section className="tem reveal" aria-labelledby="tem-title">
      <header className="section-head">
        <span className="section-head__num mono">07</span>
        <h2 id="tem-title" className="section-head__title">Pièces des témoins</h2>
        <span className="section-head__meta mono">{pics.length ? `${pics.length} PIÈCE${pics.length > 1 ? "S" : ""}` : "DÉPÔT"}</span>
      </header>

      <div className="tem__rules mono">
        <b>AVIS AUX TÉMOINS.</b> Vous détenez une photo du suspect ? Versez-la au dossier.{" "}
        <span className="red">Uniquement des photos de Sparrow.</span> Toute autre pièce sera détruite par le Ministère.
      </div>

      {enabled === false && (
        <p className="don__pending mono">
          <span className="feed__cursor" aria-hidden="true" /> GUICHET DE DÉPÔT EN COURS D&apos;INSTALLATION PAR LE MINISTÈRE.
        </p>
      )}

      {enabled && (
        <>
          {askCode ? (
            <form className="tem__code" onSubmit={submitCode}>
              <label className="mono" htmlFor="tem-code">
                CODE DES POTES
              </label>
              <div className="tem__coderow">
                <input
                  id="tem-code"
                  className="mono"
                  type="password"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="none"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="••••••"
                  autoFocus
                />
                <button type="submit" className="btn btn--primary">
                  Valider
                </button>
              </div>
              <small className="mono steel">Demandez le code au groupe. Il est retenu sur ce téléphone.</small>
            </form>
          ) : (
            <button type="button" className="btn btn--primary tem__cta" onClick={start} disabled={busy != null}>
              {busy ?? "Déposer une photo du suspect"}
            </button>
          )}
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => void upload(e.target.files)}
          />

          {pics.length === 0 ? (
            <p className="tem__empty mono">Aucune pièce déposée pour l&apos;instant. Le premier témoin entrera dans l&apos;histoire.</p>
          ) : (
            <ul className="tem__grid">
              {visible.map((p, i) => (
                <li key={p.url} className="tem__item">
                  <button type="button" className="tem__thumb" onClick={() => setOpen(i)} aria-label={`Agrandir la pièce ${num(i)}`}>
                    <img src={p.url} alt={`Pièce ${num(i)} déposée par un témoin`} loading="lazy" decoding="async" />
                  </button>
                  <span className="tem__tag mono">{num(i)}</span>
                  <span className="tem__date mono">{formatDot(Date.parse(p.at))}</span>
                </li>
              ))}
            </ul>
          )}
          {pics.length > 6 && (
            <button type="button" className="btn btn--ghost btn--sm tem__more" onClick={() => setShowAll((v) => !v)}>
              {showAll ? "Replier" : `Voir les ${pics.length} pièces`}
            </button>
          )}
          {role === "admin" && <p className="tem__admin mono">MODE MINISTÈRE ACTIF · Agrandir une pièce pour la détruire.</p>}
        </>
      )}

      {current && open != null && createPortal(
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Pièce ${num(open)}`} onClick={() => setOpen(null)}>
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={current.url} alt={`Pièce ${num(open)}`} />
            <figcaption className="mono">
              <b>{num(open)}</b> · {formatDot(Date.parse(current.at))} — « {CAPTIONS[(pics.length - open) % CAPTIONS.length]} »
            </figcaption>
            <div className="lightbox__row">
              {role === "admin" && (
                <button type="button" className="btn btn--sm" onClick={() => void remove(current)}>
                  Détruire la pièce
                </button>
              )}
              <button type="button" className="btn btn--primary btn--sm" onClick={() => setOpen(null)} autoFocus>
                Fermer
              </button>
            </div>
          </figure>
        </div>,
        document.body,
      )}
    </section>
  );
}

export const Temoins = memo(TemoinsImpl);
