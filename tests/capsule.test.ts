import { describe, expect, it } from "vitest";
import {
  ARCHIVE_YEARS,
  BACKUP_KIND,
  MAX_BODY,
  OPEN_MS,
  archiveOpensAt,
  capsuleYearOf,
  emptyCapsule,
  isOpen,
  makeBackup,
  mergeLetters,
  needsBackup,
  normalize,
  parseBackup,
  sealLetter,
} from "@/lib/capsule/model";
import { END_MS, START_MS } from "@/lib/time";

const draft = { author: "Max", body: "Salut le Sparrow de 2031.", tone: "emouvant" as const };

describe("capsule — ouverture", () => {
  it("s'ouvre exactement au même instant que le compte à rebours", () => {
    expect(OPEN_MS).toBe(END_MS);
    expect(isOpen(END_MS - 1)).toBe(false);
    expect(isOpen(END_MS)).toBe(true);
  });
  it("archives annuelles le 12 octobre à minuit, heure de Paris", () => {
    expect(new Date(archiveOpensAt(2027)).toISOString()).toBe("2027-10-11T22:00:00.000Z");
    expect(archiveOpensAt(2031)).toBe(END_MS);
    expect(ARCHIVE_YEARS).toEqual([2027, 2028, 2029, 2030, 2031]);
  });
  it("année de capsule", () => {
    expect(capsuleYearOf(START_MS)).toBe(1);
    expect(capsuleYearOf(archiveOpensAt(2027) - 1)).toBe(1);
    expect(capsuleYearOf(archiveOpensAt(2027))).toBe(2);
    expect(capsuleYearOf(END_MS + 1000)).toBe(5);
  });
});

describe("capsule — lettres", () => {
  it("scelle une lettre avec ouverture le 12/10/2031", () => {
    const l = sealLetter(draft, START_MS);
    expect(l.openAt).toBe(new Date(END_MS).toISOString());
    expect(l.author).toBe("Max");
    expect(l.origin).toBe("local");
  });
  it("tronque les lettres trop longues", () => {
    const l = sealLetter({ ...draft, body: "x".repeat(MAX_BODY + 50) }, START_MS);
    expect(l.body.length).toBe(MAX_BODY);
  });
  it("signature vide → Anonyme", () => {
    expect(sealLetter({ ...draft, author: "  " }, START_MS).author).toBe("Anonyme");
  });
});

describe("capsule — sauvegardes", () => {
  it("export puis import : aller-retour sans perte", () => {
    const a = sealLetter(draft, START_MS);
    const b = sealLetter({ ...draft, body: "Deuxième lettre" }, START_MS + 1000);
    const text = JSON.stringify(makeBackup([a, b], START_MS));
    const res = parseBackup(text);
    expect("letters" in res && res.letters).toEqual([a, b]);
  });
  it("fusion sans doublons", () => {
    const a = sealLetter(draft, START_MS);
    const b = sealLetter({ ...draft, body: "B" }, START_MS + 5);
    const { letters, added } = mergeLetters([a], [a, b]);
    expect(letters.map((l) => l.id)).toEqual([a.id, b.id]);
    expect(added).toBe(1);
  });
  it("refuse un fichier étranger ou corrompu", () => {
    expect("error" in parseBackup("pas du json")).toBe(true);
    expect("error" in parseBackup(JSON.stringify({ kind: "autre", letters: [] }))).toBe(true);
  });
  it("ignore les lettres invalides et interdit d'avancer la date d'ouverture", () => {
    const good = sealLetter(draft, START_MS);
    const cheat = { ...sealLetter(draft, START_MS), openAt: "2027-01-01T00:00:00.000Z" };
    const text = JSON.stringify({ kind: BACKUP_KIND, version: 1, letters: [good, cheat, { id: "x" }, null] });
    const res = parseBackup(text);
    if (!("letters" in res)) throw new Error(res.error);
    expect(res.letters).toHaveLength(2);
    expect(res.letters.every((l) => Date.parse(l.openAt) >= END_MS)).toBe(true);
  });
  it("rappel de sauvegarde quand des lettres n'ont jamais été exportées", () => {
    const data = { ...emptyCapsule(), letters: [sealLetter(draft, START_MS)], updatedAt: "2026-10-16T10:00:00.000Z" };
    expect(needsBackup(data)).toBe(true);
    expect(needsBackup({ ...data, lastExportAt: "2026-10-16T11:00:00.000Z" })).toBe(false);
  });
  it("normalise des données abîmées", () => {
    const n = normalize({ letters: [{ nope: 1 }], attempts: -4, draft: { tone: "inconnu" } });
    expect(n.letters).toEqual([]);
    expect(n.attempts).toBe(0);
    expect(n.draft.tone).toBe("vanne");
  });
});
