import type { ResolvedGameModeConfig } from "../../contracts/game-mode-config";
import { freeModeArcadeConfig } from "../../public/free-mode-arcade-config";
import { freeModeCasinoConfig } from "../../public/free-mode-casino-config";
import { freeModeExchangeOfficeConfig } from "../../public/free-mode-exchange-office-config";
import { freeModeStripClubConfig } from "../../public/free-mode-strip-club-config";

export const freeModeVenueBuildingActions: NonNullable<ResolvedGameModeConfig["balance"]["buildingActions"]> = {  back_cashdesk: {
    actionId: "back_cashdesk",
    buildingType: "arcade",
    label: "Zadní pokladna",
    description: "Instantně vypere část aktuálního dirty cash přes zadní pokladnu Herny.",
    durationMs: 0,
    cooldownMs: freeModeArcadeConfig.backCashdesk.cooldownMinutes * 60 * 1000,
    inputCost: {},
    outputGain: {},
    heatGain: freeModeArcadeConfig.backCashdesk.heatGain,
    influenceChange: freeModeArcadeConfig.backCashdesk.influenceGain,
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Vypere část dirty cash, přidá clean cash po poplatku a zvýší audit risk."
  },
  good_rate: {
    actionId: "good_rate",
    buildingType: "exchange",
    label: "Výhodný kurz",
    description: "Instantně vypere menší část aktuálního dirty cash přes síť směnáren.",
    durationMs: 0,
    cooldownMs: freeModeExchangeOfficeConfig.goodRate.cooldownMinutes * 60 * 1000,
    inputCost: {},
    outputGain: {},
    heatGain: freeModeExchangeOfficeConfig.goodRate.heatGain,
    influenceChange: freeModeExchangeOfficeConfig.goodRate.influenceGain,
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Vypere část dirty cash, přidá clean cash po poplatku a zvýší audit risk."
  },
  quiet_backroom: {
    actionId: "quiet_backroom",
    buildingType: "casino",
    label: "Tichá herna",
    description: "Instantně vypere část aktuálního dirty cash přes tiché zázemí kasina.",
    durationMs: 0,
    cooldownMs: freeModeCasinoConfig.quietBackroom.cooldownMinutes * 60 * 1000,
    inputCost: {},
    outputGain: {},
    heatGain: freeModeCasinoConfig.quietBackroom.heatGain,
    influenceChange: freeModeCasinoConfig.quietBackroom.influenceGain,
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Vypere část dirty cash, přidá clean cash po poplatku a zvýší audit risk."
  },
  vip_night: {
    actionId: "vip_night",
    buildingType: "casino",
    label: "VIP noc",
    description: "Na 10 minut výrazně zvýší casino income, vliv, heat a audit risk.",
    durationMs: freeModeCasinoConfig.vipNight.durationMinutes * 60 * 1000,
    cooldownMs: freeModeCasinoConfig.vipNight.cooldownMinutes * 60 * 1000,
    inputCost: {},
    outputGain: {},
    heatGain: 0,
    influenceChange: 0,
    effectModifiers: {
      cleanIncomeMultiplier: 1 + freeModeCasinoConfig.vipNight.cleanIncomeBonusPct / 100,
      dirtyIncomeMultiplier: 1 + freeModeCasinoConfig.vipNight.dirtyIncomeBonusPct / 100,
      influenceMultiplier: 1 + freeModeCasinoConfig.vipNight.influenceBonusPct / 100,
      heatMultiplier: 1 + freeModeCasinoConfig.vipNight.heatBonusPct / 100
    },
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Aktivuje VIP noc. Boost se sám se sebou nestackuje."
  },
  bribed_inspector: {
    actionId: "bribed_inspector",
    buildingType: "casino",
    label: "Podplacený inspektor",
    description: "Zaplatí inspektora. Úspěch sníží heat a audit risk, selhání zvýší policejní tlak.",
    durationMs: freeModeCasinoConfig.bribedInspector.protectionMinutes * 60 * 1000,
    cooldownMs: freeModeCasinoConfig.bribedInspector.cooldownMinutes * 60 * 1000,
    inputCost: { cash: freeModeCasinoConfig.bribedInspector.cleanCashCost },
    outputGain: {},
    heatGain: 0,
    influenceChange: 0,
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Heat control akce s rizikem selhání."
  },
  vip_lounge: {
    actionId: "vip_lounge",
    buildingType: "strip_club",
    label: "Hostit VIP klienty",
    description: "Na 30 minut zvýší produkci Strip Clubu, vliv, heat a šanci na drb.",
    durationMs: freeModeStripClubConfig.vipLounge.durationMinutes * 60 * 1000,
    cooldownMs: freeModeStripClubConfig.vipLounge.cooldownMinutes * 60 * 1000,
    inputCost: { cash: freeModeStripClubConfig.vipLounge.cleanCashCost },
    outputGain: {},
    heatGain: 0,
    influenceChange: 0,
    effectModifiers: {
      cleanIncomeMultiplier: 1 + freeModeStripClubConfig.vipLounge.cleanIncomeBonusPct / 100,
      dirtyIncomeMultiplier: 1 + freeModeStripClubConfig.vipLounge.dirtyIncomeBonusPct / 100,
      influenceMultiplier: 1 + freeModeStripClubConfig.vipLounge.influenceBonusPct / 100,
      heatMultiplier: 1 + freeModeStripClubConfig.vipLounge.heatBonusPct / 100
    },
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "VIP klienti jsou aktivní. Boost se sám se sebou nestackuje."
  },
  bar_whispers: {
    actionId: "bar_whispers",
    buildingType: "strip_club",
    label: "Šeptanda u baru",
    description: "Okamžitě vygeneruje pravděpodobnostní drb.",
    durationMs: 0,
    cooldownMs: freeModeStripClubConfig.barWhispers.cooldownMinutes * 60 * 1000,
    inputCost: {},
    outputGain: {},
    heatGain: freeModeStripClubConfig.barWhispers.heatGain,
    influenceChange: 0,
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Šeptanda u baru vygenerovala drb. Pravdivost není jistá."
  },
  private_party: {
    actionId: "private_party",
    buildingType: "strip_club",
    label: "Získat kompro",
    description: "Přidá vliv, dočasný influence boost a může přinést kontakt, extra drb nebo skandál.",
    durationMs: freeModeStripClubConfig.privateParty.durationMinutes * 60 * 1000,
    cooldownMs: freeModeStripClubConfig.privateParty.cooldownMinutes * 60 * 1000,
    inputCost: { cash: freeModeStripClubConfig.privateParty.cleanCashCost },
    outputGain: {},
    heatGain: freeModeStripClubConfig.privateParty.heatGain,
    influenceChange: freeModeStripClubConfig.privateParty.instantInfluenceGain,
    effectModifiers: {
      influenceMultiplier: 1 + freeModeStripClubConfig.privateParty.influenceProductionBonusPct / 100
    },
    requiredOwner: true,
    allowedIfContested: false,
    reportText: "Soukromá party proběhla. Výsledek může obsahovat kontakt, extra drb nebo skandál."
  }
};
