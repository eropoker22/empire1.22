import type { AttackDistrictCommand, AttackWeaponId, DefenseWeaponId } from "@empire/shared-types";
import type { CoreGameState } from "../entities";

export interface BattleReportNotificationInput {
  command: AttackDistrictCommand;
  recipientPlayerId: string;
  defenderPlayerId: string | null;
  targetDistrictId: string;
  result: "success" | "failure" | "blocked" | "catastrophe";
  outcomeTier: "clean_capture" | "costly_capture" | "failed_raid" | "disaster";
  districtCaptured: boolean;
  districtDestroyed: boolean;
  districtDamaged: boolean;
  trapTriggered: boolean;
  trapType: "toxic" | null;
  trapReport: string | null;
  attackerLosses: Partial<Record<AttackWeaponId, number>>;
  defenderLosses: Partial<Record<DefenseWeaponId, number>>;
  heatGained: number;
  reportForAttacker: string;
  reportForDefender: string;
  combatPopulationLoss: number;
  occupationPopulationLoss: number;
  defenderPopulationLoss: number;
  vestPopulationSaved: number;
  survivingDefenseAbandoned: boolean;
  catastropheBaseChance: number;
  bazookaCatastropheBonus: number;
  catastropheFinalChance: number;
  attackPower?: number;
  defensePower?: number;
  stabilizingUntilTick?: number | null;
  attackDurationTicks: number;
  resolveAtTick?: number;
  tacticalGrid: {
    attackerApplied: boolean;
    defenderApplied: boolean;
    multiplier: number;
  };
  detectedDefense: Partial<Record<DefenseWeaponId, number>>;
  tick: number;
  eventId: string;
}
export type BattleReportNotificationsInput = Omit<BattleReportNotificationInput,
  "recipientPlayerId" | "targetDistrictId" | "detectedDefense" | "eventId"> & {
  attackerPlayerId: string;
  targetDistrict: CoreGameState["districtsById"][string];
};
