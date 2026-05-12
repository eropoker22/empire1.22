import {
  DEFENSE_LABEL_BY_WEAPON,
  DEFENSE_POWER_BY_WEAPON
} from "../../../packages/game-core/src/legacy-page/combat-preview-rules.js";
import { getEmpireDataNamespace, registerEmpireData } from "./registry.js";

export const DEFENSE_WEAPON_IDS = Object.freeze(["vest", "barricades", "cameras", "defense-tower", "alarm"]);

export const defenseWeaponStats = Object.freeze(
  Object.fromEntries(
    DEFENSE_WEAPON_IDS.map((weaponId) => [
      weaponId,
      Object.freeze({ power: DEFENSE_POWER_BY_WEAPON[weaponId] || 0 })
    ])
  )
);

export const defenseCatalog = Object.freeze(
  DEFENSE_WEAPON_IDS.map((weaponId) => Object.freeze({
    id: weaponId,
    label: DEFENSE_LABEL_BY_WEAPON[weaponId] || weaponId,
    ...(defenseWeaponStats[weaponId] || {})
  }))
);

export const defensesData = registerEmpireData("defenses", Object.freeze({
  defenseCatalog,
  defenseWeaponStats,
  defenseWeaponIds: DEFENSE_WEAPON_IDS,
  defenseWeaponLabels: DEFENSE_LABEL_BY_WEAPON
}));

Object.assign(registerEmpireData("catalogs", getEmpireDataNamespace().catalogs || {}), {
  defenseCatalog,
  defenseWeaponStats
});
