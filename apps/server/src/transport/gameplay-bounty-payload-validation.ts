import type { DomainError } from "@empire/shared-types";
import {
  BOUNTY_DURATION_OPTIONS_HOURS,
  BOUNTY_MIN_REWARD_CLEAN_CASH
} from "@empire/shared-types";

const BOUNTY_OBJECTIVE_TYPES = ["attack-player", "attack-district", "destroy-player-district"];

export const isBountyCommandType = (commandType: string): boolean =>
  commandType === "create-bounty" || commandType === "cancel-bounty";

export const validateBountyCommandPayload = (
  errors: DomainError[],
  commandType: string,
  payload: Record<string, unknown>
): boolean => {
  switch (commandType) {
    case "create-bounty":
      rejectUnknownPayloadFields(errors, payload, [
        "targetPlayerId",
        "objectiveType",
        "targetDistrictId",
        "rewardCleanCash",
        "durationHours",
        "isAnonymous"
      ]);
      requireStringField(errors, payload, "targetPlayerId", "command.payload.targetPlayerId");
      requireChoiceField(errors, payload, "objectiveType", "command.payload.objectiveType", BOUNTY_OBJECTIVE_TYPES);
      requireOptionalStringOrNullField(errors, payload, "targetDistrictId", "command.payload.targetDistrictId");
      requirePositiveIntegerField(errors, payload, "rewardCleanCash", "command.payload.rewardCleanCash", 1_000_000);
      if (typeof payload.rewardCleanCash === "number" && payload.rewardCleanCash < BOUNTY_MIN_REWARD_CLEAN_CASH) {
        errors.push(createInvalidFieldError(
          "command.payload.rewardCleanCash",
          `Bounty reward must be at least ${BOUNTY_MIN_REWARD_CLEAN_CASH} clean cash.`
        ));
      }
      requireIntegerChoiceField(errors, payload, "durationHours", "command.payload.durationHours", [...BOUNTY_DURATION_OPTIONS_HOURS]);
      requireOptionalBooleanField(errors, payload, "isAnonymous", "command.payload.isAnonymous");
      if (payload.objectiveType === "attack-district" && typeof payload.targetDistrictId !== "string") {
        errors.push(createInvalidFieldError(
          "command.payload.targetDistrictId",
          "Target district is required for attack-district bounty."
        ));
      }
      return true;
    case "cancel-bounty":
      rejectUnknownPayloadFields(errors, payload, ["bountyId"]);
      requireStringField(errors, payload, "bountyId", "command.payload.bountyId");
      return true;
    default:
      return false;
  }
};

const rejectUnknownPayloadFields = (
  errors: DomainError[],
  payload: Record<string, unknown>,
  allowedFields: string[]
): void => {
  const allowed = new Set(allowedFields);
  for (const field of Object.keys(payload)) {
    if (!allowed.has(field)) {
      errors.push(createInvalidFieldError(
        `command.payload.${field}`,
        "Command payload field is not allowed for this command type."
      ));
    }
  }
};

const requireStringField = (
  errors: DomainError[],
  value: Record<string, unknown>,
  fieldPath: string,
  errorFieldPath: string
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
    errors.push(createInvalidFieldError(errorFieldPath, "Command payload field must be a non-empty string."));
  }
};

const requireOptionalStringOrNullField = (
  errors: DomainError[],
  value: Record<string, unknown>,
  fieldPath: string,
  errorFieldPath: string
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (fieldValue !== undefined && fieldValue !== null && (typeof fieldValue !== "string" || fieldValue.trim().length === 0)) {
    errors.push(createInvalidFieldError(errorFieldPath, "Command payload field must be a non-empty string or null."));
  }
};

const requireChoiceField = (
  errors: DomainError[],
  value: Record<string, unknown>,
  fieldPath: string,
  errorFieldPath: string,
  choices: string[]
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (typeof fieldValue !== "string" || !choices.includes(fieldValue)) {
    errors.push(createInvalidFieldError(errorFieldPath, `Command payload field must be one of: ${choices.join(", ")}.`));
  }
};

const requireIntegerChoiceField = (
  errors: DomainError[],
  value: Record<string, unknown>,
  fieldPath: string,
  errorFieldPath: string,
  choices: number[]
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (typeof fieldValue !== "number" || !Number.isInteger(fieldValue) || !choices.includes(fieldValue)) {
    errors.push(createInvalidFieldError(errorFieldPath, `Command payload field must be one of: ${choices.join(", ")}.`));
  }
};

const requirePositiveIntegerField = (
  errors: DomainError[],
  value: Record<string, unknown>,
  fieldPath: string,
  errorFieldPath: string,
  maxValue: number
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (typeof fieldValue !== "number" || !Number.isInteger(fieldValue) || fieldValue <= 0 || fieldValue > maxValue) {
    errors.push(createInvalidFieldError(errorFieldPath, `Command payload field must be a positive integer up to ${maxValue}.`));
  }
};

const requireOptionalBooleanField = (
  errors: DomainError[],
  value: Record<string, unknown>,
  fieldPath: string,
  errorFieldPath: string
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (fieldValue !== undefined && typeof fieldValue !== "boolean") {
    errors.push(createInvalidFieldError(errorFieldPath, "Command payload field must be a boolean."));
  }
};

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
  let current: unknown = value;
  for (const part of fieldPath.split(".")) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
