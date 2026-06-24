import type { ClientRenderState } from "./client-render-state";
import type { ClientAppShell } from "./client-app-shell";

export interface ClientSurfaceActionElement {
  dataset: Record<string, string | undefined>;
  value?: string;
  closest<T extends ClientSurfaceActionElement = ClientSurfaceActionElement>(selector: string): T | null;
  querySelector?<T extends ClientSurfaceActionElement = ClientSurfaceActionElement>(selector: string): T | null;
  querySelectorAll?<T extends ClientSurfaceActionElement = ClientSurfaceActionElement>(
    selector: string
  ): Iterable<T> | ArrayLike<T>;
}

export type ClientSurfaceAction =
  | { kind: "select-district"; districtId: string }
  | { kind: "select-spawn"; districtId: string }
  | { kind: "attack"; targetDistrictId: string }
  | { kind: "spy"; targetDistrictId: string }
  | { kind: "occupy"; targetDistrictId: string }
  | { kind: "place-trap" }
  | { kind: "open-building"; buildingId: string }
  | {
      kind: "building-action";
      buildingId: string;
      actionId: string;
      dealerSlotId?: string;
      targetCategory?: string;
      category?: string;
      mode?: string;
      investmentCleanCash?: number;
      investment?: number;
      targetZone?: string;
      itemId?: string;
      amount?: number;
    }
  | { kind: "collect"; buildingId: string }
  | { kind: "craft"; buildingId: string; recipeId: string };

export interface CreateClientSurfaceActionRouterOptions {
  client: ClientAppShell;
  createCommandId(prefix: string): string;
  getIssuedAt?: () => string;
}

export interface ClientSurfaceActionRouter {
  handleTarget(target: ClientSurfaceActionElement | null): Promise<ClientRenderState | null>;
}
