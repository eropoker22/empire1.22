import type { DayNightBuildingRuleConfig } from "@empire/game-core/contracts/game-mode-config";

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
    phaseEffectSummary: "NOC BONUS: pašovací kanály jsou bezpečnější po setmění. Přes den dirty tok výrazně padá.",
    phasePassiveModifiers: {
      day: { passiveDirtyIncomeMultiplier: 0.5, passiveHeatMultiplier: 1.12 },
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
    phaseEffectSummary: "DEN: clean cash -50 % a dirty cash -50 %. NOC BONUS: klub, VIP klienti a šeptanda sílí v noci.",
    phasePassiveModifiers: {
      day: {
        passiveCleanIncomeMultiplier: 0.5,
        passiveDirtyIncomeMultiplier: 0.5,
        passiveRumorGenerationMultiplier: 0.9,
        passiveRumorTruthModifierPct: 8
      },
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
