import type { RelocateTrapCommand } from "@empire/shared-types";
import type { CoreGameState } from "../entities";
import type { CoreError } from "../errors";

export const TRAP_RELOCATION_COOLDOWN_KEY = "trap:relocate";

export const validateRelocateTrap = (
  state: CoreGameState,
  command: RelocateTrapCommand
): CoreError[] => {
  const player = state.playersById[command.playerId];
  const trap = state.trapsById[command.payload.trapId];
  const source = state.districtsById[command.payload.sourceDistrictId];
  const target = state.districtsById[command.payload.targetDistrictId];
  if (!player) return [{ code: "trap_player_not_found", message: "Hráč nebyl nalezen." }];
  if (!trap) return [{ code: "trap_not_found", message: "Past nebyla nalezena." }];
  if (!source || !target) return [{ code: "trap_district_not_found", message: "Zdrojový nebo cílový district nebyl nalezen." }];
  if (trap.ownerPlayerId !== player.id || trap.status !== "active" || trap.districtId !== source.id) {
    return [{ code: "TRAP_RELOCATION_NOT_OWNED", message: "Přesunout lze jen vlastní aktivní past ze správného districtu." }];
  }
  if (
    source.version !== command.payload.expectedSourceVersion
    || target.version !== command.payload.expectedTargetVersion
    || trap.version !== command.payload.expectedTrapVersion
  ) {
    return [{ code: "VERSION_CONFLICT", message: "District nebo past se od otevření změnily." }];
  }
  if (source.ownerPlayerId !== player.id || target.ownerPlayerId !== player.id) {
    return [{ code: "TRAP_RELOCATION_NOT_OWNED", message: "Oba districty musí vlastnit hráč." }];
  }
  if ([source.status, target.status].some((status) => status === "destroyed" || status === "locked")) {
    return [{ code: "DISTRICT_LOCKED", message: "Zamčený nebo zničený district nelze použít pro přesun pasti." }];
  }
  if ((source.stabilizingUntilTick ?? 0) > state.root.tick || (target.stabilizingUntilTick ?? 0) > state.root.tick) {
    return [{ code: "DISTRICT_STABILIZING", message: "Během stabilizace nelze past přesouvat." }];
  }
  if (!source.adjacentDistrictIds.includes(target.id) || !target.adjacentDistrictIds.includes(source.id)) {
    return [{ code: "TARGET_NOT_ADJACENT", message: "Past lze přesunout jen do sousedního districtu." }];
  }
  const targetTrap = Object.values(state.trapsById).find(
    (candidate) => candidate.id !== trap.id && candidate.districtId === target.id && candidate.status === "active"
  );
  if (targetTrap) return [{ code: "TRAP_TARGET_OCCUPIED", message: "Cílový district už má aktivní past." }];
  const cooldownUntilTick = state.cooldownStatesById[player.cooldownStateId]?.cooldowns[TRAP_RELOCATION_COOLDOWN_KEY];
  if (typeof cooldownUntilTick === "number" && cooldownUntilTick > state.root.tick) {
    return [{ code: "TRAP_RELOCATION_COOLDOWN", message: "Přesun pasti je ještě na cooldownu." }];
  }
  return [];
};
