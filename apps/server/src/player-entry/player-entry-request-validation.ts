import type {
  ConfirmSpawnDistrictRequest,
  FinalizeServerSetupRequest
} from "@empire/shared-types";
import { entryError } from "./postgres-player-entry-repository";

export const validateConfirmSpawn = (
  value: unknown
): ConfirmSpawnDistrictRequest => {
  if (!record(value) || !onlyKeys(
    value,
    ["serverInstanceId", "districtId", "expectedAvailabilityRevision"]
  )) {
    throw entryError(
      "PLAYER_ENTRY_PAYLOAD_INVALID",
      "Potvrzení districtu obsahuje nepovolená pole."
    );
  }
  const serverInstanceId = safeIdentifier(value.serverInstanceId, "SERVER_ID_INVALID");
  const districtId = safeIdentifier(value.districtId, "DISTRICT_ID_INVALID");
  const expectedAvailabilityRevision = String(value.expectedAvailabilityRevision ?? "");
  if (!/^[a-f0-9]{64}$/u.test(expectedAvailabilityRevision)) {
    throw entryError("SPAWN_REVISION_INVALID", "Revision nabídky districtů není platná.");
  }
  return { serverInstanceId, districtId, expectedAvailabilityRevision };
};

export const validateFinalizeSetup = (
  value: unknown
): FinalizeServerSetupRequest => {
  if (!record(value) || !onlyKeys(
    value,
    ["membershipId", "factionId", "avatarId", "gangColor"]
  )) {
    throw entryError(
      "PLAYER_ENTRY_PAYLOAD_INVALID",
      "Server setup obsahuje nepovolená pole."
    );
  }
  return {
    membershipId: safeIdentifier(value.membershipId, "MEMBERSHIP_ID_INVALID"),
    factionId: safeIdentifier(value.factionId, "FACTION_ID_INVALID"),
    avatarId: safeIdentifier(value.avatarId, "AVATAR_ID_INVALID"),
    gangColor: String(value.gangColor ?? "")
  };
};

const safeIdentifier = (value: unknown, code: string) => {
  const identifier = String(value ?? "").trim();
  if (!/^[a-zA-Z0-9._:-]{1,200}$/u.test(identifier)) {
    throw entryError(code, "Identifikátor není platný.");
  }
  return identifier;
};

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const onlyKeys = (value: Record<string, unknown>, allowed: string[]) =>
  Object.keys(value).every((key) => allowed.includes(key));
