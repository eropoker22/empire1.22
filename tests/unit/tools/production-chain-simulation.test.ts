import { describe, expect, it } from "vitest";
import { runProductionChainSimulation } from "@empire/tools-debug/production-chain-simulation";

describe("authoritative production-chain simulation", () => {
  it("is deterministic and completes Pharmacy -> Lab -> Factory -> Armory through real commands", () => {
    const first = runProductionChainSimulation();
    const second = runProductionChainSimulation();

    expect(first).toEqual(second);
    expect(first.passed).toBe(true);
    expect(first.steps.map((step) => `${step.buildingTypeId}:${step.recipeId}:${step.quantity}`)).toEqual([
      "pharmacy:chemicals:2",
      "drug_lab:neon-dust:1",
      "factory:metal-parts:7",
      "factory:tech-core:1",
      "armory:pistol:1"
    ]);
    expect(first.steps.every((step) => step.maxCompletedInSingleTick === 1)).toBe(true);
    expect(first.finalBalances).toMatchObject({
      cash: 5_780,
      chemicals: 0,
      "neon-dust": 1,
      "metal-parts": 0,
      "tech-core": 0,
      pistol: 1
    });
  });

  it("rejects a conflicting reservation and refunds waiting costs exactly once", () => {
    const report = runProductionChainSimulation();

    expect(report.reservationAudit).toEqual({
      factoryStartAccepted: true,
      conflictingArmoryError: "armory_missing_inputs",
      metalPartsAfterFactoryReservation: 1,
      metalPartsAfterWaitingRefund: 5,
      cleanCashAfterWaitingRefund: 900,
      duplicateCancelError: "factory_no_waiting_items"
    });
    expect(report.invariants).toMatchObject({
      noNegativeBalances: true,
      reservationConflictRejected: true,
      waitingRefundExact: true,
      duplicateRefundBlocked: true
    });
  });
});
