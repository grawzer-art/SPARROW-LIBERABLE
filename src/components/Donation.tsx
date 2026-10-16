import { memo } from "react";
import { DONATIONS } from "@/config";

/** Encart d'accueil vers la page /don. */
function DonationImpl() {
  const open = Boolean(DONATIONS.paypal);
  return (
    <section className="don reveal" aria-labelledby="don-title">
      <header className="section-head">
        <span className="section-head__num mono">08</span>
        <h2 id="don-title" className="section-head__title">Don pour le Chevalier Noir</h2>
      </header>

      <a className="don__card don__link" href="/don">
        <div className="don__head mono">
          <span>FONDS DE SOUTIEN · RÉF. BAT-2031</span>
          <span className="red">{open ? "OUVERT" : "BIENTÔT"}</span>
        </div>
        <p className="don__lead">
          Gotham ne se protège pas toute seule. Le masque s&apos;use, la cape se froisse, le moral se négocie au kebab.
        </p>
        <ul className="don__list mono">
          <li>Entretien du masque en latex</li>
          <li>Carburant de la Batmobile (trottinette)</li>
          <li>Soutien psychologique face au calendrier</li>
        </ul>
        <span className="btn btn--primary don__cta">Ouvrir la caisse de soutien →</span>
        <p className="don__fine mono">Don volontaire entre potes, via PayPal. Les dons ne raccourcissent pas le compteur.</p>
      </a>
    </section>
  );
}

export const Donation = memo(DonationImpl);
