export const ATTACK_WEAPON_IDS = [
  "baseball-bat",
  "pistol",
  "grenade",
  "smg",
  "bazooka"
] as const;

export const DEFENSE_WEAPON_IDS = [
  "vest",
  "barricades",
  "cameras",
  "defense-tower",
  "alarm"
] as const;

export type AttackWeaponId = (typeof ATTACK_WEAPON_IDS)[number];
export type DefenseWeaponId = (typeof DEFENSE_WEAPON_IDS)[number];

export interface AttackWeaponDefinition {
  id: AttackWeaponId;
  name: string;
  specialRule: string;
}

export interface DefenseWeaponDefinition {
  id: DefenseWeaponId;
  name: string;
  defensePower: number;
  specialRule: string;
}

export const ATTACK_WEAPONS: readonly AttackWeaponDefinition[] = [
  {
    id: "baseball-bat",
    name: "Baseballová pálka",
    specialRule: "Základní melee útočná zbraň bez speciálního bonusu."
  },
  {
    id: "pistol",
    name: "Pistole",
    specialRule: "Stabilní standardní střelná zbraň bez dodatečného efektu."
  },
  {
    id: "grenade",
    name: "Granát",
    specialRule: "Ignoruje 0,3 % obrany cílového districtu za každý použitý kus."
  },
  {
    id: "smg",
    name: "SMG",
    specialRule: "Při použití všech 5 attack zbraní v jednom útoku získá každé SMG bonus +0,2 power za kus."
  },
  {
    id: "bazooka",
    name: "Bazuka",
    specialRule: "Každý kus zvyšuje šanci na totální destrukci napadeného districtu o 0,5 %."
  }
] as const;

export const DEFENSE_WEAPONS: readonly DefenseWeaponDefinition[] = [
  {
    id: "vest",
    name: "Vesta",
    defensePower: 6,
    specialRule: "Snižuje ztráty počtu obyvatel gangu o 0,5 % za kus."
  },
  {
    id: "barricades",
    name: "Barikády",
    defensePower: 12,
    specialRule: "Základní silná statická obrana bez dalšího bonusu."
  },
  {
    id: "cameras",
    name: "Kamery",
    defensePower: 6,
    specialRule: "Při 5 a více kusech je vysoká základní šance na odhalení špeha; frakce ji mohou dále modifikovat."
  },
  {
    id: "defense-tower",
    name: "Defense tower",
    defensePower: 20,
    specialRule: "Každý kus snižuje útočníkovi sílu útoku o 0,3 %."
  },
  {
    id: "alarm",
    name: "Alarm",
    defensePower: 10,
    specialRule: "Při 5 a více kusech je vysoká základní šance, že vykradení hráče selže; frakce ji mohou dále modifikovat."
  }
] as const;

export const getAttackWeaponDefinition = (
  weaponId: AttackWeaponId
): AttackWeaponDefinition | undefined => ATTACK_WEAPONS.find((weapon) => weapon.id === weaponId);

export const getDefenseWeaponDefinition = (
  weaponId: DefenseWeaponId
): DefenseWeaponDefinition | undefined => DEFENSE_WEAPONS.find((weapon) => weapon.id === weaponId);
