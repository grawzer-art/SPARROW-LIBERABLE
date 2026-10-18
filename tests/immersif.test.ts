import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFS, loadPrefs, savePrefs } from "@/components/gotchi/uiMode";

const store = new Map<string, string>();
vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
afterEach(() => store.clear());

describe("Aventure immersive — réglages", () => {
  it("par défaut : commandes à 30 %, intro activée", () => {
    expect(DEFAULT_PREFS).toEqual({ padOpacity: 0.3, intro: true });
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });
  it("l'opacité reste entre 20 et 70 % ; l'intro peut être désactivée ; données abîmées ignorées", () => {
    savePrefs({ padOpacity: 0.5, intro: false });
    expect(loadPrefs()).toEqual({ padOpacity: 0.5, intro: false });
    store.set("sp.gotchi.ui", JSON.stringify({ padOpacity: 3 }));
    expect(loadPrefs().padOpacity).toBe(0.7);
    store.set("sp.gotchi.ui", JSON.stringify({ padOpacity: 0.01 }));
    expect(loadPrefs().padOpacity).toBe(0.2);
    store.set("sp.gotchi.ui", "{pas du json");
    expect(loadPrefs()).toEqual(DEFAULT_PREFS);
  });
});
