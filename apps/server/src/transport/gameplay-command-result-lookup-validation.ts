import type {
  DomainError,
  LookupGameplayCommandResultRequest
} from "@empire/shared-types";

export type GameplayCommandResultLookupValidation =
  | { accepted: true; request: LookupGameplayCommandResultRequest; errors: [] }
  | { accepted: false; request: null; errors: DomainError[] };

export const validateLookupGameplayCommandResultRequest = (
  value: unknown
): GameplayCommandResultLookupValidation => {
  if (!isRecord(value)) {
    return rejected("request", "Request body must be a JSON object.");
  }
  const serverInstanceId = readRequired(value, "serverInstanceId");
  const commandId = readRequired(value, "commandId");
  if (!serverInstanceId || !commandId) {
    return rejected(!serverInstanceId ? "serverInstanceId" : "commandId");
  }
  for (const field of ["districtId", "sessionToken"]) {
    const candidate = value[field];
    if (candidate != null && (typeof candidate !== "string" || !candidate.trim())) {
      return rejected(field, `Gameplay command result lookup field '${field}' must be a non-empty string when provided.`);
    }
  }
  return { accepted: true, request: value as unknown as LookupGameplayCommandResultRequest, errors: [] };
};

const readRequired = (value: Record<string, unknown>, field: string): string | null => {
  const candidate = value[field];
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
};

const rejected = (field: string, message = `Gameplay command result lookup is missing required field '${field}'.`): GameplayCommandResultLookupValidation => ({
  accepted: false,
  request: null,
  errors: [{ code: "transport.invalid_request", message, details: { field } }]
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);
