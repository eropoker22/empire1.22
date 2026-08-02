import type { ClientTransport } from "../transport/client-transport";
import { projectClientControllerState } from "./client-controller-state-projector";
import { createClientAppCore } from "./create-client-app-core";

export interface CreateControllerClientAppOptions {
  transport: ClientTransport;
  onStateRecompute?(reason: string): void;
}

export const createControllerClientApp = ({
  transport,
  onStateRecompute
}: CreateControllerClientAppOptions) => createClientAppCore({
  transport,
  projectRenderState: projectClientControllerState,
  onStateRecompute
});
