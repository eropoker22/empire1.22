import type { DomainError, GameplaySliceResponse } from "@empire/shared-types";
import { empireCityMapManifestHash } from "../../../../page-assets/js/data/empire-city-map.generated.js";

export const getMapManifestMismatch = (
  response: GameplaySliceResponse
): DomainError | null => {
  const serverHash = response.readModel?.server.mapManifestHash ?? null;
  if (!serverHash || serverHash === empireCityMapManifestHash) {
    return null;
  }

  return {
    code: "client.map_manifest_mismatch",
    message: "Client map manifest does not match the server map manifest.",
    details: {
      clientMapManifestHash: empireCityMapManifestHash,
      serverMapManifestHash: serverHash,
      mapManifestId: response.readModel?.server.mapManifestId ?? null,
      mapManifestVersion: response.readModel?.server.mapManifestVersion ?? null
    }
  };
};

export const hasCurrentMapManifestMismatch = (
  slice: GameplaySliceResponse["readModel"]
): boolean => {
  const serverHash = slice?.server.mapManifestHash ?? null;
  return Boolean(serverHash && serverHash !== empireCityMapManifestHash);
};
