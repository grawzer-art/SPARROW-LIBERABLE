"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { DONATIONS } from "@/config";
import { BatSignal } from "./DailyQuote";
import { Toast } from "./Overlays";

const TARIFS: { eur: string; amount?: number; label: string; note: string }[] = [
  { eur: "2 €", amount: 2, label: "Un café de patience", note: "Effet estimé : 4 minutes de calme." },
  { eur: "5 €", amount: 5, label: "Recharge de moral", note: "Valable jusqu'au prochain lundi." },
  { eur: "10 €", amount: 10, label: "Kebab de soutien", note: "Sauce blanche comprise. Oignons négociables." },
  { eur: "20 €", amount: 20, label: "Entretien du masque", note: "Le latex ne se lave pas tout seul." },
  { eur: "50 €", amount: 50, label: "Carburant de la Batmobile", note: "Trottinette électrique, batterie fatiguée." },
  { eur: "?? €", label: "Montant libre", note: "Le Chevalier Noir ne juge pas. Le calendrier, si." },
];

/** Lien PayPal.me, avec montant prérempli si fourni. */
const paypalLink = (base: string, amount?: number) => (amount ? `${base.replace(/\/$/, "")}/${amount}EUR` : base);

export function DonPage() {
  const { paypal } = DONATIONS;
  const handle = paypal.replace(/^https?:\/\/(www\.)?paypal\.me\//i, "").replace(/\/$/, "");
  const [toastText, setToastText] = useState<string | null>(null);
  const [qr, setQr] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = useCallback((m: string) => {
    setToastText(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastText(null), 3400);
  }, []);

  useEffect(() => {
    QRCode.toString(`${window.location.origin}/don`, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#090909", light: "#F1EFE8" },
    })
      .then(setQr)
      .catch(() => setQr(""));
  }, []);

  const share = async () => {
    const url = `${window.location.origin}/don`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Don pour le Chevalier Noir", text: "Le Chevalier Noir a besoin de vous. Ou d'un kebab.", url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Lien de la caisse copié.");
    } catch {
      toast(url);
    }
  };

  return (
    <div className="app is-ready">
      <div className="grain" aria-hidden="true" />
      <div className="leak" aria-hidden="true" />
      <main className="page donp">
        <nav className="donp__nav mono reveal">
          <a href="/">← RETOUR AU DOSSIER</a>
          <span>RÉF. BAT-2031</span>
        </nav>

        <p className="donp__pre mono reveal" style={{ ["--d" as string]: "0.1s" }}>
          FONDS DE SOUTIEN OFFICIEL · GUICHET OUVERT
        </p>
        <h1 className="title donp__title reveal" style={{ ["--d" as string]: "0.15s" }}>
          <span className="donp__t1">DON POUR LE</span>
          <span className="donp__t2">CHEVALIER NOIR</span>
        </h1>

        <div className="donp__signal reveal" style={{ ["--d" as string]: "0.3s" }}>
          <BatSignal />
        </div>

        <p className="donp__lead reveal" style={{ ["--d" as string]: "0.4s" }}>
          Gotham ne se protège pas toute seule. Le masque s&apos;use, la cape se froisse, et le moral se négocie au kebab.
        </p>

        {paypal && (
          <section className="wero reveal" style={{ ["--d" as string]: "0.5s" }} aria-labelledby="pp-title">
            <div className="wero__head mono">
              <span id="pp-title">COORDONNÉES PAYPAL</span>
              <span className="red">● ACTIF</span>
            </div>
            <p className="wero__num wero__num--handle">@{handle}</p>
            <p className="wero__who mono">BÉNÉFICIAIRE : LE CHEVALIER NOIR (ALIAS SPARROW)</p>
            <a className="btn btn--primary wero__copy" href={paypal} target="_blank" rel="noopener noreferrer">
              Donner via PayPal
            </a>
            <ol className="install__steps mono wero__steps">
              <li><span>Toucher <b>Donner via PayPal</b>, ou un montant du barème ci-dessous.</span></li>
              <li><span>PayPal s&apos;ouvre (appli ou site), montant déjà rempli.</span></li>
              <li><span>Choisir <b>« Entre proches »</b> pour éviter les frais.</span></li>
              <li><span>Valider. Ressentir de la fierté.</span></li>
            </ol>
          </section>
        )}

        <section className="tarifs reveal" aria-labelledby="tarifs-title">
          <header className="section-head">
            <span className="section-head__num mono">B</span>
            <h2 id="tarifs-title" className="section-head__title">Barème officiel</h2>
            <span className="section-head__meta mono">TOUCHER = PAYER</span>
          </header>
          <ul className="tarifs__list">
            {TARIFS.map((t) => (
              <li key={t.eur}>
                <a
                  className="tarif"
                  href={paypalLink(paypal, t.amount)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => toast(t.amount ? `Direction PayPal : ${t.eur} pré-remplis. Merci pour Gotham.` : "Direction PayPal. Le montant, c'est toi qui vois.")}
                >
                  <span className="tarif__eur">{t.eur}</span>
                  <span className="tarif__txt">
                    <b>{t.label}</b>
                    <small className="mono">{t.note}</small>
                  </span>
                  <span className="tarif__go mono" aria-hidden="true">
                    →
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="donp__share reveal" aria-labelledby="qr-title">
          <div className="share__qr">
            <div className="share__qrbox" role="img" aria-label="QR code vers cette page de don" dangerouslySetInnerHTML={{ __html: qr }} />
            <div className="share__qrtext mono">
              <strong id="qr-title">FAIRE PASSER LA CAISSE</strong>
              <span>Un pote scanne ce code avec son appareil photo : il arrive directement sur cette page.</span>
            </div>
          </div>
          <button type="button" className="btn donp__sharebtn" onClick={share}>
            Partager la page de don
          </button>
        </section>

        <footer className="foot mono">
          <p>
            Don 100 % volontaire, entre potes. Le paiement se fait chez PayPal : cette page ne collecte
            aucune donnée et ne voit passer aucun euro.
          </p>
          <p>Montant collecté : information classifiée. Rappel : les dons ne raccourcissent pas le compteur. Nous avons vérifié.</p>
          <p>
            <a href="/" className="red">← Retour au dossier SP-2031</a>
          </p>
        </footer>
      </main>
      <Toast text={toastText} />
    </div>
  );
}
