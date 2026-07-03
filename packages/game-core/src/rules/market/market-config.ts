import type {
  AnyRecord,
  MarketEventId,
  MarketResourceId
} from "./market-types";

export const marketResourceIds = ["metalParts", "techCore", "chemicals", "biomass"] as const satisfies readonly MarketResourceId[];

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
    metalParts: Object.freeze({
      name: "Metal Parts",
      basePrice: 58,
      normalMarketStartStock: 900,
      normalMarketMaxStock: 1400,
      minPriceMultiplier: 0.55,
      maxPriceMultiplier: 3.2,
      blackMarketMarkup: 1.45,
      volatility: 0.7,
      category: "combat_material"
    }),
    techCore: Object.freeze({
      name: "Tech Core",
      basePrice: 270,
      normalMarketStartStock: 260,
      normalMarketMaxStock: 420,
      minPriceMultiplier: 0.65,
      maxPriceMultiplier: 4,
      blackMarketMarkup: 1.7,
      volatility: 1.1,
      category: "advanced_component"
    }),
    chemicals: Object.freeze({
      name: "Chemicals",
      basePrice: 22,
      normalMarketStartStock: 700,
      normalMarketMaxStock: 1100,
      minPriceMultiplier: 0.55,
      maxPriceMultiplier: 3.5,
      blackMarketMarkup: 1.55,
      volatility: 0.9,
      category: "drug_material"
    }),
    biomass: Object.freeze({
      name: "Biomass",
      basePrice: 25,
      normalMarketStartStock: 1000,
      normalMarketMaxStock: 1600,
      minPriceMultiplier: 0.5,
      maxPriceMultiplier: 2.8,
      blackMarketMarkup: 1.42,
      volatility: 0.6,
      category: "drug_material"
    })
  } satisfies Record<MarketResourceId, AnyRecord>),
  warModePriceMultipliers: Object.freeze({
    basePriceMultiplier: 3.5,
    stockMultiplier: 4,
    maxStockMultiplier: 5,
    blackMarketMarkupMultiplier: 1.15,
    stockRegenMultiplier: 4
  }),
  baselineVolume: Object.freeze({
    metalParts: 300,
    techCore: 80,
    chemicals: 220,
    biomass: 350
  } satisfies Record<MarketResourceId, number>),
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
    maxRiskFactor: 2.2
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
  stockRegenPerMinute: Object.freeze({
    metalParts: 35,
    techCore: 8,
    chemicals: 28,
    biomass: 45
  } satisfies Record<MarketResourceId, number>),
  marketEvents: Object.freeze({
    police_crackdown: Object.freeze({
      affectedCategories: ["drug_material", "advanced_component"],
      priceMultiplier: 1.25,
      stockRegenMultiplier: 0.7,
      durationSecondsFree: 600
    }),
    supply_drop: Object.freeze({
      affectedCategories: ["combat_material", "drug_material"],
      priceMultiplier: 0.8,
      stockRegenMultiplier: 1.4,
      durationSecondsFree: 420
    }),
    gang_war: Object.freeze({
      affectedCategories: ["combat_material", "advanced_component"],
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
