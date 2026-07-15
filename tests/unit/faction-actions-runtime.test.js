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
      code: "Výpadek systému",
      canRun: false
    });
    expect(action.effect).toContain("v této verzi ho zatím nelze spustit");
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
      name: "Korporát",
      code: "Právní štít",
      canRun: false
    });
  });

  it("shows private army action as preview-only", () => {
    const action = getFactionActionForPlayer(createStorage({
      registration: {
        factionId: "soukroma-armada"
      }
    }));

    expect(action).toMatchObject({
      factionId: "soukroma-armada",
      name: "Soukromá armáda",
      code: "Taktické nasazení",
      canRun: false
    });
    expect(action.effect).toContain("v této verzi ho zatím nelze spustit");
  });

  it("shows Kartel action as preview-only", () => {
    const action = getFactionActionForPlayer(createStorage({
      registration: {
        factionId: "kartel"
      }
    }));

    expect(action).toMatchObject({
      factionId: "kartel",
      name: "Kartel",
      code: "Noční zásilka",
      canRun: false
    });
    expect(action.effect).toContain("v této verzi ho zatím nelze spustit");
  });

  it("shows secret organization action as preview-only", () => {
    const action = getFactionActionForPlayer(createStorage({
      registration: {
        factionId: "tajna-organizace"
      }
    }));

    expect(action).toMatchObject({
      factionId: "tajna-organizace",
      name: "Tajná organizace",
      code: "Spící buňka",
      canRun: false
    });
    expect(action.effect).toContain("v této verzi ho zatím nelze spustit");
  });

  it("shows hacker action as preview-only", () => {
    const action = getFactionActionForPlayer(createStorage({
      registration: {
        factionId: "hackeri"
      }
    }));

    expect(action).toMatchObject({
      factionId: "hackeri",
      name: "Hackeři",
      code: "Výpadek systému",
      canRun: false
    });
    expect(action.effect).toContain("v této verzi ho zatím nelze spustit");
  });
});
