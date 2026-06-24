import type { LobbyClubBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { LobbyClubMetadata } from "./lobbyClubTypes";

export const getLobbyClubMetadata = (
  building: CoreGameState["buildingsById"][string],
  tick = 0
): LobbyClubMetadata => cleanupLobbyClubMetadata(readLobbyClubMetadata(building), tick);

export const withLobbyClubMetadata = (
  building: CoreGameState["buildingsById"][string],
  lobbyClub: LobbyClubMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  lobbyClub
});

export const getOwnedLobbyClubCount = (
  state: CoreGameState,
  playerId: string | null | undefined,
  config: LobbyClubBalanceConfig
): number =>
  playerId
    ? Object.values(state.buildingsById).filter((building) =>
        building.buildingTypeId === config.buildingTypeId && building.ownerPlayerId === playerId && building.status === "active"
      ).length
    : 0;

export const getOwnedLobbyClubs = (
  state: CoreGameState,
  playerId: string | null | undefined,
  config: LobbyClubBalanceConfig
): CoreGameState["buildingsById"][string][] =>
  playerId
    ? Object.values(state.buildingsById)
        .filter((building) => building.buildingTypeId === config.buildingTypeId && building.ownerPlayerId === playerId && building.status === "active")
        .sort((a, b) => a.id.localeCompare(b.id))
    : [];

export const resolveLobbyClubTier = (
  ownedCount: number,
  config: LobbyClubBalanceConfig
): LobbyClubBalanceConfig["lobbyPressureTiers"][number] | null =>
  config.lobbyPressureTiers.find((tier) => ownedCount >= tier.minOwned && ownedCount <= tier.maxOwned)
    ?? config.lobbyPressureTiers.find((tier) => ownedCount >= tier.minOwned)
    ?? null;

export const appendLobbyRiskEvent = (
  metadata: LobbyClubMetadata,
  actionId: string,
  riskPct: number,
  expiresAtTick: number,
  tick: number
): LobbyClubMetadata => ({
  ...metadata,
  riskEvents: [...metadata.riskEvents, { actionId, riskPct, expiresAtTick, tick }].slice(-12)
});

export const hasOwnedBuilding = (
  state: CoreGameState,
  playerId: string | null | undefined,
  buildingTypeId: string
): boolean =>
  Boolean(playerId) && Object.values(state.buildingsById).some((building) =>
    building.ownerPlayerId === playerId && building.status === "active" && building.buildingTypeId === buildingTypeId
  );

export const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil(Math.max(0, minutes) * 60000 / Math.max(1, tickRateMs)));

const readLobbyClubMetadata = (building: CoreGameState["buildingsById"][string]): LobbyClubMetadata => {
  const raw = isRecord(building.metadata?.lobbyClub) ? building.metadata.lobbyClub : {};
  return {
    backroomPressureExpiresAtTick: asOptionalTick(raw.backroomPressureExpiresAtTick),
    mediaScreenExpiresAtTick: asOptionalTick(raw.mediaScreenExpiresAtTick),
    riskReductionExpiresAtTick: asOptionalTick(raw.riskReductionExpiresAtTick),
    nextInfluenceDiscountPct: asOptionalNumber(raw.nextInfluenceDiscountPct),
    nextInfluenceDiscountExpiresAtTick: asOptionalTick(raw.nextInfluenceDiscountExpiresAtTick),
    incomePenaltyUntilTick: asOptionalTick(raw.incomePenaltyUntilTick),
    influenceCostReductionDisabledUntilTick: asOptionalTick(raw.influenceCostReductionDisabledUntilTick),
    lastScandalCheckTick: asOptionalTick(raw.lastScandalCheckTick),
    riskEvents: Array.isArray(raw.riskEvents)
      ? raw.riskEvents.filter(isRecord).map((entry) => ({
          actionId: String(entry.actionId || ""),
          riskPct: Number(entry.riskPct || 0),
          expiresAtTick: Math.floor(Number(entry.expiresAtTick || 0)),
          tick: Math.floor(Number(entry.tick || 0))
        })).filter((entry) => entry.actionId)
      : [],
    scandalEvents: Array.isArray(raw.scandalEvents)
      ? raw.scandalEvents.filter(isRecord).map((entry) => ({
          type: String(entry.type || ""),
          tick: Math.floor(Number(entry.tick || 0)),
          label: String(entry.label || entry.type || ""),
          riskPct: Number(entry.riskPct || 0)
        })).filter((entry) => entry.type)
      : []
  };
};

const cleanupLobbyClubMetadata = (metadata: LobbyClubMetadata, tick: number): LobbyClubMetadata => ({
  ...metadata,
  backroomPressureExpiresAtTick: Number(metadata.backroomPressureExpiresAtTick || 0) > tick ? metadata.backroomPressureExpiresAtTick : undefined,
  mediaScreenExpiresAtTick: Number(metadata.mediaScreenExpiresAtTick || 0) > tick ? metadata.mediaScreenExpiresAtTick : undefined,
  riskReductionExpiresAtTick: Number(metadata.riskReductionExpiresAtTick || 0) > tick ? metadata.riskReductionExpiresAtTick : undefined,
  nextInfluenceDiscountPct: Number(metadata.nextInfluenceDiscountExpiresAtTick || 0) > tick ? metadata.nextInfluenceDiscountPct : undefined,
  nextInfluenceDiscountExpiresAtTick: Number(metadata.nextInfluenceDiscountExpiresAtTick || 0) > tick ? metadata.nextInfluenceDiscountExpiresAtTick : undefined,
  incomePenaltyUntilTick: Number(metadata.incomePenaltyUntilTick || 0) > tick ? metadata.incomePenaltyUntilTick : undefined,
  influenceCostReductionDisabledUntilTick: Number(metadata.influenceCostReductionDisabledUntilTick || 0) > tick ? metadata.influenceCostReductionDisabledUntilTick : undefined,
  riskEvents: metadata.riskEvents.filter((event) => event.expiresAtTick > tick),
  scandalEvents: metadata.scandalEvents.slice(-8)
});

const asOptionalTick = (value: unknown): number | undefined => {
  const tick = Math.floor(Number(value || 0));
  return tick > 0 ? tick : undefined;
};

const asOptionalNumber = (value: unknown): number | undefined => {
  const amount = Number(value || 0);
  return amount > 0 && Number.isFinite(amount) ? amount : undefined;
};

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
