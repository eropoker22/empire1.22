import type { DomainError } from "@empire/shared-types";

type GameplaySliceRequestKind = "submit";

export const createMissingFieldError = (
  kind: GameplaySliceRequestKind,
  fieldPath: string,
  message = `V gameplay ${kind} requestu chybí povinné pole '${fieldPath}'.`
): DomainError => ({
  code: "transport.invalid_request",
  message,
  details: {
    field: fieldPath
  }
});

export const createInvalidFieldError = (
  fieldPath: string,
  message: string
): DomainError => ({
  code: "transport.invalid_request",
  message,
  details: {
    field: fieldPath
  }
});
export const getFieldPath = (
  value: Record<string, unknown>,
  fieldPath: string
): unknown => {
  const parts = fieldPath.split(".");
  let current: unknown = value;
  for (const part of parts) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
};
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
