import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";

export const freeModeRestaurantBuildingActions: NonNullable<ResolvedGameModeConfig["balance"]["buildingActions"]> = {
  restaurant_collect_revenue: {
    actionId: "restaurant_collect_revenue",
    buildingType: "restaurant",
    label: "Vybrat tržby",
    description: "Vybere lokální tržby restaurace jako clean a dirty cash.",
    durationMs: 0,
    cooldownMs: 60 * 60 * 1000,
    inputCost: {},
    outputGain: {
      cash: 1800,
      "dirty-cash": 900
    },
    heatGain: 5,
    influenceChange: 0,
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Restaurace vybrala lokální tržby: 1800 clean cash a 900 dirty cash."
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
    cooldownMs: 45 * 60 * 1000,
    inputCost: {},
    outputGain: {},
    heatGain: 5,
    influenceChange: 10,
    effectModifiers: {
      influenceMultiplier: 1.5
    },
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Restaurace posílila lokální síť a vliv v districtu."
  }
};
