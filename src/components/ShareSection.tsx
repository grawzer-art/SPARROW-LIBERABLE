"use client";

import { memo, useEffect, useState } from "react";
import QRCode from "qrcode";
import { appUrl, copyLink, shareCard, shareLink } from "@/lib/share";
import { MAIN_PHOTO } from "@/data/photos";
import { now, remaining } from "@/lib/time";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

function ShareSectionImpl({ toast }: { toast: (m: string) => void }) {
  const [qr, setQr] = useState<string>("");
  const [url, setUrl] = useState("");
  const [tab, setTab] = useState<"ios" | "android">("ios");
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const u = appUrl();
    setUrl(u);
    QRCode.toString(u, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#090909", light: "#F1EFE8" } })
      .then(setQr)
      .catch(() => setQr(""));
    if (/android/i.test(navigator.userAgent)) setTab("android");
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true,
    );
    const onBip = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const report = (res: string) => {
    if (res === "copied") toast("Lien copié. Transmettez le dossier avec discrétion.");
    else if (res === "failed") toast("Transmission impossible. Copiez l'adresse manuellement.");
  };

  return (
    <section className="share reveal" aria-labelledby="share-title">
      <header className="section-head">
        <span className="section-head__num mono">05</span>
        <h2 id="share-title" className="section-head__title">Diffusion restreinte</h2>
        <span className="section-head__meta mono">ACCÈS : LES POTES</span>
      </header>

      <div className="share__actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={async () => report(await shareLink("Dossier SP-2031 : Sparrow n'est toujours pas libérable. Suivez l'affaire en direct."))}
        >
          Partager le dossier
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await shareCard(remaining(now()), MAIN_PHOTO.src ?? "", "countdown");
            setBusy(false);
            if (res === "failed") toast("Impression de la fiche impossible sur cet appareil.");
          }}
        >
          {busy ? "Impression…" : "Fiche image"}
        </button>
        <button type="button" className="btn" onClick={async () => report(await copyLink())}>
          Copier le lien
        </button>
      </div>

      <div className="share__qr">
        <div className="share__qrbox" aria-label="QR code vers l'application" role="img" dangerouslySetInnerHTML={{ __html: qr }} />
        <div className="share__qrtext mono">
          <strong>SCANNER POUR ACCÉDER AU DOSSIER</strong>
          <span className="share__url">{url.replace(/^https?:\/\//, "")}</span>
          <span>Montrez cet écran à un pote. Il scanne avec l&apos;appareil photo. C&apos;est tout.</span>
        </div>
      </div>

      <div className="install">
        <div className="install__head">
          <h3 className="install__title">Installer sur l&apos;écran d&apos;accueil</h3>
          {standalone && <span className="install__ok mono">✓ APPLICATION INSTALLÉE</span>}
        </div>
        <div className="install__tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === "ios"} className={tab === "ios" ? "on" : ""} onClick={() => setTab("ios")}>
            iPhone
          </button>
          <button type="button" role="tab" aria-selected={tab === "android"} className={tab === "android" ? "on" : ""} onClick={() => setTab("android")}>
            Android
          </button>
        </div>
        {tab === "ios" ? (
          <ol className="install__steps mono">
            <li><span>Ouvrir ce lien dans <b>Safari</b>.</span></li>
            <li><span>
              Toucher le bouton <b>Partager</b> <ShareGlyph /> en bas de l&apos;écran.
            </span></li>
            <li><span>
              Choisir <b>Sur l&apos;écran d&apos;accueil</b>, puis <b>Ajouter</b>.
            </span></li>
            <li><span>L&apos;icône SPARROW apparaît. Le dossier s&apos;ouvre en plein écran.</span></li>
          </ol>
        ) : (
          <ol className="install__steps mono">
            <li><span>Ouvrir ce lien dans <b>Chrome</b>.</span></li>
            <li><span>
              Toucher le menu <b>⋮</b> en haut à droite.
            </span></li>
            <li><span>
              Choisir <b>Installer l&apos;application</b> (ou <b>Ajouter à l&apos;écran d&apos;accueil</b>).
            </span></li>
            <li><span>Confirmer. L&apos;icône SPARROW rejoint vos applis.</span></li>
          </ol>
        )}
        {installEvt && (
          <button
            type="button"
            className="btn btn--primary install__cta"
            onClick={async () => {
              await installEvt.prompt();
              setInstallEvt(null);
            }}
          >
            Installer maintenant
          </button>
        )}
        <p className="install__note mono">
          Gratuit, sans compte, sans pub. Fonctionne hors ligne après la première visite. Pas de widget d&apos;écran verrouillé : c&apos;est une
          web-app, pas un satellite.
        </p>
      </div>
    </section>
  );
}

function ShareGlyph() {
  return (
    <svg className="glyph" viewBox="0 0 20 24" width="14" height="17" aria-hidden="true">
      <path d="M10 2v13M5.5 6.5 10 2l4.5 4.5M4 10H2v12h16V10h-2" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export const ShareSection = memo(ShareSectionImpl);
