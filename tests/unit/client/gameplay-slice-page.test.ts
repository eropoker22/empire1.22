import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import { persistServerConfirmedGameplaySliceFocus } from "../../../apps/client/src/browser/gameplay-slice-page";

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
