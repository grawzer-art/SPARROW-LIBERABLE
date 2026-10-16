import { describe, expect, it } from "vitest";
import { END_MS, START_MS, TOTAL_DAYS, msUntilNextTick, remaining, tzOffsetMs, zonedToUtc } from "@/lib/time";

const H = 3600_000;
const D = 24 * H;

describe("instants officiels", () => {
  it("début : 12/10/2026 00:00 Paris = 11/10/2026 22:00 UTC (heure d'été)", () => {
    expect(new Date(START_MS).toISOString()).toBe("2026-10-11T22:00:00.000Z");
  });
  it("fin : 12/10/2031 00:00 Paris = 11/10/2031 22:00 UTC (heure d'été)", () => {
    expect(new Date(END_MS).toISOString()).toBe("2031-10-11T22:00:00.000Z");
  });
  it("durée totale : 1 826 jours (2028 bissextile)", () => {
    expect(TOTAL_DAYS).toBe(1826);
    expect(END_MS - START_MS).toBe(1826 * D);
  });
});

describe("fuseau Europe/Paris", () => {
  it("hiver = UTC+1, été = UTC+2", () => {
    expect(tzOffsetMs(Date.UTC(2027, 0, 15), "Europe/Paris")).toBe(H);
    expect(tzOffsetMs(Date.UTC(2027, 6, 15), "Europe/Paris")).toBe(2 * H);
  });
  it("conversion d'heures murales en hiver", () => {
    expect(new Date(zonedToUtc("2030-01-01", "00:00")).toISOString()).toBe("2029-12-31T23:00:00.000Z");
  });
  it("heure de fin modifiable (ex. 14:30)", () => {
    expect(new Date(zonedToUtc("2031-10-12", "14:30")).toISOString()).toBe("2031-10-12T12:30:00.000Z");
  });
});

describe("compte à rebours", () => {
  it("au départ : 1826 j 00:00:00", () => {
    const r = remaining(START_MS);
    expect([r.days, r.hours, r.minutes, r.seconds]).toEqual([1826, 0, 0, 0]);
    expect(r.progress).toBe(0);
  });
  it("une seconde après le départ : 1825 j 23:59:59", () => {
    const r = remaining(START_MS + 1000);
    expect([r.days, r.hours, r.minutes, r.seconds]).toEqual([1825, 23, 59, 59]);
  });
  it("à l'instant cible : zéro et terminé", () => {
    const r = remaining(END_MS);
    expect([r.days, r.hours, r.minutes, r.seconds]).toEqual([0, 0, 0, 0]);
    expect(r.done).toBe(true);
    expect(r.progress).toBe(1);
  });
  it("1 ms avant la cible : encore 1 seconde affichée, pas terminé", () => {
    const r = remaining(END_MS - 1);
    expect(r.seconds).toBe(1);
    expect(r.done).toBe(false);
  });
  it("après la cible : reste à zéro", () => {
    const r = remaining(END_MS + 10 * D);
    expect(r.ms).toBe(0);
    expect(r.done).toBe(true);
  });
  it("changement d'année 2029 → 2030 (minuit Paris)", () => {
    const newYear = zonedToUtc("2030-01-01", "00:00");
    const before = remaining(newYear - 1000);
    const at = remaining(newYear);
    expect(before.ms - at.ms).toBe(1000);
    // 12/10/2031 00:00 CEST - 01/01/2030 00:00 CET : 649 jours moins 1 h (passage à l'heure d'été)
    expect(at.days).toBe(648);
    expect(at.hours).toBe(23);
  });
  it("passage à l'heure d'été (30/03/2031 02:00 → 03:00) : aucune heure perdue dans le décompte", () => {
    const before = Date.UTC(2031, 2, 30, 0, 59, 59); // 01:59:59 CET
    const after = before + 1000; // 03:00:00 CEST
    expect(tzOffsetMs(before, "Europe/Paris")).toBe(H);
    expect(tzOffsetMs(after, "Europe/Paris")).toBe(2 * H);
    expect(remaining(before).ms - remaining(after).ms).toBe(1000);
  });
  it("passage à l'heure d'hiver (26/10/2031 n'affecte pas, test 27/10/2030)", () => {
    const before = Date.UTC(2030, 9, 27, 0, 59, 59); // 02:59:59 CEST
    const after = before + 1000; // 02:00:00 CET
    expect(tzOffsetMs(after, "Europe/Paris")).toBe(H);
    expect(remaining(before).ms - remaining(after).ms).toBe(1000);
  });
  it("29 février 2028 compté", () => {
    const feb28 = zonedToUtc("2028-02-28", "12:00");
    const mar1 = zonedToUtc("2028-03-01", "12:00");
    expect(remaining(feb28).days - remaining(mar1).days).toBe(2);
  });
  it("progression à mi-parcours ≈ 50 %", () => {
    expect(remaining(START_MS + (END_MS - START_MS) / 2).progress).toBeCloseTo(0.5, 6);
  });
});

describe("cadence sans dérive", () => {
  it("se recale sur la frontière de seconde", () => {
    expect(msUntilNextTick(END_MS - 2_300)).toBe(305);
    expect(msUntilNextTick(END_MS - 2_000)).toBe(1005);
  });
});

import { parisDayIndex } from "@/lib/calendar";
import { QUOTES } from "@/data/quotes";

describe("citation du jour", () => {
  it("change à minuit heure de Paris (pas UTC)", () => {
    const before = zonedToUtc("2027-03-05", "23:59");
    const after = zonedToUtc("2027-03-06", "00:00");
    expect(parisDayIndex(after) - parisDayIndex(before)).toBe(1);
    expect(parisDayIndex(START_MS)).toBe(0);
  });
  it("au moins 20 citations", () => {
    expect(QUOTES.length).toBeGreaterThanOrEqual(20);
  });
});
