// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveClientSurfaceAction } from "../../apps/client/src/app/client-surface-action-resolver";
import {
  createServerGameplayDistrictSurfaceActionDispatcher
} from "../../page-assets/js/app/ui/serverGameplayDistrictSurfaceActionDispatcher.js";

describe("server gameplay district surface action dispatcher", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <main data-gameplay-slice-client></main>
      <section data-district-popup></section>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("bridges exact projected building inputs into the typed client action", async () => {
    const handleSurfaceAction = vi.fn(async (target) => resolveClientSurfaceAction(target));
    const onDispatch = vi.fn();
    const onResponse = vi.fn();
    const dispatcher = createServerGameplayDistrictSurfaceActionDispatcher({
      documentRef: document,
      getElements: () => ({ popup: document.querySelector("[data-district-popup]") }),
      isMounted: () => true,
      onDispatch,
      onResponse,
      source: { handleSurfaceAction }
    });

    const response = await dispatcher({
      buildingActionBuildingId: "building:district-79:stock-exchange:1",
      buildingActionDistrictId: "district:79",
      buildingActionId: "speculative_buy",
      buildingActionInputs: {
        targetCategory: "electronics",
        investmentCleanCash: 2750,
        mode: "pump",
        targetZone: "downtown",
        dealerSlotId: "slot-2",
        itemId: "pulse-shot",
        amount: 12
      }
    });

    expect(response).toEqual({
      kind: "building-action",
      buildingId: "building:district-79:stock-exchange:1",
      actionId: "speculative_buy",
      dealerSlotId: "slot-2",
      itemId: "pulse-shot",
      amount: 12,
      targetCategory: "electronics",
      mode: "pump",
      investmentCleanCash: 2750,
      targetZone: "downtown"
    });
    expect(onDispatch).toHaveBeenCalledTimes(1);
    expect(onResponse).toHaveBeenCalledWith(response);
    expect(handleSurfaceAction).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-gameplay-slice-client]").children).toHaveLength(0);
  });
});
