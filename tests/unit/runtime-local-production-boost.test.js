import { describe, expect, it } from "vitest";
import {
  advanceLocalProductionJob,
  cancelWaitingLocalProduction,
  collectLocalProduction,
  queueLocalProduction,
  setLocalProductionSpeedMultiplier
} from "../../page-assets/js/app/runtime/localProductionLineState.js";

const defaults = {
  unitDurationMs: 1_000,
  localOutputCap: 4,
  queueCapacity: 4,
  unitCleanMoneyCost: 100,
  unitInputs: { "metal-parts": 2 },
  output: { inventory: "materials", itemId: "test-output", amount: 1 }
};

describe("Industrial Overdrive local production boundaries", () => {
  it.each(["Pharmacy", "Drug Lab", "Factory", "Armory"])(
    "applies the shared 1.25 multiplier once for %s",
    () => {
      const queued = queueLocalProduction(null, {
        ...defaults,
        quantity: 1,
        now: 0
      }).job;
      const beforeActivation = advanceLocalProductionJob(queued, 400).job;
      const boosted = setLocalProductionSpeedMultiplier(beforeActivation, 1.25, 400, 800).job;

      const atExpiry = advanceLocalProductionJob(boosted, 800);
      expect(atExpiry).toMatchObject({
        completedAmount: 0,
        job: {
          queuedAmount: 1,
          producedAmount: 0,
          productionSpeedMultiplier: 1,
          activeWorkRemainingMs: 100
        }
      });

      const completed = advanceLocalProductionJob(atExpiry.job, 900);
      expect(completed).toMatchObject({
        completedAmount: 1,
        job: { queuedAmount: 0, producedAmount: 1, isProducing: false }
      });
      expect(advanceLocalProductionJob(completed.job, 900)).toMatchObject({
        changed: false,
        completedAmount: 0,
        job: { producedAmount: 1 }
      });
    }
  );

  it("starts a new unit during the boost with a reduced projected deadline", () => {
    const queued = queueLocalProduction(null, {
      ...defaults,
      quantity: 1,
      now: 10_000,
      productionSpeedMultiplier: 1.25,
      productionSpeedExpiresAtMs: 20_000
    }).job;

    expect(queued.readyAtMs).toBe(10_800);
    expect(advanceLocalProductionJob(queued, 10_800)).toMatchObject({
      completedAmount: 1,
      job: { producedAmount: 1, queuedAmount: 0 }
    });
  });

  it("keeps output, queue, local cap, reservations, cancel and collect semantics unchanged", () => {
    const queued = queueLocalProduction(null, {
      ...defaults,
      quantity: 4,
      now: 0,
      productionSpeedMultiplier: 1.25,
      productionSpeedExpiresAtMs: 10_000
    }).job;
    const full = advanceLocalProductionJob(queued, 4_000).job;

    expect(full).toMatchObject({
      queuedAmount: 0,
      producedAmount: 4,
      localOutputCap: 4,
      queueCapacity: 4,
      cleanMoneyCost: 0,
      inputs: {}
    });
    expect(full.producedAmount).toBeLessThanOrEqual(full.localOutputCap);

    const collected = collectLocalProduction(full, 2, 5_000, {
      productionSpeedMultiplier: 1.25,
      productionSpeedExpiresAtMs: 10_000
    });
    expect(collected).toMatchObject({ collectedAmount: 2, remainingAmount: 2 });
  });

  it("cancels only waiting boosted units and refunds their recorded reservations", () => {
    const queued = queueLocalProduction(null, {
      ...defaults,
      quantity: 3,
      now: 0,
      productionSpeedMultiplier: 1.25,
      productionSpeedExpiresAtMs: 10_000
    }).job;

    const cancelled = cancelWaitingLocalProduction(queued);
    expect(cancelled).toMatchObject({
      waitingAmount: 2,
      refund: {
        cleanMoney: 200,
        inputs: { "metal-parts": 4 }
      },
      job: {
        queuedAmount: 1,
        isProducing: true,
        productionSpeedMultiplier: 1.25
      }
    });
    expect(advanceLocalProductionJob(cancelled.job, 800)).toMatchObject({
      completedAmount: 1,
      job: { queuedAmount: 0, producedAmount: 1 }
    });
  });
});
