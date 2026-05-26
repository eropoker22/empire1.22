import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import { createInitialClientRenderState } from "../../../apps/client/src/app/client-render-state";
import {
  persistServerConfirmedGameplaySliceFocus,
  renderGameplaySliceStatus
} from "../../../apps/client/src/browser/gameplay-slice-page";
import { renderTopBarShell } from "../../../apps/client/src/ui/top-bar/top-bar-shell";

const createStorage = (initialValue: unknown) => {
  const store = new Map<string, string>([
    ["empireStreets.session.v1", JSON.stringify(initialValue)]
  ]);

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    }
  } as Storage;
};

describe("gameplay slice page storage cache", () => {
  it("stores server-confirmed home district as cache after load", () => {
    const storage = createStorage({
      registration: {
        identity: "Host Alpha",
        preferredStartDistrictId: 27,
        startDistrictId: 27
      }
    });

    persistServerConfirmedGameplaySliceFocus(storage, undefined, {
      player: {
        homeDistrictId: "district:spawn:1"
      },
      district: {
        districtId: "district:spawn:1"
      }
    } as GameplaySliceView);

    expect(JSON.parse(storage.getItem("empireStreets.session.v1")!)).toMatchObject({
      registration: {
        preferredStartDistrictId: 27,
        startDistrictId: 27,
        assignedHomeDistrictId: "district:spawn:1",
        lastServerConfirmedDistrictId: "district:spawn:1"
      }
    });
  });

  it("stores server-confirmed faction as cache after load", () => {
    const storage = createStorage({
      registration: {
        identity: "Host Alpha",
        factionId: "not-a-real-faction",
        selectedFaction: "not-a-real-faction"
      }
    });

    persistServerConfirmedGameplaySliceFocus(storage, undefined, {
      player: {
        homeDistrictId: "district:spawn:1",
        factionId: "mafian"
      },
      district: {
        districtId: "district:spawn:1"
      }
    } as GameplaySliceView);

    expect(JSON.parse(storage.getItem("empireStreets.session.v1")!)).toMatchObject({
      registration: {
        factionId: "mafian",
        selectedFaction: "mafian",
        serverConfirmedFactionId: "mafian",
        assignedHomeDistrictId: "district:spawn:1",
        lastServerConfirmedDistrictId: "district:spawn:1"
      }
    });
  });
});

describe("gameplay slice page fallback cells", () => {
  it("omits projection loading and transport error cells from game status html", () => {
    const html = renderGameplaySliceStatus({
      ...createInitialClientRenderState(),
      connection: {
        status: "error",
        lastErrorMessage: "Unable to load gameplay slice from server.",
        staleData: true
      },
      errors: [
        {
          code: "client.transport_error",
          message: "Unable to load gameplay slice from server."
        }
      ]
    });

    expect(html).toBe("");
    expect(html).not.toContain("error");
    expect(html).not.toContain("Waiting for district projection");
    expect(html).not.toContain("Unable to load gameplay slice from server.");
  });

  it("omits the player projection loading header", () => {
    expect(renderTopBarShell({ player: null })).toBe("");
  });
});
