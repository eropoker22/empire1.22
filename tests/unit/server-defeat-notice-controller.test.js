// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  createServerDefeatNoticeController,
  createServerDefeatNoticeViewModel
} from "../../page-assets/js/app/ui/serverDefeatNoticeController.js";

let storage;

describe("server defeat notice controller", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    storage = createStorage();
  });

  it("creates distinct purge and last-district messages", () => {
    const purge = createServerDefeatNoticeViewModel(defeatedSlice("scheduled_weakest_player", 14));
    const territory = createServerDefeatNoticeViewModel(defeatedSlice("last_district_lost", null));

    expect(purge).toMatchObject({
      kind: "purge",
      title: "OČISTA TĚ VYŘADILA",
      code: "PURGE_ELIMINATION",
      finalPlacement: 14
    });
    expect(territory).toMatchObject({
      kind: "territory",
      title: "TVÉ IMPÉRIUM PADLO",
      code: "LAST_DISTRICT_LOST",
      finalPlacement: null
    });
    expect(territory.lockText).toContain("až po skončení tohoto právě probíhajícího serveru");
  });

  it("shows an authoritative notice once and remembers acknowledgement", () => {
    const controller = createServerDefeatNoticeController({
      documentRef: document,
      windowRef: window,
      storageRef: storage
    });
    controller.mount();

    expect(controller.update(defeatedSlice("scheduled_weakest_player", 14))).toBeGreaterThan(0);
    const notice = document.querySelector("[data-server-defeat-notice]");
    expect(notice.hidden).toBe(false);
    expect(notice.dataset.defeatKind).toBe("purge");
    expect(notice.querySelector("[data-server-defeat-title]").textContent).toBe("OČISTA TĚ VYŘADILA");
    expect(notice.querySelector("[data-server-defeat-preview-controls]")).toBeNull();

    notice.querySelector("[data-server-defeat-action]").click();
    expect(notice.hidden).toBe(true);
    expect(controller.update(defeatedSlice("scheduled_weakest_player", 14))).toBe(0);
    expect(notice.hidden).toBe(true);
    controller.destroy();
  });
});

function defeatedSlice(reason, finalPlacement) {
  return {
    server: { serverInstanceId: "instance:free:test" },
    elimination: {
      playerStatus: "defeated",
      currentPlayerStatus: "defeated",
      currentPlayerDefeat: {
        reason,
        eliminatedAtTick: 8640,
        finalPlacement
      }
    }
  };
}

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value))
  };
}
