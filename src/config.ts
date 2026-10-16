/**
 * ─────────────────────────────────────────────────────────────
 *  RÉGLAGES OFFICIELS DU DOSSIER SP-2031
 * ─────────────────────────────────────────────────────────────
 *  Pour changer l'heure de fin : modifier END.time ci-dessous
 *  (format 24 h "HH:MM"), puis commit. Vercel redéploie seul.
 *  Les dates sont interprétées dans le fuseau TIMEZONE, heure
 *  d'été comprise. Tous les téléphones visent le même instant.
 */

export const TIMEZONE = "Europe/Paris";

export const START = { date: "2026-10-12", time: "00:00" } as const;
export const END = { date: "2031-10-12", time: "00:00" } as const;

export const CASE_NUMBER = "SP-2031";
export const APP_NAME = "SPARROW EST LIBÉRABLE";
export const SHORT_NAME = "SPARROW";

/**
 * ─────────────────────────────────────────────────────────────
 *  CAISSE DE SOUTIEN AU CHEVALIER NOIR
 * ─────────────────────────────────────────────────────────────
 *  Laisser une valeur vide ("") pour masquer le bouton correspondant.
 *  - paypal    : lien complet, ex. "https://paypal.me/pseudo"
 *  - weroUrl   : lien de paiement Wero s'il existe (sinon "")
 *  - weroId    : numéro de téléphone ou e-mail Wero, copié au toucher
 *  ⚠ Ces informations sont publiques (site et dépôt GitHub publics).
 */
export const DONATIONS: { paypal: string; weroUrl: string; weroId: string } = {
  paypal: "",
  weroUrl: "",
  weroId: "",
};
