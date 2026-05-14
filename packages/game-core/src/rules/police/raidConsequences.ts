import type { PendingRaid, PoliceEvent, PoliceRaidPreviewConsequences, PoliceRaidSeverity, PoliceState } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { GameCoreContext } from "../../engine/context";
import { resolveWantedLevel } from "./wantedLevel";
import { createRaidPreviewConsequences, sanitizeAmount } from "./raidPreview";
import {
  applyBuildingDisruptions,
  applyDistrictLockdown,
  applyResourceSeizures,
  createPlayerResourceState
} from "./raidStateMutators";

export interface RaidConsequencesResult {
  raidId: string;
  severity: PoliceRaidSeverity;
  seizedDirtyCash: number;
  seizedResources: Record<string, number>;
  lockedDistrictId: string | null;
  lockdownUntilTick: number | null;
  disruptedBuildingIds: string[];
  buildingDisruptionUntilTick: number | null;
  heatReducedBy: number;
  courtMitigationPct: number;
  courtBuildingsOwned: number;
  courthouseMitigation?: PoliceRaidPreviewConsequences["courthouseMitigation"];
  message: string;
  eventId: string;
}

export interface ApplyRaidConsequencesResult {
  nextState: CoreGameState;
  result: RaidConsequencesResult;
  event: PoliceEvent;
  applied: boolean;
}

export const applyRaidConsequences = (
  state: CoreGameState,
  raid: PendingRaid,
  context?: GameCoreContext
): ApplyRaidConsequencesResult => {
  const eventId = `police:event:${raid.raidId}:resolved`;
  const emptyResult: RaidConsequencesResult = {
    raidId: raid.raidId,
    severity: raid.severity,
    seizedDirtyCash: 0,
    seizedResources: {},
    lockedDistrictId: null,
    lockdownUntilTick: null,
    disruptedBuildingIds: [],
    buildingDisruptionUntilTick: null,
    heatReducedBy: 0,
    courtMitigationPct: 0,
    courtBuildingsOwned: 0,
    courthouseMitigation: null,
    message: "Police raid had no valid target.",
    eventId
  };
  const player = state.playersById[raid.playerId] ?? null;
  const policeState = player?.policeStateId ? state.policeStatesById[player.policeStateId] ?? null : null;

  if (!player || !policeState || raid.status === "resolved" || raid.status === "expired") {
    const event = createPoliceEvent(raid, emptyResult, state.root.tick);
    return {
      nextState: state,
      result: emptyResult,
      event,
      applied: false
    };
  }

  const preview = createRaidPreviewConsequences(
    state,
    raid.playerId,
    raid.severity,
    raid.targetDistrictId ?? null,
    context
  );
  const resourceState = state.resourceStatesById[player.resourceStateId] ?? createPlayerResourceState(player, state.root.tick);
  const nextResourceState = applyResourceSeizures(resourceState, preview);
  const targetDistrict = preview.lockedDistrictId ? state.districtsById[preview.lockedDistrictId] ?? null : null;
  const nextDistrictsById = targetDistrict
    ? {
        ...state.districtsById,
        [targetDistrict.id]: applyDistrictLockdown(targetDistrict, preview.lockdownUntilTick, raid.reason)
      }
    : state.districtsById;
  const nextBuildingsById = preview.disruptedBuildingIds.length > 0
    ? applyBuildingDisruptions(state.buildingsById, preview.disruptedBuildingIds, preview.buildingDisruptionUntilTick ?? state.root.tick)
    : state.buildingsById;
  const nextHeat = Math.max(0, sanitizeAmount(policeState.heat) - preview.heatReducedBy);
  const result: RaidConsequencesResult = {
    raidId: raid.raidId,
    severity: raid.severity,
    seizedDirtyCash: preview.seizedDirtyCash,
    seizedResources: preview.seizedResources,
    lockedDistrictId: preview.lockedDistrictId,
    lockdownUntilTick: preview.lockdownUntilTick,
    disruptedBuildingIds: preview.disruptedBuildingIds,
    buildingDisruptionUntilTick: preview.buildingDisruptionUntilTick ?? null,
    heatReducedBy: preview.heatReducedBy,
    courtMitigationPct: preview.courtMitigationPct ?? 0,
    courtBuildingsOwned: preview.courtBuildingsOwned ?? 0,
    courthouseMitigation: preview.courthouseMitigation ?? null,
    message: createRaidResultMessage(preview),
    eventId
  };
  const event = createPoliceEvent(raid, result, state.root.tick);
  const nextPoliceState = applyResolvedRaidToPoliceState(policeState, raid, result, event, nextHeat, state.root.tick);

  return {
    nextState: {
      ...state,
      resourceStatesById: {
        ...state.resourceStatesById,
        [resourceState.id]: nextResourceState
      },
      districtsById: nextDistrictsById,
      buildingsById: nextBuildingsById,
      policeStatesById: {
        ...state.policeStatesById,
        [nextPoliceState.id]: nextPoliceState
      }
    },
    result,
    event,
    applied: true
  };
};

const applyResolvedRaidToPoliceState = (
  policeState: PoliceState,
  raid: PendingRaid,
  result: RaidConsequencesResult,
  event: PoliceEvent,
  nextHeat: number,
  currentTick: number
): PoliceState => {
  const pendingRaids = (policeState.pendingRaids ?? []).map((entry) =>
    entry.raidId === raid.raidId
      ? {
          ...entry,
          status: "resolved" as const,
          resolvedAtTick: currentTick,
          previewConsequences: {
            seizedDirtyCash: result.seizedDirtyCash,
            seizedResources: result.seizedResources,
            lockedDistrictId: result.lockedDistrictId,
            lockdownUntilTick: result.lockdownUntilTick,
            disruptedBuildingIds: result.disruptedBuildingIds,
            buildingDisruptionUntilTick: result.buildingDisruptionUntilTick,
            heatReducedBy: result.heatReducedBy,
            courtMitigationPct: result.courtMitigationPct,
            courtBuildingsOwned: result.courtBuildingsOwned,
            courthouseMitigation: result.courthouseMitigation ?? null
          }
        }
      : entry
  );
  const hasOpenRaid = pendingRaids.some((entry) => entry.status === "pending" || entry.status === "acknowledged");

  return {
    ...policeState,
    heat: nextHeat,
    wantedLevel: resolveWantedLevel(nextHeat),
    activeFlags: hasOpenRaid
      ? ensureFlag(policeState.activeFlags, "raid:pending")
      : policeState.activeFlags.filter((flag) => flag !== "raid:pending"),
    pendingRaids,
    policeEvents: [event, ...(policeState.policeEvents ?? [])].slice(0, 12),
    lastRaidResolvedAtTick: currentTick,
    version: policeState.version + 1
  };
};

const createPoliceEvent = (
  raid: PendingRaid,
  result: RaidConsequencesResult,
  currentTick: number
): PoliceEvent => ({
  id: result.eventId,
  type: "police-raid-resolved",
  playerId: raid.playerId,
  districtId: result.lockedDistrictId ?? raid.targetDistrictId,
  severity: raid.severity,
  message: result.message,
  createdAtTick: currentTick,
  payload: {
    raidId: raid.raidId,
    seizedDirtyCash: result.seizedDirtyCash,
    seizedResources: result.seizedResources,
    lockedDistrictId: result.lockedDistrictId,
    lockdownUntilTick: result.lockdownUntilTick,
    disruptedBuildingIds: result.disruptedBuildingIds,
    buildingDisruptionUntilTick: result.buildingDisruptionUntilTick,
    heatReducedBy: result.heatReducedBy,
    courtMitigationPct: result.courtMitigationPct,
    courtBuildingsOwned: result.courtBuildingsOwned,
    courthouseMitigation: result.courthouseMitigation ?? null
  }
});

const createRaidResultMessage = (preview: PoliceRaidPreviewConsequences): string => {
  if (preview.courthouseMitigation?.reductionPct) {
    return "Následky razie byly zmírněny díky Soudu.";
  }
  const seizedResourceCount = Object.values(preview.seizedResources).reduce((total, amount) => total + amount, 0);
  if (preview.seizedDirtyCash <= 0 && seizedResourceCount <= 0 && !preview.lockedDistrictId) {
    return "Razie nic nenašla. Město si tě ale zapsalo.";
  }
  return "Razie zabavila část špinavých peněz a dočasně přidusila provoz.";
};

const ensureFlag = (flags: string[], flag: string): string[] =>
  flags.includes(flag) ? flags : [...flags, flag];
