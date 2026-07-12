import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";
import { baseCooldownMsForFinalMinutes } from "./free-mode-timing";

export const freeModeProductionBuildingActions: NonNullable<ResolvedGameModeConfig["balance"]["buildingActions"]> = {
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
