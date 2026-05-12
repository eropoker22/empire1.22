import { ATTACK_SETUP_WEAPONS } from "../../../packages/game-config/src/legacy-page/combat-config.js";
import { getEmpireDataNamespace, registerEmpireData } from "./registry.js";

export const ATTACK_WEAPON_IDS = Object.freeze(["baseball-bat", "pistol", "grenade", "smg", "bazooka"]);

export const WEAPON_LABELS = Object.freeze({
  "baseball-bat": "Baseballová pálka",
  pistol: "Pistole",
  grenade: "Granát",
  smg: "SMG",
  bazooka: "Bazuka",
  vest: "Vesta",
  barricades: "Barikády",
  cameras: "Kamery",
  "defense-tower": "Defense tower",
  alarm: "Alarm"
});

export const ATTACK_WEAPON_LABELS = WEAPON_LABELS;

export const attackWeaponStats = Object.freeze(
  Object.fromEntries(
    Object.entries(ATTACK_SETUP_WEAPONS).map(([weaponId, stats]) => [
      weaponId,
      Object.freeze({ ...stats })
    ])
  )
);

export const weaponCatalog = Object.freeze(
  ATTACK_WEAPON_IDS.map((weaponId) => Object.freeze({
    id: weaponId,
    label: WEAPON_LABELS[weaponId] || weaponId,
    ...(attackWeaponStats[weaponId] || {})
  }))
);

export const weaponsData = registerEmpireData("weapons", Object.freeze({
  weaponCatalog,
  attackWeaponStats,
  attackWeaponIds: ATTACK_WEAPON_IDS,
  weaponLabels: WEAPON_LABELS
}));

Object.assign(registerEmpireData("catalogs", getEmpireDataNamespace().catalogs || {}), {
  weaponCatalog,
  attackWeaponStats
});
