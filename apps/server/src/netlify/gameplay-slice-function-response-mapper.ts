import type { GameplayCommandResultLookupResponse, GameplaySliceResponse } from "@empire/shared-types";
import type { ServerApp } from "../app";
import { createInstanceSnapshot } from "../runtime/persistence/mappers";
import type { SnapshotTokenCodec } from "../runtime/persistence/services";
import { createJsonResponse, type NetlifyFunctionResponse } from "./netlify-json-response";

interface GameplaySliceFunctionResponseMapperOptions {
  server: ServerApp;
  hostedAuthorityRequired: boolean;
  snapshotTokenCodec: SnapshotTokenCodec | null;
}

type GameplaySliceHandlerResponse = {
  status: number;
  body: GameplaySliceResponse | GameplayCommandResultLookupResponse;
};

export const createGameplaySliceFunctionResponseMapper = (
  options: GameplaySliceFunctionResponseMapperOptions
) => (
  response: GameplaySliceHandlerResponse,
  instanceId: string
): Promise<NetlifyFunctionResponse> => {
  const runtime = options.server.instanceManager.getInstanceById(instanceId);
  return Promise.resolve(options.hostedAuthorityRequired ? null : runtime
    ? options.snapshotTokenCodec!.seal(createInstanceSnapshot(runtime))
    : ("snapshotToken" in response.body ? response.body.snapshotToken ?? null : null)
  ).then((snapshotToken) => createJsonResponse(response.status, {
    ...response.body,
    snapshotToken
  }));
};
