import type { ActionCommand } from "./action-command";
export type HeatReductionMethod = "dirty" | "clean" | "influence";
export type ReducePoliceHeatCommand = ActionCommand<"reduce-police-heat", { method: HeatReductionMethod }>;
