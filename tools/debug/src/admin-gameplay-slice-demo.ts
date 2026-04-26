import type { BuildStructureCommand, GameModeId } from "@empire/shared-types";
import type { ClientAppShell, ClientRenderState } from "../../../apps/client/src/app";
import { createClientApp } from "../../../apps/client/src/app";
import {
  createAttackDistrictCommand,
  createCollectProductionCommand,
  createCraftItemCommand
} from "../../../apps/client/src/features";
import { createInMemoryClientTransport } from "../../../apps/client/src/transport";
import { createServerApp } from "../../../apps/server/src/app";
import { createDistrictBuildingSliceSeed } from "../../seed/src";
import { resolveLiveGameplaySliceBootstrap } from "./live-gameplay-slice-bootstrap";

/**
 * Responsibility: Local browser-only demo harness for the migrated gameplay slice.
 * Belongs here: isolated debug bootstrap outside production runtime and legacy pages runtime.
 * Does not belong here: authoritative gameplay logic or server transport code.
 */
export interface AdminGameplaySliceDemo {
  load(): Promise<ClientRenderState>;
  reset(): Promise<ClientRenderState>;
  selectDistrict(districtId: string): Promise<ClientRenderState>;
  build(buildingTypeId: string, slotIndex: number): Promise<ClientRenderState>;
  attack(targetDistrictId: string): Promise<ClientRenderState>;
  collect(buildingId: string): Promise<ClientRenderState>;
  craft(buildingId: string, recipeId: string): Promise<ClientRenderState>;
  createCommandId(prefix: string): string;
  getClientShell(): ClientAppShell;
  getRenderState(): ClientRenderState;
}

interface CreateDeprecatedDevBuildStructureCommandInput {
  commandId: string;
  serverInstanceId: string;
  playerId: string;
  mode: GameModeId;
  districtId: string;
  buildingTypeId: string;
  slotIndex: number;
  issuedAt: string;
}

const createDeprecatedDevBuildStructureCommand = (
  input: CreateDeprecatedDevBuildStructureCommandInput
): BuildStructureCommand => ({
  id: input.commandId,
  type: "build-structure",
  mode: input.mode,
  playerId: input.playerId,
  serverInstanceId: input.serverInstanceId,
  issuedAt: input.issuedAt,
  payload: {
    districtId: input.districtId,
    buildingTypeId: input.buildingTypeId,
    slotIndex: input.slotIndex
  },
  clientRequestId: null
});

export const createAdminGameplaySliceDemo = (): AdminGameplaySliceDemo => {
  let sequence = 0;
  let bootstrapState = resolveLiveGameplaySliceBootstrap();
  let server = createServerApp();
  let client = createClientApp({
    transport: createInMemoryClientTransport(server.gameplaySliceTransport)
  });

  const bootstrap = () => {
    bootstrapState = resolveLiveGameplaySliceBootstrap();
    server = createServerApp();
    const runtime = server.instanceManager.createInstance(bootstrapState.instanceId, bootstrapState.mode);

    runtime.state = createDistrictBuildingSliceSeed({
      instanceId: bootstrapState.instanceId,
      playerId: bootstrapState.playerId,
      playerName: bootstrapState.playerName,
      playerFactionId: bootstrapState.playerFactionId,
      playerColor: bootstrapState.playerColor,
      districtId: bootstrapState.districtId,
      mode: bootstrapState.mode,
      playerAttackLoadout: bootstrapState.playerAttackLoadout,
      homeDistrict: bootstrapState.homeDistrict,
      extraDistricts: bootstrapState.extraDistricts
    });
    server.instanceManager.startInstance(bootstrapState.instanceId);
    client = createClientApp({
      transport: createInMemoryClientTransport(server.gameplaySliceTransport)
    });
  };

  const nextCommandId = (prefix: string): string => {
    sequence += 1;
    return `${prefix}:${sequence}`;
  };

  const getSelectedDistrictId = (): string | null =>
    client.getRenderState().districtPanel?.districtId ?? null;

  const loadCurrentSlice = () =>
    client.load({
      serverInstanceId: bootstrapState.instanceId,
      playerId: bootstrapState.playerId,
      districtId: bootstrapState.districtId
    });

  bootstrap();

  return {
    load: async () => loadCurrentSlice(),
    reset: async () => {
      bootstrap();
      return loadCurrentSlice();
    },
    selectDistrict: async (districtId) => client.selectDistrict(districtId),
    build: async (buildingTypeId, slotIndex) => {
      const selectedDistrictId = getSelectedDistrictId();

      if (!selectedDistrictId) {
        return client.getRenderState();
      }

      return client.dispatch(
        createDeprecatedDevBuildStructureCommand({
          commandId: nextCommandId("command:build"),
          serverInstanceId: bootstrapState.instanceId,
          playerId: bootstrapState.playerId,
          mode: bootstrapState.mode,
          districtId: selectedDistrictId,
          buildingTypeId,
          slotIndex,
          issuedAt: new Date().toISOString()
        })
      );
    },
    attack: async (targetDistrictId) => {
      const selectedDistrictId = getSelectedDistrictId();

      if (!selectedDistrictId) {
        return client.getRenderState();
      }

      return client.dispatch(
        createAttackDistrictCommand({
          commandId: nextCommandId("command:attack"),
          serverInstanceId: bootstrapState.instanceId,
          playerId: bootstrapState.playerId,
          mode: bootstrapState.mode,
          sourceDistrictId: selectedDistrictId,
          targetDistrictId,
          issuedAt: new Date().toISOString()
        })
      );
    },
    collect: async (buildingId) => {
      const selectedDistrictId = getSelectedDistrictId();

      if (!selectedDistrictId) {
        return client.getRenderState();
      }

      return client.dispatch(
        createCollectProductionCommand({
          commandId: nextCommandId("command:collect"),
          serverInstanceId: bootstrapState.instanceId,
          playerId: bootstrapState.playerId,
          mode: bootstrapState.mode,
          districtId: selectedDistrictId,
          buildingId,
          issuedAt: new Date().toISOString()
        })
      );
    },
    craft: async (buildingId, recipeId) => {
      const slice = client.getGameplaySlice();

      if (!slice) {
        return client.getRenderState();
      }

      return client.dispatch(
        createCraftItemCommand({
          commandId: nextCommandId("command:craft"),
          slice,
          buildingId,
          recipeId,
          issuedAt: new Date().toISOString()
        })
      );
    },
    createCommandId: (prefix) => nextCommandId(prefix),
    getClientShell: () => client,
    getRenderState: () => client.getRenderState()
  };
};
