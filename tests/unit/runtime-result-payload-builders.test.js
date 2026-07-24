import { describe, expect, it } from "vitest";
import {
  createResultPayloadBuilders,
  formatCombatLootLabel,
  pickRandomQuote,
  resolveAttackOutcomeMeta
} from "../../page-assets/js/app/runtime/resultPayloadBuilders.js";

function createBuilders(overrides = {}) {
  return createResultPayloadBuilders({
    currentPlayerId: 1,
    startPhaseOwnerByDistrictId: new Map([[2, 1], [3, 4]]),
    getLaunchPlayerName: (ownerId) => `Player ${ownerId}`,
    getStoredRegistration: () => ({ identity: "Erik" }),
    getAllianceLabel: () => "North Pact",
    getWorldState: () => ({
      ownedDistrictIds: [2],
      districtDefenseById: { 3: 100 },
      districtDefenseLoadoutById: { 3: { pistol: 2 } }
    }),
    getDistrictById: (districtId) => ({ id: districtId, districtType: "park" }),
    resolveDistrictBuildingProfile: () => ({ buildings: [{ displayName: "Factory" }] }),
    districtTypeMeta: { park: { label: "Park" }, resident: { label: "Resident" } },
    unknownAtmosphereMeta: { label: "Neznámá" },
    getDistrictAtmosphereMeta: () => ({ label: "Napjatá" }),
    resolvePoliceSpecialty: () => ({ key: "total", icon: "!", label: "Total" }),
    resolvePoliceOperationType: () => ({ specialtyKey: "total" }),
    resolveGangHeatTier: () => ({ id: 2 }),
    getGangState: () => ({ heat: 50 }),
    policeActionTierMessages: { 1: { tone: "low" }, 2: { tone: "mid" } },
    policeActionTierQuotes: { 2: ["Quote"] },
    policeDistrictClickWarningQuotes: ["Raid warning"],
    spyAllianceDetectionWarningQuotes: ["[ALLY] detected"],
    spyDetectionWarningQuotes: ["Spy detected"],
    spySuccessEmptyDistrictQuotes: ["Empty success"],
    spySuccessOccupiedDistrictQuotes: ["Occupied success"],
    spyMediumFailEmptyDistrictQuotes: ["Empty medium"],
    spyMediumFailOccupiedDistrictQuotes: ["Occupied medium"],
    spyMajorFailEmptyDistrictQuotes: ["Empty major"],
    spyMajorFailOccupiedDistrictQuotes: ["Occupied major"],
    spyCaptureCooldownMs: 40_000,
    formatDurationLabel: (value) => `${value}ms`,
    gangHeatPoliceDurationMs: 1000,
    formatDistrictReference: (districtId) => `District ${districtId}`,
    resolveDistrictNumericId: (value) => Number(value?.id ?? value?.districtId ?? value) || 0,
    now: () => 1_000,
    random: () => 0,
    ...overrides
  });
}

describe("result payload builders", () => {
  it("keeps pure combat labels and outcome metadata", () => {
    expect(formatCombatLootLabel("tech-core")).toBe("Tech Core");
    expect(formatCombatLootLabel("combat-module")).toBe("Bojový modul");
    expect(formatCombatLootLabel("neon-dust")).toBe("Neon Dust");
    expect(formatCombatLootLabel("pistol")).toBe("Pistole");
    expect(pickRandomQuote(["A"], "B", () => 0)).toBe("A");
    expect(resolveAttackOutcomeMeta("catastrophe").title).toBe("KATASTROFA");
  });

  it("builds spy result rows from readonly district state", () => {
    const rows = createBuilders().buildSpyResultRows(3, {}, { defensePower: 50 });

    expect(rows.map((row) => row.label)).toContain("Budovy");
    expect(rows.map((row) => row.label)).not.toContain("Odhad zbraní v districtu");
    expect(rows.find((row) => row.label === "Odhad síly obrany")?.value).toBe("80 až 120");
  });

  it("resolves ownership and player labels with fallbacks", () => {
    const builders = createBuilders();

    expect(builders.isCurrentPlayerOwnedDistrict(2)).toBe(true);
    expect(builders.getResultDistrictOwnerLabel(3)).toBe("Player 4");
    expect(builders.getCurrentPlayerGangLabel()).toBe("Erik Crew");
    expect(builders.getCurrentPlayerAllianceLabel()).toBe("North Pact");
  });

  it("creates live police and spy payloads without gameplay mutation", () => {
    const builders = createBuilders();
    const policePayload = builders.createOwnedDistrictPoliceRaidAlertPayload({ id: 2 }, {
      impact: { tierId: 2 },
      expiresAt: 2_000
    });
    const spyPayload = builders.createSpyDetectionAlertPayload(2);

    expect(policePayload.badge).toBe("");
    expect(policePayload.summary).toBe("Policie zasáhla tvůj district. Zkontroluj dopady a počkej na konec razie.");
    expect(policePayload.getRows()).toHaveLength(3);
    expect(policePayload.getRows().map((row) => row.label)).toEqual(["District", "Typ razie", "Konec za"]);
    expect(spyPayload.summary).toContain("North Pact");
    expect(spyPayload.detectedAt).toBe(1_000);
  });

  it("includes district identity in police district warning payloads", () => {
    const payload = createBuilders().createDistrictPoliceRaidWarningPayload({ id: 3 }, {
      impact: { tierId: 2 },
      expiresAt: 2_000
    });

    expect(payload.rows).toContainEqual({ label: "District", value: "District 3" });
  });

  it("builds a compact active-attack status payload", () => {
    const payload = createBuilders().createDistrictAttackInProgressPayload({ id: 3 }, {
      attackerDistrictId: 2,
      expiresAt: 2_000
    });

    expect(payload.title).toBe("Probíhá útok");
    expect(payload.hideBadge).toBe(true);
    expect(payload.hideSummary).toBe(true);
    expect(payload.rows.map((row) => row.label)).toEqual(["Útočník", "Obránce", "Konec boje"]);
  });

  it("creates attack result payloads without resolving gameplay outcome", () => {
    const payload = createBuilders().createAttackResultPayload({
      order: {
        estimatedAttackPower: 120,
        createdAt: new Date(1_000).toISOString(),
        resolveAt: new Date(3_000).toISOString()
      },
      targetDistrictId: 3,
      outcome: { key: "total-success", capturesDistrict: true, destroysDistrict: false },
      deployedMembers: 10,
      memberLoss: 2,
      currentDefense: 100,
      nextDefense: 50
    });

    expect(payload.title).toBe("TOTÁLNÍ ÚSPĚCH");
    expect(payload.attackerLossesLabel).toBe("20%");
    expect(payload.defenderLossesLabel).toBe("50%");
    expect(payload.districtStateValue).toBe("Obsazený");
    expect(payload.heatGainedLabel).toBe("Police feed");
    expect(payload.policeWarningLabel).toBe("Sleduj police feed");
  });

  it("keeps explicit attack heat values when core/runtime payload provides them", () => {
    const payload = createBuilders().createAttackResultPayload({
      order: {
        estimatedAttackPower: 120,
        heatAdded: 8,
        createdAt: new Date(1_000).toISOString(),
        resolveAt: new Date(3_000).toISOString()
      },
      targetDistrictId: 3,
      outcome: { key: "failure", capturesDistrict: false, destroysDistrict: false },
      deployedMembers: 10,
      memberLoss: 2,
      currentDefense: 100,
      nextDefense: 80
    });

    expect(payload.heatGainedLabel).toBe("+8");
    expect(payload.policeWarningLabel).toBe("Heat zvýšen, sleduj police feed");
  });

  it("creates robbery result payloads for loot and empty outcomes", () => {
    const builders = createBuilders();
    const withLoot = builders.createRobberyResultPayload({
      order: { targetDistrictId: 5, createdAt: new Date(1_000).toISOString(), resolveAt: new Date(2_000).toISOString() },
      deployedMembers: 5,
      memberLoss: 0,
      lootEntries: [["tech-core", 1]],
      successChance: 75
    });
    const withoutLoot = builders.createRobberyResultPayload({
      order: { targetDistrictId: 5, createdAt: new Date(1_000).toISOString(), resolveAt: new Date(2_000).toISOString() },
      deployedMembers: 5,
      memberLoss: 5,
      lootEntries: []
    });

    expect(withLoot.raidTone).toBe("is-clean-success");
    expect(withLoot.raidResultPayload.title).toBe("VYKRÁST DISTRICT: ČISTÝ LOOT");
    expect(withLoot.raidResultPayload.summary).toContain("Území se neobsazuje");
    expect(withLoot.raidResultPayload.rows).not.toContainEqual({ label: "Akce", value: "Vykrást district" });
    expect(withLoot.raidResultPayload.rows.map((row) => row.label)).not.toContain("Šance");
    expect(withLoot.raidResultPayload.rows.some((row) => row.value === "Tech Core x1")).toBe(true);
    expect(withoutLoot.raidTone).toBe("is-disaster");
    expect(withoutLoot.raidResultPayload.title).toBe("VYKRÁST DISTRICT: BEZ LOOTU");
  });

  it("creates spy result payloads for success and capture states", () => {
    const builders = createBuilders();
    const success = builders.createSpyResultPayload({
      mission: { targetDistrictId: 3 },
      scenarioLabel: "Úspěch",
      knownDefensePower: 100,
      isUnownedDistrict: false
    });
    const captured = builders.createSpyResultPayload({
      mission: { targetDistrictId: 3 },
      scenarioLabel: "Neúspěch",
      isUnownedDistrict: true
    });
    const partial = builders.createSpyResultPayload({
      mission: { targetDistrictId: 3 },
      scenarioLabel: "Částečný úspěch",
      isUnownedDistrict: true
    });
    const critical = builders.createSpyResultPayload({
      mission: { targetDistrictId: 3 },
      scenarioLabel: "Kritický neúspěch",
      isUnownedDistrict: true,
      heatGain: 7
    });

    expect(success.summary).toBe("Occupied success");
    expect(success.rows.map((row) => row.label)).toContain("Odhad síly obrany");
    expect(partial.rows.find((row) => row.label === "Budovy")).toMatchObject({
      value: "Nezjištěno",
      fullWidth: true
    });
    expect(captured.rows).toEqual([
      { label: "Stav špeha", value: "Zajat" },
      { label: "Cooldown", value: "40000ms", nowrap: true, countdownUntil: 41000 }
    ]);
    expect(critical.title).toBe("Špehování: Kritický neúspěch");
    expect(critical.rows).toContainEqual({ label: "Heat", value: "+7" });
  });
});
