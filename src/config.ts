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
