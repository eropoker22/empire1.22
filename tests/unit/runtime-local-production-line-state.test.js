import { describe, expect, it } from "vitest";
import {
  advanceLocalProductionJob,
  cancelWaitingLocalProduction,
  collectLocalProduction,
  normalizeLocalProductionJob,
  queueLocalProduction
} from "../../page-assets/js/app/runtime/localProductionLineState.js";

const defaults = {
  unitDurationMs: 1_000,
  localOutputCap: 2,
  queueCapacity: 4,
  unitCleanMoneyCost: 360,
  unitInputs: { chemicals: 2 },
  output: { inventory: "materials", itemId: "chemicals", amount: 1 }
};

describe("local-demo production line state", () => {
  it("queues the complete requested quantity and rejects queue overflow atomically", () => {
    const queued = queueLocalProduction(null, { ...defaults, quantity: 4, now: 10_000 });
    expect(queued).toMatchObject({ ok: true, job: { queuedAmount: 4, producedAmount: 0, isProducing: true } });
    expect(queued.job.reservationUnits).toHaveLength(4);
    expect(queued.job.cleanMoneyCost).toBe(1_440);
    expect(queued.job.inputs).toEqual({ chemicals: 8 });

    const rejected = queueLocalProduction(queued.job, { ...defaults, quantity: 1, now: 10_000 });
    expect(rejected).toMatchObject({ ok: false, reason: "queue_full" });
    expect(rejected.job).toEqual(queued.job);
  });

  it("completes one unit per cycle and pauses without losing the paid queue at local capacity", () => {
    const queued = queueLocalProduction(null, { ...defaults, quantity: 4, now: 10_000 }).job;
    const first = advanceLocalProductionJob(queued, 11_000);
    expect(first).toMatchObject({ completedAmount: 1, job: { producedAmount: 1, queuedAmount: 3, isProducing: true } });

    const full = advanceLocalProductionJob(first.job, 12_000);
    expect(full).toMatchObject({ completedAmount: 1, job: { producedAmount: 2, queuedAmount: 2, isProducing: false, status: "waiting" } });
    expect(full.job.reservationUnits).toHaveLength(2);
  });

  it("resumes a paused queue only after collect frees local output space", () => {
    const full = normalizeLocalProductionJob({
      ...defaults.output,
      version: 2,
      queuedAmount: 2,
      producedAmount: 2,
      isProducing: false,
      unitDurationMs: 1_000,
      localOutputCap: 2,
      queueCapacity: 4,
      reservationUnits: [
        { cleanMoney: 360, inputs: { chemicals: 2 } },
        { cleanMoney: 360, inputs: { chemicals: 2 } }
      ],
      output: defaults.output
    });
    const collected = collectLocalProduction(full, 1, 20_000);
    expect(collected).toMatchObject({ collectedAmount: 1, remainingAmount: 1 });
    expect(collected.job).toMatchObject({ producedAmount: 1, queuedAmount: 2, isProducing: true, readyAtMs: 21_000 });
  });

  it("cancels only waiting units and refunds their exact stored reservations once", () => {
    const queued = queueLocalProduction(null, { ...defaults, quantity: 3, now: 10_000 }).job;
    const cancelled = cancelWaitingLocalProduction(queued);
    expect(cancelled).toMatchObject({
      ok: true,
      waitingAmount: 2,
      refund: { cleanMoney: 720, inputs: { chemicals: 4 } },
      job: { queuedAmount: 1, isProducing: true, cleanMoneyCost: 360, inputs: { chemicals: 2 } }
    });
    expect(cancelWaitingLocalProduction(cancelled.job)).toMatchObject({ ok: false, reason: "no_waiting" });
  });

  it("migrates a ready legacy batch into local produced output without recreating a queue", () => {
    expect(normalizeLocalProductionJob({
      status: "ready",
      quantity: 3,
      output: { inventory: "weapons", itemId: "pistol", amount: 3 },
      durationMs: 5_000
    }, { localOutputCap: 5, queueCapacity: 4 })).toMatchObject({
      version: 2,
      queuedAmount: 0,
      producedAmount: 3,
      status: "ready"
    });
  });
});
