import type { DomainError } from "@empire/shared-types";

const DEFAULT_MAX_BODY_BYTES = 512 * 1024;
const encoder = new TextEncoder();

export interface ParsedNetlifyJsonBody {
  accepted: true;
  body: unknown;
}

export interface RejectedNetlifyJsonBody {
  accepted: false;
  statusCode: number;
  error: DomainError;
}

export type NetlifyJsonBodyParseResult =
  | ParsedNetlifyJsonBody
  | RejectedNetlifyJsonBody;

/**
 * Responsibility: Safe JSON body parsing for serverless gameplay endpoints.
 * Belongs here: request body size guard and syntax errors.
 * Does not belong here: DTO field validation or gameplay routing.
 */
export const parseNetlifyJsonBody = (
  body: string | null,
  maxBodyBytes = DEFAULT_MAX_BODY_BYTES
): NetlifyJsonBodyParseResult => {
  if (!body) {
    return rejectInvalidJson();
  }

  if (encoder.encode(body).byteLength > maxBodyBytes) {
    return {
      accepted: false,
      statusCode: 413,
      error: {
        code: "transport.request_body_too_large",
        message: "Request body exceeds the gameplay slice limit."
      }
    };
  }

  try {
    return {
      accepted: true,
      body: JSON.parse(body)
    };
  } catch (_error) {
    return rejectInvalidJson();
  }
};

const rejectInvalidJson = (): RejectedNetlifyJsonBody => ({
  accepted: false,
  statusCode: 400,
  error: {
    code: "transport.invalid_json",
    message: "Request body must be valid JSON."
  }
});
