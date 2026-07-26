// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServerGameplayMarketController
} from "../../page-assets/js/app/ui/serverGameplayMarketController.js";
import {
  createServerMarketCommand
} from "../../page-assets/js/app/ui/serverGameplayMarketViewModel.js";

describe("server gameplay market controller", () => {
  beforeEach(() => {
    document.body.innerHTML = createFixture();
    window.confirm = vi.fn(() => true);
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("maps every market surface action to the canonical server command", () => {
    expect(createServerMarketCommand({
      action: "buy",
      resourceId: "metal-parts",
      amount: 2,
      marketType: "black",
      paymentType: "dirtyCash"
    })).toEqual({
      type: "buy-market-resource",
      payload: {
        resourceId: "metal-parts",
        amount: 2,
        marketType: "black",
        paymentType: "dirtyCash"
      }
    });
    expect(createServerMarketCommand({
      action: "sell",
      resourceId: "metal-parts",
      amount: 3
    })).toEqual({
      type: "sell-market-resource",
      payload: { resourceId: "metal-parts", amount: 3 }
    });
    expect(createServerMarketCommand({
      action: "create-listing",
      resourceId: "metal-parts",
      amount: 4,
      unitPrice: 550,
      paymentType: "cleanCash"
    })).toEqual({
      type: "create-player-market-listing",
      payload: {
        resourceId: "metal-parts",
        amount: 4,
        unitPrice: 550,
        paymentType: "cleanCash"
      }
    });
    expect(createServerMarketCommand({
      action: "buy-listing",
      listingId: "listing:peer"
    })).toEqual({
      type: "buy-player-market-listing",
      payload: { listingId: "listing:peer" }
    });
    expect(createServerMarketCommand({
      action: "cancel-listing",
      listingId: "listing:self"
    })).toEqual({
      type: "cancel-player-market-listing",
      payload: { listingId: "listing:self" }
    });
  });

  it("does not import local simulation or create controller timers", () => {
    const source = readFileSync(resolve(
      process.cwd(),
      "page-assets/js/app/ui/serverGameplayMarketController.js"
    ), "utf8");
    expect(source).not.toMatch(/runtime\.js|marketState|marketDataSource|localStorage/u);
    expect(source).not.toMatch(/setInterval|setTimeout|requestAnimationFrame/u);
  });

  it("renders lazily and ignores read-model changes outside market inputs", () => {
    const source = { submitCommand: vi.fn() };
    const controller = createController(source);
    expect(controller.mount()).toBe(true);
    expect(controller.mount()).toBe(false);
    const initialReadModel = createReadModel();
    controller.update(initialReadModel);

    expect(controller.getDiagnostics().renders).toBe(0);
    expect(document.querySelector("[data-market-list]").children).toHaveLength(0);

    document.querySelector("[data-market-popup-open]").click();
    expect(controller.getDiagnostics().renders).toBe(1);
    expect(document.querySelectorAll(".market-popup-row")).toHaveLength(1);
    expect(document.querySelector("[data-market-popup]").dataset.marketAuthoritative).toBe("true");

    const sameMarket = structuredClone(initialReadModel);
    sameMarket.district = { districtId: "district:changed" };
    controller.update(sameMarket);
    expect(controller.getDiagnostics().renders).toBe(1);
    controller.destroy();
  });

  it("submits a buy and applies its response read model immediately", async () => {
    const responseModel = createReadModel();
    responseModel.market.resources[0].normalMarket.stock = 6;
    responseModel.market.resources[0].normalMarket.stockPercent = 60;
    const source = {
      submitCommand: vi.fn().mockResolvedValue({ accepted: true, readModel: responseModel })
    };
    let controller;
    const onReadModel = vi.fn((readModel) => controller.update(readModel));
    controller = createController(source, onReadModel);
    controller.mount();
    controller.update(createReadModel());
    controller.open();

    const quantity = document.querySelector(".market-popup-row__quantity");
    quantity.value = "2";
    quantity.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector(".market-popup-row__buy").click();
    await vi.waitFor(() => expect(source.submitCommand).toHaveBeenCalledTimes(1));

    expect(source.submitCommand).toHaveBeenCalledWith({
      type: "buy-market-resource",
      payload: {
        resourceId: "metal-parts",
        amount: 2,
        marketType: "normal",
        paymentType: "cleanCash"
      }
    });
    expect(onReadModel).toHaveBeenCalledWith(responseModel);
    expect(document.querySelector(".market-popup-row__stock").getAttribute("aria-label")).toBe("Stock 6/10");
    await vi.waitFor(() => {
      expect(document.querySelector("[data-market-feedback]").textContent).toContain("Trh vydal");
    });
    controller.destroy();
  });

  it("uses server escrow commands on the player-market tab and cleans listeners", async () => {
    const source = {
      submitCommand: vi.fn().mockResolvedValue({ accepted: true, readModel: createReadModel() })
    };
    const controller = createController(source);
    controller.mount();
    controller.update(createReadModel());
    controller.open();
    document.querySelector('[data-market-tab="player-market"]').click();

    expect(document.querySelector(".market-player")).not.toBeNull();
    document.querySelector(".market-player-sell-button").click();
    await vi.waitFor(() => expect(source.submitCommand).toHaveBeenCalledTimes(1));
    expect(source.submitCommand.mock.calls[0][0]).toMatchObject({
      type: "create-player-market-listing",
      payload: {
        resourceId: "metal-parts",
        amount: 1,
        paymentType: "cleanCash"
      }
    });

    controller.close();
    expect(controller.destroy()).toBe(true);
    document.querySelector("[data-market-popup-open]").click();
    expect(document.querySelector("[data-market-popup]").hidden).toBe(true);
  });
});

function createController(source, onReadModel) {
  return createServerGameplayMarketController({
    root: document.querySelector("#game-root"),
    source,
    onReadModel,
    documentRef: document,
    windowRef: window
  });
}

function createReadModel() {
  return {
    district: { districtId: "district:1" },
    player: {
      playerId: "player:1",
      instanceId: "instance:1",
      resourceBalances: { "metal-parts": 8 },
      economy: {
        cleanCash: 5000,
        dirtyCash: 2500,
        resources: { "metal-parts": 8 }
      }
    },
    market: {
      mode: "free",
      resources: [{
        id: "metal-parts",
        name: "Kovové díly",
        category: "combat_material",
        trend: "flat",
        normalMarket: {
          available: true,
          price: 450,
          sellPrice: 220,
          stock: 8,
          maxStock: 10,
          stockPercent: 80,
          canBuy: true,
          canSell: true
        },
        blackMarket: {
          available: true,
          price: 700,
          dirtyCashPrice: 900,
          heatRisk: 1,
          canBuyWithCleanCash: true,
          canBuyWithDirtyCash: true
        }
      }],
      blackMarket: { refreshesAt: Date.now() + 60_000, heatByValue: [] },
      playerMarket: {
        listings: [],
        ownListingCount: 0,
        listingLimitPerSeller: 5
      },
      recentTransactions: []
    }
  };
}

function createFixture() {
  return `<main id="game-root">
    <button data-market-popup-open>Bazar</button>
    <div data-market-popup hidden>
      <button data-market-popup-close>Zavřít</button>
      <h3 data-market-title data-mobile-title="Market">Městský market</h3>
      <button data-market-tab="market" class="is-active">Market</button>
      <button data-market-tab="black-market">Černý trh</button>
      <button data-market-tab="player-market">Hráčský bazar</button>
      <div data-market-dashboard></div>
      <p data-market-copy></p>
      <p data-market-feedback></p>
      <div data-market-list></div>
    </div>
  </main>`;
}
