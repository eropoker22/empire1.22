import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "../../page-assets/js/config.js";
import {
  getCurrentPlayerFactionId,
  getFactionActionForPlayer
} from "../../page-assets/js/app/faction-actions-runtime.js";

function createStorage(session) {
  return {
    getItem(key) {
      return key === STORAGE_KEYS.session ? JSON.stringify(session) : null;
    }
  };
}

describe("faction actions runtime", () => {
  it("shows only the current player's faction action", () => {
    const action = getFactionActionForPlayer(createStorage({
      registration: {
        factionId: "hackeri"
      }
    }));

    expect(action).toMatchObject({
      factionId: "hackeri",
      name: "Hackeři",
      code: "Grid Breach"
    });
  });

  it("prefers selectedFaction from the locked registration", () => {
    const storage = createStorage({
      registration: {
        factionId: "mafian",
        selectedFaction: "korporace"
      }
    });

    expect(getCurrentPlayerFactionId(storage)).toBe("korporace");
    expect(getFactionActionForPlayer(storage)).toMatchObject({
      factionId: "korporace",
      code: "Legal Cover"
    });
  });
});
