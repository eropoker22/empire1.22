import type { FactionPassiveModifiers } from "@empire/shared-types";
import { FACTION_PASSIVE_MODIFIER_KEYS } from "@empire/shared-types";

export type FactionPassiveModifierUsageStatus = "active" | "partial" | "planned";

export interface FactionPassiveModifierUsage {
  key: keyof FactionPassiveModifiers;
  status: FactionPassiveModifierUsageStatus;
  surfaces: string[];
  note: string;
}

export const FACTION_PASSIVE_MODIFIER_USAGE: Record<
  keyof FactionPassiveModifiers,
  FactionPassiveModifierUsage
> = {
  cleanIncomeMultiplier: {
    key: "cleanIncomeMultiplier",
    status: "active",
    surfaces: [
      "packages/game-core/src/rules/economy/calculateIncome.ts: district resource income",
      "packages/game-core/src/rules/economy/calculateIncome.ts: fixed building income"
    ],
    note: "Aplikuje se na cash income z district modifiers i fixed budov."
  },
  dirtyIncomeMultiplier: {
    key: "dirtyIncomeMultiplier",
    status: "active",
    surfaces: [
      "packages/game-core/src/rules/economy/calculateIncome.ts: district dirty income",
      "packages/game-core/src/rules/economy/calculateIncome.ts: fixed building dirty income"
    ],
    note: "Aplikuje se na dirty-cash income z district modifiers i fixed budov."
  },
  productionMultiplier: {
    key: "productionMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/rules/production/completeProduction.ts"],
    note: "Obecný násobič produkce pro productionBuildings."
  },
  illegalProductionMultiplier: {
    key: "illegalProductionMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/rules/factions/factionRules.ts: illegal production building set"],
    note: "Aktivní pro drug_lab, smuggling_tunnel a street_dealers, pokud produkují přes productionBuildings."
  },
  smugglingIncomeMultiplier: {
    key: "smugglingIncomeMultiplier",
    status: "active",
    surfaces: [
      "packages/game-core/src/handlers/smugglingTunnelBuildingActions.ts",
      "packages/game-core/src/rules/economy/fixedBuildingIncomeConfig.ts"
    ],
    note: "Aplikuje se na dirty income z pasivního Smuggling Tunnel výpočtu."
  },
  techProductionMultiplier: {
    key: "techProductionMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/rules/factions/factionRules.ts: tech resource set"],
    note: "Aktivní pro tech-core, data a intel resources."
  },
  heatGainMultiplier: {
    key: "heatGainMultiplier",
    status: "active",
    surfaces: [
      "packages/game-core/src/handlers/attackDistrict.ts",
      "packages/game-core/src/rules/heists/heistSystem.ts",
      "packages/game-core/src/handlers/useBuildingAction.ts",
      "packages/game-core/src/rules/economy/collectIncome.ts: fixed building passive pressure"
    ],
    note: "Aplikuje se na attack/heist heat, building action heat a pasivní heat z fixed budov. Occupy heat používá jen aggressiveActionHeatGainMultiplier."
  },
  illegalActionHeatGainMultiplier: {
    key: "illegalActionHeatGainMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/handlers/useBuildingAction.ts"],
    note: "Aplikuje se na building action heat pro drug_lab, smuggling_tunnel a street_dealers přes centrální faction helper."
  },
  influenceGainMultiplier: {
    key: "influenceGainMultiplier",
    status: "active",
    surfaces: [
      "packages/game-core/src/handlers/useBuildingAction.ts",
      "packages/game-core/src/rules/economy/collectIncome.ts: fixed building passive pressure"
    ],
    note: "Aplikuje se jen na pozitivní influence gain."
  },
  spySuccessChanceBonus: {
    key: "spySuccessChanceBonus",
    status: "active",
    surfaces: ["packages/game-core/src/handlers/spyDistrict.ts"],
    note: "Aditivní bonus v p. b. přes applyFactionChanceBonus."
  },
  spyInfoQualityMultiplier: {
    key: "spyInfoQualityMultiplier",
    status: "planned",
    surfaces: [],
    note: "Definováno pro Tajnou organizaci, ale spy report zatím nemá škálovanou quality vrstvu nad success/failure výsledkem."
  },
  trapDetectionChanceBonus: {
    key: "trapDetectionChanceBonus",
    status: "active",
    surfaces: ["packages/game-core/src/handlers/spyDistrict.ts"],
    note: "Aditivní bonus k trap reveal šanci při úspěšném spy reportu přes capped faction helper."
  },
  secretActionHeatGainMultiplier: {
    key: "secretActionHeatGainMultiplier",
    status: "planned",
    surfaces: [],
    note: "Definováno pro Tajnou organizaci, ale secret/spy/infiltration akce zatím nemají jednotný heat gain kontext."
  },
  attackPowerMultiplier: {
    key: "attackPowerMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/handlers/attackDistrict.ts"],
    note: "Aplikuje se na attacker power po trap/effect výpočtu."
  },
  defensePowerMultiplier: {
    key: "defensePowerMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/handlers/attackDistrict.ts"],
    note: "Aplikuje se na defender power po district efektech."
  },
  baseDefensePowerMultiplier: {
    key: "baseDefensePowerMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/handlers/attackDistrict.ts"],
    note: "Aplikuje se na základní defense položky bez kamer a alarmů v district attack flow."
  },
  cameraEffectivenessMultiplier: {
    key: "cameraEffectivenessMultiplier",
    status: "active",
    surfaces: [
      "packages/game-core/src/handlers/attackDistrict.ts",
      "packages/game-core/src/handlers/spyDistrict.ts"
    ],
    note: "Aplikuje se na účinnost kamer v combat defense a proti spy pokusům."
  },
  alarmEffectivenessMultiplier: {
    key: "alarmEffectivenessMultiplier",
    status: "active",
    surfaces: [
      "packages/game-core/src/handlers/attackDistrict.ts",
      "packages/game-core/src/handlers/spyDistrict.ts"
    ],
    note: "Aplikuje se na účinnost alarmů v combat defense a proti spy pokusům."
  },
  occupyPowerMultiplier: {
    key: "occupyPowerMultiplier",
    status: "planned",
    surfaces: [],
    note: "Definováno pro Soukromou armádu, ale occupy je zatím binární claim po spy reportu bez power/chance výpočtu."
  },
  attackDurationMultiplier: {
    key: "attackDurationMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/handlers/attackDistrict.ts"],
    note: "Aplikuje se na výsledný attack cooldown/duration po day-night a building redukcích."
  },
  robberyCooldownMultiplier: {
    key: "robberyCooldownMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/rules/heists/heistSystem.ts"],
    note: "Aplikuje se centrálně na global i same-target cooldown po district heistu."
  },
  attackCooldownMultiplier: {
    key: "attackCooldownMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/handlers/attackDistrict.ts"],
    note: "Aplikuje se centrálně na attack cooldown spolu se starším attackDurationMultiplier."
  },
  occupyCooldownMultiplier: {
    key: "occupyCooldownMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/handlers/occupyDistrict.ts"],
    note: "Aplikuje se na cooldown obsazení neutrálního districtu po úspěšném spy intel."
  },
  robberyDirtyCashLootMultiplier: {
    key: "robberyDirtyCashLootMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/rules/heists/heistSystem.ts"],
    note: "Aplikuje se pouze na dirty-cash složku district heist lootu."
  },
  robberyLootMultiplier: {
    key: "robberyLootMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/rules/heists/heistSystem.ts"],
    note: "Aplikuje se centrálně na clean cash, dirty cash a resource loot z district heistu."
  },
  aggressiveActionHeatGainMultiplier: {
    key: "aggressiveActionHeatGainMultiplier",
    status: "active",
    surfaces: [
      "packages/game-core/src/handlers/attackDistrict.ts",
      "packages/game-core/src/handlers/occupyDistrict.ts",
      "packages/game-core/src/rules/heists/heistSystem.ts"
    ],
    note: "Aplikuje se na heat z útoků, obsazování a district heist start/outcome heat."
  },
  defenseSystemEffectivenessMultiplier: {
    key: "defenseSystemEffectivenessMultiplier",
    status: "active",
    surfaces: [
      "packages/game-core/src/handlers/attackDistrict.ts",
      "packages/game-core/src/handlers/spyDistrict.ts"
    ],
    note: "Aplikuje se na efekt kamer a alarmů při obraně districtu a proti spy pokusům."
  },
  populationGenerationMultiplier: {
    key: "populationGenerationMultiplier",
    status: "active",
    surfaces: [
      "packages/game-core/src/handlers/apartmentBlockBuildingActions.ts",
      "packages/game-core/src/handlers/schoolBuildingActions.ts"
    ],
    note: "Aplikuje se centrálně na lokální generování populace v Apartment Blocku a studentů ve Škole."
  },
  // TODO(factions): Wire this once rumor/suspicion generation has one central faction-aware helper.
  rumorGenerationMultiplier: {
    key: "rumorGenerationMultiplier",
    status: "planned",
    surfaces: [],
    note: "Definováno pro Kult jako budoucí tlak na drby/podezření; rumor generace zatím nemá jednotný faction-aware helper."
  },
  equipmentLossMultiplier: {
    key: "equipmentLossMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/handlers/attackDistrict.ts"],
    note: "Aplikuje se na attacker equipment losses v district attack flow před escape/recovery mitigací."
  },
  marketFeeMultiplier: {
    key: "marketFeeMultiplier",
    status: "planned",
    surfaces: [],
    note: "Definováno pro Hackery/Korporaci, zatím nenapojeno na serverMarketSystem fee výpočty."
  },
  rumorTruthMultiplier: {
    key: "rumorTruthMultiplier",
    status: "active",
    surfaces: ["packages/game-core/src/rules/events/rumorPipeline.ts"],
    note: "Aplikuje se na truthChancePct u faction-owned rumor events přes capped multiplier; negarantuje 100% pravdu."
  },
  upkeepCostMultiplier: {
    key: "upkeepCostMultiplier",
    status: "planned",
    surfaces: [],
    note: "Kontrakt je definovaný pro Soukromou armádu, ale žádný upkeep/combat-cost systém ho zatím neaplikuje."
  }
};

export const listFactionPassiveModifierUsage = (): FactionPassiveModifierUsage[] =>
  FACTION_PASSIVE_MODIFIER_KEYS.map((key) => FACTION_PASSIVE_MODIFIER_USAGE[key]);

export const listUnusedPlannedFactionPassiveModifiers = (): FactionPassiveModifierUsage[] =>
  listFactionPassiveModifierUsage().filter((usage) => usage.status === "planned");
