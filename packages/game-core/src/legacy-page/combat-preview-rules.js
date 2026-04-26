import { ATTACK_SETUP_WEAPONS } from "../../../game-config/src/legacy-page/combat-config.js";

export function calculateAttackDeployment(loadout = {}) {
  return Object.entries(loadout).reduce(
    (totals, [weaponId, amount]) => {
      const weapon = ATTACK_SETUP_WEAPONS[weaponId];
      const normalizedAmount = Math.max(0, Number.parseInt(String(amount ?? 0), 10) || 0);

      if (!weapon || normalizedAmount <= 0) {
        return totals;
      }

      return {
        totalResidents: totals.totalResidents + normalizedAmount * weapon.residents,
        totalPower: totals.totalPower + normalizedAmount * weapon.power
      };
    },
    { totalResidents: 0, totalPower: 0 }
  );
}

const DEFENSE_POWER_BY_WEAPON = {
  vest: 6,
  barricades: 12,
  cameras: 6,
  "defense-tower": 20,
  alarm: 10
};

const DEFENSE_LABEL_BY_WEAPON = {
  vest: "Vesta",
  barricades: "Barikády",
  cameras: "Kamery",
  "defense-tower": "Defense tower",
  alarm: "Alarm"
};

export function calculateDefensePower(loadout = {}) {
  return Object.entries(loadout).reduce((totalPower, [weaponId, amount]) => {
    const normalizedAmount = Math.max(0, Number.parseInt(String(amount ?? 0), 10) || 0);
    return totalPower + normalizedAmount * (DEFENSE_POWER_BY_WEAPON[weaponId] ?? 0);
  }, 0);
}

export function calculateTotalDefensePower({ loadout = {}, residents = 0 } = {}) {
  const normalizedResidents = Math.max(0, Number.parseInt(String(residents ?? 0), 10) || 0);
  return calculateDefensePower(loadout) + normalizedResidents;
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
  const targetDistrictId = Number.parseInt(String(order?.targetDistrictId ?? "0").replace("district:", ""), 10) || 0;
  return `Scénář ${((targetDistrictId - 1) % 4) + 1}`;
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
  if (scenarioLabel === "Scénář 1") return Math.min(deployedMembers, 1);
  if (scenarioLabel === "Scénář 2") return Math.min(deployedMembers, 3);
  if (scenarioLabel === "Scénář 3") return Math.min(deployedMembers, 5);
  if (scenarioLabel === "Scénář 4") return Math.min(deployedMembers, 8);
  return 0;
}

export function getRobberyLootForOrder(order, scenarioLabel) {
  const targetDistrictId = Number.parseInt(String(order?.targetDistrictId ?? "0").replace("district:", ""), 10) || 0;
  const lootTables = {
    1: { chemicals: 8, biomass: 6 },
    2: { chemicals: 5, "metal-parts": 4 },
    3: { biomass: 4, "tech-core": 2 },
    4: { chemicals: 3, biomass: 2, "stim-pack": 1 }
  };

  if (scenarioLabel === "Scénář 4") {
    return {};
  }

  return lootTables[((targetDistrictId - 1) % 4) + 1] || {};
}
