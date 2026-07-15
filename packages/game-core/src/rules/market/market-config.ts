import type {
  AnyRecord,
  MarketEventId,
  MarketResourceId
} from "./market-types";

export const normalMarketResourceIds = ["chemicals", "biomass", "metal-parts", "stim-pack"] as const satisfies readonly MarketResourceId[];
export const blackMarketResourceIds = [
  "tech-core", "combat-module", "neon-dust", "pulse-shot", "velvet-smoke",
  "ghost-serum", "overdrive-x", "pistol", "grenade", "smg", "bazooka"
] as const satisfies readonly MarketResourceId[];
export const playerMarketResourceIds = [
  "chemicals", "biomass", "metal-parts", "neon-dust", "baseball-bat", "barricades",
  "stim-pack", "pulse-shot", "velvet-smoke", "tech-core", "pistol", "grenade", "vest",
  "cameras", "alarm", "combat-module", "ghost-serum", "overdrive-x", "smg", "bazooka",
  "defense-tower"
] as const satisfies readonly MarketResourceId[];
export const marketResourceIds = [...playerMarketResourceIds] as const satisfies readonly MarketResourceId[];

export const marketReplacementCost = Object.freeze({
  chemicals: 360,
  biomass: 420,
  "metal-parts": 300,
  "neon-dust": 1220,
  "baseball-bat": 600,
  barricades: 1200,
  "stim-pack": 800,
  "pulse-shot": 1940,
  "velvet-smoke": 2100,
  "tech-core": 2100,
  pistol: 3000,
  grenade: 2700,
  vest: 3000,
  cameras: 4800,
  alarm: 2700,
  "combat-module": 7900,
  "ghost-serum": 6880,
  "overdrive-x": 10640,
  smg: 8500,
  bazooka: 16700,
  "defense-tower": 22100
} satisfies Record<MarketResourceId, number>);

const createResourceConfig = (
  name: string,
  basePrice: number,
  category: string,
  startStock: number,
  maxStock: number,
  volatility = 0.8,
  blackMarketMarkup = 1.55
) => Object.freeze({
  name,
  basePrice,
  normalMarketStartStock: startStock,
  normalMarketMaxStock: maxStock,
  minPriceMultiplier: 1,
  maxPriceMultiplier: 4,
  blackMarketMarkup,
  volatility,
  category
});

export const marketConfig = Object.freeze({
  id: "server_market",
  freeModeEconomyBaseline: Object.freeze({
    expectedPlayers: 20,
    baselineCleanCashPerPlayer: 2500,
    baselineDirtyCashPerPlayer: 1500,
    baselineTotalMoney: 80000,
    inflationNeutralPoint: 80000,
    inflationSoftCap: 140000,
    inflationHardCap: 220000
  }),
  warModeEconomyBaseline: Object.freeze({
    expectedPlayers: 50,
    baselineCleanCashPerPlayer: 12000,
    baselineDirtyCashPerPlayer: 8000,
    baselineTotalMoney: 1000000,
    inflationNeutralPoint: 1000000,
    inflationSoftCap: 1800000,
    inflationHardCap: 3000000
  }),
  resources: Object.freeze({
    chemicals: createResourceConfig("Chemicals", 450, "bulk", 700, 1100, 0.9),
    biomass: createResourceConfig("Biomass", 530, "bulk", 1000, 1600, 0.6),
    "metal-parts": createResourceConfig("Metal Parts", 380, "bulk", 900, 1400, 0.7),
    "stim-pack": createResourceConfig("Stim Pack", 1000, "tactical", 220, 360),
    "neon-dust": createResourceConfig("Neon Dust", 1900, "bulk", 0, 140),
    "baseball-bat": createResourceConfig("Baseballová pálka", 750, "bulk", 0, 120),
    barricades: createResourceConfig("Barikády", 1500, "bulk", 0, 100),
    "pulse-shot": createResourceConfig("Pulse Shot", 3010, "tactical", 0, 90),
    "velvet-smoke": createResourceConfig("Velvet Smoke", 3260, "tactical", 0, 90),
    "tech-core": createResourceConfig("Tech Core", 3260, "tactical", 0, 80, 1.1),
    pistol: createResourceConfig("Pistole", 4650, "tactical", 0, 70),
    grenade: createResourceConfig("Granát", 4190, "tactical", 0, 70),
    vest: createResourceConfig("Vesta", 4650, "tactical", 0, 70),
    cameras: createResourceConfig("Kamery", 7440, "tactical", 0, 50),
    alarm: createResourceConfig("Alarm", 4190, "tactical", 0, 70),
    "combat-module": createResourceConfig("Combat Module", 12250, "strategic", 0, 24, 1.2),
    "ghost-serum": createResourceConfig("Ghost Serum", 10670, "strategic", 0, 18, 1.2),
    "overdrive-x": createResourceConfig("Overdrive X", 16490, "strategic", 0, 18, 1.2),
    smg: createResourceConfig("SMG", 13180, "strategic", 0, 16, 1.15),
    bazooka: createResourceConfig("Bazuka", 25890, "strategic", 0, 8, 1.3),
    "defense-tower": createResourceConfig("Obranná věž", 34260, "strategic", 0, 8, 1.3)
  } satisfies Record<MarketResourceId, AnyRecord>),
  warModePriceMultipliers: Object.freeze({
    basePriceMultiplier: 3.5,
    stockMultiplier: 4,
    maxStockMultiplier: 5,
    blackMarketMarkupMultiplier: 1.15,
    stockRegenMultiplier: 4
  }),
  baselineVolume: Object.freeze(Object.fromEntries(marketResourceIds.map((resourceId) => [
    resourceId,
    normalMarketResourceIds.includes(resourceId as typeof normalMarketResourceIds[number]) ? 220 : 30
  ])) as Record<MarketResourceId, number>),
  demand: Object.freeze({
    rollingWindowFreeSeconds: 600,
    minFactor: 0.75,
    maxFactor: 1.85
  }),
  scarcity: Object.freeze({
    minFactor: 0.85,
    maxFactor: 2.25
  }),
  chaos: Object.freeze({
    heistBonus: 0.01,
    attackBonus: 0.02,
    policeRaidBonus: 0.03,
    minFactor: 1,
    maxFactor: 1.75
  }),
  inflation: Object.freeze({
    minFactor: 0.85,
    maxFactor: 2.4
  }),
  blackMarket: Object.freeze({
    dirtyCashPaymentMultiplier: 1.25,
    minRiskFactor: 1,
    maxRiskFactor: 2.2,
    rotationSeconds: 30 * 60,
    offerCount: 5
  }),
  shoppingMallBonus: Object.freeze({
    buildingTypeId: "shopping_mall",
    discountPctPerMall: 2,
    maxDiscountPct: 14,
    regularMarketWeight: 1,
    blackMarketWeight: 0.4,
    playerMarketWeight: 0,
    emergencyMarketWeight: 0,
    minFinalPriceMultiplier: 0.7,
    feeReductionPctPerMall: 5,
    maxFeeReductionPct: 30
  }),
  playerMarket: Object.freeze({
    listingLimitPerSeller: 5,
    listingTtlSecondsFree: 45 * 60,
    listingTtlSecondsWar: 6 * 60 * 60,
    minUnitPrice: 1,
    maxUnitPriceMultiplier: 8,
    dirtyTradeHeat: 2,
    dirtyTradePoliceSuspicion: 1
  }),
  stockRegenPerMinute: Object.freeze(Object.fromEntries(marketResourceIds.map((resourceId) => [
    resourceId,
    resourceId === "chemicals" ? 28 : resourceId === "biomass" ? 45 : resourceId === "metal-parts" ? 35 : resourceId === "stim-pack" ? 6 : 0
  ])) as Record<MarketResourceId, number>),
  marketEvents: Object.freeze({
    police_crackdown: Object.freeze({
      affectedCategories: ["bulk", "tactical", "strategic"],
      priceMultiplier: 1.25,
      stockRegenMultiplier: 0.7,
      durationSecondsFree: 600
    }),
    supply_drop: Object.freeze({
      affectedCategories: ["bulk", "tactical"],
      priceMultiplier: 0.8,
      stockRegenMultiplier: 1.4,
      durationSecondsFree: 420
    }),
    gang_war: Object.freeze({
      affectedCategories: ["tactical", "strategic"],
      priceMultiplier: 1.35,
      stockRegenMultiplier: 0.85,
      durationSecondsFree: 480
    }),
    lab_shortage: Object.freeze({
      affectedResources: ["chemicals", "biomass"],
      priceMultiplier: 1.3,
      stockRegenMultiplier: 0.65,
      durationSecondsFree: 480
    })
  } satisfies Record<MarketEventId, AnyRecord>),
  largeTransactionValueFree: Object.freeze({
    medium: 750,
    high: 1800,
    extreme: 3500
  }),
  largeTransactionRisk: Object.freeze({
    normal: Object.freeze({
      medium: 0.05,
      high: 0.12,
      extreme: 0.22
    }),
    black: Object.freeze({
      medium: 0.12,
      high: 0.25,
      extreme: 0.4
    })
  }),
  priceHistory: Object.freeze({
    freeSnapshotSeconds: 60,
    freeLimit: 60,
    warSnapshotSeconds: 600,
    warLimit: 200
  }),
  transactionLogLimit: 120
});
