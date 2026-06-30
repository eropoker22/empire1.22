import type { DomainError } from "@empire/shared-types";
import { isAllianceCommandType, validateAllianceCommandPayload } from "./gameplay-alliance-payload-validation";
import { isBasicActionCommandType, validateBasicActionCommandPayload } from "./gameplay-basic-action-payload-validation";
import { isBountyCommandType, validateBountyCommandPayload } from "./gameplay-bounty-payload-validation";
import { isMarketCommandType, validateMarketCommandPayload } from "./gameplay-market-payload-validation";

type GameplaySliceRequestKind = "submit";

export const validateGameCommandPayload = (
  errors: DomainError[],
  command: Record<string, unknown>
): void => {
  const type = typeof command.type === "string" ? command.type : "";
  if (!hasPayloadSchema(type)) {
    return;
  }

  if (!isRecord(command.payload)) {
    errors.push(createMissingFieldError("submit", "command.payload", "Command payload must be a JSON object."));
    return;
  }

  const payload = command.payload;
  if (validateBasicActionCommandPayload(errors, type, payload)) {
    return;
  }

  if (validateAllianceCommandPayload(errors, type, payload)) {
    return;
  }

  if (validateMarketCommandPayload(errors, type, payload)) {
    return;
  }

  if (validateBountyCommandPayload(errors, type, payload)) {
    return;
  }

  switch (type) {
    case "attack-district":
      rejectUnknownPayloadFields(errors, payload, ["districtId", "sourceDistrictId"]);
      validateDistrictPayload(errors, payload, true);
      break;
    case "occupy-district":
      validateDistrictPayload(errors, payload, true);
      break;
    case "spy-district":
      rejectUnknownPayloadFields(errors, payload, ["districtId", "sourceDistrictId"]);
      requireStringField(errors, "submit", payload, "districtId", "command.payload.districtId");
      requireStringField(errors, "submit", payload, "sourceDistrictId", "command.payload.sourceDistrictId");
      break;
    case "place-trap":
      rejectUnknownPayloadFields(errors, payload, ["districtId"]);
      requireStringField(errors, "submit", payload, "districtId", "command.payload.districtId");
      break;
    case "select-spawn-district":
      rejectUnknownPayloadFields(errors, payload, ["districtId"]);
      requireStringField(errors, "submit", payload, "districtId", "command.payload.districtId");
      break;
    case "collect-production":
      validateBuildingPayload(errors, payload);
      break;
    case "craft-item":
      validateBuildingPayload(errors, payload);
      requireStringField(errors, "submit", payload, "recipeId", "command.payload.recipeId");
      break;
    case "run-building-action":
      validateBuildingPayload(errors, payload);
      requireStringField(errors, "submit", payload, "actionId", "command.payload.actionId");
      validateRunBuildingActionOptionalPayload(errors, payload);
      break;
  }
};

const validateDistrictPayload = (
  errors: DomainError[],
  payload: Record<string, unknown>,
  sourceDistrictMayBeNull: boolean
): void => {
  requireStringField(errors, "submit", payload, "districtId", "command.payload.districtId");
  requireOptionalStringField(
    errors,
    payload,
    "sourceDistrictId",
    "command.payload.sourceDistrictId",
    sourceDistrictMayBeNull
  );
};

const validateBuildingPayload = (
  errors: DomainError[],
  payload: Record<string, unknown>
): void => {
  requireStringField(errors, "submit", payload, "districtId", "command.payload.districtId");
  requireStringField(errors, "submit", payload, "buildingId", "command.payload.buildingId");
};

const hasPayloadSchema = (type: string): boolean =>
  [
    "attack-district",
    "occupy-district",
    "spy-district",
    "place-trap",
    "select-spawn-district",
    "collect-production",
    "craft-item",
    "run-building-action"
  ].includes(type) || isBasicActionCommandType(type) || isAllianceCommandType(type) || isMarketCommandType(type) || isBountyCommandType(type);

const validateRunBuildingActionOptionalPayload = (
  errors: DomainError[],
  payload: Record<string, unknown>
): void => {
  for (const field of [
    "dealerSlotId",
    "slotId",
    "itemId",
    "targetCategory",
    "category",
    "mode",
    "targetDistrictId",
    "targetZone"
  ]) {
    requireOptionalStringField(errors, payload, field, `command.payload.${field}`);
  }

  for (const field of ["amount", "investmentCleanCash", "investment"]) {
    requireOptionalFiniteNumberField(errors, payload, field, `command.payload.${field}`);
  }
};

const requireStringField = (
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

const rejectUnknownPayloadFields = (
  errors: DomainError[],
  payload: Record<string, unknown>,
  allowedFields: string[]
): void => {
  const allowed = new Set(allowedFields);
  for (const field of Object.keys(payload)) {
    if (allowed.has(field)) {
      continue;
    }
    errors.push(createInvalidFieldError(
      `command.payload.${field}`,
      "Command payload field is not allowed for this command type."
    ));
  }
};

const requireOptionalStringField = (
  errors: DomainError[],
  value: Record<string, unknown>,
  fieldPath: string,
  errorFieldPath = fieldPath,
  allowNull = false
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (
    fieldValue === undefined ||
    (allowNull && fieldValue === null) ||
    (typeof fieldValue === "string" && fieldValue.trim().length > 0)
  ) {
    return;
  }

  errors.push(createInvalidFieldError(errorFieldPath, "Command payload field must be a non-empty string."));
};

const requireOptionalFiniteNumberField = (
  errors: DomainError[],
  value: Record<string, unknown>,
  fieldPath: string,
  errorFieldPath = fieldPath
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (fieldValue === undefined || (typeof fieldValue === "number" && Number.isFinite(fieldValue))) {
    return;
  }

  errors.push(createInvalidFieldError(errorFieldPath, "Command payload field must be a finite number."));
};

const createMissingFieldError = (
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

const createInvalidFieldError = (
  fieldPath: string,
  message: string
): DomainError => ({
  code: "transport.invalid_request",
  message,
  details: {
    field: fieldPath
  }
});

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
