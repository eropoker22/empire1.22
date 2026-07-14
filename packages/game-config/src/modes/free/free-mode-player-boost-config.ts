import type { PlayerBoostBalanceConfig } from "../../contracts/game-mode-config";
import { ticksFromMinutes } from "./free-mode-timing";

export const freeModePlayerBoostConfig: PlayerBoostBalanceConfig = {
  "ghost-network": {
    boostId: "ghost-network",
    label: "Ghost Network",
    category: "intel",
    description: "Prožeň špiony neviditelnou sítí a vytáhni z districtu víc informací.",
    shortEffect: "Špionáž −35 % času · rozšířený intel",
    cleanCashCost: 5_000,
    inputCosts: {
      "ghost-serum": 2,
      "pulse-shot": 2
    },
    activeDurationTicks: ticksFromMinutes(12),
    cooldownTicks: ticksFromMinutes(35),
    consumptionMode: "timed",
    effect: {
      spyDurationMultiplier: 0.65,
      criticalFailureChanceMultiplier: 0.75,
      extraIntelBlocksOnSuccess: 1
    },
    uiAccent: "cyan",
    iconKey: "signal-eye"
  },
  "industrial-overdrive": {
    boostId: "industrial-overdrive",
    label: "Industrial Overdrive",
    category: "production",
    description: "Přetěž výrobní síť a vytlač z každé linky vyšší tempo.",
    shortEffect: "Všechny výrobní linky +25 % rychlosti",
    cleanCashCost: 7_500,
    inputCosts: {
      "overdrive-x": 2,
      "combat-module": 2
    },
    activeDurationTicks: ticksFromMinutes(12),
    cooldownTicks: ticksFromMinutes(45),
    consumptionMode: "timed",
    effect: {
      productionSpeedMultiplier: 1.25
    },
    uiAccent: "amber",
    iconKey: "industrial-gear"
  },
  "tactical-grid": {
    boostId: "tactical-grid",
    label: "Tactical Grid",
    category: "combat",
    description: "Propoj výzbroj, obranu a intel do jediné taktické sítě.",
    shortEffect: "+12 % k příštímu útoku nebo obraně",
    cleanCashCost: 10_000,
    inputCosts: {
      "ghost-serum": 2,
      "overdrive-x": 1,
      "combat-module": 3
    },
    activeDurationTicks: ticksFromMinutes(20),
    cooldownTicks: ticksFromMinutes(60),
    consumptionMode: "next-valid-pvp-combat",
    effect: {
      combatPowerMultiplier: 1.12
    },
    uiAccent: "red",
    iconKey: "tactical-grid"
  }
};
