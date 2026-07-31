import { describe, expect, it } from "vitest";
import { assertBalanceTransition } from "../e2e/helpers/hostedProductionParity.js";

describe("hosted production balance evidence", () => {
  it("accounts for passive income across a legitimate multi-tick command sequence", () => {
    const evidence = assertBalanceTransition(
      createSnapshot({
        currentTick: 40,
        cash: 100,
        chemicals: 25
      }),
      createSnapshot({
        currentTick: 42,
        cash: 86,
        chemicals: 21
      }),
      {
        cash: -20,
        chemicals: -4
      },
      "Pharmacy initial two-unit reservation"
    );

    expect(evidence).toEqual({
      cash: {
        before: 100,
        tickGap: 2,
        passivePerTick: 3,
        commandDelta: -20,
        expected: 86,
        actual: 86
      },
      chemicals: {
        before: 25,
        tickGap: 2,
        passivePerTick: 0,
        commandDelta: -4,
        expected: 21,
        actual: 21
      }
    });
  });
});

function createSnapshot({ currentTick, cash, chemicals }) {
  return {
    currentTick,
    hasEconomyRates: true,
    playerBalancePerTick: {
      cash: 3,
      chemicals: 0
    },
    resourceBalances: {
      cash,
      chemicals
    }
  };
}
