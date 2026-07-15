import { describe, expect, it } from "vitest";
import { createFreeModeConfig } from "../../../packages/game-config/src/factories/create-free-mode-config";
import { validateModeConfig } from "../../../packages/game-config/src/validation/validate-mode-config";
import { createReplacementValueResolver } from "../../../packages/game-core/src/rules/economy/replacementValue";

describe("free mode City Event config", () => {
  const config = createFreeModeConfig();
  const cityEvents = config.balance.cityEvents!;

  it("defines the approved Victor, Leon and Nyra schedules", () => {
    expect(cityEvents.agents.victor).toMatchObject({
      requiredInfluence: 0,
      offerCount: 3,
      refreshTimes: [{ hour: 18, minute: 0 }, { hour: 22, minute: 0 }, { hour: 2, minute: 0 }],
      availability: { opensAt: { hour: 18, minute: 0 }, closesAt: { hour: 4, minute: 0 } }
    });
    expect(cityEvents.agents.leon).toMatchObject({
      requiredInfluence: 100,
      refreshTimes: [{ hour: 10, minute: 0 }, { hour: 22, minute: 0 }]
    });
    expect(cityEvents.agents.nyra).toMatchObject({
      requiredInfluence: 300,
      refreshTimes: [{ hour: 6, minute: 0 }, { hour: 14, minute: 0 }, { hour: 22, minute: 0 }],
      dossierSlot: { standardOfferCount: 2, rareEligibleHour: 22 }
    });
  });

  it("validates all 300 canonical definitions and their replacement-value budgets", () => {
    expect(() => validateModeConfig(config)).not.toThrow();
    expect(cityEvents.definitions).toHaveLength(300);
    expect(new Set(cityEvents.definitions.map((event) => event.id))).toHaveLength(300);
    for (const agentId of ["victor", "leon", "nyra"] as const) {
      expect(cityEvents.definitions.filter((event) => event.agentId === agentId)).toHaveLength(100);
    }
    const resolver = createReplacementValueResolver(config);
    expect(resolver.resolve("metal-parts")).toBe(300);
    expect(resolver.resolve("tech-core")).toBe(2_100);
    expect(resolver.resolve("combat-module")).toBe(7_900);
  });

  it("contains no legacy reward aliases or common Bazooka/Defense Tower giveaways", () => {
    const forbidden = new Set([
      "ammo", "spyGear", "intel", "streetPistol", "chemical", "metalParts", "techCore",
      "overdriveX", "ghostSerum", "velvetSmoke", "securityCameras", "bazooka", "defense-tower"
    ]);
    for (const definition of cityEvents.definitions) {
      expect(Object.keys(definition.reward).some((key) => forbidden.has(key))).toBe(false);
    }
  });
});
