import type {
  DomainError,
  LoadGameplaySliceRequest,
  SubmitGameplayCommandRequest
} from "@empire/shared-types";
import { validateGameCommandPayload } from "./gameplay-command-payload-validation";

type GameplaySliceRequestKind = "load" | "submit";

interface ValidationAccepted<TRequest> {
  accepted: true;
  request: TRequest;
  errors: [];
}

interface ValidationRejected {
  accepted: false;
  request: null;
  errors: DomainError[];
}

export type GameplaySliceRequestValidationResult<TRequest> =
  | ValidationAccepted<TRequest>
  | ValidationRejected;

/**
 * Responsibility: Runtime validation for browser JSON before it reaches server authority.
 * Belongs here: transport DTO shape checks.
 * Does not belong here: gameplay rule validation or balancing decisions.
 */
export const validateLoadGameplaySliceRequest = (
  value: unknown
): GameplaySliceRequestValidationResult<LoadGameplaySliceRequest> => {
  const errors: DomainError[] = [];

  if (!isRecord(value)) {
    return reject("load", [
      createMissingFieldError("load", "request", "Request body must be a JSON object.")
    ]);
  }

  requireStringField(errors, "load", value, "serverInstanceId");
  requireStringField(errors, "load", value, "playerId");
  requireStringField(errors, "load", value, "districtId");

  return errors.length > 0
    ? reject("load", errors)
    : {
        accepted: true,
        request: value as unknown as LoadGameplaySliceRequest,
        errors: []
      };
};

export const validateSubmitGameplayCommandRequest = (
  value: unknown
): GameplaySliceRequestValidationResult<SubmitGameplayCommandRequest> => {
  const errors: DomainError[] = [];

  if (!isRecord(value)) {
    return reject("submit", [
      createMissingFieldError("submit", "request", "Request body must be a JSON object.")
    ]);
  }

  requireStringField(errors, "submit", value, "focusDistrictId");

  const command = value.command;
  if (!isRecord(command)) {
    errors.push(createMissingFieldError("submit", "command", "Submit request must include a command object."));
  } else {
    validateGameCommandShape(errors, command);
  }

  return errors.length > 0
    ? reject("submit", errors)
    : {
        accepted: true,
        request: value as unknown as SubmitGameplayCommandRequest,
        errors: []
      };
};

const validateGameCommandShape = (
  errors: DomainError[],
  command: Record<string, unknown>
): void => {
  requireStringField(errors, "submit", command, "id", "command.id");
  requireStringField(errors, "submit", command, "type", "command.type");
  requireStringField(errors, "submit", command, "serverInstanceId", "command.serverInstanceId");
  requireStringField(errors, "submit", command, "playerId", "command.playerId");
  requireStringField(errors, "submit", command, "mode", "command.mode");
  requireStringField(errors, "submit", command, "issuedAt", "command.issuedAt");
  validateGameCommandPayload(errors, command);
};

export const createGameplaySliceValidationResponse = (
  errors: DomainError[]
) => ({
  accepted: false,
  readModel: null,
  errors
});

const reject = <TRequest>(
  kind: GameplaySliceRequestKind,
  errors: DomainError[]
): GameplaySliceRequestValidationResult<TRequest> => ({
  accepted: false,
  request: null,
  errors: errors.length > 0
    ? errors
    : [
        {
          code: "transport.invalid_request",
          message: `Invalid gameplay slice ${kind} request.`
        }
      ]
});

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
