import { describe, expect, it } from "vitest";
import { dueMilestone } from "@/data/milestones";

const D = 86_400_000;

describe("caps symboliques", () => {
  it("annonce le cap juste franchi", () => {
    expect(dueMilestone(999.5 * D, [])?.id).toBe("d1000");
  });
  it("ne réannonce pas un cap déjà vu", () => {
    expect(dueMilestone(999.5 * D, ["d1000"])).toBeNull();
  });
  it("n'annonce pas un cap franchi il y a longtemps (nouvel utilisateur)", () => {
    expect(dueMilestone(900 * D, [])).toBeNull();
  });
  it("dernières 24 h", () => {
    expect(dueMilestone(20 * 3_600_000, [])?.id).toBe("h24");
  });
  it("rien une fois terminé", () => {
    expect(dueMilestone(0, [])).toBeNull();
  });
});
