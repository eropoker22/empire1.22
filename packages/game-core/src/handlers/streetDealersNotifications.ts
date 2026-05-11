import type { Notification } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import { createNotification } from "../events";
import { composeEntityId } from "../utils";
import type { StreetDealerSaleSlot } from "./streetDealersTypes";
export const createStreetDealerSaleNotification = (input: {
  state: CoreGameState;
  playerId: string;
  slot: StreetDealerSaleSlot;
  result: Record<string, unknown>;
  districtId: string;
  buildingId: string;
  eventId: string;
}): Notification =>
  createNotification({
    id: composeEntityId("notification", `${input.slot.saleId}:report`),
    recipientType: "player",
    recipientId: input.playerId,
    category: "report.building-action",
    title: "Pouliční prodej dokončen",
    bodyKey: "report.building-action",
    payload: {
      reportId: composeEntityId("report", `${input.slot.saleId}:building-action`),
      reportType: "building-action",
      actionType: "run-building-action",
      playerId: input.playerId,
      districtId: input.districtId,
      buildingId: input.buildingId,
      buildingTypeId: "street_dealers",
      buildingType: "street_dealers",
      buildingActionId: "start_drug_sale",
      actionId: "start_drug_sale",
      actionLabel: "Spustit prodej",
      result: "success",
      success: true,
      inputCost: {},
      outputGain: { "dirty-cash": Number(input.result.rewardDirtyCash || 0) },
      resourceDelta: { "dirty-cash": Number(input.result.rewardDirtyCash || 0) },
      cashDelta: 0,
      dirtyCashDelta: Number(input.result.rewardDirtyCash || 0),
      heatDelta: Number(input.result.heatGain || 0),
      influenceDelta: 0,
      producedItems: { "dirty-cash": Number(input.result.rewardDirtyCash || 0) },
      consumedItems: {},
      cooldownUntilTick: 0,
      message: createCompletionMessage(input.result),
      policeImpact: {
        heatDelta: Number(input.result.heatGain || 0)
      },
      streetDealerResult: input.result,
      heatGain: Number(input.result.heatGain || 0),
      influenceChange: 0,
      tick: input.state.root.tick,
      createdAt: new Date(0).toISOString(),
      eventId: input.eventId
    },
    createdAt: new Date(0).toISOString(),
    readAt: null
  });

const createCompletionMessage = (result: Record<string, unknown>): string => {
  const incident = isRecord(result.incident) ? ` Incident: ${String(result.incident.label || result.incident.type)}.` : "";
  return `Pouliční prodej dokončen. Dirty cash +${Number(result.rewardDirtyCash || 0)}, heat +${Number(result.heatGain || 0)}.${incident}`;
};


const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));