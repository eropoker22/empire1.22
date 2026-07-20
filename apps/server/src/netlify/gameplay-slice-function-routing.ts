import type { GameplaySliceResponse } from "@empire/shared-types";
import { resolveGameplaySliceFunctionRoute } from "./gameplay-slice-function-routes";

export const createGameplaySliceRouteError = (
  code: string,
  message: string
): GameplaySliceResponse => ({
  accepted: false,
  readModel: null,
  errors: [{ code, message }]
});

export const isGameplaySliceStateChangingRoute = (
  route: ReturnType<typeof resolveGameplaySliceFunctionRoute>
): boolean => route === "matchmaking-reserve" || route === "join" || route === "logout" || route === "submit";
