import { resolveRumorTemplate, type RumorTextTemplateKey } from "@empire/game-config";
import type { CityFeedEvent, CityFeedIntelType, CityFeedSeverity, CityFeedSourceType, CityFeedTruthiness } from "@empire/shared-types";
import type { CoreGameState } from "../../entities";
import type { CoreEvent } from "../../events";

type EventPayload = Record<string, unknown>;

export const createPoliceCityFeedEvents = (
  state: CoreGameState,
  event: CoreEvent,
  payload: EventPayload
): CityFeedEvent[] => {
  const districtId = stringValue(payload.districtId || payload.targetDistrictId);

  switch (event.type) {
    case "police-warning-issued": {
      const warningRumor = resolveWarningRumorTemplate(state, event, payload);
      return [
        createFeedEvent(state, event, {
          sourceType: "police_warning",
          category: "police",
          severity: "medium",
          truthiness: "confirmed",
          intelType: "confirmed_event",
          visibility: "all",
          playerId: stringValue(payload.playerId),
          districtId,
          messageKey: "police_warning",
          payload: { aggregatePressure: numericValue(payload.aggregatePressure) }
        }),
        createPoliceRumorFeedEvent(state, event, {
          sourceType: "police_warning",
          severity: warningRumor.severity,
          truthiness: warningRumor.truthiness,
          intelType: warningRumor.intelType,
          playerId: stringValue(payload.playerId),
          districtId,
          messageKey: warningRumor.messageKey,
          rumorType: warningRumor.rumorType
        })
      ];
    }
    case "police-raid-triggered": {
      const targetDistrictId = stringValue(payload.targetDistrictId || payload.lockedDistrictId);
      return [
        createFeedEvent(state, event, {
          sourceType: "police_raid",
          category: "police",
          severity: severityValue(payload.severity, "high"),
          truthiness: "confirmed",
          intelType: "confirmed_event",
          visibility: "all",
          playerId: stringValue(payload.playerId),
          districtId: targetDistrictId,
          messageKey: "police_raid",
          payload: publicRaidPayload(payload)
        }),
        createPoliceRumorFeedEvent(state, event, {
          sourceType: "police_warning",
          severity: "medium",
          truthiness: "unconfirmed",
          intelType: "suspicion",
          playerId: stringValue(payload.playerId),
          districtId: targetDistrictId,
          messageKey: targetDistrictId ? "police_district_heat" : "police_pressure_high",
          rumorType: targetDistrictId ? "police_district_heat" : "police_pressure_high"
        })
      ];
    }
    case "police-raid-resolved": {
      const targetDistrictId = stringValue(payload.targetDistrictId || payload.lockedDistrictId);
      return [
        createFeedEvent(state, event, {
          sourceType: "police_raid",
          category: "police",
          severity: severityValue(payload.severity, "high"),
          truthiness: "confirmed",
          intelType: "confirmed_event",
          visibility: "all",
          playerId: stringValue(payload.playerId),
          districtId: targetDistrictId,
          messageKey: "police_raid",
          payload: publicRaidPayload(payload)
        }),
        createPoliceRumorFeedEvent(state, event, {
          sourceType: "police_raid",
          severity: "medium",
          truthiness: "unconfirmed",
          intelType: "scandal",
          playerId: stringValue(payload.playerId),
          districtId: targetDistrictId,
          messageKey: "police_post_raid_scandal",
          rumorType: "police_post_raid_scandal"
        })
      ];
    }
    default:
      return [];
  }
};

const createFeedEvent = (
  state: CoreGameState,
  event: CoreEvent,
  input: Omit<CityFeedEvent, "id" | "createdAtTick" | "message" | "messageKey"> & { messageKey: RumorTextTemplateKey }
): CityFeedEvent => {
  const sourceEventId = createSourceEventId(event, input.sourceType, state.root.tick);
  const district = resolveDistrictLabel(state, input.districtId);
  return {
    id: `city-feed:${sourceEventId}`,
    sourceEventId,
    createdAtTick: state.root.tick,
    ...input,
    messageKey: `rumor.${input.messageKey}`,
    message: resolveRumorTemplate(input.messageKey, hashText(sourceEventId), { district })
  };
};

const resolveWarningRumorTemplate = (
  state: CoreGameState,
  event: CoreEvent,
  payload: EventPayload
): {
  severity: CityFeedSeverity;
  truthiness: CityFeedTruthiness;
  intelType: Exclude<CityFeedIntelType, "confirmed_event">;
  messageKey: RumorTextTemplateKey;
  rumorType: string;
} => {
  const sourceEventId = createSourceEventId(event, "police_warning", state.root.tick);
  const forcedFalseLead = booleanValue(payload.falseLead);
  const falseLeadRoll = Math.abs(hashText(`${state.serverInstance.worldSeed}:${sourceEventId}:false-lead`)) % 100;
  if (forcedFalseLead || falseLeadRoll < 15) {
    return {
      severity: "low",
      truthiness: "false_possible",
      intelType: "false_lead",
      messageKey: "police_false_lead",
      rumorType: "police_false_lead"
    };
  }
  return {
    severity: "low",
    truthiness: "unconfirmed",
    intelType: "warning",
    messageKey: "police_pressure_medium",
    rumorType: "police_pressure_medium"
  };
};

const createPoliceRumorFeedEvent = (
  state: CoreGameState,
  event: CoreEvent,
  input: {
    sourceType: Extract<CityFeedSourceType, "police_warning" | "police_raid">;
    severity: CityFeedSeverity;
    truthiness: CityFeedTruthiness;
    intelType: Exclude<CityFeedIntelType, "confirmed_event">;
    playerId?: string;
    districtId?: string;
    messageKey: RumorTextTemplateKey;
    rumorType: string;
  }
): CityFeedEvent => {
  const baseSourceEventId = createSourceEventId(event, input.sourceType, state.root.tick);
  const sourceEventId = `${baseSourceEventId}:rumor:${input.rumorType}`;
  const district = resolveDistrictLabel(state, input.districtId);
  return {
    id: `city-feed:${sourceEventId}`,
    sourceEventId,
    createdAtTick: state.root.tick,
    sourceType: input.sourceType,
    category: "rumor",
    severity: input.severity,
    truthiness: input.truthiness,
    intelType: input.intelType,
    visibility: "all",
    playerId: input.playerId,
    districtId: input.districtId,
    messageKey: `rumor.${input.messageKey}`,
    message: resolveRumorTemplate(input.messageKey, hashText(sourceEventId), { district }),
    payload: {
      atmosphericPoliceRumor: true,
      rumorType: input.rumorType
    }
  };
};

const createSourceEventId = (event: CoreEvent, sourceType: CityFeedSourceType, fallbackTick: number): string => {
  const payload = safePayload(event.payload);
  const directId = stringValue(payload.raidId || payload.notificationId || payload.reportId || payload.eventId);
  if (directId) return `${sourceType}:${directId}`;
  return [
    sourceType,
    event.type,
    stringValue(payload.playerId || payload.attackerPlayerId),
    stringValue(payload.districtId || payload.targetDistrictId),
    stringValue(payload.buildingId || payload.actionId),
    stringValue(payload.result || payload.outcomeTier),
    stringValue(payload.tick ?? fallbackTick)
  ].filter(Boolean).join(":");
};

const publicRaidPayload = (payload: EventPayload): EventPayload => ({
  raidId: stringValue(payload.raidId),
  status: stringValue(payload.status),
  seizedDirtyCash: numericValue(payload.seizedDirtyCash ?? safePayload(payload.cashSeized)["dirty-cash"]),
  heatReduced: numericValue(payload.heatReduced ?? payload.heatReducedBy),
  courthouseMitigation: safePayload(payload.courthouseMitigation)
});

const resolveDistrictLabel = (state: CoreGameState, districtId?: string): string =>
  districtId ? (state.districtsById[districtId]?.name || districtId) : "jedné z horkých čtvrtí";

const safePayload = (value: unknown): EventPayload =>
  value && typeof value === "object" ? value as EventPayload : {};

const stringValue = (value: unknown): string | undefined => {
  const text = String(value ?? "").trim();
  return text || undefined;
};

const numericValue = (value: unknown): number => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const booleanValue = (value: unknown): boolean => value === true || value === "true";

const severityValue = (value: unknown, fallback: CityFeedSeverity): CityFeedSeverity =>
  value === "low" || value === "medium" || value === "high" || value === "extreme" ? value : fallback;

const hashText = (value: string): number =>
  Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
