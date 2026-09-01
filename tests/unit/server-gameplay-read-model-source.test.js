// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const SOURCE_MODULE = "../../page-assets/js/app/runtime/serverGameplayReadModelSource.js";

const readModel = (stateVersion, cityEvents = null, status = "running") => ({
  server: { serverInstanceId: "instance:source", stateVersion, status },
  player: {
    playerId: "player:source",
    instanceId: "instance:source",
    cityEvents
  }
});

describe("server gameplay read-model source", () => {
  beforeEach(() => {
    vi.resetModules();
    document.documentElement.dataset.gameplayExecutionMode = "server-authoritative";
    delete window.empireStreetsGameplaySliceReadModel;
    delete window.EmpireGameplaySliceClient;
  });

  afterEach(() => {
    delete document.documentElement.dataset.gameplayExecutionMode;
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

  it("reports command readiness only for a running server lifecycle", async () => {
    const source = await import(SOURCE_MODULE);

    source.setServerGameplaySliceReadModel(readModel(1, null, "lobby"));
    expect(source.isServerGameplaySourceReady()).toBe(false);

    source.setServerGameplaySliceReadModel(readModel(1, null, "running"));
    expect(source.isServerGameplaySourceReady()).toBe(true);
  });

  it("rejects stale Heat and preserves Heat missing from a partial response", async () => {
    const source = await import(SOURCE_MODULE);
    source.setServerGameplaySliceReadModel({
      ...readModel(51),
      player: { ...readModel(51).player, police: { heat: 122, wantedLevel: 2 } }
    });

    expect(source.setServerGameplaySliceReadModel({
      ...readModel(50),
      player: { ...readModel(50).player, police: { heat: 2, wantedLevel: 2 } }
    })).toBe(false);
    expect(source.getServerGameplaySliceReadModel().player.police.heat).toBe(122);

    source.setServerGameplaySliceReadModel({
      ...readModel(51),
      player: { ...readModel(51).player, police: { wantedLevel: 2 } }
    });
    expect(source.getServerGameplaySliceReadModel().player.police.heat).toBe(122);
  });

  it("clears the prior player scope when the source is destroyed", async () => {
    const source = await import(SOURCE_MODULE);
    source.mountServerGameplaySource(document);
    source.setServerGameplaySliceReadModel(readModel(4));

    expect(source.destroyServerGameplaySource()).toBe(true);
    expect(source.getServerGameplaySliceReadModel()).toBeNull();
    expect(window.empireStreetsGameplaySliceReadModel).toBeUndefined();
  });
});
