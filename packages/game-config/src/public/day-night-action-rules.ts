import type { DayNightActionRuleConfig } from "@empire/game-core/contracts/game-mode-config";

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
    blockedReason: "Politické okno se otevírá jen přes den.",
    phaseEffectSummary: "DEN ONLY: politické okno běží jen přes den."
  },
  restaurant_collect_revenue: {
    allowedPhases: ["day"],
    preferredPhase: "day",
    blockedReason: "Tržby restaurace můžeš vybrat jen přes den.",
    phaseEffectSummary: "DEN ONLY: tržby restaurace lze vybrat jen přes den."
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
    allowedPhases: ["day"],
    preferredPhase: "day",
    blockedReason: "Výhodný kurz můžeš spustit jen přes den.",
    phaseEffectSummary: "DEN ONLY: výhodný kurz směnárny běží jen přes den."
  },
  open_channel: {
    preferredPhase: "night",
    heatMultiplier: 1.3,
    detectionChanceModifierPct: 10,
    phaseEffectSummary: "NOC BONUS: kanál je bezpečnější po setmění. Přes den roste policejní tlak a pouliční riziko."
  },
  start_drug_sale: {
    preferredPhase: "night",
    heatMultiplier: 1.3,
    detectionChanceModifierPct: 10,
    phaseEffectSummary: "Prodej je dostupný ve dne i v noci. Přes den roste heat a pouliční riziko; cena za kus zůstává pevná."
  },
  strip_club_collect_cash: {
    preferredPhase: "night",
    rewardMultiplier: 0.85,
    heatMultiplier: 1.25,
    phaseEffectSummary: "NOC BONUS: strip club cash je silnější v noci."
  },
  vip_lounge: {
    allowedPhases: ["night"],
    preferredPhase: "night",
    blockedReason: "Hostit VIP klienty můžeš jen v noci.",
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
