import type { DomainError, GameplaySliceResponse } from "@empire/shared-types";

export const createGameplayFunctionErrorResponse = (
  errors: DomainError[]
): GameplaySliceResponse => ({
  accepted: false,
  readModel: null,
  errors
});
