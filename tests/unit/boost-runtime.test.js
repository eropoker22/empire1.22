import { describe, expect, it } from "vitest";
import { resolveButtonState } from "../../page-assets/js/app/boost-runtime.js";

describe("boost card button states", () => {
  it("keeps active effect countdowns out of boost card buttons", () => {
    expect(resolveButtonState({ isActive: true, isArmed: false, activeEndsAtMs: 120_000 }, {}, null, 0))
      .toEqual({ label: "AKTIVNÍ", deadline: null });
  });

  it("shows a red-blocked label without the active effect countdown", () => {
    expect(resolveButtonState({ disabledReason: "boost_already_active" }, { active: { expiresAtMs: 120_000 } }, null, 0))
      .toEqual({ label: "BLOKOVÁNO", deadline: null });
  });

  it("retains countdowns only for actual boost cooldowns", () => {
    expect(resolveButtonState({ disabledReason: "boost_on_cooldown", cooldownEndsAtMs: 120_000 }, {}, null, 0))
      .toEqual({ label: "COOLDOWN · 02:00", deadline: 120_000 });
  });
});
