import { describe, expect, it } from "vitest";
import {
  CONFLICT_SYSTEM_IDS,
  GAMEPLAY_SYSTEM_IDS,
  GAMEPLAY_EXECUTION_MODES,
  assertConflictAuthorityMatrix,
  assertGameplayAuthorityMatrix,
  getGameplayAuthorityMatrix,
  getConflictAuthorityMatrix
} from "../../page-assets/js/app/runtime/gameplayExecutionMode.js";

describe("conflict authority matrix", () => {
  it.each([
    [GAMEPLAY_EXECUTION_MODES.localDemo, "localMutation"],
    [GAMEPLAY_EXECUTION_MODES.serverAuthoritative, "serverCommand"]
  ])("assigns exactly one authority in %s", (mode, expectedAuthority) => {
    const matrix = getConflictAuthorityMatrix(mode);
    for (const systemId of CONFLICT_SYSTEM_IDS) {
      expect(matrix[systemId][expectedAuthority]).toBe(true);
      expect(Number(matrix[systemId].localMutation) + Number(matrix[systemId].serverCommand)).toBe(1);
    }
  });

  it("assigns no mutation authority while unavailable", () => {
    const matrix = getConflictAuthorityMatrix(GAMEPLAY_EXECUTION_MODES.unavailable);
    for (const systemId of CONFLICT_SYSTEM_IDS) {
      expect(matrix[systemId]).toEqual({
        localMutation: false,
        serverCommand: false,
        readOnly: true,
        unavailable: true
      });
    }
  });

  it("covers every gameplay mutation system with one authority", () => {
    const matrix = getGameplayAuthorityMatrix(GAMEPLAY_EXECUTION_MODES.serverAuthoritative);
    expect(Object.keys(matrix)).toEqual([...GAMEPLAY_SYSTEM_IDS]);
    expect(assertGameplayAuthorityMatrix(matrix, GAMEPLAY_EXECUTION_MODES.serverAuthoritative)).toBe(true);
    for (const authority of Object.values(matrix)) {
      expect(authority).toEqual({
        localMutation: false,
        serverCommand: true,
        readOnly: false,
        unavailable: false
      });
    }
  });

  it("rejects a double-authority integration", () => {
    const matrix = getConflictAuthorityMatrix(GAMEPLAY_EXECUTION_MODES.serverAuthoritative);
    expect(() => assertConflictAuthorityMatrix({
      ...matrix,
      attack: { localMutation: true, serverCommand: true, readOnly: false, unavailable: false }
    }, GAMEPLAY_EXECUTION_MODES.serverAuthoritative)).toThrow(/attack/);
  });
});
