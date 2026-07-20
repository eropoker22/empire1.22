import type { DomainError } from "@empire/shared-types";
import type { SnapshotTokenCodec } from "../runtime/persistence/services";

export const validateSnapshotTokenForInstance = async (
  codec: SnapshotTokenCodec,
  snapshotToken: string | null | undefined,
  serverInstanceId: string
): Promise<DomainError | null> => {
  const token = String(snapshotToken ?? "").trim();
  if (!token) return null;
  const snapshot = await codec.open(token);
  return snapshot?.instanceId === serverInstanceId
    ? null
    : { code: "transport.snapshot_token_invalid", message: "Snapshot token is invalid." };
};
