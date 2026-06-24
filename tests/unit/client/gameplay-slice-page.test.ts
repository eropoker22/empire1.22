import { describe, expect, it } from "vitest";
import type { GameplaySliceView } from "@empire/shared-types";
import { createClientApp } from "../../../apps/client/src/app";
import { createInitialClientRenderState } from "../../../apps/client/src/app/client-render-state";
import {
  persistServerConfirmedGameplaySliceFocus,
  renderGameplaySliceStatus,
  setGameplayRuntimeMarker
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
  it("treats a load response without a read model as a runtime error", async () => {
    const client = createClientApp({
      transport: {
        load: async () => ({
          accepted: false,
          readModel: null,
          errors: [
            {
              code: "transport.not_found",
              message: "Gameplay slice endpoint was not found."
            }
          ]
        }),
        send: async () => ({
          accepted: false,
          readModel: null,
          errors: []
        })
      }
    });

    const state = await client.load({
      serverInstanceId: "instance:test",
      playerId: "player:test",
      factionId: "mafian"
    });

    expect(state.connection.status).toBe("error");
    expect(state.connection.lastErrorMessage).toBe("Gameplay slice endpoint was not found.");
    expect(client.getGameplaySlice()).toBeNull();
  });

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

describe("gameplay slice runtime marker", () => {
  it("writes a stable DOM marker for server-authoritative errors and legacy fallback", () => {
    const previousDocument = globalThis.document;
    const body = { dataset: {} as Record<string, string> };
    globalThis.document = { body } as unknown as Document;
    const root = { dataset: {} } as HTMLElement;

    try {
      setGameplayRuntimeMarker(root, "server-authoritative-error", {
        endpoint: "/api/gameplay-slice/load",
        error: "Gameplay slice request failed: POST /api/gameplay-slice/load returned HTTP 404.",
        fallback: "legacy"
      });

      expect(root.dataset.gameplayRuntime).toBe("server-authoritative-error");
      expect(root.dataset.gameplaySliceEndpoint).toBe("/api/gameplay-slice/load");
      expect(root.dataset.gameplayFallback).toBe("legacy");
      expect(body.dataset.gameplayRuntime).toBe("server-authoritative-error");
      expect(body.dataset.gameplayFallback).toBe("legacy");

      setGameplayRuntimeMarker(root, "server-authoritative-ready");

      expect(root.dataset.gameplayRuntime).toBe("server-authoritative-ready");
      expect(root.dataset.gameplayFallback).toBeUndefined();
      expect(body.dataset.gameplayRuntime).toBe("server-authoritative-ready");
      expect(body.dataset.gameplayFallback).toBeUndefined();
    } finally {
      globalThis.document = previousDocument;
    }
  });
});
