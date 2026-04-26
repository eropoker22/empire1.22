import type { District, GameModeId, Player } from "@empire/shared-types";
import type { DistrictBuildingSliceSeedDistrict } from "../../seed/src";
import {
  type LegacyMapDistrictRecord,
  normalizeMapDistrictBuildingDisplayNames,
  normalizeMapDistrictBuildings,
  normalizeMapDistrictName,
  normalizeMapDistrictNumber,
  normalizeMapDistrictString,
  normalizeMapDistrictZone,
  readLegacyMapDistrictsByNumber
} from "./live-gameplay-map-districts";
import {
  findFallbackNeighborDistrictNumber,
  isRecord,
  normalizeAttackLoadout,
  normalizeDefenseLoadout,
  normalizeDistrictNumber,
  normalizeFactionId,
  normalizeIdentity,
  normalizeMode,
  normalizeServerId,
  orderDistrictNumbers,
  readDatasetDistrictLabel,
  toDistrictId,
  toDistrictNumber,
  uniqueNumbers
} from "./live-gameplay-slice-normalizers";

const SESSION_STORAGE_KEY = "empireStreets.session.v1";
const FALLBACK_PLAYER_ID = "Ty";
const FALLBACK_DISTRICT_NUMBER = 27;

interface LegacyAuthoritySession {
  registration?: {
    identity?: string;
    factionId?: Player["factionId"];
    gangColor?: string;
    serverId?: string;
    serverMode?: string;
    startDistrictId?: number | string;
  } | null;
  inventory?: {
    weapons?: Record<string, unknown>;
  } | null;
  world?: {
    ownedDistrictIds?: unknown[];
    destroyedDistrictIds?: unknown[];
    districtDefenseLoadoutById?: Record<string, unknown>;
  } | null;
}

interface LegacyDistrictStateSnapshot {
  revealedDistrictIds?: unknown[];
  ownedDistrictIds?: unknown[];
  destroyedDistrictIds?: unknown[];
}

export interface LiveGameplaySliceBootstrap {
  instanceId: string;
  playerId: string;
  playerName: string;
  playerFactionId: Player["factionId"];
  playerColor: Player["color"] | string | null;
  districtId: string;
  mode: GameModeId;
  playerAttackLoadout: Player["attackLoadout"];
  homeDistrict: Partial<DistrictBuildingSliceSeedDistrict>;
  extraDistricts: DistrictBuildingSliceSeedDistrict[];
}

declare global {
  interface Window {
    empireStreetsServerState?: {
      session?: unknown;
    };
    empireStreetsServerSession?: unknown;
    empireStreetsDistrictState?: {
      getState?: () => LegacyDistrictStateSnapshot;
    };
  }
}

export const resolveLiveGameplaySliceBootstrap = (): LiveGameplaySliceBootstrap => {
  const session = readAuthoritySession();
  const districtState = readDistrictState();
  const mode = normalizeMode(session?.registration?.serverMode);
  const playerName = normalizeIdentity(session?.registration?.identity, FALLBACK_PLAYER_ID);
  const playerId = playerName;
  const playerFactionId = normalizeFactionId(session?.registration?.factionId);
  const playerColor = session?.registration?.gangColor ?? null;
  const playerAttackLoadout = normalizeAttackLoadout(session?.inventory?.weapons);
  const homeDistrictNumber = resolveHomeDistrictNumber(session, districtState);
  const districtNumbers = resolveDistrictNumbers(homeDistrictNumber, session, districtState);
  const districtIds = districtNumbers.map(toDistrictId);
  const defenseLoadouts = session?.world?.districtDefenseLoadoutById || {};
  const ownedDistrictNumbers = new Set(resolveOwnedDistrictNumbers(session, districtState, homeDistrictNumber));
  const legacyMapDistricts = readLegacyMapDistrictsByNumber();
  const homeDistrict = createDistrictSeed({
    districtId: toDistrictId(homeDistrictNumber),
    allDistrictIds: districtIds,
    playerId,
    isOwnedByPlayer: true,
    defenseLoadout: normalizeDefenseLoadout(defenseLoadouts[String(homeDistrictNumber)]),
    mapDistrict: legacyMapDistricts.get(homeDistrictNumber)
  });
  const extraDistricts = districtIds.filter((districtId) => districtId !== toDistrictId(homeDistrictNumber)).map((districtId) =>
    createDistrictSeed({
      districtId,
      allDistrictIds: districtIds,
      playerId,
      isOwnedByPlayer: ownedDistrictNumbers.has(toDistrictNumber(districtId)),
      defenseLoadout: normalizeDefenseLoadout(defenseLoadouts[String(toDistrictNumber(districtId))]),
      mapDistrict: legacyMapDistricts.get(toDistrictNumber(districtId))
    })
  );

  return {
    instanceId: `instance:${normalizeServerId(session?.registration?.serverId)}`,
    playerId,
    playerName,
    playerFactionId,
    playerColor,
    districtId: toDistrictId(homeDistrictNumber),
    mode,
    playerAttackLoadout,
    homeDistrict,
    extraDistricts
  };
};

const readAuthoritySession = (): LegacyAuthoritySession | null => {
  const serverSession = window.empireStreetsServerState?.session || window.empireStreetsServerSession;

  if (isRecord(serverSession)) {
    return serverSession as LegacyAuthoritySession;
  }

  try {
    const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue);
    return isRecord(parsedValue) ? (parsedValue as LegacyAuthoritySession) : null;
  } catch {
    return null;
  }
};

const readDistrictState = (): LegacyDistrictStateSnapshot | null => {
  try {
    const state = window.empireStreetsDistrictState?.getState?.();
    return isRecord(state) ? (state as LegacyDistrictStateSnapshot) : null;
  } catch {
    return null;
  }
};

const resolveHomeDistrictNumber = (
  session: LegacyAuthoritySession | null,
  districtState: LegacyDistrictStateSnapshot | null
): number => {
  const registrationDistrict = normalizeDistrictNumber(session?.registration?.startDistrictId);

  if (registrationDistrict > 0) {
    return registrationDistrict;
  }

  const ownedDistrictId = resolveOwnedDistrictNumbers(session, districtState)[0];

  if (ownedDistrictId > 0) {
    return ownedDistrictId;
  }

  const domDistrict = normalizeDistrictNumber(readDatasetDistrictLabel("[data-gang-start-district]"));
  return domDistrict > 0 ? domDistrict : FALLBACK_DISTRICT_NUMBER;
};

const resolveDistrictNumbers = (
  homeDistrictNumber: number,
  session: LegacyAuthoritySession | null,
  districtState: LegacyDistrictStateSnapshot | null
): number[] => {
  const ownedDistrictNumbers = resolveOwnedDistrictNumbers(session, districtState, homeDistrictNumber);
  const revealedDistrictNumbers = uniqueNumbers(
    districtState?.revealedDistrictIds,
    districtState?.destroyedDistrictIds,
    session?.world?.destroyedDistrictIds
  ).filter((districtNumber) => !ownedDistrictNumbers.includes(districtNumber));
  const knownDistrictNumbers = uniqueNumbers([homeDistrictNumber], ownedDistrictNumbers, revealedDistrictNumbers);

  if (knownDistrictNumbers.some((districtNumber) => !ownedDistrictNumbers.includes(districtNumber))) {
    return orderDistrictNumbers(homeDistrictNumber, knownDistrictNumbers);
  }

  return orderDistrictNumbers(homeDistrictNumber, [
    ...knownDistrictNumbers,
    findFallbackNeighborDistrictNumber(homeDistrictNumber, new Set(knownDistrictNumbers))
  ]);
};

const resolveOwnedDistrictNumbers = (
  session: LegacyAuthoritySession | null,
  districtState: LegacyDistrictStateSnapshot | null,
  homeDistrictNumber?: number
): number[] =>
  uniqueNumbers(
    session?.world?.ownedDistrictIds,
    districtState?.ownedDistrictIds,
    homeDistrictNumber ? [homeDistrictNumber] : []
  );

const createDistrictSeed = ({
  districtId,
  allDistrictIds,
  playerId,
  isOwnedByPlayer,
  defenseLoadout,
  mapDistrict
}: {
  districtId: string;
  allDistrictIds: string[];
  playerId: string;
  isOwnedByPlayer: boolean;
  defenseLoadout: District["defenseLoadout"];
  mapDistrict?: LegacyMapDistrictRecord;
}): DistrictBuildingSliceSeedDistrict => ({
  id: districtId,
  name: normalizeMapDistrictName(mapDistrict, districtId),
  ownerPlayerId: isOwnedByPlayer ? playerId : null,
  status: isOwnedByPlayer ? "claimed" : "neutral",
  zone: normalizeMapDistrictZone(mapDistrict),
  heat: normalizeMapDistrictNumber(mapDistrict?.heat),
  influence: normalizeMapDistrictNumber(mapDistrict?.influence),
  legacyBuildingNames: normalizeMapDistrictBuildings(mapDistrict),
  legacyBuildingDisplayNames: normalizeMapDistrictBuildingDisplayNames(mapDistrict),
  buildingSetKey: normalizeMapDistrictString(mapDistrict?.buildingSetKey),
  buildingSetTitle: normalizeMapDistrictString(mapDistrict?.buildingSetTitle),
  buildingTier: normalizeMapDistrictString(mapDistrict?.buildingTier),
  adjacentDistrictIds: allDistrictIds.filter((candidateId) => candidateId !== districtId),
  defenseLoadout
});
