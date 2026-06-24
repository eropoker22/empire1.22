import type { DistrictId } from "../ids/entity-id";
import type { ActionCommand } from "./action-command";

export interface SelectSpawnDistrictPayload {
  districtId: DistrictId;
}

export type SelectSpawnDistrictCommand = ActionCommand<"select-spawn-district", SelectSpawnDistrictPayload>;
