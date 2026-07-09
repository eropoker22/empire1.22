import type { DomainError } from "@empire/shared-types";

const MARKET_RESOURCE_IDS = ["metalParts", "techCore", "chemicals", "biomass"];
const MARKET_TYPES = ["normal", "black"];
const MARKET_PAYMENT_TYPES = ["cleanCash", "dirtyCash"];

export const isMarketCommandType = (commandType: string): boolean =>
  commandType === "buy-market-resource" || commandType === "sell-market-resource";

export const validateMarketCommandPayload = (
  errors: DomainError[],
  commandType: string,
  payload: Record<string, unknown>
): boolean => {
  switch (commandType) {
    case "buy-market-resource":
      rejectUnknownPayloadFields(errors, payload, ["resourceId", "amount", "marketType", "paymentType"]);
      requireChoiceField(errors, payload, "resourceId", "command.payload.resourceId", MARKET_RESOURCE_IDS);
      requirePositiveIntegerField(errors, payload, "amount", "command.payload.amount", 999);
      requireChoiceField(errors, payload, "marketType", "command.payload.marketType", MARKET_TYPES);
      requireChoiceField(errors, payload, "paymentType", "command.payload.paymentType", MARKET_PAYMENT_TYPES);
      if (payload.marketType === "normal" && payload.paymentType === "dirtyCash") {
        errors.push(createInvalidFieldError(
          "command.payload.paymentType",
          "Dirty cash lze použít jen při nákupu na černém trhu."
        ));
      }
      return true;
    case "sell-market-resource":
      rejectUnknownPayloadFields(errors, payload, ["resourceId", "amount"]);
      requireChoiceField(errors, payload, "resourceId", "command.payload.resourceId", MARKET_RESOURCE_IDS);
      requirePositiveIntegerField(errors, payload, "amount", "command.payload.amount", 999);
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
        "Tohle pole payloadu není pro daný command povolené."
      ));
    }
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
  errorFieldPath: string,
  maxValue: number
): void => {
  const fieldValue = getFieldPath(value, fieldPath);
  if (typeof fieldValue !== "number" || !Number.isInteger(fieldValue) || fieldValue <= 0 || fieldValue > maxValue) {
    errors.push(createInvalidFieldError(errorFieldPath, `Pole payloadu musí být kladné celé číslo do ${maxValue}.`));
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

