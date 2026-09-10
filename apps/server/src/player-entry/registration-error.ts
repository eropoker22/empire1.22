import type { HostedServerRegistrationReasonCode } from "@empire/shared-types";
import { entryError } from "./player-entry-error";

export const registrationError = (code: HostedServerRegistrationReasonCode | null): Error => {
  if (code === "SERVER_REGISTRATION_NOT_OPEN" || code === "SERVER_REGISTRATION_NOT_SCHEDULED") {
    return entryError(code, "Registrace na tento server ještě nezačala.");
  }
  if (code === "SERVER_REGISTRATION_CLOSED_EARLY") {
    return entryError(code, "Registrace na tento server byla bezpečnostně uzavřena.");
  }
  return entryError("SERVER_REGISTRATION_CLOSED", "Registrační okno tohoto serveru už skončilo.");
};
