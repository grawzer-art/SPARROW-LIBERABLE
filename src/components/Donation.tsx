"use client";

import { memo } from "react";
import { DONATIONS } from "@/config";

/** Caisse de soutien au Chevalier Noir : simples liens externes, l'appli ne collecte rien. */
function DonationImpl({ toast }: { toast: (m: string) => void }) {
  const { paypal, weroUrl, weroId } = DONATIONS;
  const hasAny = Boolean(paypal || weroUrl || weroId);

  const copyWero = async () => {
    try {
      await navigator.clipboard.writeText(weroId);
      toast("Identifiant Wero copié. Ouvrez votre appli bancaire → Wero → Envoyer.");
    } catch {
      toast(`Identifiant Wero : ${weroId}`);
    }
  };

  return (
    <section className="don reveal" aria-labelledby="don-title">
      <header className="section-head">
        <span className="section-head__num mono">06</span>
        <h2 id="don-title" className="section-head__title">Don pour le Chevalier Noir</h2>
      </header>

      <div className="don__card">
        <div className="don__head mono">
          <span>FONDS DE SOUTIEN · RÉF. BAT-2031</span>
          <span className="red">OUVERT</span>
        </div>
        <p className="don__lead">
          Gotham ne se protège pas toute seule. Le masque s&apos;use, la cape se froisse, le moral se négocie au kebab.
        </p>
        <ul className="don__list mono">
          <li>Entretien du masque en latex</li>
          <li>Carburant de la Batmobile (trottinette)</li>
          <li>Soutien psychologique face au calendrier</li>
        </ul>

        {hasAny ? (
          <div className="don__actions">
            {paypal && (
              <a className="btn btn--primary" href={paypal} target="_blank" rel="noopener noreferrer">
                Donner via PayPal
              </a>
            )}
            {weroUrl && (
              <a className="btn" href={weroUrl} target="_blank" rel="noopener noreferrer">
                Donner via Wero
              </a>
            )}
            {!weroUrl && weroId && (
              <button type="button" className="btn" onClick={copyWero}>
                Wero : copier l&apos;identifiant
              </button>
            )}
          </div>
        ) : (
          <p className="don__pending mono">
            <span className="feed__cursor" aria-hidden="true" /> COORDONNÉES BANCAIRES EN COURS DE VALIDATION PAR LE MINISTÈRE.
          </p>
        )}

        <p className="don__fine mono">
          Montant collecté : information classifiée. Rappel : les dons ne raccourcissent pas le compteur. Nous avons
          vérifié. Don volontaire entre potes ; le paiement se fait sur PayPal ou Wero, cette appli ne collecte aucune
          donnée.
        </p>
      </div>
    </section>
  );
}

export const Donation = memo(DonationImpl);
