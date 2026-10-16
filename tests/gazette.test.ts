import { describe, expect, it } from "vitest";
import data from "@/data/gazette/titres.json";
import speciales from "@/data/gazette/speciales.json";
import {
  LANCEMENT,
  PALIERS,
  RUBRIQUES,
  TOUS_TITRES,
  addDays,
  archives,
  editionDu,
  editionNumber,
  joursRestants,
  parisDate,
  titreParId,
} from "@/lib/gazette/edition";
import { END_MS } from "@/lib/time";

const tout = JSON.stringify(data) + JSON.stringify(speciales);

describe("rédaction", () => {
  it("au moins 50 titres, identifiants uniques, rubriques valides", () => {
    expect(TOUS_TITRES.length).toBeGreaterThanOrEqual(50);
    const ids = [...data.titres, ...data.breves].map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TOUS_TITRES) expect(Object.keys(RUBRIQUES)).toContain(t.rubrique);
  });
  it("chaque rubrique est fournie", () => {
    for (const r of Object.keys(RUBRIQUES)) expect(TOUS_TITRES.filter((t) => t.rubrique === r).length).toBeGreaterThanOrEqual(10);
  });
  it("des titres, pas des articles", () => {
    for (const t of TOUS_TITRES) expect(t.titre.length).toBeLessThanOrEqual(150);
  });
  it("respect de la vie privée : jamais le mot interdit", () => {
    expect(tout.toLowerCase()).not.toContain("sursis");
  });
  it("typographie : jamais de guillemet ou de deux-points orphelin en début de ligne", () => {
    for (const t of TOUS_TITRES) {
      expect(t.titre).not.toMatch(/ [»:;?!]/);
      expect(t.titre).not.toMatch(/« /);
    }
  });
  it("dates de publication au bon format", () => {
    for (const t of [...data.titres, ...data.breves]) expect(t.ajout).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("éditions", () => {
  it("numérotation à partir du lancement", () => {
    expect(editionNumber(LANCEMENT)).toBe(1);
    expect(editionNumber(addDays(LANCEMENT, 30))).toBe(31);
  });
  it("déterministe et sans doublon dans une même édition", () => {
    const a = editionDu("2027-03-14");
    const b = editionDu("2027-03-14");
    expect(a).toEqual(b);
    const ids = [a.une.id, ...a.titres.map((t) => t.id)];
    expect(new Set(ids).size).toBe(ids.length);
    expect(a.breves).toHaveLength(4);
  });
  it("variété : au plus 2 titres par rubrique dans une édition", () => {
    for (let i = 0; i < 60; i++) {
      const e = editionDu(addDays("2026-10-16", i));
      const counts: Record<string, number> = {};
      for (const t of [e.une, ...e.titres]) counts[t.rubrique] = (counts[t.rubrique] ?? 0) + 1;
      expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(2);
    }
  });
  it("la une change d'un jour à l'autre", () => {
    const unes = new Set(Array.from({ length: 30 }, (_, i) => editionDu(addDays("2027-01-10", i)).une.id));
    expect(unes.size).toBeGreaterThanOrEqual(25);
  });
  it("un titre ajouté plus tard ne modifie pas les archives", () => {
    const avant = editionDu("2026-11-01");
    TOUS_TITRES.push({ id: "test-futur", rubrique: "vdm", ajout: "2030-01-01", titre: "Titre du futur" });
    try {
      expect(editionDu("2026-11-01")).toEqual(avant);
    } finally {
      TOUS_TITRES.pop();
    }
  });
  it("éditions spéciales datées", () => {
    expect(editionDu("2026-12-25").speciale).toBe("ÉDITION DE NOËL");
    const histo = editionDu("2031-10-12");
    expect(histo.speciale).toBe("ÉDITION HISTORIQUE");
  });
  it("éditions DERNIÈRE MINUTE aux paliers du compte à rebours", () => {
    const veille = parisDate(END_MS - 12 * 3_600_000);
    expect(joursRestants(veille)).toBe(1);
    const e = editionDu(veille);
    expect(e.speciale).toBe("DERNIÈRE MINUTE · J-1");
    expect(e.flash?.id).toBe("pa-1");
    expect(titreParId("pa-1")?.titre).toBe(e.une.titre);
    for (const j of PALIERS) expect(titreParId(`pa-${j}`)).not.toBeNull();
  });
  it("archives : du plus récent au lancement", () => {
    const a = archives("2026-10-20");
    expect(a.map((x) => x.date)).toEqual(["2026-10-20", "2026-10-19", "2026-10-18", "2026-10-17", "2026-10-16"]);
    expect(a.at(-1)?.speciale).toBe("ÉDITION INAUGURALE");
  });
  it("tous les identifiants se retrouvent (liens partagés)", () => {
    for (const t of TOUS_TITRES) expect(titreParId(t.id)?.titre).toBe(t.titre);
    expect(titreParId("es-2026-12-25")).not.toBeNull();
    expect(titreParId("inconnu")).toBeNull();
  });
});
