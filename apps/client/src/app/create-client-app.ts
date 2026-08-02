import { renderClientShell } from "./client-shell-renderer";
import { createClientAppCore } from "./create-client-app-core";
import type { ClientTransport } from "../transport/client-transport";

export interface CreateClientAppOptions {
  transport: ClientTransport;
  onStateRecompute?(reason: string): void;
}

export const createClientApp = ({
  transport,
  onStateRecompute
}: CreateClientAppOptions) => createClientAppCore({
  transport,
  projectRenderState: renderClientShell,
  onStateRecompute
});
