import type { GameCommand, GameplaySliceView, LoadGameplaySliceRequest } from "@empire/shared-types";
import type { ClientRenderState } from "./client-render-state";

/**
 * Responsibility: Public client shell contract that binds app render and command dispatch.
 * Belongs here: top-level shell boundary between UI composition and transport.
 * Does not belong here: gameplay rules, state mutation logic, or server authority.
 */
export interface ClientAppShell {
  load(request: LoadGameplaySliceRequest): Promise<ClientRenderState>;
  selectDistrict(districtId: string): Promise<ClientRenderState>;
  selectBuilding(buildingId: string | null): Promise<ClientRenderState>;
  dispatch(command: GameCommand): Promise<ClientRenderState>;
  getRenderState(): ClientRenderState;
  getGameplaySlice(): GameplaySliceView | null;
}

export const createClientAppShell = (shell: ClientAppShell): ClientAppShell => shell;
