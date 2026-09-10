import {
  SERVER_ASSIGNED_FOCUS_DISTRICT_ID,
  type GameplaySliceResponse,
  type LoadGameplaySliceRequest
} from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../runtime/instance/server-instance-runtime";
import { createGameplaySliceResponseMetadata } from "./gameplay-slice-response-metadata";

export const createUnchangedGameplaySliceResponse = (
  runtime: ServerInstanceRuntime,
  playerId: string,
  request: LoadGameplaySliceRequest
): GameplaySliceResponse | null => {
  if (request.knownStateVersion !== runtime.state.root.version) return null;
  const requestedFocus = !request.districtId || request.districtId === SERVER_ASSIGNED_FOCUS_DISTRICT_ID
    ? runtime.state.playersById[playerId]?.homeDistrictId ?? null
    : request.districtId;
  if (!requestedFocus || request.knownFocusDistrictId !== requestedFocus) return null;
  return { accepted: true, changed: false, readModel: null, errors: [],
    metadata: createGameplaySliceResponseMetadata(runtime) };
};
