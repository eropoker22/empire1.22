import { describe, expect, it } from "vitest";
import { restoreBuildingActionEntries } from "../../page-assets/js/app/ui/eventFeedPanel.js";

describe("street news persistence", () => {
  it("restores regular messages and drops expired cooldown and police raid entries", () => {
    const now = 1_000_000;
    const restored = restoreBuildingActionEntries([
      { id: "regular", tone: "success", title: "Výběr", summary: "Cash", timestampMs: now - 10 },
      { id: "expired", tone: "event", title: "Cooldown", summary: "Čekání", timestampMs: now - 20, expiresAt: now - 1 },
      { id: "expired-raid", tone: "warning", title: "Policejní razie", summary: "Dopady razie", sourceKind: "police-raid", timestampMs: now - 20, expiresAt: now - 1 },
      { id: "legacy-raid", tone: "warning", title: "Policejní zásah", summary: "Dopady razie", timestampMs: now - 20 },
      { id: "active", tone: "event", title: "Cooldown", summary: "Čekání", timestampMs: now - 30, expiresAt: now + 1 }
    ], now);

    expect(restored.map((entry) => entry.id)).toEqual(["regular", "active"]);
  });
});
