import { SpritePreview } from "./game/SpritePreview";

/** Encart d'accueil vers le mini jeu /jeu. */
export function ArcadeTeaser() {
  return (
    <section className="arc reveal" aria-labelledby="arc-title">
      <header className="section-head">
        <span className="section-head__num mono">06</span>
        <h2 id="arc-title" className="section-head__title">Salle d&apos;arcade</h2>
        <span className="section-head__meta mono">1 JOUEUR</span>
      </header>
      <a href="/jeu" className="arc__card">
        <div className="arc__sprites" aria-hidden="true">
          <SpritePreview skin="lunettes" scale={4} />
          <SpritePreview skin="lili" scale={4} />
        </div>
        <div className="arc__txt">
          <p className="mono arc__kicker">NOUVEAU · JEU RÉTRO 8-BIT</p>
          <p className="arc__title">L&apos;Évasion de Sparrow</p>
          <p className="mono arc__desc">Lili lui court après. Saute les calendriers, esquive les lundis, mange des frites. Inscris ton nom au classement.</p>
          <span className="btn btn--primary arc__cta">▶ Insert coin</span>
        </div>
      </a>
    </section>
  );
}
