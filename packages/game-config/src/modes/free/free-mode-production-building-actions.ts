import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";
import { baseCooldownMsForFinalMinutes } from "./free-mode-timing";

export const freeModeProductionBuildingActions: NonNullable<ResolvedGameModeConfig["balance"]["buildingActions"]> = {
  produce_tech_core: {
    actionId: "produce_tech_core",
    buildingType: "factory",
    label: "Vyrobit Tech Core",
    description: "Sestavi Tech Core z dilu.",
    durationMs: 0,
    cooldownMs: baseCooldownMsForFinalMinutes(6),
    inputCost: { "metal-parts": 2 },
    outputGain: { "tech-core": 1 },
    heatGain: 2,
    influenceChange: 0,
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Tovarna vyrobila Tech Core."
  },
  produce_combat_module: {
    actionId: "produce_combat_module",
    buildingType: "factory",
    label: "Vyrobit bojovy modul",
    description: "Vyrobi bojovy modul jako soucastku pro pokrocile vybaveni.",
    durationMs: 0,
    cooldownMs: baseCooldownMsForFinalMinutes(12),
    inputCost: { "metal-parts": 2, "tech-core": 1 },
    outputGain: { "combat-module": 1 },
    heatGain: 3,
    influenceChange: 1,
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Tovarna vyrobila bojovy modul."
  },
  armory_craft_weapons: {
    actionId: "armory_craft_weapons",
    buildingType: "armory",
    label: "Vyrobit vyzbrojni modul",
    description: "Vyrobi vyzbrojni modul ve zbrojovce jako soucastku pro dalsi vybaveni.",
    durationMs: 0,
    cooldownMs: baseCooldownMsForFinalMinutes(12),
    inputCost: { "metal-parts": 2 },
    outputGain: { "combat-module": 1 },
    heatGain: 3,
    influenceChange: 1,
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Zbrojovka vyrobila vyzbrojni modul."
  }
};
