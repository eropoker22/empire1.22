import type { AirportBalanceConfig } from "../contracts";
import type { CoreGameState } from "../entities";
import type { AirportImportCategory, AirportMetadata, PendingAirportImport } from "./airportTypes";
export const getAirportMetadata = (
  building: CoreGameState["buildingsById"][string],
  tick = 0
): AirportMetadata => cleanupAirportMetadata(readAirportMetadata(building), tick);

export const getOwnedAirport = (
  state: CoreGameState | Record<string, any>,
  playerId: string | null | undefined,
  config?: AirportBalanceConfig
): CoreGameState["buildingsById"][string] | undefined => {
  if (!config || !playerId) return undefined;
  return Object.values((state as CoreGameState).buildingsById ?? {}).find((building: any) =>
    building?.buildingTypeId === config.buildingTypeId
    && building?.ownerPlayerId === playerId
    && building?.status === "active"
  ) as CoreGameState["buildingsById"][string] | undefined;
};

export const hasOwnedBuilding = (state: CoreGameState | Record<string, any>, playerId: string | null | undefined, buildingTypeId: string): boolean =>
  Boolean(playerId) && Object.values((state as CoreGameState).buildingsById ?? {}).some((building: any) =>
    building?.buildingTypeId === buildingTypeId && building?.ownerPlayerId === playerId && building?.status === "active"
  );

export const getOwnedBuildingCount = (state: CoreGameState, playerId: string, buildingTypeId: string): number =>
  Object.values(state.buildingsById).filter((building) =>
    building.buildingTypeId === buildingTypeId && building.ownerPlayerId === playerId && building.status === "active"
  ).length;

const readAirportMetadata = (building: CoreGameState["buildingsById"][string]): AirportMetadata => {
  const raw = isRecord(building.metadata?.airport) ? building.metadata.airport : {};
  return {
    pendingImports: Array.isArray(raw.pendingImports) ? raw.pendingImports.filter(isRecord).map(readPendingImport).filter((entry): entry is PendingAirportImport => Boolean(entry)) : [],
    blackCharterExpiresAtTick: asOptionalTick(raw.blackCharterExpiresAtTick),
    blackCharterOffer: isRecord(raw.blackCharterOffer)
      ? {
          items: Array.isArray(raw.blackCharterOffer.items) ? raw.blackCharterOffer.items.map(String) : [],
          discountPct: Number(raw.blackCharterOffer.discountPct || 0),
          purchaseCustomsRiskPct: Number(raw.blackCharterOffer.purchaseCustomsRiskPct || 0)
        }
      : undefined,
    evacuationCorridorExpiresAtTick: asOptionalTick(raw.evacuationCorridorExpiresAtTick),
    discountDisabledUntilTick: asOptionalTick(raw.discountDisabledUntilTick),
    nextImportCostPenaltyPct: Number(raw.nextImportCostPenaltyPct || 0),
    lastCustomsInspectionTick: asOptionalTick(raw.lastCustomsInspectionTick),
    lastImportShipment: isRecord(raw.lastImportShipment)
      ? {
          tick: Math.floor(Number(raw.lastImportShipment.tick || 0)),
          category: resolveImportCategory(raw.lastImportShipment.category, ["materials", "rareComponents", "weapons", "defenseItems"]),
          requestedItems: readNumberRecord(raw.lastImportShipment.requestedItems),
          acceptedItems: readNumberRecord(raw.lastImportShipment.acceptedItems),
          lostItems: readNumberRecord(raw.lastImportShipment.lostItems),
          customsTriggered: Boolean(raw.lastImportShipment.customsTriggered)
        }
      : undefined,
    customsEvents: Array.isArray(raw.customsEvents) ? raw.customsEvents.filter(isRecord).map((entry) => ({ type: String(entry.type || ""), tick: Math.floor(Number(entry.tick || 0)), label: String(entry.label || entry.type || ""), riskPct: Number(entry.riskPct || 0) })).filter((entry) => entry.type) : []
  };
};

const cleanupAirportMetadata = (metadata: AirportMetadata, tick: number): AirportMetadata => ({
  ...metadata,
  blackCharterOffer: Number(metadata.blackCharterExpiresAtTick || 0) > tick ? metadata.blackCharterOffer : undefined,
  pendingImports: metadata.pendingImports.filter((entry) => entry.completesAtTick > tick || entry.completesAtTick === tick),
  customsEvents: metadata.customsEvents.slice(-10)
});

const readPendingImport = (entry: Record<string, unknown>): PendingAirportImport | null => {
  const category = resolveImportCategoryOrNull(entry.category, ["materials", "rareComponents", "weapons", "defenseItems"]);
  if (!category) return null;
  return {
    importId: String(entry.importId || ""),
    category,
    startedAtTick: Math.floor(Number(entry.startedAtTick || 0)),
    completesAtTick: Math.floor(Number(entry.completesAtTick || 0)),
    shipment: readNumberRecord(entry.shipment)
  };
};

export const withAirportMetadata = (
  building: CoreGameState["buildingsById"][string],
  airport: AirportMetadata
): Record<string, unknown> => ({
  ...(building.metadata ?? {}),
  airport
});

export const resolveImportCategory = (value: unknown, allowed: string[]): AirportImportCategory =>
  resolveImportCategoryOrNull(value, allowed) ?? "materials";

export const resolveImportCategoryOrNull = (value: unknown, allowed: string[]): AirportImportCategory | null => {
  const normalized = String(value ?? "").trim();
  return allowed.includes(normalized) ? normalized as AirportImportCategory : null;
};

const readNumberRecord = (value: unknown): Record<string, number> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value)
          .map(([key, amount]) => [key, Math.max(0, Math.floor(Number(amount || 0)))] as const)
          .filter((entry) => entry[1] > 0)
      )
    : {};

const asOptionalTick = (value: unknown): number | undefined => {
  const tick = Math.floor(Number(value || 0));
  return tick > 0 ? tick : undefined;
};

export const minutesToTicks = (minutes: number, tickRateMs: number): number =>
  Math.max(1, Math.ceil(minutes * 60 * 1000 / Math.max(1, tickRateMs)));

const interpolate = (min: number, max: number, unit: number): number =>
  min + (max - min) * Math.max(0, Math.min(1, unit));

const isRecord = (value: unknown): value is Record<string, any> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
