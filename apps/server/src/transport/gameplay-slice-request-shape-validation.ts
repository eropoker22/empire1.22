import type { DomainError } from "@empire/shared-types";

export type GameplaySliceRequestKind = "load" | "submit";

const LOAD_REQUEST_FIELDS = [
  "serverInstanceId",
  "playerId",
  "accountId",
  "districtId",
  "preferredStartDistrictId",
  "factionId",
  "snapshotToken",
  "sessionToken",
  "joinTicket"
] as const;

const SUBMIT_REQUEST_FIELDS = [
  "command",
  "focusDistrictId",
  "expectedStateVersion",
  "snapshotToken",
  "sessionToken"
] as const;

const COMMAND_ENVELOPE_FIELDS = [
  "id",
  "type",
  "mode",
  "playerId",
  "serverInstanceId",
  "issuedAt",
  "payload",
  "clientRequestId"
] as const;

export const rejectUnknownLoadRequestFields = (
  errors: DomainError[],
  value: Record<string, unknown>
): void => {
  rejectUnknownFields(errors, "load", value, LOAD_REQUEST_FIELDS);
};

export const rejectUnknownSubmitRequestFields = (
  errors: DomainError[],
  value: Record<string, unknown>
): void => {
  rejectUnknownFields(errors, "submit", value, SUBMIT_REQUEST_FIELDS);
};

export const rejectUnknownCommandEnvelopeFields = (
  errors: DomainError[],
  value: Record<string, unknown>
): void => {
  rejectUnknownFields(errors, "submit", value, COMMAND_ENVELOPE_FIELDS, "command.");
};

export const requireStringField = (
  errors: DomainError[],
  kind: GameplaySliceRequestKind,
  value: Record<string, unknown>,
  fieldPath: string,
  errorFieldPath = fieldPath
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (typeof fieldValue === "string" && fieldValue.trim().length > 0) {
    return;
  }

  errors.push(createMissingFieldError(kind, errorFieldPath));
};

export const validateOptionalStringField = (
  errors: DomainError[],
  kind: GameplaySliceRequestKind,
  value: Record<string, unknown>,
  fieldPath: string
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (fieldValue === undefined || fieldValue === null) {
    return;
  }
  if (typeof fieldValue === "string" && fieldValue.trim().length > 0) {
    return;
  }

  errors.push({
    code: "transport.invalid_request",
    message: `Gameplay slice ${kind} request field '${fieldPath}' must be a non-empty string when provided.`,
    details: {
      field: fieldPath
    }
  });
};

export const validateOptionalIntegerField = (
  errors: DomainError[],
  kind: GameplaySliceRequestKind,
  value: Record<string, unknown>,
  fieldPath: string
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (fieldValue === undefined || fieldValue === null) {
    return;
  }
  if (typeof fieldValue === "number" && Number.isInteger(fieldValue) && fieldValue >= 0) {
    return;
  }

  errors.push({
    code: "transport.invalid_request",
    message: `Gameplay slice ${kind} request field '${fieldPath}' must be a non-negative integer when provided.`,
    details: {
      field: fieldPath
    }
  });
};

export const createMissingFieldError = (
  kind: GameplaySliceRequestKind,
  fieldPath: string,
  message = `Gameplay slice ${kind} request is missing required field '${fieldPath}'.`
): DomainError => ({
  code: "transport.invalid_request",
  message,
  details: {
    field: fieldPath
  }
});

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const rejectUnknownFields = (
  errors: DomainError[],
  kind: GameplaySliceRequestKind,
  value: Record<string, unknown>,
  allowedFields: readonly string[],
  fieldPrefix = ""
): void => {
  const allowed = new Set(allowedFields);
  for (const field of Object.keys(value)) {
    if (allowed.has(field)) {
      continue;
    }

    const fieldPath = `${fieldPrefix}${field}`;
    errors.push({
      code: "transport.invalid_request",
      message: `Gameplay slice ${kind} request contains unsupported field '${fieldPath}'.`,
      details: {
        field: fieldPath
      }
    });
  }
};

const getFieldPath = (
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
