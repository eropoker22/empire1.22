// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { beginActionSubmission } from "../../page-assets/js/app/runtime/actionSubmissionState.js";
import { renderRecipeCard } from "../../page-assets/js/app/ui/recipePanel.js";

describe("immediate gameplay action submission state", () => {
  it("records click to first feedback without session or identity data", () => {
    const button = document.createElement("button");
    const timestamps = [100, 101];
    const windowRef = {
      empireStreetsRuntimeDiagnostics: { debugEnabled: true },
      empireStreetsPerformanceMetrics: {},
      performance: { now: () => timestamps.shift() ?? 101, mark: vi.fn() }
    };

    beginActionSubmission(button, {
      actionType: "spy-district",
      requestFrame: vi.fn(),
      windowRef
    });

    expect(windowRef.empireStreetsPerformanceMetrics.lastGameplayActionLifecycle).toEqual({
      actionType: "spy-district",
      phases: {
        click: { elapsedFromClickMs: 0 },
        "first-feedback": { elapsedFromClickMs: 1 }
      }
    });
    expect(JSON.stringify(windowRef.empireStreetsPerformanceMetrics)).not.toMatch(/session|cookie|token|player/i);
  });

  it("shows submitting synchronously, blocks a duplicate, and restores on rejection", () => {
    const button = document.createElement("button");
    button.innerHTML = "<span>Potvrdit špionáž</span>";
    const requestFrame = vi.fn();

    const submission = beginActionSubmission(button, {
      actionType: "spy-district",
      submittingLabel: "Spouštím špionáž…",
      requestFrame
    });

    expect(submission).not.toBeNull();
    expect(button).toMatchObject({ disabled: true, textContent: "Spouštím špionáž…" });
    expect(button.dataset.state).toBe("submitting");
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(beginActionSubmission(button, { actionType: "spy-district" })).toBeNull();
    expect(requestFrame).toHaveBeenCalledTimes(1);

    submission.rejected();
    expect(button.disabled).toBe(false);
    expect(button.innerHTML).toBe("<span>Potvrdit špionáž</span>");
    expect(button.dataset.state).toBeUndefined();
  });

  it("transitions accepted submissions to pending without enabling the button", () => {
    const button = document.createElement("button");
    button.textContent = "Potvrdit útok";
    const submission = beginActionSubmission(button, {
      actionType: "attack-district",
      requestFrame: () => 1
    });

    submission.accepted("Útok probíhá");

    expect(button.disabled).toBe(true);
    expect(button.dataset.state).toBe("pending");
    expect(button.textContent).toBe("Útok probíhá");
  });

  it("shows queued production submitting before the server promise resolves", async () => {
    const mount = document.createElement("div");
    let resolveResponse;
    const onStart = vi.fn(() => new Promise((resolve) => {
      resolveResponse = resolve;
    }));
    const card = renderRecipeCard({
      authorityMode: "server-authoritative",
      buildingName: "pharmacy",
      recipeId: "chemicals",
      recipe: {
        name: "Chemicals",
        inputs: {},
        output: { inventory: "materials", itemId: "chemicals", amount: 1 },
        durationMs: 60_000
      },
      inputAmounts: {},
      maxBatches: 1,
      canStart: true
    }, { onStart }, { mount });
    const button = card.querySelector(".pharmacy-slot__btn--start");

    button.click();
    button.click();

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    expect(button.dataset.state).toBe("submitting");
    expect(button.textContent).toBe("Spouštím výrobu…");

    resolveResponse({ accepted: true });
    await Promise.resolve();
    expect(button.dataset.state).toBe("pending");
    expect(button.textContent).toBe("Výroba probíhá");
  });
});
