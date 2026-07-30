// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyLiveGameplayAuthorityState,
  prepareLiveGameplayBootstrap
} from "../../page-assets/js/app/runtime/liveGameplayBootstrap.js";

describe("live gameplay lifecycle authority", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <section data-game-authority-gate aria-hidden="false">
        <strong data-game-authority-status></strong>
        <p data-game-authority-message></p>
        <button data-game-authority-retry hidden></button>
      </section>
      <main id="game-root"></main>
      <div data-gameplay-slice-client></div>
    `;
    document.body.className = "";
    delete window.empireClientAuthorityState;
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.body.className = "";
    delete window.empireClientAuthorityState;
  });

  it("keeps lobby gameplay locked until the same server reports running", () => {
    prepareLiveGameplayBootstrap({
      status: "active",
      serverInstanceId: "instance:free:1",
      playerId: "player:1",
      reservedSpawnDistrictId: "district:21",
      factionId: "mafian"
    });

    expect(applyLiveGameplayAuthorityState(createSlice("lobby"))).toBe(true);
    expect(document.body.dataset.authorityState).toBe("waiting-for-start");
    expect(document.querySelector("#game-root").inert).toBe(true);
    expect(document.querySelector("#game-root").getAttribute("aria-busy")).toBe("true");
    expect(document.querySelector("[data-game-authority-status]").textContent)
      .toBe("SERVER ČEKÁ NA START");
    expect(window.empireClientAuthorityState).toMatchObject({
      serverReady: true,
      gameplayReady: false,
      reasonCode: "SERVER_WAITING_FOR_START"
    });

    expect(applyLiveGameplayAuthorityState(createSlice("running"))).toBe(true);
    expect(document.body.dataset.authorityState).toBe("ready");
    expect(document.body.classList.contains("game-body--booting")).toBe(false);
    expect(document.querySelector("#game-root").inert).toBe(false);
    expect(document.querySelector("#game-root").getAttribute("aria-busy")).toBe("false");
    expect(document.querySelector("[data-game-authority-gate]").getAttribute("aria-hidden")).toBe("true");
    expect(window.empireClientAuthorityState).toMatchObject({
      serverReady: true,
      gameplayReady: true,
      reasonCode: null
    });
  });

  it("fails closed when lifecycle metadata is missing", () => {
    expect(applyLiveGameplayAuthorityState(createSlice(undefined))).toBe(true);

    expect(document.body.dataset.authorityState).toBe("unavailable");
    expect(document.querySelector("#game-root").inert).toBe(true);
    expect(document.querySelector("[data-game-authority-status]").textContent)
      .toBe("ČEKÁM NA STAV SERVERU");
    expect(window.empireClientAuthorityState).toMatchObject({
      serverReady: false,
      gameplayReady: false,
      reasonCode: "SERVER_STATUS_PENDING"
    });
  });
});

const createSlice = (status) => ({
  server: {
    serverInstanceId: "instance:free:1",
    ...(status ? { status } : {})
  },
  player: {
    playerId: "player:1"
  }
});
