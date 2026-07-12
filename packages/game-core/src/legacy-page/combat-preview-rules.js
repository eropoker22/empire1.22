import { ATTACK_SETUP_WEAPONS } from "../../../game-config/src/legacy-page/combat-config.js";

// Preview-only legacy helpers. Server-authoritative combat results are resolved by game-core command handlers.
export function calculateAttackDeployment(loadout = {}, modifiers = {}, weaponDefinitions = ATTACK_SETUP_WEAPONS) {
  return Object.entries(loadout).reduce(
    (totals, [weaponId, amount]) => {
      const weapon = weaponDefinitions[weaponId];
      const normalizedAmount = Math.max(0, Number.parseInt(String(amount ?? 0), 10) || 0);

      if (!weapon || normalizedAmount <= 0) {
        return totals;
      }

      const multiplier = Math.max(0, Number(modifiers[weaponId] ?? 1));
      return {
        totalResidents: totals.totalResidents + normalizedAmount * weapon.residents,
        totalPower: totals.totalPower + normalizedAmount * weapon.power * multiplier
      };
    },
    { totalResidents: 0, totalPower: 0 }
  );
}

export const DEFENSE_POWER_BY_WEAPON = {
  vest: 6,
  barricades: 12,
  cameras: 6,
  "defense-tower": 20,
  alarm: 10
};

export const DEFENSE_LABEL_BY_WEAPON = {
  vest: "Vesta",
  barricades: "Barikády",
  cameras: "Kamery",
  "defense-tower": "Defense tower",
  alarm: "Alarm"
};

export function calculateDefensePower(loadout = {}, modifiers = {}) {
  return Object.entries(loadout).reduce((totalPower, [weaponId, amount]) => {
    const normalizedAmount = Math.max(0, Number.parseInt(String(amount ?? 0), 10) || 0);
    const multiplier = Math.max(0, Number(modifiers[weaponId] ?? 1));
    return totalPower + normalizedAmount * (DEFENSE_POWER_BY_WEAPON[weaponId] ?? 0) * multiplier;
  }, 0);
}

export function calculateTotalDefensePower({ loadout = {}, residents = 0, modifiers = {} } = {}) {
  const normalizedResidents = Math.max(0, Number.parseInt(String(residents ?? 0), 10) || 0);
  return calculateDefensePower(loadout, modifiers) + normalizedResidents;
}

export function formatDefenseLoadout(loadout = {}) {
  return Object.entries(loadout)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([weaponId, amount]) => `${DEFENSE_LABEL_BY_WEAPON[weaponId] || weaponId} x${amount}`)
    .join(", ");
}

export function validateAttackSelection({
  sourceDistrictId,
  totalResidents,
  totalPower,
  availablePopulation
}) {
  if (!sourceDistrictId) {
    return { canConfirm: false, status: "Chybí sousední district" };
  }

  if (totalResidents <= 0 || totalPower <= 0) {
    return { canConfirm: false, status: "Vyber zbraně" };
  }

  if (totalResidents > availablePopulation) {
    return { canConfirm: false, status: "Málo obyvatel" };
  }

  return { canConfirm: true, status: "Připraveno" };
}

export function resolveAttackScenario(order) {
  return order?.resolvedScenario?.label || "Neúspěch";
}

export function resolveRobberyScenario(order) {
  const preview = createRobberySetupPreview({
    districtType: order?.targetDistrictType || order?.districtType || "park",
    sentMembers: order?.deployedMembers
  });
  return `${preview.zoneLabel} · ${preview.riskLabel}`;
}

export function getAttackScenarioMemberLoss(scenarioLabel, deployedMembers) {
  if (scenarioLabel === "Totální úspěch") return 0;
  if (scenarioLabel === "Pyrrhovo vítězství") return Math.ceil(deployedMembers * 0.5);
  if (scenarioLabel === "Neúspěch") return deployedMembers;
  if (scenarioLabel === "Katastrofa") return deployedMembers;
  return deployedMembers;
}

export function estimateDistrictDefense({ districtType, isOccupied, districtId }) {
  const baseDefenseByType = {
    downtown: 58,
    industrial: 42,
    economy: 36,
    resident: 30,
    park: 24
  };

  const deterministicVariance = ((Number(districtId) || 0) % 5) * 2;
  const occupationBonus = isOccupied ? 12 : 0;
  return (baseDefenseByType[districtType] || 28) + deterministicVariance + occupationBonus;
}

export function resolveAttackOutcome({
  attackPower,
  defensePower,
  catastropheRoll = Math.random(),
  successRoll = Math.random()
}) {
  if (catastropheRoll < 0.08) {
    return {
      key: "catastrophe",
      label: "Katastrofa",
      capturesDistrict: false,
      destroysDistrict: true,
      attackerLossRatio: 1,
      defenseLossRatio: 1
    };
  }

  if (attackPower > defensePower) {
    if (successRoll < 0.7) {
      return {
        key: "total-success",
        label: "Totální úspěch",
        capturesDistrict: true,
        destroysDistrict: false,
        attackerLossRatio: 0,
        defenseLossRatio: 1
      };
    }

    return {
      key: "pyrrhic-victory",
      label: "Pyrrhovo vítězství",
      capturesDistrict: false,
      destroysDistrict: false,
      attackerLossRatio: 0.5,
      defenseLossRatio: 0
    };
  }

  return {
    key: "failure",
    label: "Neúspěch",
    capturesDistrict: false,
    destroysDistrict: false,
    attackerLossRatio: 1,
    defenseLossRatio: 0.2
  };
}

export function getRobberyScenarioMemberLoss(scenarioLabel, deployedMembers) {
  if (scenarioLabel === "Úspěch") return getRobberyMemberLoss(deployedMembers, true);
  if (scenarioLabel === "Selhání") return getRobberyMemberLoss(deployedMembers, false);
  return 0;
}

export function getRobberyLootForOrder(order, scenarioLabel) {
  if (scenarioLabel === "Selhání") {
    return {};
  }
  return resolveRobberyOrderOutcome(order).loot;
}

export const ROBBERY_ZONE_CONFIG = Object.freeze({
  park: Object.freeze({
    label: "Park",
    recommendedMin: 6,
    recommendedMax: 10,
    difficulty: 10,
    zoneHeat: 1,
    loot: Object.freeze({
      biomass: Object.freeze([2, 5]),
      chemicals: Object.freeze([1, 3])
    })
  }),
  residential: Object.freeze({
    label: "Residential",
    recommendedMin: 8,
    recommendedMax: 14,
    difficulty: 16,
    zoneHeat: 2,
    loot: Object.freeze({
      biomass: Object.freeze([3, 7]),
      chemicals: Object.freeze([2, 5])
    })
  }),
  industrial: Object.freeze({
    label: "Industrial",
    recommendedMin: 12,
    recommendedMax: 20,
    difficulty: 24,
    zoneHeat: 4,
    loot: Object.freeze({
      "metal-parts": Object.freeze([5, 10]),
      "tech-core": Object.freeze([1, 3])
    })
  }),
  commercial: Object.freeze({
    label: "Commercial",
    recommendedMin: 16,
    recommendedMax: 26,
    difficulty: 32,
    zoneHeat: 6,
    loot: Object.freeze({
      chemicals: Object.freeze([5, 11]),
      "metal-parts": Object.freeze([4, 9])
    })
  }),
  downtown: Object.freeze({
    label: "Downtown",
    recommendedMin: 28,
    recommendedMax: 45,
    difficulty: 48,
    zoneHeat: 10,
    loot: Object.freeze({
      "tech-core": Object.freeze([2, 5]),
      chemicals: Object.freeze([8, 15]),
      "metal-parts": Object.freeze([8, 15])
    })
  })
});

export const ROBBERY_DISTRICT_LOOT_POOLS = Object.freeze({
  pharmacy: Object.freeze([
    Object.freeze({ itemId: "chemicals", label: "Chemicals", range: Object.freeze([2, 5]) }),
    Object.freeze({ itemId: "biomass", label: "Biomass", range: Object.freeze([2, 5]) }),
    Object.freeze({ itemId: "stim-pack", label: "Stim Pack", range: Object.freeze([1, 2]) })
  ]),
  lab: Object.freeze([
    Object.freeze({ itemId: "neon-dust", label: "Neon Dust", range: Object.freeze([1, 3]) }),
    Object.freeze({ itemId: "pulse-shot", label: "Pulse Shot", range: Object.freeze([1, 2]) }),
    Object.freeze({ itemId: "velvet-smoke", label: "Velvet Smoke", range: Object.freeze([1, 2]) }),
    Object.freeze({ itemId: "ghost-serum", label: "Ghost Serum", range: Object.freeze([1, 1]) }),
    Object.freeze({ itemId: "overdrive-x", label: "Overdrive X", range: Object.freeze([1, 1]) })
  ]),
  armory: Object.freeze([
    Object.freeze({ itemId: "baseball-bat", label: "Baseballová pálka", range: Object.freeze([1, 3]) }),
    Object.freeze({ itemId: "pistol", label: "Pistole", range: Object.freeze([1, 2]) }),
    Object.freeze({ itemId: "grenade", label: "Granát", range: Object.freeze([1, 2]) }),
    Object.freeze({ itemId: "smg", label: "SMG", range: Object.freeze([1, 1]) }),
    Object.freeze({ itemId: "vest", label: "Vesta", range: Object.freeze([1, 2]) }),
    Object.freeze({ itemId: "barricades", label: "Barikády", range: Object.freeze([1, 2]) }),
    Object.freeze({ itemId: "cameras", label: "Kamery", range: Object.freeze([1, 1]) }),
    Object.freeze({ itemId: "defense-tower", label: "Defense tower", range: Object.freeze([1, 1]) }),
    Object.freeze({ itemId: "alarm", label: "Alarm", range: Object.freeze([1, 2]) })
  ]),
  factory: Object.freeze([
    Object.freeze({ itemId: "metal-parts", label: "Metal Parts", range: Object.freeze([2, 5]) }),
    Object.freeze({ itemId: "tech-core", label: "Tech Core", range: Object.freeze([1, 2]) }),
    Object.freeze({ itemId: "combat-module", label: "Bojový modul", range: Object.freeze([1, 1]) })
  ])
});

const ROBBERY_ZONE_LOOT_CATEGORY_HINTS = Object.freeze({
  park: Object.freeze(["pharmacy", "lab", "armory", "factory"]),
  residential: Object.freeze(["pharmacy", "armory", "lab", "factory"]),
  industrial: Object.freeze(["factory", "armory", "pharmacy", "lab"]),
  commercial: Object.freeze(["pharmacy", "factory", "lab", "armory"]),
  downtown: Object.freeze(["factory", "armory", "lab", "pharmacy"])
});

export const ROBBERY_RISK_LABELS = Object.freeze({
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  overkill: "Overkill"
});

export const ROBBERY_RISK_DESCRIPTIONS = Object.freeze({
  critical: "Crew je hluboko pod minimem. Šance na průser je extrémní.",
  high: "Pod doporučením. Dá se to zkusit, ale ztráty můžou bolet.",
  medium: "Doporučené nasazení pro danou zónu.",
  low: "Silná sestava. Riziko klesá, ale heat pořád roste.",
  overkill: "Zbytečně velká akce. Úspěch je pravděpodobný, heat bude hlasitý."
});

export const ROBBERY_LOOT_LABELS = Object.freeze({
  park: "District stash: 2-3 položky",
  residential: "District stash: 2-3 položky",
  industrial: "District stash: 2-3 položky",
  commercial: "District stash: 2-3 položky",
  downtown: "District stash: 2-3 položky"
});

export function normalizeRobberyZone(districtType) {
  const key = String(districtType || "").trim().toLowerCase();
  if (key === "resident" || key === "residential") return "residential";
  if (key === "economy" || key === "commercial") return "commercial";
  if (key === "industrial") return "industrial";
  if (key === "downtown") return "downtown";
  return "park";
}

export function normalizeRobberyDistrictId(value) {
  const direct = Number(value);
  if (Number.isFinite(direct) && direct > 0) {
    return Math.floor(direct);
  }

  const match = String(value || "").match(/\d+/u);
  const parsed = match ? Number(match[0]) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function getRobberyZoneConfig(districtType) {
  return ROBBERY_ZONE_CONFIG[normalizeRobberyZone(districtType)];
}

export function getRobberyRiskLevel(districtType, sentMembers) {
  const config = getRobberyZoneConfig(districtType);
  const sent = normalizeRobberyMembers(sentMembers);

  if (sent < config.recommendedMin * 0.5) return "critical";
  if (sent < config.recommendedMin) return "high";
  if (sent <= config.recommendedMax) return "medium";
  if (sent <= config.recommendedMax * 1.5) return "low";
  return "overkill";
}

export function getRobberySuccessChance(districtType, sentMembers) {
  const config = getRobberyZoneConfig(districtType);
  const sent = normalizeRobberyMembers(sentMembers);
  return clampNumber(45 + sent * 2 - config.difficulty, 8, 88);
}

export function getRobberyHeatGain(districtType, sentMembers) {
  const config = getRobberyZoneConfig(districtType);
  const sent = normalizeRobberyMembers(sentMembers);
  return 3 + Math.ceil(sent / 5) + config.zoneHeat;
}

export function createRobberySetupPreview({ districtType = "park", districtId = 0, sentMembers = 0, hasScoutReport = true } = {}) {
  const config = getRobberyZoneConfig(districtType);
  const riskLevel = getRobberyRiskLevel(districtType, sentMembers);
  const successChance = getRobberySuccessChance(districtType, sentMembers);
  const heatGain = getRobberyHeatGain(districtType, sentMembers);
  const zoneKey = normalizeRobberyZone(districtType);
  const scoutReportActive = Boolean(hasScoutReport);
  const districtLootLabel = getRobberyDistrictLootLabel(districtType, districtId);

  return {
    zoneKey,
    zoneLabel: scoutReportActive ? config.label : "Neznámý sektor",
    recommendedMin: config.recommendedMin,
    recommendedMax: config.recommendedMax,
    recommendationLabel: `${config.recommendedMin}-${config.recommendedMax}`,
    riskLevel,
    riskLabel: ROBBERY_RISK_LABELS[riskLevel],
    riskDescription: ROBBERY_RISK_DESCRIPTIONS[riskLevel],
    successChance,
    successChanceLabel: `${successChance}%`,
    heatGain,
    heatLabel: `+${heatGain}`,
    scoutReportActive,
    scoutReportLabel: scoutReportActive ? "Scout report aktivní" : "Bez scout reportu",
    previewRiskLabel: scoutReportActive ? ROBBERY_RISK_LABELS[riskLevel] : "Neznámé / Odhad",
    previewSuccessChanceLabel: scoutReportActive ? `${successChance}%` : "Odhad",
    previewLootLabel: scoutReportActive ? districtLootLabel : "Nejistý",
    previewTrapHintLabel: scoutReportActive ? "Past nepotvrzena" : "Neznámá",
    previewDescription: scoutReportActive
      ? `${ROBBERY_RISK_DESCRIPTIONS[riskLevel]} Scout report aktivní. Loot je stash konkrétního districtu.`
      : "Bez scout reportu je preview jen hrubý odhad. Spy není povinné pro spuštění Vykrást district."
  };
}

export function getRobberyMemberLoss(sentMembers, success, random = Math.random) {
  const sent = normalizeRobberyMembers(sentMembers);
  if (sent <= 0) {
    return 0;
  }

  const minRatio = success ? 0.05 : 0.25;
  const maxRatio = success ? 0.18 : 0.6;
  const roll = clampRatio(Number(random()));
  return Math.min(sent, Math.ceil(sent * (minRatio + (maxRatio - minRatio) * roll)));
}

export function rollRobberyLoot(districtType, success, random = Math.random, districtId = 0) {
  if (!success) {
    return {};
  }

  const lootTable = getRobberyDistrictLootTable(districtType, districtId);
  return Object.fromEntries(
    Object.entries(lootTable)
      .map(([itemId, [minAmount, maxAmount]]) => [
        itemId,
        rollInteger(minAmount, maxAmount, random)
      ])
      .filter(([, amount]) => amount > 0)
  );
}

export function resolveRobberyOrderOutcome(order = {}, options = {}) {
  const random = typeof options.random === "function" ? options.random : Math.random;
  const districtType = order.targetDistrictType || order.districtType || "park";
  const targetDistrictId = normalizeRobberyDistrictId(order.targetDistrictId || order.districtId);
  const deployedMembers = normalizeRobberyMembers(order.deployedMembers);
  const successChance = getRobberySuccessChance(districtType, deployedMembers);
  const successRoll = clampRatio(Number(random()));
  const success = successRoll * 100 < successChance;
  const memberLoss = getRobberyMemberLoss(deployedMembers, success, random);
  const loot = rollRobberyLoot(districtType, success, random, targetDistrictId);
  const preview = createRobberySetupPreview({ districtType, districtId: targetDistrictId, sentMembers: deployedMembers });

  return {
    ...preview,
    success,
    scenarioLabel: success ? "Úspěch" : "Selhání",
    successRoll,
    deployedMembers,
    memberLoss,
    returningMembers: Math.max(0, deployedMembers - memberLoss),
    loot,
    heatGain: getRobberyHeatGain(districtType, deployedMembers)
  };
}

export function getRobberyDistrictLootTable(districtType = "park", districtId = 0) {
  const zoneKey = normalizeRobberyZone(districtType);
  const normalizedDistrictId = normalizeRobberyDistrictId(districtId);
  const seed = normalizedDistrictId > 0 ? `${zoneKey}:district:${normalizedDistrictId}` : `${zoneKey}:fallback`;
  const random = createDeterministicUnitRandom(seed);
  const categoryOrder = shuffleRobberyLootEntries(
    ROBBERY_ZONE_LOOT_CATEGORY_HINTS[zoneKey] || ROBBERY_ZONE_LOOT_CATEGORY_HINTS.park,
    random
  );
  const itemCount = 2 + Math.floor(random() * 2);
  const selectedItems = [];

  for (const category of categoryOrder) {
    const categoryItems = ROBBERY_DISTRICT_LOOT_POOLS[category] || [];
    const candidates = shuffleRobberyLootEntries(categoryItems, random)
      .filter((item) => !selectedItems.some((selected) => selected.itemId === item.itemId));
    if (candidates[0]) {
      selectedItems.push(candidates[0]);
    }
    if (selectedItems.length >= itemCount) {
      break;
    }
  }

  return Object.freeze(Object.fromEntries(
    selectedItems.slice(0, itemCount).map((item) => [
      item.itemId,
      Object.freeze([...item.range])
    ])
  ));
}

export function getRobberyDistrictLootLabel(districtType = "park", districtId = 0) {
  const table = getRobberyDistrictLootTable(districtType, districtId);
  const labelsByItemId = new Map(
    Object.values(ROBBERY_DISTRICT_LOOT_POOLS)
      .flatMap((items) => items.map((item) => [item.itemId, item.label]))
  );
  const labels = Object.keys(table).map((itemId) => labelsByItemId.get(itemId) || itemId);
  return labels.join(" / ") || ROBBERY_LOOT_LABELS[normalizeRobberyZone(districtType)] || "District stash";
}

function normalizeRobberyMembers(value) {
  return Math.max(0, Math.floor(Number(value) || 0));
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
}

function clampRatio(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  return Math.min(1, Math.max(0, number));
}

function rollInteger(min, max, random) {
  const safeMin = Math.max(0, Math.floor(Number(min) || 0));
  const safeMax = Math.max(safeMin, Math.floor(Number(max) || safeMin));
  const roll = Math.min(0.999999, clampRatio(Number(random())));
  return safeMin + Math.floor(roll * (safeMax - safeMin + 1));
}

function createDeterministicUnitRandom(seedValue) {
  let state = 2166136261;
  const seed = String(seedValue || "robbery-loot");
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleRobberyLootEntries(entries, random) {
  const output = [...entries];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(clampRatio(Number(random())) * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}
