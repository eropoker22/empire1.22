import { PLAYER_FACTION_IDS, type District, type GameModeId, type Player } from "@empire/shared-types";

const FALLBACK_MODE: GameModeId = "free";
const FALLBACK_SERVER_ID = "admin-slice";
const ATTACK_LOADOUT_KEYS = ["pistol", "grenade", "smg", "bazooka"] as const;
const DEFENSE_LOADOUT_KEYS = ["vest", "barricades", "cameras", "defense-tower", "alarm"] as const;

export const normalizeMode = (mode: unknown): GameModeId => (mode === "war" ? "war" : FALLBACK_MODE);

export const normalizeServerId = (serverId: unknown): string => {
  const source = String(serverId || readDatasetValue("[data-gang-server]") || "").trim().replace(/^instance:/i, "");
  return source ? source.toLowerCase().replace(/\s+/g, "-") : FALLBACK_SERVER_ID;
};

export const normalizeIdentity = (identity: unknown, fallbackPlayerId: string): string => {
  const normalizedIdentity = String(identity || "").trim();
  return normalizedIdentity || fallbackPlayerId;
};

export const normalizeFactionId = (factionId: unknown): Player["factionId"] => {
  const normalizedFactionId = String(factionId || "").trim();
  return PLAYER_FACTION_IDS.includes(normalizedFactionId as Player["factionId"])
    ? (normalizedFactionId as Player["factionId"])
    : "mafian";
};

export const normalizeAttackLoadout = (weapons: Record<string, unknown> | null | undefined): Player["attackLoadout"] =>
  ATTACK_LOADOUT_KEYS.reduce<Player["attackLoadout"]>((loadout, weaponId) => {
    loadout[weaponId] = normalizeCount(weapons?.[weaponId]);
    return loadout;
  }, {});

export const normalizeDefenseLoadout = (loadout: unknown): District["defenseLoadout"] => {
  if (!isRecord(loadout)) {
    return {};
  }

  return DEFENSE_LOADOUT_KEYS.reduce<District["defenseLoadout"]>((normalizedLoadout, weaponId) => {
    const amount = normalizeCount(loadout[weaponId]);

    if (amount > 0) {
      normalizedLoadout[weaponId] = amount;
    }

    return normalizedLoadout;
  }, {});
};

export const uniqueNumbers = (...sources: Array<unknown[] | readonly unknown[] | undefined>): number[] => {
  const normalizedNumbers = new Set<number>();

  sources.forEach((source) => {
    if (!Array.isArray(source)) {
      return;
    }

    source.forEach((value) => {
      const normalizedValue = normalizeDistrictNumber(value);

      if (normalizedValue > 0) {
        normalizedNumbers.add(normalizedValue);
      }
    });
  });

  return Array.from(normalizedNumbers).sort((left, right) => left - right);
};

export const orderDistrictNumbers = (homeDistrictNumber: number, districtNumbers: number[]): number[] => [
  homeDistrictNumber,
  ...districtNumbers.filter((districtNumber) => districtNumber !== homeDistrictNumber)
];

export const findFallbackNeighborDistrictNumber = (homeDistrictNumber: number, knownDistricts: Set<number>): number => {
  let offset = 1;

  while (knownDistricts.has(homeDistrictNumber + offset)) {
    offset += 1;
  }

  return homeDistrictNumber + offset;
};

export const normalizeDistrictNumber = (value: unknown): number => {
  const normalized = Number.parseInt(String(value || "").replace(/[^0-9-]/g, ""), 10);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
};

export const toDistrictId = (districtNumber: number): string => `district:${districtNumber}`;

export const toDistrictNumber = (districtId: string): number => normalizeDistrictNumber(districtId);

export const formatDistrictName = (districtId: string): string => `District ${toDistrictNumber(districtId)}`;

export const readDatasetDistrictLabel = (selector: string): string => {
  const rawValue = readDatasetValue(selector);
  const matchedDistrictNumber = rawValue.match(/\d+/);
  return matchedDistrictNumber?.[0] || rawValue;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeCount = (value: unknown): number => {
  const normalized = Number.parseInt(String(value ?? 0), 10);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
};

const readDatasetValue = (selector: string): string => {
  const element = document.querySelector<HTMLElement>(selector);
  return String(element?.textContent || "").trim();
};
