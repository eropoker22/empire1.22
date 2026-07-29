import type { DomainError, GameCommand, GameplaySliceView } from "@empire/shared-types";
import type { ClientRenderState } from "../app";
import type { ClientTransport } from "../transport";

export interface GameplaySlicePageMountOptions {
  root: HTMLElement;
  transport?: ClientTransport;
  presentationMode?: "full" | "controller-only";
}

export interface MountedGameplaySlicePage {
  destroy(): void;
}

export interface GameplaySliceCommandResult {
  accepted: boolean;
  errors: DomainError[];
  readModel: GameplaySliceView | null;
  renderState: ClientRenderState;
  transportFailure: boolean;
}

export interface MountedGameplaySlicePageExternalPort extends MountedGameplaySlicePage {
  closeDistrictSheetFromExternal(reason?: string): boolean;
  getCurrentReadModel(): GameplaySliceView | null;
  getCurrentRenderState(): ClientRenderState;
  handleSurfaceActionFromExternal(target: HTMLElement): Promise<ClientRenderState | null>;
  selectDistrictFromExternal(districtId: string): Promise<ClientRenderState | null>;
  submitCommandFromExternal(command: GameCommand): Promise<GameplaySliceCommandResult>;
}

interface MountedGameplaySlicePageExternalPortOptions {
  root: HTMLElement;
  closeDistrictSheet(reason?: string): boolean;
  getCurrentReadModel(): GameplaySliceView | null;
  getCurrentRenderState(): ClientRenderState;
  handleSurfaceAction(target: HTMLElement): Promise<ClientRenderState | null>;
  selectDistrict(districtId: string): Promise<ClientRenderState | null>;
  submitCommand(command: GameCommand): Promise<ClientRenderState>;
  applyState(state: ClientRenderState, reason: string): void;
  destroy(): void;
}

type GameplaySlicePageMount = (
  options: GameplaySlicePageMountOptions
) => MountedGameplaySlicePage | null;

const activeGameplaySlicePages = new Set<MountedGameplaySlicePageExternalPort>();

declare global {
  interface Window {
    EmpireGameplaySliceClient?: {
      closeDistrictSheet(reason?: string): boolean;
      getCurrentReadModel(): GameplaySliceView | null;
      getCurrentRenderState(): ClientRenderState | null;
      handleSurfaceAction(target: HTMLElement): Promise<ClientRenderState | null>;
      selectDistrict(districtId: string): Promise<ClientRenderState | null>;
      submitCommand(command: GameCommand): Promise<GameplaySliceCommandResult | null>;
      mount(options: GameplaySlicePageMountOptions): MountedGameplaySlicePage | null;
      autoMount(): MountedGameplaySlicePage[];
    };
  }
}

export const createMountedGameplaySlicePageExternalPort = (
  options: MountedGameplaySlicePageExternalPortOptions
): MountedGameplaySlicePageExternalPort => {
  const applyExternalState = async (
    action: () => Promise<ClientRenderState | null>,
    reason: string
  ): Promise<ClientRenderState | null> => {
    const state = await action();
    if (!state) return null;
    options.applyState(state, reason);
    return state;
  };
  return {
    closeDistrictSheetFromExternal: options.closeDistrictSheet,
    getCurrentReadModel: options.getCurrentReadModel,
    getCurrentRenderState: options.getCurrentRenderState,
    handleSurfaceActionFromExternal: (target) => {
      if (!options.root.contains(target)) return Promise.resolve(null);
      return applyExternalState(
        () => options.handleSurfaceAction(target),
        "external:surface-action"
      );
    },
    selectDistrictFromExternal: (districtId) => applyExternalState(
      () => options.selectDistrict(districtId),
      "external:select-district"
    ),
    submitCommandFromExternal: async (command) => {
      const state = await options.submitCommand(command);
      options.applyState(state, "external:command");
      return {
        accepted: state.lastCommandStatus?.commandId === command.id
          && state.lastCommandStatus.accepted === true,
        errors: state.errors,
        readModel: options.getCurrentReadModel(),
        renderState: state,
        transportFailure: state.errors.some((error) => error.code === "client.transport_error")
      };
    },
    destroy: options.destroy
  };
};

export const registerMountedGameplaySlicePage = (
  mountedPage: MountedGameplaySlicePageExternalPort
): (() => void) => {
  activeGameplaySlicePages.add(mountedPage);
  return () => activeGameplaySlicePages.delete(mountedPage);
};

export const closeDistrictSheet = (reason = "external district popup close"): boolean => {
  let closed = false;
  for (const mountedPage of activeGameplaySlicePages) {
    closed = mountedPage.closeDistrictSheetFromExternal(reason) || closed;
  }
  return closed;
};

const getSoleMountedGameplaySlicePage = (): MountedGameplaySlicePageExternalPort | null => {
  if (activeGameplaySlicePages.size !== 1) return null;
  return activeGameplaySlicePages.values().next().value ?? null;
};

export const getCurrentGameplaySliceReadModel = (): GameplaySliceView | null =>
  getSoleMountedGameplaySlicePage()?.getCurrentReadModel() ?? null;

export const getCurrentGameplaySliceRenderState = (): ClientRenderState | null =>
  getSoleMountedGameplaySlicePage()?.getCurrentRenderState() ?? null;

export const handleGameplaySliceSurfaceAction = (
  target: HTMLElement
): Promise<ClientRenderState | null> => {
  const mountedPage = getSoleMountedGameplaySlicePage();
  return mountedPage ? mountedPage.handleSurfaceActionFromExternal(target) : Promise.resolve(null);
};

export const selectGameplaySliceDistrict = (
  districtId: string
): Promise<ClientRenderState | null> => {
  const mountedPage = getSoleMountedGameplaySlicePage();
  return mountedPage ? mountedPage.selectDistrictFromExternal(districtId) : Promise.resolve(null);
};

export const submitGameplaySliceCommand = (
  command: GameCommand
): Promise<GameplaySliceCommandResult | null> => {
  const mountedPage = getSoleMountedGameplaySlicePage();
  return mountedPage ? mountedPage.submitCommandFromExternal(command) : Promise.resolve(null);
};

export const installGameplaySlicePageApi = (mountPage: GameplaySlicePageMount): void => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  window.EmpireGameplaySliceClient = {
    closeDistrictSheet,
    getCurrentReadModel: getCurrentGameplaySliceReadModel,
    getCurrentRenderState: getCurrentGameplaySliceRenderState,
    handleSurfaceAction: handleGameplaySliceSurfaceAction,
    selectDistrict: selectGameplaySliceDistrict,
    submitCommand: submitGameplaySliceCommand,
    mount: mountPage,
    autoMount: () => Array.from(document.querySelectorAll<HTMLElement>("[data-gameplay-slice-client]"))
      .map((root) => mountPage({ root }))
      .filter((mount): mount is MountedGameplaySlicePage => mount !== null)
  };
};
