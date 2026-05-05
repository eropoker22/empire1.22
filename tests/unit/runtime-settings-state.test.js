import { describe, expect, it } from "vitest";
import {
  createSettingsStateRuntime,
  normalizeMapVisibilityMode,
  normalizeSettingsState
} from "../../page-assets/js/app/runtime/settingsState.js";

describe("runtime settings state", () => {
  it("normalizes partial settings with stable fallbacks", () => {
    expect(normalizeMapVisibilityMode("bad-value")).toBe("all");
    expect(normalizeSettingsState({
      language: "en",
      mapDistrictBorders: 0,
      mapVisibilityMode: "hide-enemies"
    })).toMatchObject({
      language: "en",
      mapDistrictBorders: false,
      mapVisibilityMode: "hide-enemies"
    });
  });

  it("loads, saves, and applies settings without requiring real DOM", () => {
    let saved = null;
    const events = [];
    const documentRef = {
      documentElement: { dataset: {}, lang: "" },
      dispatchEvent: (event) => events.push(event)
    };
    class FakeCustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init.detail;
      }
    }
    const runtime = createSettingsStateRuntime({
      loadSettingsState: () => ({ reducedMapEffects: true }),
      saveSettingsState: (settings) => {
        saved = settings;
      },
      documentRef,
      CustomEventCtor: FakeCustomEvent
    });

    expect(runtime.getSettingsState().reducedMapEffects).toBe(true);
    const applied = runtime.applySettingsState({ language: "en", mapVisibilityMode: "only-player" });

    expect(saved).toEqual(applied);
    expect(documentRef.documentElement.dataset.mapVisibilityMode).toBe("only-player");
    expect(events[0].type).toBe("empire:settings-changed");
  });
});
