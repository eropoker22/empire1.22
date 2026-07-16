import type { DomainError } from "@empire/shared-types";

export const validateBasicActionCommandPayload = (
  errors: DomainError[],
  commandType: string,
  payload: Record<string, unknown>
): boolean => {
  switch (commandType) {
    case "rob-district":
      rejectUnknownPayloadFields(errors, payload, [
        "targetDistrictId",
        "sourceDistrictId",
        "expectedTargetVersion",
        "expectedSourceVersion",
        "routeDistrictId",
        "expectedRouteVersion"
      ]);
      requireStringField(errors, payload, "targetDistrictId", "command.payload.targetDistrictId");
      requireOptionalStringField(errors, payload, "sourceDistrictId", "command.payload.sourceDistrictId");
      requireOptionalFiniteNumberField(errors, payload, "expectedTargetVersion", "command.payload.expectedTargetVersion");
      requireOptionalFiniteNumberField(errors, payload, "expectedSourceVersion", "command.payload.expectedSourceVersion");
      requireOptionalStringField(errors, payload, "routeDistrictId", "command.payload.routeDistrictId");
      requireOptionalFiniteNumberField(errors, payload, "expectedRouteVersion", "command.payload.expectedRouteVersion");
      return true;
    case "heist-district":
      rejectUnknownPayloadFields(errors, payload, [
        "targetDistrictId",
        "sourceDistrictId",
        "style",
        "gangMembersSent",
        "expectedTargetVersion",
        "expectedSourceVersion",
        "routeDistrictId",
        "expectedRouteVersion"
      ]);
      requireStringField(errors, payload, "targetDistrictId", "command.payload.targetDistrictId");
      requireOptionalStringField(errors, payload, "sourceDistrictId", "command.payload.sourceDistrictId");
      requireChoiceField(errors, payload, "style", "command.payload.style", ["stealth", "balanced", "all_in"]);
      requirePositiveIntegerField(errors, payload, "gangMembersSent", "command.payload.gangMembersSent");
      requireOptionalFiniteNumberField(errors, payload, "expectedTargetVersion", "command.payload.expectedTargetVersion");
      requireOptionalFiniteNumberField(errors, payload, "expectedSourceVersion", "command.payload.expectedSourceVersion");
      requireOptionalStringField(errors, payload, "routeDistrictId", "command.payload.routeDistrictId");
      requireOptionalFiniteNumberField(errors, payload, "expectedRouteVersion", "command.payload.expectedRouteVersion");
      return true;
    case "place-defense":
      rejectUnknownPayloadFields(errors, payload, [
        "targetDistrictId",
        "sourceDistrictId",
        "defenseItemId",
        "amount",
        "expectedTargetVersion"
      ]);
      requireStringField(errors, payload, "targetDistrictId", "command.payload.targetDistrictId");
      requireOptionalStringField(errors, payload, "sourceDistrictId", "command.payload.sourceDistrictId");
      requireStringField(errors, payload, "defenseItemId", "command.payload.defenseItemId");
      requirePositiveIntegerField(errors, payload, "amount", "command.payload.amount");
      requireOptionalFiniteNumberField(errors, payload, "expectedTargetVersion", "command.payload.expectedTargetVersion");
      return true;
    case "remove-defense":
      rejectUnknownPayloadFields(errors, payload, [
        "targetDistrictId",
        "defenseItemId",
        "amount",
        "expectedTargetVersion"
      ]);
      requireStringField(errors, payload, "targetDistrictId", "command.payload.targetDistrictId");
      requireStringField(errors, payload, "defenseItemId", "command.payload.defenseItemId");
      requirePositiveIntegerField(errors, payload, "amount", "command.payload.amount");
      requireOptionalFiniteNumberField(errors, payload, "expectedTargetVersion", "command.payload.expectedTargetVersion");
      return true;
    default:
      return false;
  }
};

export const isBasicActionCommandType = (commandType: string): boolean =>
  ["heist-district", "place-defense", "remove-defense", "rob-district"].includes(commandType);

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
        "Tohle pole payloadu není pro daný command povolené."
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
    errors.push(createInvalidFieldError(errorFieldPath, "Pole payloadu musí být neprázdný text."));
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
    errors.push(createInvalidFieldError(errorFieldPath, "Pole payloadu musí být konečné číslo."));
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
    errors.push(createInvalidFieldError(errorFieldPath, `Pole payloadu musí být jedna z hodnot: ${choices.join(", ")}.`));
  }
};

const requirePositiveIntegerField = (
  errors: DomainError[],
  value: Record<string, unknown>,
  fieldPath: string,
  errorFieldPath: string
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (typeof fieldValue !== "number" || !Number.isInteger(fieldValue) || fieldValue <= 0) {
    errors.push(createInvalidFieldError(errorFieldPath, "Pole payloadu musí být kladné celé číslo."));
  }
};

const createMissingFieldError = (
  fieldPath: string,
  message = `V gameplay submit requestu chybí povinné pole '${fieldPath}'.`
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
