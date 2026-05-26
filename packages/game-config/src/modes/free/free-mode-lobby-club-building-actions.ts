import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";
import { freeModeLobbyClubConfig } from "../../public/free-mode-lobby-club-config";

export const freeModeLobbyClubBuildingActions: NonNullable<ResolvedGameModeConfig["balance"]["buildingActions"]> = {
  backroom_pressure: {
    actionId: "backroom_pressure",
    buildingType: "lobby_club",
    label: "Zákulisní tlak",
    description: "Na 8 minut posílí influence produkci, sníží cenu influence akcí a přidá politický tlak.",
    durationMs: freeModeLobbyClubConfig.backroomPressure.durationMinutes * 60 * 1000,
    cooldownMs: freeModeLobbyClubConfig.backroomPressure.cooldownMinutes * 60 * 1000,
    inputCost: { cash: freeModeLobbyClubConfig.backroomPressure.costCleanCash },
    outputGain: {},
    heatGain: freeModeLobbyClubConfig.backroomPressure.heatGain,
    influenceChange: -freeModeLobbyClubConfig.backroomPressure.costInfluence,
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Zákulisní tlak je aktivní. Influence síť tlačí na rozhodnutí v celém městě."
  },
  quiet_negotiation: {
    actionId: "quiet_negotiation",
    buildingType: "lobby_club",
    label: "Tiché vyjednávání",
    description: "Okamžitě zkrátí jeden politický/společenský cooldown, sníží rizika a zlevní další influence akci.",
    durationMs: 0,
    cooldownMs: freeModeLobbyClubConfig.quietNegotiation.cooldownMinutes * 60 * 1000,
    inputCost: { cash: freeModeLobbyClubConfig.quietNegotiation.costCleanCash },
    outputGain: {},
    heatGain: freeModeLobbyClubConfig.quietNegotiation.heatGain,
    influenceChange: -freeModeLobbyClubConfig.quietNegotiation.costInfluence,
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Tiché vyjednávání proběhlo mimo záznam. Rizika klesla a další influence akce bude levnější."
  },
  media_screen: {
    actionId: "media_screen",
    buildingType: "lobby_club",
    label: "Mediální clona",
    description: "Na 8 minut brání negativním drbům, snižuje jejich pravdivost a zlepšuje veřejný obraz.",
    durationMs: freeModeLobbyClubConfig.mediaScreen.durationMinutes * 60 * 1000,
    cooldownMs: freeModeLobbyClubConfig.mediaScreen.cooldownMinutes * 60 * 1000,
    inputCost: { cash: freeModeLobbyClubConfig.mediaScreen.costCleanCash },
    outputGain: {},
    heatGain: freeModeLobbyClubConfig.mediaScreen.heatGain,
    influenceChange: 0,
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Mediální clona překresluje veřejný obraz a tlumí negativní drby."
  }
};
