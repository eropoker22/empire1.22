import type { ServerInstanceSummary } from "@empire/shared-types";
import type { ServerInstanceRuntime } from "../instance/server-instance-runtime";
import { isRuntimeJoinable } from "./server-instance-joinability";

export const createServerInstanceSummary = (
  runtime: ServerInstanceRuntime
): ServerInstanceSummary => ({
  serverInstanceId: runtime.record.id,
  displayName: runtime.lobby.displayName,
  mode: runtime.record.mode,
  region: runtime.lobby.region,
  status: runtime.record.status,
  playerCount: runtime.state.root.playerIds.length,
  maxPlayers: runtime.lobby.maxPlayers,
  startedAt: runtime.record.startedAt,
  createdAt: runtime.record.createdAt,
  tick: runtime.state.root.tick,
  joinable: isRuntimeJoinable(runtime),
  phase: runtime.state.root.phase,
  map: createMapSummary(runtime)
});

const createMapSummary = (runtime: ServerInstanceRuntime): ServerInstanceSummary["map"] => {
  const counts = {
    totalDistricts: runtime.state.root.districtIds.length,
    downtownDistricts: 0,
    commercialDistricts: 0,
    industrialDistricts: 0,
    residentialDistricts: 0,
    parkDistricts: 0
  };

  for (const districtId of runtime.state.root.districtIds) {
    const zone = runtime.state.districtsById[districtId]?.zone;
    if (zone === "downtown") counts.downtownDistricts += 1;
    if (zone === "commercial") counts.commercialDistricts += 1;
    if (zone === "industrial") counts.industrialDistricts += 1;
    if (zone === "residential") counts.residentialDistricts += 1;
    if (zone === "park") counts.parkDistricts += 1;
  }

  return counts;
};
