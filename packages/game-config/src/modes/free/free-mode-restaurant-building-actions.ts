import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";

export const freeModeRestaurantBuildingActions: NonNullable<ResolvedGameModeConfig["balance"]["buildingActions"]> = {
  restaurant_collect_revenue: {
    actionId: "restaurant_collect_revenue",
    buildingType: "restaurant",
    label: "Vybrat tržby",
    description: "Vybere lokální tržby restaurace jako clean a dirty cash.",
    durationMs: 0,
    cooldownMs: 30 * 60 * 1000,
    inputCost: {},
    outputGain: {
      cash: 869,
      "dirty-cash": 550
    },
    heatGain: 5,
    influenceChange: 0,
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Restaurace vybrala lokální tržby: 869 clean cash a 550 dirty cash."
  },
  restaurant_cover_meetings: {
    actionId: "restaurant_cover_meetings",
    buildingType: "restaurant",
    label: "Krýt schůzky",
    description: "Na 30 minut zvedne lokální income restaurace a přidá vliv.",
    durationMs: 30 * 60 * 1000,
    cooldownMs: 45 * 60 * 1000,
    inputCost: {},
    outputGain: {},
    heatGain: 4,
    influenceChange: 8,
    effectModifiers: {
      cleanIncomeMultiplier: 1.18,
      dirtyIncomeMultiplier: 1.18
    },
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Restaurace kryje schůzky. Income restaurace je dočasně posílený."
  },
  restaurant_local_network: {
    actionId: "restaurant_local_network",
    buildingType: "restaurant",
    label: "Posílit lokální síť",
    description: "Na 30 minut posílí lokální vliv restaurace.",
    durationMs: 30 * 60 * 1000,
    cooldownMs: 30 * 60 * 1000,
    inputCost: {},
    outputGain: {},
    heatGain: 8,
    influenceChange: 4,
    effectModifiers: {
      influenceMultiplier: 1.12
    },
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Restaurace posílila lokální síť a vliv v districtu."
  }
};
