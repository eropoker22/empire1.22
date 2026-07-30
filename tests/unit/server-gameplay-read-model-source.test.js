// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SOURCE_MODULE = "../../page-assets/js/app/runtime/serverGameplayReadModelSource.js";

const readModel = (stateVersion, cityEvents = null) => ({
  server: { stateVersion },
  player: {
    playerId: "player:source",
    instanceId: "instance:source",
    cityEvents
  }
});

describe("server gameplay read-model source", () => {
  beforeEach(() => {
    vi.resetModules();
    delete window.empireStreetsGameplaySliceReadModel;
    delete window.EmpireGameplaySliceClient;
  });

  afterEach(() => {
    delete window.empireStreetsGameplaySliceReadModel;
    delete window.EmpireGameplaySliceClient;
  });

  it("hydrates from a gameplay client that rendered before the source mounted", async () => {
    const current = readModel(4, { agents: [{ agentId: "victor", offers: [{}] }] });
    window.EmpireGameplaySliceClient = {
      getCurrentReadModel: () => current
    };
    const source = await import(SOURCE_MODULE);

    expect(source.mountServerGameplaySource(document)).toBe(true);
    expect(source.getServerGameplaySliceReadModel()).toBe(current);
    expect(window.empireStreetsGameplaySliceReadModel).toBe(current);
  });

  it("prefers a newer gameplay client model over an older mirrored window model", async () => {
    const stale = readModel(2);
    const current = readModel(3, { agents: [] });
    window.empireStreetsGameplaySliceReadModel = stale;
    window.EmpireGameplaySliceClient = {
      getCurrentReadModel: () => current
    };
    const source = await import(SOURCE_MODULE);

    expect(source.getServerGameplaySliceReadModel()).toBe(current);
    expect(window.empireStreetsGameplaySliceReadModel).toBe(current);
  });
});
