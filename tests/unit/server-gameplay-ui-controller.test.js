// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createServerGameplayProfileController,
  createServerPlayerProfileView
} from "../../page-assets/js/app/ui/serverGameplayProfileController.js";
import { createServerGameplayUiController } from "../../page-assets/js/app/ui/serverGameplayUiController.js";

describe("server gameplay presentation UI controller", () => {
  beforeEach(() => {
    resetOverlayCoordinator();
    document.body.innerHTML = createUiFixture();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("builds player profile labels only from the server read model", () => {
    const view = createServerPlayerProfileView(createReadModel());

    expect(view).toMatchObject({
      identityLabel: "Neon Erik",
      factionLabel: "Hackeři",
      serverLabel: "instance:free:1",
      cleanMoneyLabel: expect.stringContaining("1"),
      dirtyMoneyLabel: expect.stringContaining("450"),
      influenceLabel: "72",
      allianceLabel: "Night",
      gangLabel: "Night Runners",
      districtCountLabel: "1",
      heatLabel: "18",
      protectionLabel: "Ochrana 25 %",
      avatarSrc: expect.stringContaining("/img/avatars/Hacker/")
    });
  });

  it("mounts once, subscribes once and updates only changed topbar fields", () => {
    const source = createReadModelSource(createReadModel());
    const controller = createServerGameplayUiController({
      root: document.querySelector("#game-root"),
      source,
      documentRef: document,
      windowRef: window
    });

    expect(controller.mount()).toBe(true);
    expect(controller.mount()).toBe(false);
    expect(source.listenerCount()).toBe(1);
    expect(compactText("[data-topbar-clean-money]")).toBe("$1200");
    expect(compactText("[data-topbar-dirty-money]")).toBe("$450");
    expect(compactText("[data-topbar-influence]")).toBe("72");

    const writesBeforeSameModel = controller.getDiagnostics().selectiveDomWrites;
    source.emit(clone(createReadModel()));
    expect(controller.getDiagnostics().selectiveDomWrites).toBe(writesBeforeSameModel);

    const changed = createReadModel();
    changed.player.economy.cleanCash = 1300;
    source.emit(changed);
    expect(compactText("[data-topbar-clean-money]")).toBe("$1300");
    expect(compactText("[data-player-popup-clean-money]")).toBe("$1200");

    document.querySelector("[data-player-profile-open]").click();
    expect(document.querySelector("[data-player-popup]").hidden).toBe(false);
    expect(compactText("[data-player-popup-clean-money]")).toBe("$1300");
    expect(document.querySelector("[data-player-popup-name]").textContent).toBe("Neon Erik");

    expect(controller.destroy()).toBe(true);
    expect(controller.destroy()).toBe(false);
    expect(source.listenerCount()).toBe(0);
  });

  it("renders storage lazily and changes only authoritative row values", () => {
    const source = createReadModelSource(createReadModel());
    const controller = createServerGameplayUiController({
      root: document.querySelector("#game-root"),
      source,
      documentRef: document,
      windowRef: window
    });
    controller.mount();
    const storage = document.querySelector("[data-storage-popup]");

    expect(document.querySelector('[data-storage-resource="pistol"] [data-storage-value]').textContent).toBe("0");
    document.querySelector("[data-storage-popup-open]").click();
    expect(storage.hidden).toBe(false);
    expect(storage.parentElement).toBe(document.body);
    expect(document.querySelector('[data-storage-resource="pistol"] [data-storage-value]').textContent).toBe("3 / 10");
    expect(document.querySelector('[data-storage-resource="metal-parts"] [data-storage-value]').textContent).toBe("8 / 20");

    const writesBefore = controller.getDiagnostics().selectiveDomWrites;
    source.emit(clone(createReadModel()));
    expect(controller.getDiagnostics().selectiveDomWrites).toBe(writesBefore);

    const changed = createReadModel();
    changed.player.storage.groups[0].items[0].currentAmount = 4;
    source.emit(changed);
    expect(document.querySelector('[data-storage-resource="pistol"] [data-storage-value]').textContent).toBe("4 / 10");
    expect(document.querySelector('[data-storage-resource="metal-parts"] [data-storage-value]').textContent).toBe("8 / 20");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(storage.hidden).toBe(true);
    controller.destroy();
  });

  it("removes named listeners and the source subscription on pagehide", () => {
    const source = createReadModelSource(createReadModel());
    const submitCommand = vi.fn();
    source.submitCommand = submitCommand;
    const controller = createServerGameplayUiController({
      root: document.querySelector("#game-root"),
      source,
      documentRef: document,
      windowRef: window
    });
    controller.mount();
    window.dispatchEvent(new Event("pagehide"));

    expect(controller.getDiagnostics().mounted).toBe(false);
    expect(source.listenerCount()).toBe(0);
    document.querySelector("[data-storage-popup-open]").click();
    expect(document.querySelector("[data-storage-popup]").hidden).toBe(true);
    expect(submitCommand).not.toHaveBeenCalled();
  });

  it("keeps profile mount and destroy idempotent in isolation", () => {
    const controller = createServerGameplayProfileController({
      root: document.querySelector("#game-root"),
      documentRef: document
    });
    expect(controller.mount()).toBe(true);
    expect(controller.mount()).toBe(false);
    controller.update(createReadModel());
    expect(controller.destroy()).toBe(true);
    expect(controller.destroy()).toBe(false);
  });
});

function createReadModelSource(initialReadModel) {
  let currentReadModel = initialReadModel;
  const listeners = new Set();
  return {
    getCurrentReadModel: () => currentReadModel,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    emit(readModel) {
      currentReadModel = readModel;
      for (const listener of listeners) listener(readModel);
    },
    listenerCount: () => listeners.size
  };
}

function createReadModel() {
  return {
    server: { serverInstanceId: "instance:free:1" },
    leaderboard: {
      currentPlayer: {
        playerId: "player:1",
        name: "Neon Erik",
        allianceTag: "Night",
        score: 1234,
        isCurrentPlayer: true
      },
      entries: []
    },
    police: {
      heat: 18,
      protection: { raidConsequenceMultiplier: 0.75, sources: ["district"] }
    },
    districts: [
      { districtId: "district:1", ownerPlayerId: "player:1", isOwnedByPlayer: true },
      { districtId: "district:2", ownerPlayerId: "player:2", isOwnedByPlayer: false }
    ],
    player: {
      playerId: "player:1",
      instanceId: "instance:free:1",
      factionId: "hackeri",
      color: "#22d3ee",
      profile: {
        displayName: "Neon Erik",
        gangName: "Night Runners",
        avatarId: "hackeri:1"
      },
      faction: { name: "Hackeři", uiTheme: { accent: "#22d3ee" } },
      alliance: { allianceName: "Night" },
      resourceBalances: { pistol: 3, "metal-parts": 8 },
      economy: {
        cleanCash: 1200,
        dirtyCash: 450,
        influence: 72,
        resources: {},
        materials: { "metal-parts": 8 },
        drugs: {},
        weapons: { pistol: 3 }
      },
      storage: {
        groups: [{
          id: "bulk",
          items: [
            storageItem("pistol", 3, 10),
            storageItem("metal-parts", 8, 20)
          ]
        }]
      }
    }
  };
}

function storageItem(resourceKey, currentAmount, maxAmount) {
  return {
    resourceKey,
    currentAmount,
    maxAmount,
    isNearCapacity: false,
    isFull: false,
    isOverCapacity: false
  };
}

function createUiFixture() {
  return `<main id="game-root">
    <span class="resource-pill"><strong data-topbar-clean-money>—</strong></span>
    <span class="resource-pill"><strong data-topbar-dirty-money>—</strong></span>
    <strong data-topbar-influence>—</strong>
    <button data-player-profile-open>Profil</button>
    <button data-storage-popup-open>Sklad</button>
    <div data-player-popup hidden><button data-player-popup-close>Zavřít</button>
      <section data-player-popup-card><img data-player-popup-avatar><span data-player-popup-avatar-fallback></span>
        <strong data-player-popup-name></strong><strong data-player-popup-identity></strong>
        <strong data-player-popup-faction></strong><strong data-player-popup-server></strong>
        <strong data-player-popup-empire-score></strong><strong data-player-popup-clean-money></strong>
        <strong data-player-popup-dirty-money></strong><strong data-player-popup-influence></strong>
        <strong data-player-popup-heat></strong><strong data-player-popup-protection></strong>
        <strong data-player-popup-gang></strong><strong data-player-popup-alliance></strong>
        <strong data-player-popup-districts></strong>
      </section>
    </div>
    <div data-storage-popup hidden><button data-storage-popup-close>Zavřít</button>
      <section class="storage-popup-card">
        <p data-storage-resource="pistol"><span data-storage-value>0</span></p>
        <p data-storage-resource="metal-parts"><span data-storage-value>0</span></p>
      </section>
    </div>
  </main>`;
}

function compactText(selector) {
  return document.querySelector(selector).textContent.replace(/\s/gu, "");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function resetOverlayCoordinator() {
  const state = globalThis[Symbol.for("empire.legacyOverlayCoordinator.state")];
  if (!state) return;
  state.overlayStack.splice(0);
  state.suppressionStartedAt = 0;
  state.suppressMapInputUntil = 0;
}
