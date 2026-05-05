import { describe, expect, it, vi } from "vitest";
import {
  getActionResultRefreshHints,
  getActionResultToast,
  handleActionError,
  handleActionSuccess,
  handleAttackResult,
  handleCraftResult,
  handleMarketResult,
  handlePoliceResult,
  handleProductionResult,
  handleSpyResult,
  normalizeActionResult
} from "../../page-assets/js/app/runtime/actionResultOrchestrator.js";

describe("action result orchestrator", () => {
  it("normalizes partial action results with safe defaults", () => {
    expect(normalizeActionResult(null)).toMatchObject({
      type: "event",
      kind: "event",
      ok: true,
      tone: "success",
      payload: {},
      snapshot: {},
      options: { refresh: true },
      refreshHints: {}
    });

    expect(normalizeActionResult({
      ok: false,
      resultKind: "market",
      message: "Chybí cash.",
      payload: { itemId: "chemicals" },
      options: { refresh: false },
      hints: { resources: true }
    })).toMatchObject({
      type: "market",
      kind: "market",
      ok: false,
      tone: "warning",
      message: "Chybí cash.",
      payload: { itemId: "chemicals" },
      options: { refresh: false },
      refreshHints: { resources: true }
    });
  });

  it("builds toast and refresh hints without requiring DOM", () => {
    expect(getActionResultToast({ type: "craft", message: "Hotovo", tone: "success" })).toEqual({
      tone: "success",
      message: "Hotovo"
    });
    expect(getActionResultToast({ type: "craft" })).toBeNull();
    expect(getActionResultRefreshHints({ refreshHints: { market: true } })).toEqual({ market: true });
  });

  it("handles success and error through optional callbacks", () => {
    const showToast = vi.fn();
    const refreshAfterAction = vi.fn();

    const result = handleActionSuccess({
      type: "spy",
      message: "Spy complete.",
      refreshHints: { map: true }
    }, { showToast, refreshAfterAction });

    expect(result.kind).toBe("spy");
    expect(showToast).toHaveBeenCalledWith("Spy complete.", "success");
    expect(refreshAfterAction).toHaveBeenCalledWith(expect.objectContaining({ showToast }), { map: true });

    const error = handleActionError(new Error("Boom"), { showToast });
    expect(error).toMatchObject({ kind: "error", ok: false, tone: "warning", message: "Boom" });
  });

  it("provides typed action result handlers", () => {
    expect(handleProductionResult({}, {}).kind).toBe("production");
    expect(handleCraftResult({}, {}).kind).toBe("craft");
    expect(handleMarketResult({}, {}).kind).toBe("market");
    expect(handleSpyResult({}, {}).kind).toBe("spy");
    expect(handleAttackResult({}, {}).kind).toBe("attack");
    expect(handlePoliceResult({}, {}).kind).toBe("police");
  });
});
