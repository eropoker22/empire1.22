import { describe, expect, it } from "vitest";
import { resolveModeConfig } from "@empire/game-config";
import { resolveCasinoAction } from "../../../packages/game-core/src/handlers/casinoBuildingActions";
import { resolveStripClubAction } from "../../../packages/game-core/src/handlers/stripClubBuildingActions";
import { resolveInstantAirportImport } from "../../../packages/game-core/src/handlers/airportInstantImport";
import { getAirportMetadata } from "../../../packages/game-core/src/handlers/airportMetadata";
import { createCoreStateWithFixedBuildingFixture } from "../../fixtures/game-state-fixtures";

describe("client command IDs cannot choose a building action outcome", () => {
  const config = resolveModeConfig("free");
  it.each(["casino", "strip_club", "airport"])("preserves %s monetary, risk and information results", type => {
    const { state, building } = createCoreStateWithFixedBuildingFixture(type);
    const resolve = (commandId: string) => {
      const common = { state, building, commandId, balances: { cash: 100_000 }, tickRateMs: config.tickRateMs };
      if (type === "casino") return resolveCasinoAction({ ...common,
        casinoConfig: config.balance.casino!, action: config.balance.buildingActions!.bribed_inspector });
      if (type === "strip_club") return resolveStripClubAction({ ...common,
        stripClubConfig: { ...config.balance.stripClub!, privateParty: { ...config.balance.stripClub!.privateParty,
          extraRumorChancePct: 100, scandalChancePct: 100 } }, action: config.balance.buildingActions!.private_party });
      const result = resolveInstantAirportImport({ ...common,
        gameConfig: config, config: config.balance.airport!, category: "materials", metadata: getAirportMetadata(building) });
      // The tracking ID intentionally identifies the command; the outcome must not.
      const { importId: _importId, ...airportResult } = result.airportResult;
      return { ...result, airportResult };
    };
    const expected = resolve("client:first");
    expect(expected).not.toBeNull();
    for (let index = 0; index < 25; index++) expect(resolve(`client:alternative:${index}`)).toEqual(expected);
  });
});
