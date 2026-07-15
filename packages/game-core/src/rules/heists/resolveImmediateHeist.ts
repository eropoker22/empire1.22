import type { HeistDistrictCommand, HeistDistrictStyle } from "@empire/shared-types";
import type { ConflictBalanceConfig } from "../../contracts";
import type { CoreGameState } from "../../entities";
import { deterministicUnitInterval } from "../../utils/math";

export type ImmediateHeistOutcome = "clean_success" | "success" | "detected" | "failed" | "trap_triggered";

export interface ImmediateHeistResolution {
  outcome: ImmediateHeistOutcome;
  successChance: number;
  detectionChance: number;
  lootMultiplier: number;
  lootRoll: number;
  gangLosses: number;
  heatGain: number;
  trapId: string | null;
  attackerIdentified: boolean;
}

const LOSS_RANGES: Record<ImmediateHeistOutcome, Record<HeistDistrictStyle, [number, number]>> = {
  clean_success: { stealth: [0, 0.03], balanced: [0, 0.03], all_in: [0, 0.03] },
  success: { stealth: [0.03, 0.10], balanced: [0.03, 0.10], all_in: [0.03, 0.10] },
  detected: { stealth: [0.15, 0.35], balanced: [0.20, 0.45], all_in: [0.30, 0.55] },
  failed: { stealth: [0.25, 0.50], balanced: [0.25, 0.50], all_in: [0.25, 0.50] },
  trap_triggered: { stealth: [0.35, 0.60], balanced: [0.35, 0.60], all_in: [0.35, 0.60] }
};

export const calculateImmediateHeistChances = (input: {
  defenseLoadout: CoreGameState["districtsById"][string]["defenseLoadout"];
  style: NonNullable<ConflictBalanceConfig["heist"]>["styles"][HeistDistrictStyle];
  members: number;
  config: NonNullable<ConflictBalanceConfig["heist"]>;
}): { successChance: number; detectionChance: number; cameraBonus: number } => {
  const memberProgress = (input.members - input.style.minMembers)
    / Math.max(1, input.style.maxMembers - input.style.minMembers);
  const resistance = Number(input.defenseLoadout["defense-tower"] ?? 0)
      * input.config.security.defenseTowerResistancePerUnit
    + Number(input.defenseLoadout.barricades ?? 0)
      * input.config.security.barricadesResistancePerUnit;
  const successChance = clamp(
    input.style.baseSuccessChance
      + Math.min(0.15, Math.max(0, memberProgress) * 0.15)
      - Math.min(0.30, resistance / 300),
    0.10,
    0.95
  );
  const cameraBonus = Math.min(
    input.config.security.camerasMaxDetectionBonus,
    Number(input.defenseLoadout.cameras ?? 0) * input.config.security.camerasDetectionChancePerUnit
  );
  const alarmBonus = Math.min(
    input.config.security.alarmMaxDetectionBonus,
    Number(input.defenseLoadout.alarm ?? 0) * input.config.security.alarmDetectionChancePerUnit
  );
  const detectionChance = clamp(
    input.style.baseDetectionChance + Math.max(0, memberProgress) * 0.18 + cameraBonus + alarmBonus,
    0.02,
    0.95
  );
  return { successChance, detectionChance, cameraBonus };
};

export const resolveImmediateHeist = (
  state: CoreGameState,
  command: HeistDistrictCommand,
  sourceDistrictId: string,
  config: NonNullable<ConflictBalanceConfig["heist"]>
): ImmediateHeistResolution => {
  const source = state.districtsById[sourceDistrictId];
  const target = state.districtsById[command.payload.targetDistrictId];
  const style = config.styles[command.payload.style];
  const members = command.payload.gangMembersSent;
  const { successChance, detectionChance, cameraBonus } = calculateImmediateHeistChances({
    defenseLoadout: target.defenseLoadout,
    style,
    members,
    config
  });
  const seed = [
    state.serverInstance.worldSeed,
    command.id,
    command.playerId,
    sourceDistrictId,
    target.id,
    source.securityRevision,
    target.securityRevision,
    state.root.tick,
    command.payload.style,
    members
  ].join(":");
  const successRoll = deterministicUnitInterval(`${seed}:success`);
  const detectionRoll = deterministicUnitInterval(`${seed}:detection`);
  const lootRoll = deterministicUnitInterval(`${seed}:loot`);
  const lossRoll = deterministicUnitInterval(`${seed}:loss`);
  const activeTrap = Object.values(state.trapsById)
    .find((trap) => trap.districtId === target.id && trap.status === "active");
  const trapTriggered = Boolean(activeTrap) && detectionRoll < Math.min(0.75, detectionChance + 0.15);
  const outcome: ImmediateHeistOutcome = trapTriggered
    ? "trap_triggered"
    : successRoll >= successChance
      ? "failed"
      : detectionRoll < detectionChance
        ? "detected"
        : detectionRoll > Math.min(1, detectionChance + 0.20)
          ? "clean_success"
          : "success";
  const [minLossPct, maxLossPct] = LOSS_RANGES[outcome][command.payload.style];
  const styleLossRoll = outcome === "detected"
    ? clamp(lossRoll * (0.75 + style.detectedLossMultiplier * 0.5), 0, 1)
    : lossRoll;
  const lossPct = minLossPct + (maxLossPct - minLossPct) * styleLossRoll;
  const rawLosses = Math.floor(members * lossPct);
  const gangLosses = outcome === "clean_success"
    ? Math.min(members, rawLosses)
    : Math.min(members, Math.max(1, rawLosses));
  const outcomeLootMultiplier = outcome === "clean_success" ? 1
    : outcome === "success" ? 0.85
      : outcome === "detected" ? 0.55
        : 0;

  return {
    outcome,
    successChance,
    detectionChance,
    lootMultiplier: style.lootMultiplier * outcomeLootMultiplier,
    lootRoll,
    gangLosses,
    heatGain: outcome === "clean_success" || outcome === "success"
      ? style.heatOnSuccess
      : style.heatOnDetected,
    trapId: trapTriggered ? activeTrap!.id : null,
    attackerIdentified: outcome === "detected" || outcome === "trap_triggered"
      ? deterministicUnitInterval(`${seed}:detection:identity`) < clamp(0.35 + cameraBonus, 0, 0.90)
      : false
  };
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
