import {
  SERVER_ASSIGNED_FOCUS_DISTRICT_ID,
  type DomainError,
  type LoadGameplaySliceRequest,
  type SubmitGameplayCommandRequest
} from "@empire/shared-types";
import { validateGameCommandPayload } from "./gameplay-command-payload-validation";
import {
  createMissingFieldError,
  isRecord,
  rejectUnknownCommandEnvelopeFields,
  rejectUnknownLoadRequestFields,
  rejectUnknownSubmitRequestFields,
  requireStringField,
  validateOptionalIntegerField,
  validateOptionalStringField,
  type GameplaySliceRequestKind
} from "./gameplay-slice-request-shape-validation";

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

  rejectUnknownLoadRequestFields(errors, value);
  requireStringField(errors, "load", value, "serverInstanceId");
  validateOptionalStringField(errors, "load", value, "playerId");
  validateOptionalStringField(errors, "load", value, "accountId");
  validateOptionalStringField(errors, "load", value, "districtId");
  validateOptionalStringField(errors, "load", value, "preferredStartDistrictId");
  validateOptionalStringField(errors, "load", value, "factionId");
  validateOptionalStringField(errors, "load", value, "snapshotToken");
  validateOptionalStringField(errors, "load", value, "sessionToken");
  validateOptionalStringField(errors, "load", value, "joinTicket");

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

  rejectUnknownSubmitRequestFields(errors, value);
  requireStringField(errors, "submit", value, "focusDistrictId");
  rejectServerAssignedFocusDistrict(errors, value);
  validateOptionalIntegerField(errors, "submit", value, "expectedStateVersion");
  validateOptionalStringField(errors, "submit", value, "snapshotToken");
  validateOptionalStringField(errors, "submit", value, "sessionToken");

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
  rejectUnknownCommandEnvelopeFields(errors, command);
  requireStringField(errors, "submit", command, "id", "command.id");
  requireStringField(errors, "submit", command, "type", "command.type");
  requireStringField(errors, "submit", command, "serverInstanceId", "command.serverInstanceId");
  requireStringField(errors, "submit", command, "playerId", "command.playerId");
  requireStringField(errors, "submit", command, "mode", "command.mode");
  validateGameCommandPayload(errors, command);
};

const rejectServerAssignedFocusDistrict = (
  errors: DomainError[],
  value: Record<string, unknown>
): void => {
  if (value.focusDistrictId !== SERVER_ASSIGNED_FOCUS_DISTRICT_ID) {
    return;
  }

  errors.push({
    code: "transport.invalid_request",
    message: "Gameplay slice submit request field 'focusDistrictId' must be a concrete server district.",
    details: {
      field: "focusDistrictId"
    }
  });
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
