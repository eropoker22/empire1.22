import type { DomainError } from "@empire/shared-types";

export const validateAllianceCommandPayload = (
  errors: DomainError[],
  commandType: string,
  payload: Record<string, unknown>
): boolean => {
  switch (commandType) {
    case "confirm-alliance-ready":
      rejectUnknownPayloadFields(errors, payload, ["allianceId", "expectedMembershipVersion"]);
      requireStringField(errors, payload, "allianceId", "command.payload.allianceId");
      requireOptionalFiniteNumberField(errors, payload, "expectedMembershipVersion", "command.payload.expectedMembershipVersion");
      return true;
    case "start-alliance-kick-vote":
      rejectUnknownPayloadFields(errors, payload, ["allianceId", "targetPlayerId", "expectedTargetMembershipVersion"]);
      requireStringField(errors, payload, "allianceId", "command.payload.allianceId");
      requireStringField(errors, payload, "targetPlayerId", "command.payload.targetPlayerId");
      requireOptionalFiniteNumberField(errors, payload, "expectedTargetMembershipVersion", "command.payload.expectedTargetMembershipVersion");
      return true;
    case "cast-alliance-kick-vote":
      rejectUnknownPayloadFields(errors, payload, ["voteId", "choice", "expectedVoteVersion"]);
      requireStringField(errors, payload, "voteId", "command.payload.voteId");
      requireChoiceField(errors, payload, "choice", "command.payload.choice", ["yes", "no"]);
      requireOptionalFiniteNumberField(errors, payload, "expectedVoteVersion", "command.payload.expectedVoteVersion");
      return true;
    case "leave-alliance":
      rejectUnknownPayloadFields(errors, payload, ["allianceId", "expectedMembershipVersion", "chosenSuccessorPlayerId"]);
      requireStringField(errors, payload, "allianceId", "command.payload.allianceId");
      requireOptionalFiniteNumberField(errors, payload, "expectedMembershipVersion", "command.payload.expectedMembershipVersion");
      requireOptionalStringField(errors, payload, "chosenSuccessorPlayerId", "command.payload.chosenSuccessorPlayerId");
      return true;
    case "disband-alliance":
      rejectUnknownPayloadFields(errors, payload, ["allianceId"]);
      requireStringField(errors, payload, "allianceId", "command.payload.allianceId");
      return true;
    default:
      return false;
  }
};

export const isAllianceCommandType = (commandType: string): boolean =>
  [
    "confirm-alliance-ready",
    "start-alliance-kick-vote",
    "cast-alliance-kick-vote",
    "leave-alliance",
    "disband-alliance"
  ].includes(commandType);

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
  errorFieldPath = fieldPath
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (typeof fieldValue !== "string" || fieldValue.trim().length === 0) {
    errors.push(createMissingFieldError(errorFieldPath));
  }
};

const requireOptionalStringField = (
  errors: DomainError[],
  value: Record<string, unknown>,
  fieldPath: string,
  errorFieldPath = fieldPath
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (fieldValue !== undefined && (typeof fieldValue !== "string" || fieldValue.trim().length === 0)) {
    errors.push(createInvalidFieldError(errorFieldPath, "Command payload field must be a non-empty string."));
  }
};

const requireOptionalFiniteNumberField = (
  errors: DomainError[],
  value: Record<string, unknown>,
  fieldPath: string,
  errorFieldPath = fieldPath
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (fieldValue !== undefined && (typeof fieldValue !== "number" || !Number.isFinite(fieldValue))) {
    errors.push(createInvalidFieldError(errorFieldPath, "Command payload field must be a finite number."));
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

const createMissingFieldError = (
  fieldPath: string,
  message = `Gameplay slice submit request is missing required field '${fieldPath}'.`
): DomainError => ({
  code: "transport.invalid_request",
  message,
  details: { field: fieldPath }
});

const createInvalidFieldError = (
  fieldPath: string,
  message: string
): DomainError => ({
  code: "transport.invalid_request",
  message,
  details: { field: fieldPath }
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
