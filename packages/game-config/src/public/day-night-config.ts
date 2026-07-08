import type {
  DayNightActionRuleConfig,
  DayNightBalanceConfig,
  DayNightBuildingRuleConfig,
  DayNightModifiersConfig,
  DayNightPhaseId
} from "@empire/game-core/contracts/game-mode-config";

// One DEN or NOC phase is always two real hours; tick counts derive from mode tickRateMs.
export const DAY_NIGHT_REAL_PHASE_DURATION_MS = 2 * 60 * 60 * 1000;

export const resolveDayNightPhaseDurationTicks = (tickRateMs: number): number => {
  const safeTickRateMs = Math.max(1, Math.round(Number(tickRateMs) || 1));
  return Math.max(1, Math.round(DAY_NIGHT_REAL_PHASE_DURATION_MS / safeTickRateMs));
};

export const dayModifiers: DayNightModifiersConfig = Object.freeze({
  legalIncomeMultiplier: 1.15,
  dirtyIncomeMultiplier: 0.9,
  productionSpeedMultiplier: 1,
  legalProductionSpeedMultiplier: 1.1,
  illegalProductionSpeedMultiplier: 0.9,
  heatGainMultiplier: 1.1,
  policePressureMultiplier: 1.15,
  heistSuccessChanceModifierPct: -10,
  heistDetectionChanceModifierPct: 15,
  rumorGenerationMultiplier: 0.8,
  rumorTruthChanceModifierPct: 10,
  marketVolatilityMultiplier: 0.85,
  attackTravelOrPreparationMultiplier: 1.05
});

export const nightModifiers: DayNightModifiersConfig = Object.freeze({
  legalIncomeMultiplier: 0.9,
  dirtyIncomeMultiplier: 1.25,
  productionSpeedMultiplier: 1.05,
  legalProductionSpeedMultiplier: 0.95,
  illegalProductionSpeedMultiplier: 1.2,
  heatGainMultiplier: 0.95,
  policePressureMultiplier: 0.9,
  raidSeverityMultiplier: 1.1,
  heistSuccessChanceModifierPct: 15,
  heistDetectionChanceModifierPct: -10,
  rumorGenerationMultiplier: 1.35,
  rumorTruthChanceModifierPct: -10,
  marketVolatilityMultiplier: 1.25,
  attackTravelOrPreparationMultiplier: 0.95
});

export const dayNightBuildingRules: Record<string, DayNightBuildingRuleConfig> = Object.freeze({
  central_bank: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: bankovní a regulatorní akce jsou čitelnější přes den.",
    phasePassiveModifiers: {
      day: { passiveCleanIncomeMultiplier: 1.15, passiveHeatMultiplier: 0.95 },
      night: { passiveHeatMultiplier: 1.08 }
    }
  },
  city_hall: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: politické krytí a městské zakázky mají lepší podmínky přes den.",
    phasePassiveModifiers: {
      day: { passiveInfluenceMultiplier: 1.2, passiveHeatMultiplier: 0.92 },
      night: { passiveInfluenceMultiplier: 0.9 }
    }
  },
  court: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: soudní ochrana je silnější přes den.",
    phasePassiveModifiers: {
      day: { passiveInfluenceMultiplier: 1.12, passiveHeatMultiplier: 0.9 },
      night: { passiveInfluenceMultiplier: 0.92 }
    }
  },
  courthouse: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: soudní ochrana je silnější přes den.",
    phasePassiveModifiers: {
      day: { passiveInfluenceMultiplier: 1.12, passiveHeatMultiplier: 0.9 },
      night: { passiveInfluenceMultiplier: 0.92 }
    }
  },
  parliament: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: parlamentní okna fungují přes den.",
    phasePassiveModifiers: {
      day: { passiveInfluenceMultiplier: 1.25, passiveCleanIncomeMultiplier: 1.1 },
      night: { passiveInfluenceMultiplier: 0.9 }
    }
  },
  restaurant: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: restaurace vydělává čistěji a dává přesnější drby přes den.",
    phasePassiveModifiers: {
      day: {
        passiveCleanIncomeMultiplier: 1.15,
        passiveRumorGenerationMultiplier: 0.9,
        passiveRumorTruthModifierPct: 10
      },
      night: {
        passiveCleanIncomeMultiplier: 0.95,
        passiveRumorGenerationMultiplier: 1.1
      }
    }
  },
  shopping_mall: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: obchodní centrum jede naplno přes den.",
    phasePassiveModifiers: {
      day: { passiveCleanIncomeMultiplier: 1.2, passiveInfluenceMultiplier: 1.08 },
      night: { passiveCleanIncomeMultiplier: 0.9 }
    }
  },
  stock_exchange: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: burza je stabilnější přes den, v noci je volatilnější.",
    phasePassiveModifiers: {
      day: { passiveCleanIncomeMultiplier: 1.08, passiveHeatMultiplier: 0.95 },
      night: { passiveCleanIncomeMultiplier: 1.04, passiveHeatMultiplier: 1.08 }
    }
  },
  clinic: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: kliniky mají přes den stabilnější provoz.",
    phasePassiveModifiers: {
      day: { passiveCleanIncomeMultiplier: 1.05, passiveHeatMultiplier: 0.95 },
      night: { passiveCleanIncomeMultiplier: 0.95 }
    }
  },
  school: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: škola zvyšuje populaci rychleji přes den.",
    phasePassiveModifiers: {
      day: { passiveCleanIncomeMultiplier: 1.05, passivePopulationMultiplier: 1.2 },
      night: { passiveCleanIncomeMultiplier: 0.9, passivePopulationMultiplier: 0.9 }
    }
  },
  recruitment_center: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: rekrutace má přes den stabilnější podporu.",
    phasePassiveModifiers: {
      day: { passiveCleanIncomeMultiplier: 1.1 },
      night: {}
    }
  },
  fitness_club: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: fitness má přes den lepší legální provoz.",
    phasePassiveModifiers: {
      day: { passiveCleanIncomeMultiplier: 1.1 },
      night: {}
    }
  },
  power_station: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: infrastruktura je přes den stabilnější.",
    phasePassiveModifiers: {
      day: { passiveCleanIncomeMultiplier: 1.15, passiveHeatMultiplier: 0.95 },
      night: { passiveHeatMultiplier: 1.08 }
    }
  },
  factory: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: legální průmyslová výroba je rychlejší přes den.",
    phasePassiveModifiers: {
      day: { passiveProductionMultiplier: 1.1 },
      night: { passiveProductionMultiplier: 0.98 }
    }
  },
  pharmacy: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: lékárenská výroba je rychlejší přes den.",
    phasePassiveModifiers: {
      day: { passiveProductionMultiplier: 1.1 },
      night: {}
    }
  },
  arcade: {
    preferredPhase: "night",
    phaseEffectSummary: "NOC BONUS: herny a automaty jsou silnější po setmění.",
    phasePassiveModifiers: {
      day: { passiveDirtyIncomeMultiplier: 0.9 },
      night: { passiveDirtyIncomeMultiplier: 1.2, passiveCleanIncomeMultiplier: 1.05 }
    }
  },
  casino: {
    preferredPhase: "night",
    phaseEffectSummary: "NOC BONUS: VIP cashflow a praní jsou silnější v noci.",
    phasePassiveModifiers: {
      day: { passiveDirtyIncomeMultiplier: 0.88, passiveHeatMultiplier: 1.12 },
      night: { passiveDirtyIncomeMultiplier: 1.25, passiveInfluenceMultiplier: 1.1 }
    }
  },
  exchange: {
    preferredPhase: "night",
    phaseEffectSummary: "NOC BONUS: směnárenské praní je efektivnější v noci.",
    phasePassiveModifiers: {
      day: { passiveHeatMultiplier: 1.12 },
      night: { passiveDirtyIncomeMultiplier: 1.2, passiveCleanIncomeMultiplier: 1.08 }
    }
  },
  smuggling_tunnel: {
    preferredPhase: "night",
    phaseEffectSummary: "NOC BONUS: pašovací kanály jsou bezpečnější po setmění.",
    phasePassiveModifiers: {
      day: { passiveHeatMultiplier: 1.12 },
      night: { passiveDirtyIncomeMultiplier: 1.25 }
    }
  },
  street_dealers: {
    preferredPhase: "night",
    phaseEffectSummary: "NOC BONUS: ulice prodává rychleji, ale s vyšším rizikem.",
    phasePassiveModifiers: {
      day: { passiveDirtyIncomeMultiplier: 0.9, passiveHeatMultiplier: 1.15 },
      night: { passiveDirtyIncomeMultiplier: 1.25 }
    }
  },
  strip_club: {
    preferredPhase: "night",
    phaseEffectSummary: "NOC BONUS: klub, VIP klienti a šeptanda sílí v noci.",
    phasePassiveModifiers: {
      day: { passiveRumorGenerationMultiplier: 0.9, passiveRumorTruthModifierPct: 8 },
      night: {
        passiveDirtyIncomeMultiplier: 1.25,
        passiveInfluenceMultiplier: 1.2,
        passiveRumorGenerationMultiplier: 1.25
      }
    }
  },
  vip_lounge: {
    preferredPhase: "night",
    phaseEffectSummary: "NOC BONUS: elitní drby a vliv sílí v noci.",
    phasePassiveModifiers: {
      day: { passiveRumorGenerationMultiplier: 0.9, passiveRumorTruthModifierPct: 10 },
      night: {
        passiveInfluenceMultiplier: 1.1,
        passiveRumorGenerationMultiplier: 1.25,
        passiveRumorTruthModifierPct: -5
      }
    }
  },
  port: {
    preferredPhase: "night",
    phaseEffectSummary: "NOC BONUS: kontejnery se řežou snáz mimo denní provoz.",
    phasePassiveModifiers: {
      day: { passiveHeatMultiplier: 0.95 },
      night: { passiveDirtyIncomeMultiplier: 1.15, passiveCleanIncomeMultiplier: 1.05 }
    }
  },
  drug_lab: {
    preferredPhase: "night",
    phaseEffectSummary: "NOC BONUS: ilegální produkce v labu běží rychleji v noci.",
    phasePassiveModifiers: {
      day: { passiveProductionMultiplier: 0.9, passiveHeatMultiplier: 1.12 },
      night: { passiveProductionMultiplier: 1.2 }
    }
  },
  convenience_store: {
    phaseEffectSummary: "DEN/NOC: přes den čistší provoz, v noci víc dirty cash a pouličních drbů.",
    phasePassiveModifiers: {
      day: {
        passiveCleanIncomeMultiplier: 1.12,
        passiveRumorTruthModifierPct: 8
      },
      night: {
        passiveDirtyIncomeMultiplier: 1.15,
        passiveRumorGenerationMultiplier: 1.15
      }
    }
  },
  warehouse: {
    preferredPhase: "day",
    phaseEffectSummary: "DEN BONUS: logistika je přes den o něco stabilnější.",
    phasePassiveModifiers: {
      day: { passiveCleanIncomeMultiplier: 1.05 }
    }
  },
  car_dealer: {
    phaseEffectSummary: "DEN/NOC: autosalon má přes den lepší legální příjem, v noci drží mobilitu.",
    phasePassiveModifiers: {
      day: { passiveCleanIncomeMultiplier: 1.1 },
      night: { passiveDirtyIncomeMultiplier: 1.05 }
    }
  },
  recycling_center: {
    phaseEffectSummary: "DEN/NOC: recyklace běží kdykoliv, v noci je výnos lehce vyšší.",
    phasePassiveModifiers: {
      day: { passiveHeatMultiplier: 0.95 },
      night: { passiveCleanIncomeMultiplier: 1.1 }
    }
  }
});

export const dayNightActionRules: Record<string, DayNightActionRuleConfig> = Object.freeze({
  night_machines: {
    allowedPhases: ["night"],
    preferredPhase: "night",
    blockedReason: "Noční automaty se rozjíždí až po setmění.",
    phaseEffectSummary: "NOC ONLY: automaty běží jen v noci."
  },
  vip_night: {
    allowedPhases: ["night"],
    preferredPhase: "night",
    blockedReason: "VIP noc můžeš spustit jen v noci.",
    phaseEffectSummary: "NOC ONLY: VIP noc funguje jen po setmění."
  },
  black_charter: {
    allowedPhases: ["night"],
    preferredPhase: "night",
    blockedReason: "Černý charter odlétá jen v noci.",
    phaseEffectSummary: "NOC ONLY: černý charter používá noční provoz."
  },
  parliament_policy_window: {
    allowedPhases: ["day"],
    preferredPhase: "day",
    blockedReason: "Policy Window se otevírá jen přes den.",
    phaseEffectSummary: "DEN ONLY: politické okno běží jen přes den."
  },
  official_cover: {
    preferredPhase: "day",
    heatMultiplier: 1.35,
    costMultiplier: 1.15,
    phaseEffectSummary: "DEN BONUS: úřední krytí je levnější a tišší přes den. V noci má vyšší cost/heat."
  },
  city_contract: {
    preferredPhase: "day",
    rewardMultiplier: 0.9,
    heatMultiplier: 1.25,
    phaseEffectSummary: "DEN BONUS: městská zakázka je výhodnější přes den."
  },
  liquidity_injection: {
    preferredPhase: "day",
    auditRiskModifierPct: 10,
    costMultiplier: 1.1,
    phaseEffectSummary: "DEN BONUS: likvidita je čistší přes den. V noci roste financial oversight."
  },
  currency_intervention: {
    preferredPhase: "day",
    costMultiplier: 1.12,
    heatMultiplier: 1.2,
    phaseEffectSummary: "DEN BONUS: kurzovní zásah je stabilnější přes den."
  },
  quiet_backroom: {
    preferredPhase: "night",
    rewardMultiplier: 0.9,
    heatMultiplier: 1.25,
    auditRiskModifierPct: 10,
    phaseEffectSummary: "NOC BONUS: tichá herna pere efektivněji v noci. Přes den je vyšší audit/heat."
  },
  good_rate: {
    preferredPhase: "night",
    rewardMultiplier: 0.9,
    heatMultiplier: 1.25,
    auditRiskModifierPct: 10,
    phaseEffectSummary: "NOC BONUS: výhodný kurz je bezpečnější v noci. Přes den roste audit/heat."
  },
  open_channel: {
    preferredPhase: "night",
    heatMultiplier: 1.3,
    detectionChanceModifierPct: 10,
    phaseEffectSummary: "NOC BONUS: kanál je tmavší v noci. Přes den roste police/street risk."
  },
  start_drug_sale: {
    preferredPhase: "night",
    rewardMultiplier: 0.9,
    heatMultiplier: 1.3,
    detectionChanceModifierPct: 10,
    phaseEffectSummary: "NOC BONUS: prodej v ulicích je výhodnější v noci. Přes den roste heat."
  },
  strip_club_collect_cash: {
    preferredPhase: "night",
    rewardMultiplier: 0.85,
    heatMultiplier: 1.25,
    phaseEffectSummary: "NOC BONUS: strip club cash je silnější v noci."
  },
  vip_lounge: {
    preferredPhase: "night",
    heatMultiplier: 1.2,
    rumorChanceModifierPct: -10,
    phaseEffectSummary: "NOC BONUS: VIP klienti chodí v noci. Přes den je menší rumor value."
  },
  private_party: {
    preferredPhase: "night",
    heatMultiplier: 1.25,
    auditRiskModifierPct: 8,
    phaseEffectSummary: "NOC BONUS: soukromá party má lepší noční krytí. Přes den je vyšší risk."
  },
  port_container_cut: {
    preferredPhase: "night",
    rewardMultiplier: 0.9,
    heatMultiplier: 1.25,
    phaseEffectSummary: "NOC BONUS: container cut je výhodnější v noci."
  }
});

export const createDayNightConfig = (input: {
  dayDurationTicks: number;
  nightDurationTicks: number;
  defaultPhase?: DayNightPhaseId;
}): DayNightBalanceConfig => ({
  enabled: true,
  defaultPhase: input.defaultPhase ?? "day",
  phases: {
    day: {
      id: "day",
      label: "DEN",
      durationTicks: Math.max(1, Math.floor(input.dayDurationTicks)),
      modifiers: dayModifiers,
      cityFeedMessages: [
        "Město přechází do denního režimu. Kamery, úřady a legální byznys sílí."
      ],
      uiThemeHint: "day",
      effectSummary: [
        "Legální byznys +15 %",
        "Policie víc vidí",
        "Drbů je méně, ale jsou přesnější"
      ]
    },
    night: {
      id: "night",
      label: "NOC",
      durationTicks: Math.max(1, Math.floor(input.nightDurationTicks)),
      modifiers: nightModifiers,
      cityFeedMessages: [
        "Noc padla na ulice. Černý trh ožívá a gangy se dávají do pohybu."
      ],
      uiThemeHint: "night",
      effectSummary: [
        "Dirty cash +25 %",
        "Heisty jsou snazší",
        "Drby jsou častější, ale méně jisté"
      ]
    }
  },
  buildingRules: dayNightBuildingRules,
  actionRules: dayNightActionRules
});
